// analyzeCircle.ts — circle/ellipse exercise analysis.
import { resamplePath, compactOverlay, computeMotion, selectCoreProblem, compareHalves } from './practiceEngine';
import type { PracticeStroke } from './straightLine';
import { sampleCircleGuide, type CircleGuide } from './circleExercises';

export type CircleMetricKey =
  | 'closureError'
  | 'centerError'
  | 'radiusVariance'
  | 'aspectRatio'
  | 'sectorDistortion'
  | 'junctionKink'
  | 'completionRatio';

export interface CircleMetrics {
  closureError: number;     // distance between start and end points (0–1)
  centerError: number;      // distance from actual centroid to guide centre (0–1)
  radiusVariance: number;   // std-dev of radii / mean radius (coefficient of variation)
  aspectRatio: number;      // |actual rx/ry - guide rx/ry| / guide rx/ry
  sectorDistortion: number; // std-dev of sector arc fractions
  junctionKink: number;     // angle change at the junction (radians, 0–PI)
  completionRatio: number;  // |totalAngle / (2*PI) - 1|
}

export interface CircleAnalysis {
  metrics: CircleMetrics;
  coreProblem: CircleMetricKey | null;
  feedback: string;
  motion: ReturnType<typeof computeMotion>;
  samplingNote?: string;
}

export interface CircleAttempt {
  schemaVersion: 1;
  exerciseId: 'circle-v1';
  metricVersion: 1;
  attemptId: string;
  previousAttemptId: string | null;
  createdAt: number;
  practiceSetId?: string;
  setRuleVersion?: 1;
  inputType: 'TOUCH' | 'STYLUS' | 'MIXED';
  guide: CircleGuide;
  strokes: PracticeStroke[];
  analysis: CircleAnalysis;
}

// Teaching targets — provisional engineering values.
export const CIRCLE_TARGETS: Record<CircleMetricKey, number> = {
  closureError:     0.030,
  centerError:      0.040,
  radiusVariance:   0.10,
  aspectRatio:      0.15,
  sectorDistortion: 0.10,
  junctionKink:     0.50,  // radians
  completionRatio:  0.10,
};

export const CIRCLE_METRIC_LABELS: Record<CircleMetricKey, string> = {
  closureError:     '원 폐쇄 오차',
  centerError:      '중심 위치 오차',
  radiusVariance:   '반지름 편차',
  aspectRatio:      '가로·세로 비율',
  sectorDistortion: '구간별 찌그러짐',
  junctionKink:     '접합부 꺾임',
  completionRatio:  '한 바퀴 완성도',
};

const CIRCLE_FEEDBACK: Record<CircleMetricKey, string> = {
  closureError:     '시작점 대신 원 전체 궤적을 보며 한 바퀴를 통과하세요.',
  centerError:      '가이드 중심점을 기준으로 시작점 위치를 먼저 확인하세요.',
  radiusVariance:   '중심점을 응시하면서 팔 전체로 원을 그리세요.',
  aspectRatio:      '가로·세로 비율을 공중에서 여러 번 연습한 뒤 그리세요.',
  sectorDistortion: '찌그러진 구간에 진입하기 전에 속도와 힘을 일정하게 유지하세요.',
  junctionKink:     '시작 전 원을 공중에서 반복 회전한 뒤 같은 속도로 완주하세요.',
  completionRatio:  '한 바퀴를 공중에서 여러 번 연습한 뒤 정확히 한 번 완주하세요.',
};

const dist2d = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

export function analyzeCircle(strokes: PracticeStroke[], guide: CircleGuide): CircleAnalysis {
  const allPoints = strokes.flatMap(s => s.points);
  const pts = allPoints.map(p => ({ x: p.x, y: p.y }));
  const n = pts.length;
  if (n < 4) {
    const motion = computeMotion(strokes);
    return {
      metrics: { closureError: 1, centerError: 1, radiusVariance: 1, aspectRatio: 1, sectorDistortion: 1, junctionKink: Math.PI, completionRatio: 1 },
      coreProblem: 'closureError',
      feedback: '점이 너무 적어요. 원을 한 번 더 그려주세요.',
      motion,
      samplingNote: '점이 너무 적어 분석이 제한됩니다.',
    };
  }

  const first = pts[0];
  const last = pts[n - 1];

  // --- closureError ---
  const closureError = dist2d(first, last);

  // --- centroid and radii ---
  const cx = pts.reduce((s, p) => s + p.x, 0) / n;
  const cy = pts.reduce((s, p) => s + p.y, 0) / n;
  const radii = pts.map(p => dist2d(p, { x: cx, y: cy }));
  const meanRadius = radii.reduce((s, r) => s + r, 0) / n;
  const radiusVariance = meanRadius > 0
    ? Math.sqrt(radii.reduce((s, r) => s + (r - meanRadius) ** 2, 0) / n) / meanRadius
    : 0;

  // --- centerError ---
  const centerError = dist2d({ x: cx, y: cy }, { x: guide.cx, y: guide.cy });

  // --- aspectRatio ---
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const actualRx = (Math.max(...xs) - Math.min(...xs)) / 2;
  const actualRy = (Math.max(...ys) - Math.min(...ys)) / 2;
  const guideRatio = guide.rx / (guide.ry || 1);
  const actualRatio = actualRx / (actualRy || 1);
  const aspectRatio = Math.abs(actualRatio - guideRatio) / (guideRatio || 1);

  // --- sectorDistortion (12 sectors) ---
  const SECTORS = 12;
  const sectorCounts = new Array(SECTORS).fill(0);
  for (const p of pts) {
    const angle = Math.atan2(p.y - cy, p.x - cx);
    const sector = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * SECTORS) % SECTORS;
    sectorCounts[sector]++;
  }
  const expectedPerSector = n / SECTORS;
  const sectorDistortion = Math.sqrt(
    sectorCounts.reduce((s, c) => s + ((c - expectedPerSector) / expectedPerSector) ** 2, 0) / SECTORS
  );

  // --- junctionKink ---
  // Angle change in the last few points before and after the junction
  const K = Math.min(5, Math.floor(n / 4));
  let junctionKink = 0;
  if (K >= 2) {
    const vecBefore = { x: pts[n - 1].x - pts[n - K].x, y: pts[n - 1].y - pts[n - K].y };
    const vecAfter  = { x: pts[K - 1].x - pts[0].x,     y: pts[K - 1].y - pts[0].y };
    const lenB = Math.hypot(vecBefore.x, vecBefore.y), lenA = Math.hypot(vecAfter.x, vecAfter.y);
    if (lenB > 0 && lenA > 0) {
      const dot = (vecBefore.x * vecAfter.x + vecBefore.y * vecAfter.y) / (lenB * lenA);
      junctionKink = Math.acos(Math.max(-1, Math.min(1, dot)));
    }
  }

  // --- completionRatio ---
  // Compute total angular sweep
  let totalAngle = 0;
  for (let i = 1; i < n; i++) {
    const a1 = Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
    const a2 = Math.atan2(pts[i].y - cy, pts[i].x - cx);
    let da = a2 - a1;
    if (guide.clockwise) {
      if (da < 0) da += 2 * Math.PI;
    } else {
      if (da > 0) da -= 2 * Math.PI;
    }
    totalAngle += Math.abs(da);
  }
  const completionRatio = Math.abs(totalAngle / (2 * Math.PI) - 1);

  const metrics: CircleMetrics = {
    closureError,
    centerError,
    radiusVariance,
    aspectRatio,
    sectorDistortion,
    junctionKink,
    completionRatio,
  };

  const { key: coreProblem } = selectCoreProblem(metrics, CIRCLE_TARGETS);
  const samplingNote = n < 8 ? '기록된 점이 너무 적어 분석이 제한됩니다.' : undefined;
  const motion = computeMotion(strokes);

  return {
    metrics,
    coreProblem: coreProblem as CircleMetricKey | null,
    feedback: coreProblem ? CIRCLE_FEEDBACK[coreProblem as CircleMetricKey]
      : samplingNote ?? '이번 원에서는 뚜렷한 교정 신호가 감지되지 않았어요. 같은 리듬으로 다음 원을 그려보세요.',
    motion,
    ...(samplingNote ? { samplingNote } : {}),
  };
}

// ── Best/worst size and direction per set ────────────────────────────────────

export interface CircleDirectionComparison {
  cwMeanError: number;
  ccwMeanError: number;
  betterDirection: 'clockwise' | 'counterClockwise' | 'equal';
}

export function circleDirectionComparison(attempts: CircleAttempt[]): CircleDirectionComparison | null {
  const cw  = attempts.filter(a =>  a.guide.clockwise).map(a => a.analysis.metrics.radiusVariance);
  const ccw = attempts.filter(a => !a.guide.clockwise).map(a => a.analysis.metrics.radiusVariance);
  if (!cw.length || !ccw.length) return null;
  const avg = (vs: number[]) => vs.reduce((s, v) => s + v, 0) / vs.length;
  const cwMean = avg(cw), ccwMean = avg(ccw);
  return {
    cwMeanError: cwMean,
    ccwMeanError: ccwMean,
    betterDirection: Math.abs(cwMean - ccwMean) < 0.02 ? 'equal' : cwMean < ccwMean ? 'clockwise' : 'counterClockwise',
  };
}

// ── Batch analysis ───────────────────────────────────────────────────────────

export interface CircleBatchAnalysis {
  totalAttempts: number;
  metrics: Record<CircleMetricKey, { mean: number; exceededFrequency: number }>;
  coreProblem: CircleMetricKey | null;
  halfComparison: ReturnType<typeof compareHalves<CircleMetricKey>>;
  directionComparison: CircleDirectionComparison | null;
  feedback: string;
  overlayPoints: { guideId: string; points: { x: number; y: number }[] }[];
}

export function analyzeCircleBatch(attempts: CircleAttempt[]): CircleBatchAnalysis {
  const keys = Object.keys(CIRCLE_TARGETS) as CircleMetricKey[];
  const mean = (vals: number[]) => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const metrics = Object.fromEntries(keys.map(k => {
    const vals = attempts.map(a => a.analysis.metrics[k]).filter(Number.isFinite);
    const avg = mean(vals);
    return [k, { mean: avg, exceededFrequency: attempts.length ? attempts.filter(a => a.analysis.metrics[k] > CIRCLE_TARGETS[k]).length / attempts.length : 0 }];
  })) as Record<CircleMetricKey, { mean: number; exceededFrequency: number }>;
  const meanMetrics = Object.fromEntries(keys.map(k => [k, metrics[k].mean])) as Record<CircleMetricKey, number>;
  const { key: coreProblem } = selectCoreProblem(meanMetrics, CIRCLE_TARGETS);
  const perAttempt = attempts.map(a => a.analysis.metrics);
  const halfComparison = compareHalves(perAttempt, keys);
  const overlayPoints = attempts.map(a => ({
    guideId: a.guide.id,
    points: compactOverlay(a.strokes.flatMap(s => s.points)),
  }));
  return {
    totalAttempts: attempts.length,
    metrics,
    coreProblem: coreProblem as CircleMetricKey | null,
    halfComparison,
    directionComparison: circleDirectionComparison(attempts),
    feedback: coreProblem ? CIRCLE_FEEDBACK[coreProblem as CircleMetricKey]
      : '이번 원 세트에서는 뚜렷한 반복 문제가 보이지 않았어요. 현재 리듬을 유지하세요.',
    overlayPoints,
  };
}
