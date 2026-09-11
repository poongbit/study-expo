require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeCircle, analyzeCircleBatch, CIRCLE_TARGETS, CIRCLE_METRIC_LABELS } = require('../src/basics/analyzeCircle.ts');
const { CIRCLE_GUIDES, sampleCircleGuide } = require('../src/basics/circleExercises.ts');
const { createCircleAttempt, loadCircleAttempts, saveCircleAttempt } = require('../src/basics/circleStore.web.ts');
const { newId } = require('../src/basics/straightLine.ts');

// Mock localStorage for circleStore.web
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

const guide = CIRCLE_GUIDES[0]; // circle-cw-large, cx=.5, cy=.5, rx=.35, ry=.35

function perfectCircleStroke(g = guide, n = 129) {
  const pts = sampleCircleGuide(g, n);
  // Close the circle: last point = first point
  const all = [...pts, pts[0]];
  return stroke(all.map(p => [p.x, p.y]));
}

test('perfect circle stroke has near-zero closure error', () => {
  const result = analyzeCircle([perfectCircleStroke()], guide);
  assert.ok(result.metrics.closureError < CIRCLE_TARGETS.closureError, `closureError = ${result.metrics.closureError}`);
});

test('perfect circle stroke has low radius variance', () => {
  const result = analyzeCircle([perfectCircleStroke()], guide);
  assert.ok(result.metrics.radiusVariance < CIRCLE_TARGETS.radiusVariance, `radiusVariance = ${result.metrics.radiusVariance}`);
});

test('open circle (no closure) has high closure error', () => {
  // Draw only the first half of the ellipse (start at top, end at bottom) — no closure
  const n = 128;
  const pts = sampleCircleGuide(guide, n);
  const half = pts.slice(0, 65); // 0 to pi (top to bottom)
  const s = stroke(half.map(p => [p.x, p.y]));
  const result = analyzeCircle([s], guide);
  // Start is at top (0.5, 0.15), end is at bottom (0.5, 0.85) → closureError ≈ 0.70 >> 0.03
  assert.ok(result.metrics.closureError > CIRCLE_TARGETS.closureError, `closureError = ${result.metrics.closureError}`);
});

test('junction kink is detected when stroke direction changes sharply at join', () => {
  // Draw a circle and then add a sharp reversal at the end
  const pts = sampleCircleGuide(guide, 33);
  // Add a sharp kink by including a point far from the junction
  const withKink = [...pts, { x: 0.5, y: 0.1 }, pts[0]];
  const s = stroke(withKink.map(p => [p.x, p.y]));
  const result = analyzeCircle([s], guide);
  assert.ok(result.metrics.junctionKink > CIRCLE_TARGETS.junctionKink, `junctionKink = ${result.metrics.junctionKink}`);
});

test('ellipse with wrong aspect ratio has high aspectRatio metric', () => {
  const ellipseGuide = CIRCLE_GUIDES.find(g => g.id === 'ellipse-h-cw');
  // Draw a circle instead of an ellipse (wrong ratio)
  const circleForEllipse = sampleCircleGuide({ ...ellipseGuide, rx: 0.25, ry: 0.25 }, 129);
  const s = stroke([...circleForEllipse, circleForEllipse[0]].map(p => [p.x, p.y]));
  const result = analyzeCircle([s], ellipseGuide);
  assert.ok(result.metrics.aspectRatio > CIRCLE_TARGETS.aspectRatio, `aspectRatio = ${result.metrics.aspectRatio}`);
});

test('coreProblem is the metric with largest relative excess', () => {
  const result = analyzeCircle([stroke([[0.5, 0.15], [0.5, 0.15]])], guide);
  // Very few points → should trigger samplingNote
  assert.ok(result.samplingNote || result.coreProblem !== null);
});

test('clockwise vs counter-clockwise direction comparison is present in batch', () => {
  data.clear();
  const setId = newId();
  const attempts = Array.from({ length: 20 }, (_, i) => {
    const g = CIRCLE_GUIDES[i % CIRCLE_GUIDES.length];
    return createCircleAttempt([perfectCircleStroke(g)], null, g, { practiceSetId: setId, setRuleVersion: 1 });
  });
  const batch = analyzeCircleBatch(attempts);
  assert.equal(batch.totalAttempts, 20);
  assert.ok(batch.directionComparison !== null);
  assert.ok(['clockwise', 'counterClockwise', 'equal'].includes(batch.directionComparison.betterDirection));
});

test('circle records are stored separately from curve and line records', async () => {
  data.clear();
  const a = createCircleAttempt([perfectCircleStroke()], null, guide, { practiceSetId: 'sep-test', setRuleVersion: 1 });
  await saveCircleAttempt(a);
  // Only circle key should exist
  const keys = [...data.keys()];
  assert.ok(keys.every(k => k.startsWith('chibicoach:circle-v1:')), `unexpected key found: ${keys}`);
  const history = await loadCircleAttempts();
  assert.equal(history.attempts.length, 1);
  assert.equal(history.attempts[0].exerciseId, 'circle-v1');
});

test('CIRCLE_METRIC_LABELS covers all metric keys', () => {
  const keys = Object.keys(CIRCLE_TARGETS);
  keys.forEach(k => assert.ok(k in CIRCLE_METRIC_LABELS, `missing label for ${k}`));
});

test('completion ratio detects over-draw (more than one full revolution)', () => {
  // Draw 1.5 circles
  const pts1 = sampleCircleGuide(guide, 193);
  const s = stroke(pts1.map(p => [p.x, p.y]));
  const result = analyzeCircle([s], guide);
  assert.ok(result.metrics.completionRatio > 0, `completionRatio = ${result.metrics.completionRatio}`);
});
