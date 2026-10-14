import { callLLM } from './llm.js';
import { synthesisPrompt } from './prompts.js';

function parseJson(text) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

const asList = (x) => (Array.isArray(x) ? x.map(String).filter(Boolean) : []);

// The guard: only real source numbers pass, and confidence is capped by evidence quality.
function validate(raw, sources) {
  const valid = new Set(sources.map((s) => s.id));
  const snippetIds = new Set(sources.filter((s) => s.via === 'snippet').map((s) => s.id));
  const droppedCitations = [];
  let uncitedPoints = 0;

  const keyPoints = [];
  for (const kp of Array.isArray(raw.key_points) ? raw.key_points : []) {
    const ids = (Array.isArray(kp.sources) ? kp.sources : []).map(Number).filter((n) => {
      if (valid.has(n)) return true;
      droppedCitations.push(n);
      return false;
    });
    if (!kp.point || ids.length === 0) {
      uncitedPoints++;
      continue;
    }
    keyPoints.push({ point: String(kp.point), sources: [...new Set(ids)] });
  }

  const answerable = raw.answerable !== false;
  if (answerable && keyPoints.length === 0) {
    throw new Error('answer had no key points with valid citations');
  }

  let confidence = ['high', 'medium', 'low'].includes(raw.confidence) ? raw.confidence : 'low';
  const caveats = asList(raw.caveats);
  const missingParts = asList(raw.missing_parts);

  // Cap 1: key points that rest only on search snippets.
  const snippetOnlyPoints = keyPoints.filter((kp) => kp.sources.every((id) => snippetIds.has(id))).length;
  if (snippetOnlyPoints > 0) {
    caveats.push(`${snippetOnlyPoints} key point(s) rest only on search snippets, not full pages.`);
    if (confidence === 'high') confidence = 'medium';
  }

  // Cap 2: parts of the question the sources do not answer.
  if (answerable && missingParts.length > 0 && confidence === 'high') {
    confidence = 'medium';
  }

  return {
    answer: {
      answerable,
      summary: String(raw.summary ?? ''),
      key_points: keyPoints,
      conflicts: asList(raw.conflicts),
      caveats,
      missing_parts: missingParts,
      recommendation: String(raw.recommendation ?? ''),
      confidence,
    },
    droppedCitations,
    uncitedPoints,
    snippetOnlyPoints,
  };
}

// Returns a validated answer, or null if synthesis failed twice.
export async function synthesize(question, sources, trace) {
  const prompt = synthesisPrompt(question, sources);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    try {
      const raw = parseJson(await callLLM(prompt, { json: true }));
      const { answer, droppedCitations, uncitedPoints, snippetOnlyPoints } = validate(raw, sources);
      trace.add({
        step: 'synthesize',
        ok: true,
        attempt,
        answerable: answer.answerable,
        citedSources: [...new Set(answer.key_points.flatMap((k) => k.sources))],
        droppedCitations,
        uncitedPoints,
        snippetOnlyPoints,
        missingParts: answer.missing_parts.length,
        ms: Date.now() - t0,
      });
      return answer;
    } catch (e) {
      trace.add({ step: 'synthesize', ok: false, attempt, error: e.message, ms: Date.now() - t0 });
    }
  }
  return null;
}