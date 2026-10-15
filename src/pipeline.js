import { callLLM } from './llm.js';
import { searchWeb } from './search.js';
import { fetchPage } from './fetchPage.js';
import { planPrompt } from './prompts.js';

const MAX_SOURCES = 8;

function parseJson(text) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// Step 1: ask the LLM for search queries. If anything goes wrong, fall back to the question itself.
async function plan(question, trace) {
  const t0 = Date.now();
  try {
    const parsed = parseJson(await callLLM(planPrompt(question), { json: true }));
    const queries = (parsed.queries ?? [])
      .filter((q) => typeof q === 'string' && q.trim())
      .slice(0, 4);
    if (!queries.length) throw new Error('no queries in LLM output');
    trace.add({ step: 'plan', ok: true, queries, ms: Date.now() - t0 });
    return queries;
  } catch (e) {
    trace.add({
      step: 'plan',
      ok: false,
      error: e.message,
      fallback: 'using the question as the only query',
      ms: Date.now() - t0,
    });
    return [question];
  }
}

// Treat tracking/language variants of the same page as one URL.
function normalizeUrl(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    for (const k of [...url.searchParams.keys()]) {
      if (k.startsWith('utm_') || k === 'lang') url.searchParams.delete(k);
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return u;
  }
}

// Heuristic: a source is "official" if its site's domain name is a word from the question
// (python.org and docs.python.org for a Python question). Crude, but cheap and checkable.
function isOfficial(url, question) {
  try {
    const parts = new URL(url).hostname.split('.');
    const name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    const words = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    return words.includes(name);
  } catch {
    return false;
  }
}

export async function research(question, trace) {
  const queries = await plan(question, trace);

  // Step 2: search. One failed query must not kill the run.
  const lists = [];
  for (const q of queries) {
    const t0 = Date.now();
    try {
      const results = await searchWeb(q, 5);
      trace.add({
        step: 'search',
        query: q,
        ok: true,
        results: results.length,
        urls: results.map((r) => r.url),
        ms: Date.now() - t0,
      });
      lists.push(results);
    } catch (e) {
      trace.add({ step: 'search', query: q, ok: false, error: e.message, ms: Date.now() - t0 });
    }
  }

  // Interleave results from each query and drop duplicate URLs,
  // so the first query does not use up all the slots.
  const merged = [];
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    for (const list of lists) {
      const r = list[i];
      if (r && !seen.has(normalizeUrl(r.url))) {
        seen.add(normalizeUrl(r.url));
        merged.push(r);
      }
    }
  }
  if (merged.length === 0) throw new Error('No search results (all searches failed or were empty)');

  // Step 3: fetch pages in parallel. If a page fails, fall back to its search snippet.
  const candidates = merged.slice(0, MAX_SOURCES);
  const fetched = await Promise.all(
    candidates.map(async (c) => {
      const t0 = Date.now();
      const page = await fetchPage(c.url);
      if (page.ok) {
        trace.add({
          step: 'fetch',
          url: c.url,
          ok: true,
          chars: page.chars,
          usedChars: page.text.length,
          ms: Date.now() - t0,
        });
        return { title: page.title || c.title, url: c.url, text: page.text, via: 'page' };
      }
      trace.add({
        step: 'fetch',
        url: c.url,
        ok: false,
        error: page.error,
        fallback: c.snippet ? 'using search snippet' : 'dropped',
        ms: Date.now() - t0,
      });
      return c.snippet ? { title: c.title, url: c.url, text: c.snippet, via: 'snippet' } : null;
    })
  );

  // Official sources go first, then ids are assigned in that order.
  const sources = fetched
    .filter(Boolean)
    .map((s) => ({ ...s, official: isOfficial(s.url, question) }))
    .sort((a, b) => Number(b.official) - Number(a.official))
    .map((s, i) => ({ id: i + 1, ...s }));

  trace.add({
    step: 'sources',
    total: sources.length,
    fromPages: sources.filter((s) => s.via === 'page').length,
    fromSnippets: sources.filter((s) => s.via === 'snippet').length,
    official: sources.filter((s) => s.official).length,
  });

  return { queries, sources };
}