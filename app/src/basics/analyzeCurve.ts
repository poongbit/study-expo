// analyzeCurve.ts — curve exercise analysis.
// Path comparison is resampling-based, never simple point-to-point distance.
import { resamplePath, compactOverlay, computeMotion, selectCoreProblem, compareHalves } from './practiceEngine';
import type { PracticeStroke } from './straightLine';
import { sampleGuide, type BezierGuide } from './curveExercises';

export type CurveMetricKey =
  | 'averageGuideDistance'
  | 'endpointError'
  | 'curvatureSpike'
  | 'directionReversal'
  | 'flatness'
  | 'backtracking'
  | 'extraStrokes'
  | 'wobble';

export interface CurveMetrics {
  averageGuideDistance: number; // mean point-to-guide distance after resampling (0–1)
  endpointError: number;        // mean of start and end distance errors (0–1)
  curvatureSpike: number;       // normalised spike count
  directionReversal: number;    // unwanted reversal distance / guide arc-length
  flatness: number;             // abs deviation of actual depth from guide depth (0–1)
  backtracking: number;         // backtrack distance / guide arc-length
  extraStrokes: number;         // stroke count - 1
  wobble: number;               // wobble travel beyond a single arc
}

export interface CurveAnalysis {
  metrics: CurveMetrics;
  coreProblem: CurveMetricKey | null;
  feedback: string;
  motion: ReturnType<typeof computeMotion>;
  samplingNote?: string;
}

export interface CurveAttempt {
  schemaVersion: 1;
  exerciseId: 'curve-v1';
  metricVersion: 1;
  attemptId: string;
  previousAttemptId: string | null;
  createdAt: number;
  practiceSetId?: string;
  setRuleVersion?: 1;
  inputType: 'TOUCH' | 'STYLUS' | 'MIXED';
  guide: BezierGuide;
  strokes: PracticeStroke[];
  analysis: CurveAnalysis;
}

// Teaching targets — provisional engineering values, not educator norms.
export const CURVE_TARGETS: Record<CurveMetricKey, number> = {
  averageGuideDistance: 0.035,
  endpointError:        0.030,
  curvatureSpike:       0.10,
  directionReversal:    0.020,
  flatness:             0.10,
  backtracking:         0.020,
  extraStrokes:         0,
  wobble:               0.04,
};

export const CURVE_METRIC_LABELS: Record<CurveMetricKey, string> = {
  averageGuideDistance: '가이드 곡선 이탈',
  endpointError:        '시작·끝점 오차',
  curvatureSpike:       '곡률 급변',
  directionReversal:    '방향 전환',
  flatness:             '납작하거나 부푼 정도',
  backtracking:         '되돌아감',
  extraStrokes:         '획 끊김',
  wobble:               '반복 흔들림',
};

const CURVE_FEEDBACK: Record<CurveMetricKey, string> = {
  averageGuideDistance: '가이드 곡선을 따라 공중에서 경로를 먼저 연습하세요.',
  endpointError:        '시작점과 끝점 위치를 먼저 확인한 뒤 그리세요.',
  curvatureSpike:       '커브 전체 리듬을 고스팅한 뒤 한 번에 그리세요.',
  directionReversal:    '곡선 방향을 공중에서 여러 번 연습한 뒤 같은 리듬으로 그리세요.',
  flatness:             '가이드 곡선을 보며 전체 호의 깊이를 먼저 파악한 뒤 그리세요.',
  backtracking:         '어긋나도 되돌아가지 말고 끝까지 진행하세요.',
  extraStrokes:         '한 호를 한 획으로 잇는 연습을 반복하세요.',
  wobble:               '화면에 닿지 않게 같은 동작을 2~3번 연습한 뒤 그 리듬으로 한 번에 그으세요.',
};

const dist2d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function arcLength(pts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += dist2d(pts[i - 1], pts[i]);
  return len;
}

function curvatureSpikes(pts: { x: number; y: number }[]): number {
  if (pts.length < 3) return 0;
  let spikes = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    // Angle change > ~90 degrees in normalised space
    if (Math.abs(cross) > 0.002 && dot < 0) spikes++;
  }
  return spikes;
}

function backtrackingFraction(strokes: PracticeStroke[], guide: BezierGuide): number {
  // Project points onto guide tangent at start (approximate along-guide progress)
  const ux = guide.end.x - guide.start.x, uy = guide.end.y - guide.start.y;
  const guideLen = Math.hypot(ux, uy) || 1;
  const nux = ux / guideLen, nuy = uy / guideLen;
  const along = (p: { x: number; y: number }) => (p.x - guide.start.x) * nux + (p.y - guide.start.y) * nuy;
  let back = 0;
  const deadband = 0.002;
  for (const s of strokes) {
    let peak = along(s.points[0]), descending = false, trough = peak;
    for (const p of s.points) {
      const pos = along(p);
      if (!descending) {
        peak = Math.max(peak, pos);
        if (pos < peak - deadband) { descending = true; trough = pos; }
      } else {
        trough = Math.min(trough, pos);
        if (pos > trough + deadband) { back += Math.max(0, peak - trough - deadband); descending = false; peak = pos; }
      }
    }
    if (descending) back += Math.max(0, peak - trough - deadband);
  }
  return back / (guideLen || 1);
}

export function analyzeCurve(strokes: PracticeStroke[], guide: BezierGuide): CurveAnalysis {
  const guidePts = sampleGuide(guide, 64);
  const guideLen = arcLength(guidePts);
  // Collect all drawn points
  const allPoints = strokes.flatMap(s => s.points);
  const drawnPts = allPoints.map(p => ({ x: p.x, y: p.y }));
  const first = drawnPts[0] ?? guide.start;
  const last = drawnPts[drawnPts.length - 1] ?? guide.end;
  // --- averageGuideDistance via resampling ---
  const n = 64;
  const resampled = resamplePath(drawnPts, n);
  const resampledGuide = resamplePath(guidePts, n);
  const avgDist = resampled.reduce((s, p, i) => s + dist2d(p, resampledGuide[i]), 0) / n;
  // --- endpointError ---
  const endpointError = (dist2d(first, guide.start) + dist2d(last, guide.end)) / 2;
  // --- curvatureSpike (normalised by guide length) ---
  const spikes = curvatureSpikes(resampled);
  const curvatureSpike = Math.min(1, spikes / Math.max(1, n / 10));
  // --- directionReversal ---
  const directionReversal = Math.min(1, backtrackingFraction(strokes, guide));
  // --- flatness: compare actual bow depth to guide bow depth ---
  const guideMid = resampledGuide[Math.floor(n / 2)];
  const drawnMid = resampled[Math.floor(n / 2)];
  const guideDepth = dist2d(guideMid, { x: (guide.start.x + guide.end.x) / 2, y: (guide.start.y + guide.end.y) / 2 });
  const drawnDepth = dist2d(drawnMid, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 });
  const flatness = Math.abs(drawnDepth - guideDepth);
  // --- backtracking ---
  const backtracking = Math.min(1, backtrackingFraction(strokes, guide));
  // --- extraStrokes ---
  const extraStrokes = strokes.length - 1;
  // --- wobble (lateral travel beyond single arc) ---
  const wobble = Math.max(0, resampled.reduce((s, p, i) => {
    if (i === 0) return s;
    const prev = resampled[i - 1];
    return s + Math.abs(dist2d(p, resampledGuide[i]) - dist2d(prev, resampledGuide[i - 1]));
  }, 0) / (guideLen || 1) - 0.05);
  const metrics: CurveMetrics = {
    averageGuideDistance: avgDist,
    endpointError,
    curvatureSpike,
    directionReversal,
    flatness,
    backtracking,
    extraStrokes,
    wobble,
  };
  const { key: coreProblem } = selectCoreProblem(metrics, CURVE_TARGETS);
  const samplingNote = allPoints.length < 8 ? '기록된 점이 너무 적어 분석이 제한됩니다.' : undefined;
  const motion = computeMotion(strokes);
  return {
    metrics,
    coreProblem: coreProblem as CurveMetricKey | null,
    feedback: coreProblem ? CURVE_FEEDBACK[coreProblem as CurveMetricKey]
      : samplingNote ?? '이번 커브에서는 뚜렷한 교정 신호가 감지되지 않았어요. 같은 리듬으로 다음 획을 그어보세요.',
    motion,
    ...(samplingNote ? { samplingNote } : {}),
  };
}

// ── Best/worst direction per set ─────────────────────────────────────────────

export interface CurveDirectionComparison {
  bestId: string;
  worstId: string;
  bestScore: number;
  worstScore: number;
}

export function curveDirectionComparison(
  attempts: CurveAttempt[],
): CurveDirectionComparison | null {
  const byId = new Map<string, number[]>();
  for (const a of attempts) {
    const id = a.guide.id;
    const score = a.analysis.metrics.averageGuideDistance;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id)!.push(score);
  }
  if (byId.size < 2) return null;
  const avg = (vs: number[]) => vs.reduce((s, v) => s + v, 0) / vs.length;
  const entries = [...byId.entries()].map(([id, vs]) => ({ id, score: avg(vs) }))
    .sort((a, b) => a.score - b.score);
  return {
    bestId: entries[0].id,
    bestScore: entries[0].score,
    worstId: entries[entries.length - 1].id,
    worstScore: entries[entries.length - 1].score,
  };
}

// ── Batch analysis ───────────────────────────────────────────────────────────

export interface CurveBatchAnalysis {
  totalAttempts: number;
  metrics: Record<CurveMetricKey, { mean: number; exceededFrequency: number }>;
  coreProblem: CurveMetricKey | null;
  halfComparison: ReturnType<typeof compareHalves<CurveMetricKey>>;
  directionComparison: CurveDirectionComparison | null;
  feedback: string;
  overlayPoints: { guideId: string; points: { x: number; y: number }[] }[];
}

export function analyzeCurveBatch(attempts: CurveAttempt[]): CurveBatchAnalysis {
  const keys = Object.keys(CURVE_TARGETS) as CurveMetricKey[];
  const mean = (vals: number[]) => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const metrics = Object.fromEntries(keys.map(k => {
    const vals = attempts.map(a => a.analysis.metrics[k]).filter(Number.isFinite);
    const avg = mean(vals);
    return [k, { mean: avg, exceededFrequency: attempts.length ? attempts.filter(a => a.analysis.metrics[k] > CURVE_TARGETS[k]).length / attempts.length : 0 }];
  })) as Record<CurveMetricKey, { mean: number; exceededFrequency: number }>;
  const meanMetrics = Object.fromEntries(keys.map(k => [k, metrics[k].mean])) as Record<CurveMetricKey, number>;
  const { key: coreProblem } = selectCoreProblem(meanMetrics, CURVE_TARGETS);
  const perAttempt = attempts.map(a => a.analysis.metrics);
  const halfComparison = compareHalves(perAttempt, keys);
  const overlayPoints = attempts.map(a => ({
    guideId: a.guide.id,
    points: compactOverlay(a.strokes.flatMap(s => s.points)),
  }));
  return {
    totalAttempts: attempts.length,
    metrics,
    coreProblem: coreProblem as CurveMetricKey | null,
    halfComparison,
    directionComparison: curveDirectionComparison(attempts),
    feedback: coreProblem ? CURVE_FEEDBACK[coreProblem as CurveMetricKey]
      : '이번 커브 세트에서는 뚜렷한 반복 문제가 보이지 않았어요. 현재 리듬을 유지하세요.',
    overlayPoints,
  };
}
