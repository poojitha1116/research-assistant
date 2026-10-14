export function planPrompt(question) {
  const today = new Date().toISOString().slice(0, 10);
  return `You help plan web research. Today's date is ${today}.

Turn the user's question into 2 to 4 short web search queries that together cover the question from different angles (for example: the main comparison, recent developments, opinions or evidence). Keep each query under 10 words. Do not repeat the same query in different words.

Question: ${question}

Respond with JSON only, in exactly this shape:
{"queries": ["query one", "query two"]}`;
}