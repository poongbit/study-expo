require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeCurve, analyzeCurveBatch, CURVE_TARGETS, CURVE_METRIC_LABELS } = require('../src/basics/analyzeCurve.ts');
const { CURVE_GUIDES } = require('../src/basics/curveExercises.ts');
const { createCurveAttempt } = require('../src/basics/curveStore.web.ts');
const { newId } = require('../src/basics/straightLine.ts');

// Mock localStorage for curveStore.web
const data = new Map();
global.localStorage = {
  get length() { return data.size; },
  key: i => [...data.keys()][i] ?? null,
  getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value),
};

function stroke(coords, dt = 10) {
  return { strokeId: 'test', inputType: 'TOUCH', startedAt: 100, points: coords.map(([x, y], i) => ({ x, y, t: i * dt })) };
}

// Perfect guide-following stroke for c-right
const guide = CURVE_GUIDES[0]; // c-right
function perfectCurveStroke(n = 65) {
  const { sampleBezier } = require('../src/basics/practiceEngine.ts');
  const pts = sampleBezier(guide.start, guide.controlA, guide.controlB, guide.end, n);
  return stroke(pts.map(p => [p.x, p.y]));
}

test('perfect guide-following stroke has near-zero averageGuideDistance', () => {
  const result = analyzeCurve([perfectCurveStroke()], guide);
  assert.ok(result.metrics.averageGuideDistance < 0.005, `dist = ${result.metrics.averageGuideDistance}`);
  assert.equal(result.coreProblem, null);
});

test('flat stroke has high flatness metric', () => {
  // Straight line from guide.start to guide.end (no curvature)
  const s = stroke([[guide.start.x, guide.start.y], [guide.end.x, guide.end.y]]);
  const result = analyzeCurve([s], guide);
  assert.ok(result.metrics.flatness > CURVE_TARGETS.flatness, `flatness = ${result.metrics.flatness}`);
});

test('fragmented curve increments extraStrokes', () => {
  // Two strokes = extraStrokes of 1
  const result = analyzeCurve([perfectCurveStroke(), perfectCurveStroke()], guide);
  assert.equal(result.metrics.extraStrokes, 1);
  // extraStrokes metric is above target regardless of which key wins coreProblem
  assert.ok(result.metrics.extraStrokes > CURVE_TARGETS.extraStrokes);
});

test('backtracking is detected when stroke reverses along guide direction', () => {
  // c-right guide: start={x:.5,y:.15} → end={x:.5,y:.85}, dominant direction is +y.
  // Draw down then sharply back up then down again — clear reversal along y axis.
  const s = stroke([
    [0.50, 0.15],  // start
    [0.55, 0.55],  // progress ~60% of the way
    [0.50, 0.20],  // reversal back near the beginning
    [0.50, 0.85],  // end
  ]);
  const result = analyzeCurve([s], guide);
  assert.ok(result.metrics.backtracking > CURVE_TARGETS.backtracking, `backtracking = ${result.metrics.backtracking}`);
});

test('coreProblem is the metric with highest relative excess, not just frequency', () => {
  const offGuide = stroke([[guide.start.x, guide.start.y + 0.3], [guide.end.x, guide.end.y + 0.3]]);
  const result = analyzeCurve([offGuide], guide);
  const { selectCoreProblem } = require('../src/basics/practiceEngine.ts');
  const { key } = selectCoreProblem(result.metrics, CURVE_TARGETS);
  assert.equal(result.coreProblem, key);
});

test('batch analysis computes per-guide direction comparison', () => {
  const setId = newId();
  const attempts = Array.from({ length: 20 }, (_, i) =>
    createCurveAttempt([perfectCurveStroke()], null, CURVE_GUIDES[i % CURVE_GUIDES.length], { practiceSetId: setId, setRuleVersion: 1 })
  );
  const batch = analyzeCurveBatch(attempts);
  assert.equal(batch.totalAttempts, 20);
  assert.ok(batch.directionComparison !== null);
  assert.ok(typeof batch.directionComparison.bestId === 'string');
});

test('first-half vs second-half comparison is present in batch', () => {
  const setId = newId();
  const attempts = Array.from({ length: 20 }, (_, i) =>
    createCurveAttempt([perfectCurveStroke()], null, CURVE_GUIDES[i % CURVE_GUIDES.length], { practiceSetId: setId, setRuleVersion: 1 })
  );
  const batch = analyzeCurveBatch(attempts);
  assert.ok('halfComparison' in batch);
  assert.ok('firstHalf' in batch.halfComparison);
  assert.ok('secondHalf' in batch.halfComparison);
});

test('records are stored separately from straight-line records', async () => {
  const { saveCurveAttempt, loadCurveAttempts } = require('../src/basics/curveStore.web.ts');
  data.clear();
  const a = createCurveAttempt([perfectCurveStroke()], null, guide, { practiceSetId: 'sep-test', setRuleVersion: 1 });
  await saveCurveAttempt(a);
  const { loadAttempts: loadLine } = require('../src/basics/attemptStore.web.ts');
  const lineHistory = await loadLine();
  assert.equal(lineHistory.attempts.length, 0);
  const curveHistory = await loadCurveAttempts();
  assert.equal(curveHistory.attempts.length, 1);
  assert.equal(curveHistory.attempts[0].exerciseId, 'curve-v1');
});

test('CURVE_METRIC_LABELS covers all metric keys', () => {
  const keys = Object.keys(CURVE_TARGETS);
  keys.forEach(k => assert.ok(k in CURVE_METRIC_LABELS, `missing label for ${k}`));
});
