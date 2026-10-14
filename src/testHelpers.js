import { callLLM } from './llm.js';
import { searchWeb } from './search.js';
import { createTrace } from './trace.js';

const trace = createTrace('helper test');

console.log('LLM says:', await callLLM('Reply with exactly: ok'));

const results = await searchWeb('JAX vs PyTorch', 3);
console.log('Search returned', results.length, 'results');
trace.add({ step: 'search', query: 'JAX vs PyTorch', results: results.length });

console.log('Trace saved to', trace.save({ note: 'test' }));