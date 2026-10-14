const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error('GEMINI_API_KEY is missing. Check your .env file.');
  process.exit(1);
}

const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
  headers: { 'x-goog-api-key': key },
});
const data = await res.json();

if (!res.ok) {
  console.error('Request failed:', res.status, data.error?.message);
  process.exit(1);
}

for (const m of data.models) {
  if (m.supportedGenerationMethods?.includes('generateContent')) {
    console.log(m.name.replace('models/', ''));
  }
}