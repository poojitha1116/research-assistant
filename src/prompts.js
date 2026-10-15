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
    .map((s) => {
      const kind = s.official ? 'OFFICIAL SITE' : 'third-party';
      const body = s.via === 'snippet' ? 'SEARCH SNIPPET ONLY, partial text' : 'full page';
      return `[${s.id}] ${s.title} (${kind}, ${body})\nURL: ${s.url}\n${s.text}`;
    })
    .join('\n\n---\n\n');

  return `You are a careful research assistant. Today's date is ${today}.
Answer the question using ONLY the numbered sources below. Do not use outside knowledge.

Rules:
- Every key point must list the source numbers that support it.
- Ignore sources that are off-topic. Do not cite them.
- Sources marked OFFICIAL SITE come from the project's or vendor's own website. For current facts (such as which version is latest), they outrank every third-party source. If a third-party source contradicts an official one, do not use the third-party claim, and describe the disagreement in "conflicts".
- If sources disagree, describe the disagreement in "conflicts".
- Only state technical details (syntax, numbers, dates) that appear in the text of the source you cite.
- If sources look outdated or undated, say so in "caveats".
- If the question asks about the latest, current or most recent version or state of something, check whether the sources really cover the newest one. If they only cover an older version, begin the summary by saying so, set "confidence" to "low", and do not present the older version as the answer.
- If the question asks about a "latest release", distinguish a version that has been released (stable) from one still in development or pre-release, and say clearly which one the sources describe.
- Prefer full-page sources. Do not use "high" confidence if an important claim rests only on snippet-only sources.
- Split the question into the things it asks for. List every part that the sources do NOT answer in "missing_parts". Do not fill that gap with information about a different version, topic or time period: mention it only as background, and say so.
- Set "answerable" to false only if the sources contain nothing relevant to the question. If they answer part of it, keep "answerable" true, put what they do support in "key_points", and list the rest in "missing_parts".
- "confidence" is "high" only if several relevant, current sources agree and "missing_parts" is empty. Use "low" if the evidence is thin, dated or conflicting.

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
  "missing_parts": ["parts of the question the sources do not answer, or leave the list empty"],
  "recommendation": "a short practical recommendation, or an empty string if not applicable",
  "confidence": "high | medium | low"
}`;
}