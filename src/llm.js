const KEY = process.env.GEMINI_API_KEY;

// GEMINI_MODELS=a,b,c  (falls back to the older GEMINI_MODEL / GEMINI_FALLBACK_MODEL names)
const MODELS = (
  process.env.GEMINI_MODELS ||
  [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean).join(',')
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const exhausted = new Set(); // models that reported a quota error during this run

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callModel(model, prompt, json, retries) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (json) body.generationConfig = { responseMimeType: 'application/json' };

  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json();

      if (res.ok) {
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('');
        if (!text) throw new Error('LLM returned empty text');
        return text;
      }

      const msg = data.error?.message ?? 'request failed';
      const quota = res.status === 429 && /quota/i.test(msg);
      const err = new Error(`LLM ${res.status}: ${quota ? 'daily quota exceeded' : msg.slice(0, 120)}`);
      err.quota = quota;
      // A quota error will not fix itself in seconds, so do not retry it.
      err.retryable = !quota && (res.status === 429 || res.status >= 500);
      throw err;
    } catch (e) {
      lastError = e;
      const retryable = e.retryable ?? (e.name === 'TimeoutError' || e.name === 'TypeError');
      if (!retryable || attempt === retries) break;
      await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s
    }
  }
  throw lastError;
}

// Tries each configured model in order and moves on when one fails.
export async function callLLM(prompt, { json = false, retries = 2 } = {}) {
  if (!KEY || MODELS.length === 0) throw new Error('GEMINI_API_KEY or GEMINI_MODELS is missing');

  const errors = [];
  for (const model of MODELS) {
    if (exhausted.has(model)) continue;
    try {
      return await callModel(model, prompt, json, retries);
    } catch (e) {
      if (e.quota) exhausted.add(model);
      errors.push(`${model}: ${e.message}`);
    }
  }
  throw new Error(`All models failed. ${errors.join(' | ')}`);
}