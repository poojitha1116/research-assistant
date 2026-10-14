import fs from 'node:fs';
import path from 'node:path';

export function createTrace(question) {
  const startedAt = new Date();
  const steps = [];

  return {
    add(step) {
      steps.push({ ...step, at: new Date().toISOString() });
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