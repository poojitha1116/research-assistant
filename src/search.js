const KEY = process.env.TAVILY_API_KEY;

export async function searchWeb(query, maxResults = 5) {
  if (!KEY) throw new Error('TAVILY_API_KEY is missing');

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ query, max_results: maxResults }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json();

  if (!res.ok) throw new Error(`Search ${res.status}: ${JSON.stringify(data)}`);

  return (data.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.content,
  }));
}