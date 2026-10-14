import { createTrace } from './trace.js';
import { research } from './pipeline.js';
import { synthesize } from './synthesize.js';

const question = process.argv.slice(2).join(' ').trim();
if (!question) {
  console.error('Usage: npm run ask -- "your question"');
  process.exit(1);
}

const trace = createTrace(question);

function printAnswer(answer, sources) {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const line = '-'.repeat(60);

  console.log(`\n${line}\nQUESTION: ${question}\n${line}`);

  if (!answer) {
    console.log('\nCould not produce a synthesized answer (the LLM failed twice).');
    console.log('The sources that were gathered are listed below.\n');
    for (const s of sources) console.log(` [${s.id}] ${s.title}\n     ${s.url}`);
    return;
  }

  console.log(`\nSUMMARY\n${answer.summary}`);

  if (!answer.answerable) {
    console.log('\nThe gathered sources do not answer this question.');
  }

  if (answer.key_points.length) {
    console.log('\nKEY POINTS');
    for (const kp of answer.key_points) {
      console.log(` - ${kp.point} [${kp.sources.join(', ')}]`);
    }
  }
  if (answer.conflicts.length) {
    console.log('\nWHERE SOURCES DISAGREE');
    answer.conflicts.forEach((c) => console.log(` - ${c}`));
  }
  if (answer.caveats.length) {
    console.log('\nCAVEATS');
    answer.caveats.forEach((c) => console.log(` - ${c}`));
  }
    if (answer.missing_parts?.length) {
    console.log('\nNOT COVERED BY THE SOURCES');
    answer.missing_parts.forEach((c) => console.log(` - ${c}`));
  }

  if (answer.answerable) console.log(`\nCONFIDENCE: ${answer.confidence}`);

  const cited = [...new Set(answer.key_points.flatMap((k) => k.sources))].sort((a, b) => a - b);
  if (cited.length) {
    console.log('\nSOURCES CITED');
    for (const id of cited) {
      const s = byId.get(id);
      console.log(` [${id}] ${s.title}\n     ${s.url}`);
    }
  }
}

try {
  const { sources } = await research(question, trace);
  const answer = await synthesize(question, sources, trace);

  printAnswer(answer, sources);

  const file = trace.save({
    answer,
    sources: sources.map(({ id, title, url, via }) => ({ id, title, url, via })),
  });
  console.log('\nTrace saved to', file);
} catch (e) {
  trace.add({ step: 'error', error: e.message });
  console.error('\nFailed:', e.message);
  console.log('Trace saved to', trace.save());
  process.exit(1);
}