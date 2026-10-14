import fs from 'node:fs';
import path from 'node:path';

function describe(s) {
  const status = s.ok === false ? 'FAILED' : 'ok';
  switch (s.step) {
    case 'plan':
      return `plan ${status}${s.queries ? ': ' + s.queries.length + ' queries' : ': ' + s.error}`;
    case 'search':
      return `search ${status}: "${s.query}"${s.ok ? ' -> ' + s.results + ' results' : ' (' + s.error + ')'}`;
    case 'fetch':
      return `fetch ${status}: ${s.url}${s.ok ? ' (' + s.chars + ' chars)' : ' (' + s.error + ')'}`;
    case 'sources':
      return `sources: ${s.total} total (${s.fromPages} pages, ${s.fromSnippets} snippets)`;
    case 'synthesize':
      return s.ok
        ? `synthesize ok (attempt ${s.attempt}): answerable=${s.answerable}, cited ${s.citedSources.length} sources, dropped ${s.droppedCitations.length} bad citations, ${s.uncitedPoints} uncited points`
        : `synthesize FAILED (attempt ${s.attempt}): ${s.error}`;
    case 'error':
      return `error: ${s.error}`;
    default:
      return s.step;
  }
}

export function createTrace(question) {
  const startedAt = new Date();
  const steps = [];

  return {
    add(step) {
      steps.push({ ...step, at: new Date().toISOString() });
      console.log(`  [${((Date.now() - startedAt) / 1000).toFixed(1)}s] ${describe(step)}`);
    },
    save(answer = null) {
      fs.mkdirSync('traces', { recursive: true });
      const name = startedAt.toISOString().replace(/[:.]/g, '-') + '.json';
      const file = path.join('traces', name);
      const record = { question, startedAt: startedAt.toISOString(), steps, answer };
      fs.writeFileSync(file, JSON.stringify(record, null, 2));
      return file;
    },
  };
}