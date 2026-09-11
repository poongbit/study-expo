// practiceEngine.ts — shared utilities for line, curve and circle exercises.
// Raw coordinate arrays must never leave this module as part of a Gemini prompt.
import type { StrokePoint } from '../types/drawing';
import type { PracticeStroke } from './straightLine';

// ── Path geometry ───────────────────────────────────────────────────────────

const dist2d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Resample a polyline to exactly `n` evenly-spaced points based on arc length.
 * Used to compare a drawn path with a guide path without bias from point density.
 * n must be >= 2.
 */
export function resamplePath(
  points: { x: number; y: number }[],
  n: number,
): { x: number; y: number }[] {
  if (points.length < 2 || n < 2) return points.slice(0, n);
  // Compute cumulative arc-length
  const lengths: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + dist2d(points[i - 1], points[i]));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return Array.from({ length: n }, () => ({ ...points[0] }));
  const result: { x: number; y: number }[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / (n - 1)) * total;
    while (j < lengths.length - 2 && lengths[j + 1] < target) j++;
    const seg = lengths[j + 1] - lengths[j];
    const t = seg === 0 ? 0 : (target - lengths[j]) / seg;
    result.push({
      x: points[j].x + t * (points[j + 1].x - points[j].x),
      y: points[j].y + t * (points[j + 1].y - points[j].y),
    });
  }
  return result;
}

/**
 * Sample a cubic Bezier curve into `n` points.
 * p0, p1 = start/end; c0, c1 = control points.
 */
export function sampleBezier(
  p0: { x: number; y: number },
  c0: { x: number; y: number },
  c1: { x: number; y: number },
  p1: { x: number; y: number },
  n: number,
): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * c0.x + 3 * u * t * t * c1.x + t * t * t * p1.x,
      y: u * u * u * p0.y + 3 * u * u * t * c0.y + 3 * u * t * t * c1.y + t * t * t * p1.y,
    };
  });
}

// ── Motion analysis ─────────────────────────────────────────────────────────

export interface MotionSummary {
  averageSpeed: number;       // normalized units / second
  pauseCount: number;         // segments where dt >= 120 ms and dist <= 0.025
  wobbleBySection: { start: number; middle: number; end: number };
}

/**
 * Compute motion statistics along the drawn strokes.
 */
export function computeMotion(
  strokes: PracticeStroke[],
): MotionSummary {
  let pathLength = 0;
  let durationMs = 0;
  let pauseCount = 0;
  const sectionPoints: number[][] = [[], [], []];
  const totalLen = strokes.reduce((sum, s) => {
    for (let i = 1; i < s.points.length; i++) sum += dist2d(s.points[i - 1], s.points[i]);
    return sum;
  }, 0);
  let cumulativeLen = 0;
  for (const stroke of strokes) {
    durationMs = Math.max(durationMs, stroke.points.at(-1)?.t ?? 0);
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1] as StrokePoint;
      const b = stroke.points[i] as StrokePoint;
      const seg = dist2d(a, b);
      const elapsed = b.t - a.t;
      pathLength += seg;
      if (elapsed >= 120 && seg <= 0.025) pauseCount++;
      const progress = totalLen > 0 ? cumulativeLen / totalLen : 0;
      const section = Math.min(2, Math.floor(progress * 3));
      sectionPoints[section].push(a.y);
      cumulativeLen += seg;
    }
  }
  const sectionWobble = (vals: number[]) => {
    if (vals.length < 2) return 0;
    let travel = 0;
    for (let i = 1; i < vals.length; i++) travel += Math.abs(vals[i] - vals[i - 1]);
    return Math.max(0, travel - Math.abs(vals.at(-1)! - vals[0]));
  };
  return {
    averageSpeed: durationMs > 0 ? pathLength / (durationMs / 1000) : 0,
    pauseCount,
    wobbleBySection: {
      start: sectionWobble(sectionPoints[0]),
      middle: sectionWobble(sectionPoints[1]),
      end: sectionWobble(sectionPoints[2]),
    },
  };
}

// ── Diagnostic priority ─────────────────────────────────────────────────────

export interface SeverityResult {
  key: string;
  relativeError: number;
}

/**
 * Select the metric with the largest relative excess over its target.
 * Occurrence frequency alone does NOT determine the core problem.
 */
export function selectCoreProblem<K extends string>(
  metrics: Record<K, number>,
  targets: Record<K, number>,
): { key: K | null; ranked: SeverityResult[] } {
  const ranked: SeverityResult[] = (Object.keys(targets) as K[])
    .map(key => {
      const target = targets[key] || 1;
      const excess = Math.max(0, metrics[key] - targets[key]);
      return { key, relativeError: excess / target };
    })
    .sort((a, b) => b.relativeError - a.relativeError);
  const top = ranked[0];
  const key = top && top.relativeError > 0 ? (top.key as K) : null;
  return { key, ranked };
}

// ── Stroke batch overlay (shared) ───────────────────────────────────────────

/**
 * Reduce each stroke to at most 48 points for the overlay PNG request.
 * Raw coordinates must NOT be sent to Gemini as text.
 */
export function compactOverlay(
  points: { x: number; y: number; t: number; pressure?: number }[],
): { x: number; y: number }[] {
  const step = Math.max(1, Math.ceil(points.length / 48));
  return points
    .filter((_, i) => i % step === 0 || i === points.length - 1)
    .map(p => ({ x: Math.round(p.x * 10_000) / 10_000, y: Math.round(p.y * 10_000) / 10_000 }));
}

// ── First-half / second-half comparison ────────────────────────────────────

export interface HalfComparison<K extends string> {
  firstHalf: Record<K, number>;
  secondHalf: Record<K, number>;
  mostImproved: K | null;
  mostWorsened: K | null;
}

export function compareHalves<K extends string>(
  perAttempt: Record<K, number>[],
  keys: K[],
): HalfComparison<K> {
  const half = Math.floor(perAttempt.length / 2);
  const avg = (items: Record<K, number>[], key: K) => {
    const vals = items.map(m => m[key]).filter(Number.isFinite);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const firstHalf = Object.fromEntries(keys.map(k => [k, avg(perAttempt.slice(0, half), k)])) as Record<K, number>;
  const secondHalf = Object.fromEntries(keys.map(k => [k, avg(perAttempt.slice(half), k)])) as Record<K, number>;
  let mostImproved: K | null = null, maxImprovement = 0;
  let mostWorsened: K | null = null, maxWorsening = 0;
  for (const k of keys) {
    const delta = firstHalf[k] - secondHalf[k];
    if (delta > maxImprovement) { maxImprovement = delta; mostImproved = k; }
    if (-delta > maxWorsening) { maxWorsening = -delta; mostWorsened = k; }
  }
  return { firstHalf, secondHalf, mostImproved, mostWorsened };
}
