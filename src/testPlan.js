import { planPrompt } from './prompts.js';

const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL;
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;
const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const q = 'Should a computer science student learn PyTorch or JAX first for ML research?';

async function run(label, prompt, generationConfig) {
  const t0 = Date.now();
  try {
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    if (generationConfig) body.generationConfig = generationConfig;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    console.log(`${label}: status ${res.status}, ${Date.now() - t0} ms`);
    console.log('   ', (text || data.error?.message || 'empty').slice(0, 120).replace(/\n/g, ' '));
  } catch (e) {
    console.log(`${label}: FAILED after ${Date.now() - t0} ms (${e.name})`);
  }
}

await run('A short prompt, plain      ', 'Reply with exactly: ok');
await run('B plan prompt, plain       ', planPrompt(q));
await run('C plan prompt, JSON mode   ', planPrompt(q), { responseMimeType: 'application/json' });
await run('D JSON mode + no thinking  ', planPrompt(q), {
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 0 },
});