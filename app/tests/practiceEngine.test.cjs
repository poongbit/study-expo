require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resamplePath, computeMotion, selectCoreProblem, compareHalves } = require('../src/basics/practiceEngine.ts');

function stroke(coords, dt = 10) {
  return { strokeId: 'test', inputType: 'TOUCH', startedAt: 100, points: coords.map(([x, y], i) => ({ x, y, t: i * dt })) };
}

// ── resamplePath ─────────────────────────────────────────────────────────────

test('resamplePath returns exactly n points for a straight line', () => {
  const pts = Array.from({ length: 21 }, (_, i) => ({ x: i / 20, y: 0.5 }));
  const result = resamplePath(pts, 10);
  assert.equal(result.length, 10);
  assert.ok(Math.abs(result[0].x - 0) < 1e-9);
  assert.ok(Math.abs(result[9].x - 1) < 1e-9);
});

test('resamplePath evenly spaces points on a diagonal', () => {
  const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
  const result = resamplePath(pts, 5);
  assert.equal(result.length, 5);
  // Check equal spacing
  for (let i = 1; i < result.length; i++) {
    const d = Math.hypot(result[i].x - result[i-1].x, result[i].y - result[i-1].y);
    assert.ok(Math.abs(d - Math.sqrt(2) / 4) < 1e-9, `spacing at ${i} = ${d}`);
  }
});

test('resamplePath handles degenerate all-same points', () => {
  const pts = Array.from({ length: 5 }, () => ({ x: 0.5, y: 0.5 }));
  const result = resamplePath(pts, 4);
  assert.equal(result.length, 4);
  result.forEach(p => { assert.ok(Math.abs(p.x - 0.5) < 1e-9); });
});

test('resamplePath is stable under denser input samples', () => {
  const make = n => Array.from({ length: n }, (_, i) => ({ x: i / (n - 1), y: 0.5 }));
  const sparse = resamplePath(make(10), 5);
  const dense = resamplePath(make(100), 5);
  for (let i = 0; i < 5; i++) {
    assert.ok(Math.abs(sparse[i].x - dense[i].x) < 1e-9, `x differs at ${i}`);
  }
});

// ── computeMotion ────────────────────────────────────────────────────────────

test('computeMotion computes correct average speed', () => {
  // 50 points, 0.7 units horizontal, 50*10=500ms → speed = 0.7 / 0.5 = 1.4
  const pts = Array.from({ length: 51 }, (_, i) => [0.15 + 0.7 * i / 50, 0.5]);
  const result = computeMotion([stroke(pts, 10)]);
  assert.ok(Math.abs(result.averageSpeed - 1.4) < 1e-9, `speed = ${result.averageSpeed}`);
});

test('computeMotion detects pause when dt >= 120ms and movement <= 0.025', () => {
  // Two points far apart in time but close in space = pause
  const pts = [[0.5, 0.5], [0.501, 0.5]];
  const s = { strokeId: 'test', inputType: 'TOUCH', startedAt: 100, points: [{ x: 0.5, y: 0.5, t: 0 }, { x: 0.501, y: 0.5, t: 200 }] };
  const result = computeMotion([s]);
  assert.equal(result.pauseCount, 1);
});

test('computeMotion reports zero pauses for a fast stroke', () => {
  const pts = Array.from({ length: 51 }, (_, i) => [0.15 + 0.7 * i / 50, 0.5]);
  const result = computeMotion([stroke(pts, 10)]);
  assert.equal(result.pauseCount, 0);
});

// ── selectCoreProblem ────────────────────────────────────────────────────────

test('selectCoreProblem picks metric with largest relative excess', () => {
  const metrics = { a: 0.10, b: 0.20, c: 0.05 };
  const targets = { a: 0.08, b: 0.10, c: 0.03 };
  // Relative excesses: a=(0.02/0.08)=0.25, b=(0.10/0.10)=1.0, c=(0.02/0.03)=0.67
  const { key } = selectCoreProblem(metrics, targets);
  assert.equal(key, 'b');
});

test('selectCoreProblem returns null when all metrics are within target', () => {
  const metrics = { a: 0.01, b: 0.005 };
  const targets = { a: 0.02, b: 0.01 };
  const { key } = selectCoreProblem(metrics, targets);
  assert.equal(key, null);
});

test('selectCoreProblem does not rank by frequency alone', () => {
  // 'c' has higher frequency in a naive model but smaller relative excess
  const metrics = { a: 0.001, b: 0.5, c: 0.031 };
  const targets = { a: 0.001, b: 0.10, c: 0.030 };
  // b relative = 4.0, c relative ≈ 0.033, a = 0
  const { key } = selectCoreProblem(metrics, targets);
  assert.equal(key, 'b');
});

// ── compareHalves ────────────────────────────────────────────────────────────

test('compareHalves identifies improving and worsening metrics across halves', () => {
  const keys = ['wobble', 'deviation'];
  const perAttempt = [
    { wobble: 0.10, deviation: 0.02 },
    { wobble: 0.08, deviation: 0.02 },
    { wobble: 0.03, deviation: 0.05 },
    { wobble: 0.02, deviation: 0.06 },
  ];
  const result = compareHalves(perAttempt, keys);
  assert.equal(result.mostImproved, 'wobble');  // wobble dropped 0.09 → 0.025
  assert.equal(result.mostWorsened, 'deviation');  // deviation rose 0.02 → 0.055
});
