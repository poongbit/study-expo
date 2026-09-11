require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { requestAiFeedback } = require('../src/basics/aiFeedback.ts');

const metric = { mean: .02, standardDeviation: .01, exceededFrequency: .4 };
const batch = {
  phaseId: 'level_0_line_control', totalStrokes: 20, inputType: 'STYLUS', dominantHabit: 'wobble',
  metrics: { endpoints: metric, deviation: metric, extraStrokes: metric, wobble: metric, backtracking: metric },
  pressureFailureFrequency: .2,
  strokeBatch: [{ attemptIndex: 1, points: [{ x: .1, y: .5, t: 0 }], fragmentationCount: 1 }],
  attemptSummaries: Array.from({ length: 20 }, (_, index) => ({ attemptIndex: index + 1, guideId: 'horizontal-right',
    inputType: 'STYLUS', durationMs: 500, pointCount: 30, strokeCount: 1,
    metrics: { endpoints: .01, deviation: .01, extraStrokes: 0, wobble: .02, backtracking: .01 }, correction: 'wobble', samplingLimited: false,
    motion: { averageSpeed: 1.4, pauseCount: 0, startAlongError: 0, endAlongError: 0, wobbleBySection: { start: 0, middle: .01, end: 0 } } })),
  feedback: 'local fallback',
};

test('AI request sends diagnostic summaries and a compact overlay sample', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
  let sent;
  process.env.EXPO_PUBLIC_FEEDBACK_API_URL = 'http://feedback.test/';
  global.fetch = async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ coreProblem: '끝점 조절', evidence: '평균 오차 10%', nextAction: '끝점을 보세요.' }) };
  };
  try {
    const result = await requestAiFeedback('batch-test-001', batch);
    assert.equal(sent.url, 'http://feedback.test/feedback');
    const body = JSON.parse(sent.options.body);
    assert.equal(body.metrics.wobble.exceededFrequency, .4);
    assert.equal(body.attemptSummaries.length, 20);
    assert.equal(body.attemptSummaries[0].metrics.wobble, .02);
    assert.equal(body.overlayStrokes.length, 1);
    assert.equal('strokeBatch' in body, false);
    assert.equal(body.overlayStrokes[0].points[0].x, .1);
    assert.deepEqual(result, { coreProblem: '끝점 조절', evidence: '평균 오차 10%', nextAction: '끝점을 보세요.' });
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
    else process.env.EXPO_PUBLIC_FEEDBACK_API_URL = originalUrl;
  }
});

test('batchId cache prevents a second server call for the same batch', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
  let callCount = 0;
  process.env.EXPO_PUBLIC_FEEDBACK_API_URL = 'http://feedback.test/';
  global.fetch = async () => {
    callCount++;
    return { ok: true, json: async () => ({ coreProblem: '캐시 테스트', evidence: '증거', nextAction: '행동' }) };
  };
  // Use a unique batchId so the module-level cache is cold
  const uniqueId = `cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Need fresh module import to avoid cross-test cache pollution
  // Instead, we use a batchId that was NOT used in the previous test
  try {
    const { requestAiFeedback } = require('../src/basics/aiFeedback.ts');
    await requestAiFeedback(uniqueId, batch);
    await requestAiFeedback(uniqueId, batch);  // second call with same batchId
    assert.equal(callCount, 1, `Expected 1 server call, got ${callCount}`);
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
    else process.env.EXPO_PUBLIC_FEEDBACK_API_URL = originalUrl;
  }
});

test('request body does not include raw stroke coordinates as text', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
  let body;
  process.env.EXPO_PUBLIC_FEEDBACK_API_URL = 'http://feedback.test/';
  global.fetch = async (url, options) => {
    body = options.body;
    return { ok: true, json: async () => ({ coreProblem: '테스트', evidence: '근거', nextAction: '행동' }) };
  };
  const uniqueId = `raw-coord-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    const { requestAiFeedback } = require('../src/basics/aiFeedback.ts');
    await requestAiFeedback(uniqueId, batch);
    const parsed = JSON.parse(body);
    // strokeBatch (raw array of all points) must NOT be present in the request body text
    assert.equal('strokeBatch' in parsed, false, 'strokeBatch must not appear in the POST body');
    // overlayStrokes should be compact (≤ 48 points per stroke)
    assert.ok(Array.isArray(parsed.overlayStrokes));
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_FEEDBACK_API_URL;
    else process.env.EXPO_PUBLIC_FEEDBACK_API_URL = originalUrl;
  }
});

