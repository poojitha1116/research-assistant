const key = process.env.TAVILY_API_KEY;

if (!key) {
  console.error('TAVILY_API_KEY is missing. Check your .env file.');
  process.exit(1);
}

const res = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
  body: JSON.stringify({ query: 'PyTorch vs JAX for ML research', max_results: 3 }),
});
const data = await res.json();

if (!res.ok) {
  console.error('Request failed:', res.status, JSON.stringify(data));
  process.exit(1);
}

for (const r of data.results) {
  console.log('-', r.title);
  console.log('  ', r.url);
  console.log('  snippet length:', r.content.length, 'chars');
}