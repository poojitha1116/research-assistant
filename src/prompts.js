export function planPrompt(question) {
  const today = new Date().toISOString().slice(0, 10);
  return `You help plan web research. Today's date is ${today}.

Turn the user's question into 2 to 4 short web search queries that together cover the question from different angles (for example: the main comparison, recent developments, opinions or evidence). Keep each query under 10 words. Do not repeat the same query in different words.

Important: your own knowledge may be out of date. Never put a specific version number, release name or year in a query unless the question itself contains it. If the question asks about the "latest", "current" or "newest" version of something, include a query that finds out which version is current, for example "python.org latest release" or "<product> current version ${today.slice(0, 4)}".

Question: ${question}

Respond with JSON only, in exactly this shape:
{"queries": ["query one", "query two"]}`;
}

export function synthesisPrompt(question, sources) {
  const today = new Date().toISOString().slice(0, 10);
  const blocks = sources
    .map((s) => `[${s.id}] ${s.title} (${s.via === 'snippet' ? 'SEARCH SNIPPET ONLY, partial text' : 'full page'})\nURL: ${s.url}\n${s.text}`)
    .join('\n\n---\n\n');

  return `You are a careful research assistant. Today's date is ${today}.
Answer the question using ONLY the numbered sources below. Do not use outside knowledge.

Rules:
- Every key point must list the source numbers that support it.
- Ignore sources that are off-topic. Do not cite them.
- If sources disagree, describe the disagreement in "conflicts".
- If sources look outdated or undated, say so in "caveats".
- If the question asks about the latest, current or most recent version or state of something, check whether the sources really cover the newest one. If they only cover an older version, begin the summary by saying so, set "confidence" to "low", and do not present the older version as the answer.
- If the sources do not actually answer the question, set "answerable" to false, explain why in "summary", and leave "key_points" empty.
- "confidence" is "high" only if several relevant, current sources agree. Use "low" if the evidence is thin, dated or conflicting.

Question: ${question}

Sources:
${blocks}

Respond with JSON only, in exactly this shape:
{
  "answerable": true,
  "summary": "2-3 sentence direct answer",
  "key_points": [{"point": "a specific claim", "sources": [1, 3]}],
  "conflicts": ["where sources disagree, or leave the list empty"],
  "caveats": ["limits, stale sources, missing info"],
  "recommendation": "a short practical recommendation, or an empty string if not applicable",
  "confidence": "high | medium | low"
}`;
}