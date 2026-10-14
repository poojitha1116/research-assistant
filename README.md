# Research Assistant

A command-line tool that answers a question by searching the web, reading the pages it finds, and writing a structured answer that cites its sources. Every run also saves a trace file that records each step, so you can see exactly what the system did.

```
npm run ask -- "Should a computer science student learn PyTorch or JAX first for ML research?"
```

The point of the project is retrieval: the LLM is told to answer **only** from the pages that were fetched, and to say so when they don't cover the question.

## How it works

```
Question
  |
  v
1. PLAN        LLM turns the question into 2-4 search queries
  |
  v
2. SEARCH      Tavily API returns URLs + snippets for each query
  |
  v
3. FETCH       Download each page, extract readable text (Readability + jsdom)
  |            If a page fails, fall back to its search snippet
  v
4. SYNTHESIZE  LLM reads ONLY the fetched text and returns a JSON answer
  |            Code then validates citations and caps confidence
  v
5. OUTPUT      Print answer + sources, save traces/<timestamp>.json
```

| File | Role |
|---|---|
| `src/index.js` | CLI entry point. Reads the question, runs the pipeline, prints the answer |
| `src/pipeline.js` | Runs plan, search and fetch. Merges results, removes duplicate URLs |
| `src/llm.js` | The only place that calls Gemini. Retries, timeouts, model rotation |
| `src/search.js` | Tavily search call |
| `src/fetchPage.js` | Downloads a page and extracts text. Failures are returned as data, never thrown |
| `src/prompts.js` | Planning prompt and synthesis prompt |
| `src/synthesize.js` | Calls the LLM for the answer, then runs the citation guard |
| `src/trace.js` | Records every step, prints live progress, saves JSON |
| `src/listModels.js`, `test*.js` | Small scripts used to check each service on its own |

No framework (LangChain etc.). The loop is about 300 lines of plain Node.js, which made it easy to see what was going wrong when something failed.

## Setup

**Requirements:** Node.js 22 or newer (uses built-in `fetch` and `--env-file`).

**API keys (both have free tiers):**
- Gemini: https://aistudio.google.com
- Tavily: https://tavily.com

```
git clone <this repo>
cd research-assistant
npm install
```

Copy `.env.example` to `.env` and fill it in:

```
GEMINI_API_KEY=your-key
GEMINI_MODELS=model-one,model-two,model-three
TAVILY_API_KEY=your-key
```

`GEMINI_MODELS` is a comma-separated list, tried in order. Model names change often, so list the ones your key can use:

```
npm run models
```

Pick a few `flash` models from the output. Using several matters, see "Problems I ran into".

**Check each service separately:**

```
npm run test:llm
npm run test:search
```

**Run a question:**

```
npm run ask -- "your question here"
```

The `--` is required so npm passes the question through. A run takes roughly 20-60 seconds.

## What a run looks like

Progress prints live:

```
  [3.8s] plan ok: 3 queries
  [6.0s] search ok: "python.org current version" -> 5 results
  [10.8s] fetch ok: https://www.python.org (1368 chars)
  [12.7s] sources: 8 total (8 pages, 0 snippets)
  [16.9s] synthesize ok (attempt 1): answerable=true, cited 3 sources, dropped 0 bad citations
```

Then the answer: summary, key points with `[n]` citations, where sources disagree, caveats, parts of the question the sources do not cover, a recommendation, confidence, and the list of sources actually cited.

## Trace files

Every run saves `traces/<timestamp>.json` (gitignored) with the question, every step with timings, errors, fallbacks and the final answer.

```json
{
  "question": "...",
  "steps": [
    { "step": "plan", "ok": true, "queries": ["..."], "ms": 3800 },
    { "step": "search", "query": "...", "ok": true, "results": 5, "urls": ["..."] },
    { "step": "fetch", "url": "...", "ok": false, "error": "HTTP 403", "fallback": "using search snippet" },
    { "step": "synthesize", "ok": true, "attempt": 1, "citedSources": [1, 4], "droppedCitations": [] }
  ],
  "answer": { "...": "..." }
}
```

Failures are in the trace as normal entries, which is how I diagnosed most of the problems below.

## Failure handling

| What goes wrong | What the system does |
|---|---|
| LLM returns 503 (overloaded) or times out | Retries with backoff, then moves to the next model in `GEMINI_MODELS` |
| LLM returns 429 daily quota exceeded | Does not retry. Marks that model as exhausted for the run and moves on |
| Planning fails | Falls back to using the question itself as the only search query |
| One search query fails | Logged, the others continue |
| A page returns 403, times out, or has too little text | Falls back to the search snippet for that URL, or drops it |
| LLM returns invalid JSON or no valid citations | Retries synthesis once, then prints the gathered sources without an answer |
| LLM cites a source number that does not exist | The citation guard removes it. A key point with no valid citation is dropped |
| Every model is unavailable | Prints the sources it gathered and saves the trace, instead of crashing |

## Safeguards on the answer

Beyond "answer only from the sources", some checks run in code, because a prompt rule can be ignored:

- **Citation guard:** cited numbers must match real sources.
- **Snippet cap:** if a key point rests only on search snippets, confidence is lowered and a caveat is added.
- **Missing-parts cap:** the model must list parts of the question the sources do not answer. If that list is not empty, confidence cannot be "high".
- **Not answerable:** if the sources do not address the question, the answer says so instead of guessing.

## Example questions and outputs

Saved in `examples/`.

| File | Question | What it tests |
|---|---|---|
| `1-comparison.txt` | Should a CS student learn PyTorch or JAX first for ML research? | A balanced, cited comparison |
| `2-factual.txt` | What is the capital of Australia and when was it founded? | An easy factual question |
| `3-recent.txt` | What changed in the latest Python release? | Freshness, version handling |
| `4-ambiguous.txt` | Is Python good? | A vague question |
| `5-unanswerable.txt` | asdkjh qwlkej zxmnb | Gibberish, should be "not answerable" |
| `6-technical.txt` | How does the KV cache speed up LLM inference? | A narrow technical topic |
| `7-opinion.txt` | Is a master's degree worth it for an ML research job? | Mixed evidence |
| `failure-quota-exhausted.txt` | PyTorch vs JAX | A real run where the daily quota ran out |
| `failure-all-models-unavailable.json` | Latest Python release | A real run where every model failed and the system degraded gracefully |

**Results summary:** <!-- Fill in after running: one line per question with confidence and whether it behaved as expected. -->

## Problems I ran into

1. **The plan step silently fell back to a single query.** The trace showed a 125-second timeout. Cause: the Gemini model was overloaded (HTTP 503), and my retries just waited. Fix: shorter timeouts and a fallback model.
2. **A retired model returned 404.** Model names change. Fix: list models from the API (`npm run models`) instead of hardcoding one, and read model names from `.env`.
3. **A placeholder in `.env`** (`<first model from the list>`) produced "unexpected model name format". Node reads the last duplicate line in `.env`, so an old value was also being shadowed.
4. **Free-tier daily quota ran out.** Retrying a quota error is pointless. Fix: detect "quota" in the 429 message, skip that model immediately, and rotate through a list of models.
5. **Gibberish returned confident-looking pages.** Tavily always returns something, so an empty search is not the signal for "nothing found". Fix: the synthesis prompt allows `answerable: false`, and the output prints that clearly.
6. **The planner put stale version numbers into its own queries.** For "latest Python release", it searched for "Python 3.13" because that was the newest version it remembered, so retrieval was stale before any source was read. Fix: the planning prompt forbids adding version numbers or years that were not in the question, and asks for a query that finds out which version is current. The answer moved from 3.13 to the version python.org lists as current.
7. **A key claim rested on a failed page fetch.** The model cited a YouTube search snippet with high confidence. Fix: snippet-only sources are labelled in the prompt, and code caps confidence when a key point depends only on snippets.
8. **Half an answer with "high" confidence.** For "what changed in the latest release", the system named the current version but not the changes, and filled the space with an older version's features. Fix: a required `missing_parts` field, with confidence capped in code when it is not empty.
9. **Duplicate sources.** `python.org` and `python.org?lang=en` counted as two pieces of evidence. Fix: normalize URLs (strip `utm_*` and `lang`) before de-duplicating.
10. **A shell mistake, not a code bug.** Pasting two commands together made PowerShell wait on a continuation prompt, which looked like a hang.

## Known limitations

- **The citation guard checks that a cited source exists, not that it supports the claim.** The model could cite a real page for something the page does not say. I spot-checked some claims by hand, but the system does not do this itself.
- **Confidence is the model's opinion**, only partly capped by code. It is not a measured probability.
- **Freshness depends on what Tavily returns.** A prompt cannot make the search engine find newer pages. When two sources disagree about a current fact, the model is told to prefer official sources, but it does not always report the disagreement.
- **Source quality is uneven.** Many results are blog posts and vendor content. The system does not rank sources by credibility.
- **Each page is cut to 6,000 characters**, so evidence deep in a long page is missed.
- **Some sites block scraping** (403, 419). The snippet fallback helps, but snippets are thin evidence.
- **Free-tier limits** mean a full batch of test questions can run out of daily quota.
- **Speed:** a run takes 20-60 seconds, mostly LLM time, and longer when models are overloaded.

## What I would do next

- Add a verification pass: for each cited claim, ask the LLM whether the cited text actually supports it.
- Rank sources by type (official docs, papers, blogs, forums) and show that in the answer.
- Fetch a longer, relevance-selected part of each page instead of the first 6,000 characters.
- Run the 7 example questions as an automated check and compare results across prompt changes.

## What I learned about myself

<!-- Fill this in yourself. Five lines: what I enjoyed, what frustrated me, what felt natural, what I kept thinking about, whether I lost track of time. -->
