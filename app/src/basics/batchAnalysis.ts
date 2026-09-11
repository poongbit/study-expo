import { METRIC_LABELS, TARGETS, type Attempt, type MetricKey } from './straightLine';

export const PHASE_ID = 'level_0_line_control';
export const HABIT_MIN_FREQUENCY = .35;

export interface BatchStroke {
  attemptIndex: number;
  inputType: Attempt['inputType'];
  guideId: string;
  points: { x: number; y: number; t: number; pressure?: number }[];
  fragmentationCount: number;
}
export interface MetricAggregate { mean: number; standardDeviation: number; exceededFrequency: number }
export interface AttemptSummary {
  attemptIndex: number;
  guideId: string;
  inputType: Attempt['inputType'];
  durationMs: number;
  pointCount: number;
  strokeCount: number;
  metrics: Attempt['analysis']['metrics'];
  correction: MetricKey | null;
  samplingLimited: boolean;
  motion: { averageSpeed: number; pauseCount: number; startAlongError: number; endAlongError: number;
    wobbleBySection: { start: number; middle: number; end: number } };
  pressure?: { task: NonNullable<Attempt['pressureTask']>; available: boolean; mean?: number; variation?: number; change?: number; achieved?: boolean };
}
export interface BatchAnalysis {
  phaseId: typeof PHASE_ID;
  totalStrokes: number;
  inputType: Attempt['inputType'];
  strokeBatch: BatchStroke[];
  attemptSummaries: AttemptSummary[];
  metrics: Record<MetricKey, MetricAggregate>;
  dominantHabit: MetricKey | 'pressure' | null;
  feedback: string;
  pressureFailureFrequency?: number;
}

const HABIT_FEEDBACK: Record<MetricKey | 'pressure', string> = {
  extraStrokes: '이번 20획에서는 선을 중간에 끊어 다시 잇는 패턴이 반복됐어요. 다음 세트에서는 정확도보다 시작점에서 끝점까지 한 획으로 통과하는 데 집중해보세요.',
  backtracking: '이번 20획에서는 진행한 선을 되돌아가 덧고치는 패턴이 반복됐어요. 어긋나더라도 고치지 말고 끝점까지 통과한 뒤 다음 획에서 조정해보세요.',
  wobble: '이번 20획에서는 작은 좌우 흔들림이 반복됐어요. 그리기 전 화면 위에서 같은 동작을 두세 번 연습하고, 속도를 갑자기 늦추지 않은 채 한 번에 그어보세요.',
  deviation: '이번 20획에서는 선 전체가 가이드에서 벗어나는 패턴이 반복됐어요. 출발 전에 시작점과 끝점을 번갈아 본 뒤 팔 전체로 두 점을 잇는 경로를 만들어보세요.',
  endpoints: '이번 20획에서는 시작점이나 끝점에 닿지 못하는 패턴이 반복됐어요. 선을 긋기 전에 멈출 위치를 먼저 확인하고 끝점까지 시선을 보내보세요.',
  pressure: '이번 필압 세트에서는 목표한 힘의 변화가 반복해서 나타나지 않았어요. 다음에는 선의 위치보다 굵기 변화 한 가지에만 집중해보세요.',
};
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const standardDeviation = (values: number[], average: number) => Math.sqrt(mean(values.map(value => (value - average) ** 2)));
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function motionSummary(attempt: Attempt): AttemptSummary['motion'] {
  const guide = attempt.guide;
  const guideLength = distance(guide.start, guide.end);
  const ux = (guide.end.x - guide.start.x) / guideLength, uy = (guide.end.y - guide.start.y) / guideLength;
  const along = (point: { x: number; y: number }) => ((point.x - guide.start.x) * ux + (point.y - guide.start.y) * uy) / guideLength;
  const lateral = (point: { x: number; y: number }) => ((point.y - guide.start.y) * ux - (point.x - guide.start.x) * uy) / guideLength;
  const first = attempt.strokes[0].points[0];
  const finalStroke = attempt.strokes[attempt.strokes.length - 1];
  const last = finalStroke.points[finalStroke.points.length - 1];
  let pathLength = 0, durationMs = 0, pauseCount = 0;
  const sectionOffsets: number[][] = [[], [], []];
  for (const stroke of attempt.strokes) {
    durationMs = Math.max(durationMs, stroke.points.at(-1)?.t ?? 0);
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i];
      const segment = distance(a, b), elapsed = b.t - a.t;
      pathLength += segment;
      if (elapsed >= 120 && segment <= .025 && along(a) > .1 && along(a) < .9) pauseCount++;
      const progress = Math.max(0, Math.min(.999, (along(a) + along(b)) / 2));
      const section = Math.floor(progress * 3);
      if (!sectionOffsets[section].length) sectionOffsets[section].push(lateral(a));
      sectionOffsets[section].push(lateral(b));
    }
  }
  const sectionWobble = (values: number[]) => {
    if (values.length < 2) return 0;
    let travel = 0;
    for (let i = 1; i < values.length; i++) travel += Math.abs(values[i] - values[i - 1]);
    return Math.max(0, travel - Math.abs(values.at(-1)! - values[0]));
  };
  return { averageSpeed: durationMs > 0 ? pathLength / (durationMs / 1000) : 0, pauseCount,
    startAlongError: along(first), endAlongError: along(last) - 1,
    wobbleBySection: { start: sectionWobble(sectionOffsets[0]), middle: sectionWobble(sectionOffsets[1]), end: sectionWobble(sectionOffsets[2]) } };
}

export function analyzeBatch(attempts: Attempt[]): BatchAnalysis {
  const inputTypes = new Set(attempts.map(a => a.inputType));
  const inputType: Attempt['inputType'] = inputTypes.size === 1 ? attempts[0]?.inputType ?? 'MIXED' : 'MIXED';
  const keys = Object.keys(TARGETS) as MetricKey[];
  const metrics = Object.fromEntries(keys.map(key => {
    const values = attempts.map(a => a.analysis.metrics[key]).filter(Number.isFinite);
    const average = mean(values);
    return [key, {
      mean: average,
      standardDeviation: standardDeviation(values, average),
      exceededFrequency: attempts.length ? attempts.filter(a => a.analysis.metrics[key] > TARGETS[key]).length / attempts.length : 0,
    }];
  })) as Record<MetricKey, MetricAggregate>;
  const ranked = keys.map(key => {
    const stat = metrics[key];
    const scale = TARGETS[key] || 1;
    const excess = Math.max(0, stat.mean - TARGETS[key]) / scale;
    return { key: key as MetricKey | 'pressure', frequency: stat.exceededFrequency, severity: stat.exceededFrequency * (1 + excess) };
  });
  const pressureAttempts = attempts.filter(a => a.pressureTask && a.pressureAnalysis?.available);
  const pressureFailureFrequency = pressureAttempts.length
    ? pressureAttempts.filter(a => a.pressureAnalysis?.achieved === false).length / pressureAttempts.length : undefined;
  if (pressureFailureFrequency !== undefined) ranked.push({ key: 'pressure', frequency: pressureFailureFrequency, severity: pressureFailureFrequency * 2 });
  const dominant = ranked.filter(item => item.frequency >= HABIT_MIN_FREQUENCY).sort((a, b) => b.severity - a.severity)[0]?.key ?? null;
  return {
    phaseId: PHASE_ID,
    totalStrokes: attempts.length,
    inputType,
    strokeBatch: attempts.map((attempt, index) => ({
      attemptIndex: index + 1,
      inputType: attempt.inputType,
      guideId: 'id' in attempt.guide ? attempt.guide.id : 'horizontal-right',
      points: attempt.strokes.flatMap(stroke => stroke.points.map(point => ({ ...point }))),
      fragmentationCount: attempt.strokes.length,
    })),
    attemptSummaries: attempts.map((attempt, index) => {
      const points = attempt.strokes.flatMap(stroke => stroke.points);
      return {
        attemptIndex: index + 1,
        inputType: attempt.inputType,
        guideId: 'id' in attempt.guide ? attempt.guide.id : 'horizontal-right',
        durationMs: Math.round(points.reduce((longest, point) => Math.max(longest, point.t), 0)),
        pointCount: points.length,
        strokeCount: attempt.strokes.length,
        metrics: { ...attempt.analysis.metrics },
        correction: attempt.analysis.correction,
        samplingLimited: !!attempt.analysis.samplingNote,
        motion: motionSummary(attempt),
        ...(attempt.pressureTask && attempt.pressureAnalysis ? { pressure: {
          task: attempt.pressureTask, available: attempt.pressureAnalysis.available,
          ...(attempt.pressureAnalysis.mean !== undefined ? { mean: attempt.pressureAnalysis.mean } : {}),
          ...(attempt.pressureAnalysis.variation !== undefined ? { variation: attempt.pressureAnalysis.variation } : {}),
          ...(attempt.pressureAnalysis.change !== undefined ? { change: attempt.pressureAnalysis.change } : {}),
          ...(attempt.pressureAnalysis.achieved !== undefined ? { achieved: attempt.pressureAnalysis.achieved } : {}),
        } } : {}),
      };
    }),
    metrics,
    dominantHabit: dominant,
    feedback: dominant ? HABIT_FEEDBACK[dominant] : '이번 20획에서는 한 가지 문제가 반복적으로 두드러지지 않았어요. 현재 리듬을 유지하면서 다음 단계로 넘어가도 좋습니다.',
    ...(pressureFailureFrequency !== undefined ? { pressureFailureFrequency } : {}),
  };
}

export function aggregateText(key: MetricKey, value: number) {
  return key === 'extraStrokes' ? `${value.toFixed(1)}회` : `${(value * 100).toFixed(1)}%`;
}

export function habitLabel(key: BatchAnalysis['dominantHabit']) {
  return key === 'pressure' ? '필압 조절' : key ? METRIC_LABELS[key] : '뚜렷한 반복 습관 없음';
}
