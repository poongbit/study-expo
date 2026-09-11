import { analyzeLineV1 } from './straightLineV1';
import type { InputType, StrokePoint } from '../types/drawing';
import { isKnownGuide, LINE_GUIDES, type GuideGeometry, type LineGuide, type PressureTask } from './lineExercises';

export const EXERCISE_ID = 'straight-line-v1';
export const METRIC_VERSION = 3;
export const GUIDE = LINE_GUIDES[0];
const LEGACY_GUIDE: GuideGeometry = { start: { x: .15, y: .5 }, end: { x: .85, y: .5 } };
export type MetricKey = 'endpoints' | 'deviation' | 'extraStrokes' | 'wobble' | 'backtracking';
export interface PracticeStroke {
  strokeId: string;
  inputType: InputType;
  startedAt: number;
  points: StrokePoint[];
}
export interface LineMetrics { endpoints: number; deviation: number; extraStrokes: number; wobble: number; backtracking: number }
export interface LineAnalysis {
  metrics: LineMetrics;
  correction: MetricKey | null;
  feedback: string;
  samplingNote?: string;
}
export interface PressureAnalysis {
  available: boolean;
  mean?: number;
  variation?: number;
  change?: number;
  achieved?: boolean;
  feedback: string;
}
export interface Attempt {
  schemaVersion: 1;
  practiceSetId?: string;
  setRuleVersion?: 1 | 2 | 3 | 4;
  exerciseId: typeof EXERCISE_ID;
  metricVersion: number;
  attemptId: string;
  previousAttemptId: string | null;
  createdAt: number;
  inputType: InputType | 'MIXED';
  guide: GuideGeometry | LineGuide;
  pressureTask?: PressureTask;
  pressureBaseline?: number;
  pressureAnalysis?: PressureAnalysis;
  strokes: PracticeStroke[];
  analysis: LineAnalysis;
}

// Teaching priorities are informed by the sources in docs/line-coaching.md.
// Numerical tolerances are provisional engineering settings, not educator norms.
export const TARGETS: Record<MetricKey, number> = {
  endpoints: 0.025, deviation: 0.008, extraStrokes: 0, wobble: 0.03, backtracking: 0.015,
};
export const METRIC_LABELS: Record<MetricKey, string> = {
  wobble: '반복 흔들림', backtracking: '되돌아간 거리', extraStrokes: '추가로 나눈 횟수',
  deviation: '가이드에서 벗어난 정도', endpoints: '시작·끝점 오차',
};
const FEEDBACK: Record<MetricKey, string> = {
  wobble: '작은 굴곡이 반복되고 있어요. 다음 선은 화면에 닿지 않게 같은 동작을 2~3번 연습한 뒤, 그 리듬으로 한 번에 그어보세요.',
  backtracking: '선이 진행 방향과 반대로 되돌아간 부분이 있어요. 이번에는 덧고치지 말고 끝점 방향으로 이어간 뒤 펜을 떼어보세요.',
  extraStrokes: '이번 직선을 여러 획으로 나눠 그렸어요. 다음에는 화면 위에서 동작을 미리 연습한 뒤 한 획으로 이어보세요.',
  deviation: '반복 흔들림보다 전체 경로가 가이드에서 벗어난 점이 보여요. 화면에 닿지 않게 두 점을 잇는 동작을 연습하고, 같은 경로로 한 번 그어보세요.',
  endpoints: '끝점 위치를 연습할 차례예요. 긋기 전에 출발점과 멈출 점을 번갈아 확인하고, 미리 연습한 동작으로 한 번 이어보세요.',
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

export function validateStrokes(strokes: PracticeStroke[]): string | null {
  if (!strokes.length) return '시작점에서 끝점까지 선을 먼저 그려주세요.';
  let length = 0;
  for (const stroke of strokes) {
    if (stroke.points.length < 2) return '점만 찍힌 부분이 있어요. 지우고 선을 길게 그려주세요.';
    for (let i = 0; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      if (![p.x, p.y, p.t].every(Number.isFinite) || (p.pressure !== undefined && (!Number.isFinite(p.pressure) || p.pressure < 0 || p.pressure > 1)) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1 || p.t < 0 || (i > 0 && p.t < stroke.points[i - 1].t))
        return '입력 기록을 읽을 수 없어요. 지우고 다시 그려주세요.';
      if (i) length += distance(p, stroke.points[i - 1]);
    }
  }
  return length < 0.05 ? '선이 너무 짧아요. 두 점 사이를 길게 이어주세요.' : null;
}

// Spatial simplification suppresses subpixel noise without depending on time or
// point density. Iterative RDP avoids recursion depth failures on long strokes.
function simplify(points: StrokePoint[], epsilon = 0.0015): StrokePoint[] {
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    const a = points[start], b = points[end];
    const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
    let furthest = -1, maxDistance = epsilon;
    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      const t = squared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / squared)) : 0;
      const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
      if (d > maxDistance) { furthest = i; maxDistance = d; }
    }
    if (furthest >= 0) { keep.add(furthest); stack.push([start, furthest], [furthest, end]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

export function analyzeLine(strokes: PracticeStroke[], guide: GuideGeometry = GUIDE): LineAnalysis {
  const invalid = validateStrokes(strokes);
  if (invalid) throw new Error(invalid);
  const first = strokes[0].points[0];
  const lastStroke = strokes[strokes.length - 1];
  const last = lastStroke.points[lastStroke.points.length - 1];
  let weightedDeviation = 0, pathLength = 0, wobbleDistance = 0, backwardsDistance = 0;
  let distinctSamples = 1, largestGap = 0;
  const guideLength = distance(guide.start, guide.end);
  const ux = (guide.end.x - guide.start.x) / guideLength;
  const uy = (guide.end.y - guide.start.y) / guideLength;
  const along = (p: StrokePoint) => (p.x - guide.start.x) * ux + (p.y - guide.start.y) * uy;
  const lateral = (p: StrokePoint) => (p.y - guide.start.y) * ux - (p.x - guide.start.x) * uy;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i];
      const segmentLength = distance(a, b);
      if (segmentLength > 1e-6) distinctSamples++;
      largestGap = Math.max(largestGap, segmentLength);
      const da = lateral(a), db = lateral(b);
      const absSum = Math.abs(da) + Math.abs(db);
      const meanDistance = da * db < 0 ? (da * da + db * db) / (2 * absSum) : absSum / 2;
      weightedDeviation += segmentLength * meanDistance;
      pathLength += segmentLength;
    }
    // Measure reversals along the requested guide axis, independent of its angle.
    let peak = along(stroke.points[0]), trough = peak, descending = false;
    const deadband = 0.002;
    for (const p of stroke.points) {
      const progress = along(p);
      if (!descending) {
        peak = Math.max(peak, progress);
        if (progress < peak - deadband) { descending = true; trough = progress; }
      } else {
        trough = Math.min(trough, progress);
        if (progress > trough + deadband) {
          backwardsDistance += Math.max(0, peak - trough - deadband);
          descending = false; peak = progress;
        }
      }
    }
    if (descending) backwardsDistance += Math.max(0, peak - trough - deadband);
    const points = simplify(stroke.points);
    const a = points[0], b = points[points.length - 1];
    const chord = distance(a, b);
    const dx = chord ? (b.x - a.x) / chord : 1;
    const dy = chord ? (b.y - a.y) / chord : 0;
    const offsets = points.map(p => (p.y - a.y) * dx - (p.x - a.x) * dy);
    let lateralTravel = 0, largestExcursion = 0;
    for (let i = 0; i < points.length; i++) {
      largestExcursion = Math.max(largestExcursion, Math.abs(offsets[i]));
      if (i) {
        lateralTravel += Math.abs(offsets[i] - offsets[i - 1]);
      }
    }
    // A single broad arc is not repeated wobble. Discount that excursion;
    // further side-to-side travel is assessed independently of guide proximity.
    wobbleDistance += Math.max(0, lateralTravel - 2 * largestExcursion);
  }
  const metrics: LineMetrics = {
    endpoints: (distance(first, guide.start) + distance(last, guide.end)) / 2,
    deviation: weightedDeviation / pathLength,
    extraStrokes: strokes.length - 1,
    wobble: wobbleDistance / guideLength,
    backtracking: backwardsDistance / guideLength,
  };
  // Flow before accuracy in this one-stroke exercise. This is not a rule for
  // finished illustrations, where multiple intentional strokes can be useful.
  const priorities: MetricKey[] = ['extraStrokes', 'backtracking', 'wobble', 'deviation', 'endpoints'];
  const correction = priorities.find(key => metrics[key] > TARGETS[key]) ?? null;
  const samplingNote = distinctSamples < 8 || largestGap > 0.06
    ? '기록된 점이 적거나 간격이 넓어 잔흔들림을 충분히 판단하기 어려워요.' : undefined;
  return {
    metrics, correction, samplingNote,
    feedback: correction ? FEEDBACK[correction] : samplingNote
      ? samplingNote + ' 다음 선도 편한 리듬으로 그려보세요.'
      : '이번 기록에서는 뚜렷한 반복 흔들림이나 되돌아감이 감지되지 않았어요. 같은 리듬으로 한 번 더 그려보세요.',
  };
}

export function analyzePressure(strokes: PracticeStroke[], task: PressureTask, baseline?: number): PressureAnalysis {
  if (strokes.some(s => s.inputType !== 'STYLUS')) return { available: false, feedback: '필압 평가는 Apple Pencil 입력에서만 제공해요.' };
  const values = strokes.flatMap(s => s.points.map(p => p.pressure).filter((p): p is number => p !== undefined && Number.isFinite(p)));
  if (values.length < 8 || Math.max(...values) <= 0) return { available: false, feedback: '이 기기에서 필압 값이 충분히 들어오지 않아 선의 방향과 흐름만 평가했어요.' };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  const variation = deviation / Math.max(mean, .03);
  const third = Math.max(1, Math.floor(values.length / 3));
  const sectionMean = (items: number[]) => items.reduce((sum, value) => sum + value, 0) / items.length;
  const start = sectionMean(values.slice(0, third));
  const end = sectionMean(values.slice(-third));
  const change = end - start;
  if (baseline === undefined && ['light', 'increase', 'decrease'].includes(task))
    return { available: false, mean, variation, change, feedback: '첫 획의 편한 필압 기준이 없어 이 과제의 판정을 보류했어요. 새 필압 세트에서 Apple Pencil로 첫 획부터 시작해보세요.' };
  let achieved = true;
  let feedback = `편한 필압의 기준을 ${(mean * 100).toFixed(0)}%로 기록했어요.`;
  if (task === 'steady') { achieved = variation <= .2; feedback = achieved ? '처음부터 끝까지 필압이 비교적 일정했어요.' : '필압이 자주 달라졌어요. 손에 힘을 고정하기보다 팔의 이동을 일정하게 해보세요.'; }
  if (task === 'light') { achieved = baseline !== undefined && mean <= baseline * .8; feedback = baseline === undefined ? '먼저 편한 필압을 기록해야 가벼운 필압을 비교할 수 있어요.' : achieved ? '개인 기준보다 가볍게 유지했어요.' : '편한 필압과 비슷했어요. 펜을 쥐는 힘을 조금 풀어보세요.'; }
  const neededChange = Math.max(.05, (baseline ?? mean) * .2);
  if (task === 'increase') { achieved = change >= neededChange; feedback = achieved ? '끝으로 갈수록 필압이 분명하게 강해졌어요.' : '필압 증가가 뚜렷하지 않아요. 시작을 더 가볍게 두고 서서히 힘을 더해보세요.'; }
  if (task === 'decrease') { achieved = change <= -neededChange; feedback = achieved ? '끝으로 갈수록 필압이 부드럽게 약해졌어요.' : '필압 감소가 뚜렷하지 않아요. 끝점에 가까워질수록 펜을 살짝 들어보세요.'; }
  return { available: true, mean, variation, change, achieved, feedback };
}

export function inputTypeOf(strokes: PracticeStroke[]): Attempt['inputType'] {
  const types = new Set(strokes.map(s => s.inputType));
  return types.size > 1 ? 'MIXED' : strokes[0].inputType;
}
export function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`; }
export function createAttempt(strokes: PracticeStroke[], previous: Attempt | null, options: { guide?: LineGuide; pressureTask?: PressureTask; pressureBaseline?: number } = {}): Attempt {
  const guide = options.guide ?? GUIDE;
  const pressureAnalysis = options.pressureTask ? analyzePressure(strokes, options.pressureTask, options.pressureBaseline) : undefined;
  return {
    schemaVersion: 1, exerciseId: EXERCISE_ID, metricVersion: METRIC_VERSION,
    attemptId: newId(), previousAttemptId: previous?.attemptId ?? null, createdAt: Date.now(),
    inputType: inputTypeOf(strokes), guide,
    ...(options.pressureTask ? { pressureTask: options.pressureTask, ...(options.pressureBaseline !== undefined ? { pressureBaseline: options.pressureBaseline } : {}), pressureAnalysis } : {}),
    strokes: strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })),
    analysis: analyzeLine(strokes, guide),
  };
}
export function metricText(key: MetricKey, value: number) {
  return key === 'extraStrokes' ? `${value}회` : `${(value * 100).toFixed(1)}%`;
}
export function compareAttempts(previous: Attempt | null, current: Attempt): string {
  if (!previous) return '첫 기록이에요. 다시 그리면 이번 교정 항목이 어떻게 달라졌는지 보여드릴게요.';
  if (previous.exerciseId !== current.exerciseId || previous.metricVersion !== current.metricVersion || JSON.stringify(previous.guide) !== JSON.stringify(current.guide))
    return '연습 기준이 달라져 이번 기록부터 새로 비교합니다.';
  if (previous.inputType !== current.inputType || current.inputType === 'MIXED')
    return '입력 도구가 달라 직접 비교하지 않아요. 같은 도구로 다시 그려보세요.';
  const key = previous.analysis.correction;
  if ((!key || key === 'wobble') && (previous.analysis.samplingNote || current.analysis.samplingNote)) return '기록 간격이 넓은 시도가 있어 잔흔들림의 전후 비교는 보류했어요.';
  if (!key) return current.analysis.correction ? '이번에 관찰된 항목을 기준으로 다음 선을 연습해보세요.' : '두 기록에서 뚜렷한 교정 신호가 감지되지 않았어요. 지금의 리듬을 이어가세요.';
  const before = previous.analysis.metrics[key], after = current.analysis.metrics[key];
  const beforeError = Math.max(0, before - TARGETS[key]);
  const afterError = Math.max(0, after - TARGETS[key]);
  const tolerance = key === 'extraStrokes' ? 0 : 0.001;
  const change = Math.abs(beforeError - afterError) <= tolerance ? '비슷해요' : afterError < beforeError ? '이 항목의 오차가 줄었어요' : '이 항목의 오차가 늘었어요';
  return `지난 교정 · ${METRIC_LABELS[key]}: ${metricText(key, before)} → ${metricText(key, after)}. ${change}.`;
}

export function parseAttempt(text: string): Attempt {
  const a = JSON.parse(text) as Attempt;
  if (!a || a.schemaVersion !== 1 || a.exerciseId !== EXERCISE_ID || ![1, 2, METRIC_VERSION].includes(a.metricVersion) ||
      typeof a.attemptId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(a.attemptId) ||
      !(a.previousAttemptId === null || typeof a.previousAttemptId === 'string') ||
      !Number.isFinite(a.createdAt) || (a.metricVersion < 3 ? JSON.stringify(a.guide) !== JSON.stringify(LEGACY_GUIDE) : !isKnownGuide(a.guide)) ||
      !Array.isArray(a.strokes) || !a.strokes.every(s => s && typeof s.strokeId === 'string' &&
        (s.inputType === 'TOUCH' || s.inputType === 'STYLUS') && Number.isFinite(s.startedAt) && Array.isArray(s.points) && s.points.every(p => p && typeof p === 'object')) ||
      validateStrokes(a.strokes) || a.inputType !== inputTypeOf(a.strokes)) throw new Error('지원하지 않거나 손상된 연습 기록입니다.');
  if ((a.practiceSetId !== undefined || a.setRuleVersion !== undefined) &&
      (typeof a.practiceSetId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(a.practiceSetId) || ![1, 2, 3, 4].includes(a.setRuleVersion as number)))
    throw new Error('지원하지 않는 세트 기록입니다.');
  if (a.pressureTask !== undefined && (!['natural', 'steady', 'light', 'increase', 'decrease'].includes(a.pressureTask) || a.metricVersion < 3)) throw new Error('지원하지 않는 필압 기록입니다.');
  if (a.pressureBaseline !== undefined && (!Number.isFinite(a.pressureBaseline) || a.pressureBaseline < 0 || a.pressureBaseline > 1)) throw new Error('손상된 필압 기준입니다.');
  // Derive analysis from validated raw strokes; never trust cached numeric results.
  return { ...a, analysis: a.metricVersion === 1 ? analyzeLineV1(a.strokes) : analyzeLine(a.strokes, a.guide),
    ...(a.pressureTask ? { pressureAnalysis: analyzePressure(a.strokes, a.pressureTask, a.pressureBaseline) } : {}) };
}
