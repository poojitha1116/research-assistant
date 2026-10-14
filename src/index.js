import { createTrace } from './trace.js';
import { research } from './pipeline.js';

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Usage: npm run ask -- "your question"');
  process.exit(1);
}

const trace = createTrace(question);

try {
  const { queries, sources } = await research(question, trace);

  console.log('\nQueries:');
  queries.forEach((q) => console.log(' -', q));

  console.log('\nSources gathered:');
  for (const s of sources) {
    console.log(` [${s.id}] (${s.via}, ${s.text.length} chars) ${s.title}`);
    console.log(`     ${s.url}`);
  }

  const file = trace.save({
    sources: sources.map(({ id, title, url, via }) => ({ id, title, url, via })),
  });
  console.log('\nTrace saved to', file);
} catch (e) {
  trace.add({ step: 'error', error: e.message });
  console.error('\nFailed:', e.message);
  console.log('Trace saved to', trace.save());
  process.exit(1);
}