const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL;

if (!key || !model) {
  console.error('GEMINI_API_KEY or GEMINI_MODEL is missing. Check your .env file.');
  process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify({
    contents: [{ parts: [{ text: 'Reply with exactly: LLM connection works' }] }],
  }),
});
const data = await res.json();

if (!res.ok) {
  console.error('Request failed:', res.status, data.error?.message);
  process.exit(1);
}

const parts = data.candidates?.[0]?.content?.parts ?? [];
console.log(parts.map((p) => p.text ?? '').join(''));
