// Frozen v1 rules: retain the interpretation of already-saved attempts.
import type { LineAnalysis, LineMetrics, PracticeStroke } from './straightLine';
const GUIDE = { start: { x: .15, y: .5 }, end: { x: .85, y: .5 } };
const TARGETS = { endpoints: 0.04, deviation: 0.015, extraStrokes: 0 };
const FEEDBACK = {
  endpoints: '이번에는 왼쪽 점에서 시작해서 오른쪽 점까지 선을 이어보세요.',
  deviation: '이번에는 오른쪽 끝점을 바라보며 가이드를 따라 천천히 그어보세요.',
  extraStrokes: '이번에는 중간에 떼지 않고 한 번에 길게 그어보세요.',
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function validateStrokes(strokes: PracticeStroke[]): string | null {
  if (!strokes.length) return '왼쪽 점에서 오른쪽 점까지 선을 먼저 그려주세요.';
  let length = 0;
  for (const stroke of strokes) {
    if (stroke.points.length < 2) return '점만 찍힌 부분이 있어요. 지우고 선을 길게 그려주세요.';
    for (let i = 0; i < stroke.points.length; i++) {
      const point = stroke.points[i];
      if (![point.x, point.y, point.t].every(Number.isFinite) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1 || point.t < 0 || (i > 0 && point.t < stroke.points[i - 1].t))
        return '입력 기록을 읽을 수 없어요. 지우고 다시 그려주세요.';
      if (i) length += distance(point, stroke.points[i - 1]);
    }
  }
  return length < .05 ? '선이 너무 짧아요. 두 점 사이를 길게 이어주세요.' : null;
}
export function analyzeLineV1(strokes: PracticeStroke[]): LineAnalysis {
  const invalid = validateStrokes(strokes);
  if (invalid) throw new Error(invalid);
  const first = strokes[0].points[0];
  const lastStroke = strokes[strokes.length - 1];
  const last = lastStroke.points[lastStroke.points.length - 1];
  let weightedDeviation = 0;
  let pathLength = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1], b = stroke.points[i];
      const segmentLength = distance(a, b);
      // Integrate distance to the guide by path length, not point count:
      // pausing (many samples at one point) cannot bias the result.
      const da = a.y - GUIDE.start.y, db = b.y - GUIDE.start.y;
      const absSum = Math.abs(da) + Math.abs(db);
      const meanDistance = da * db < 0 ? (da * da + db * db) / (2 * absSum) : absSum / 2;
      weightedDeviation += segmentLength * meanDistance;
      pathLength += segmentLength;
    }
  }
  const metrics: LineMetrics = {
    endpoints: (distance(first, GUIDE.start) + distance(last, GUIDE.end)) / 2,
    deviation: weightedDeviation / pathLength,
    extraStrokes: strokes.length - 1,
    wobble: 0, backtracking: 0,
  };
  const ranked: { key: keyof typeof FEEDBACK; severity: number }[] = [
    { key: 'endpoints', severity: Math.max(0, metrics.endpoints - TARGETS.endpoints) / 0.1 },
    { key: 'deviation', severity: Math.max(0, metrics.deviation - TARGETS.deviation) / 0.05 },
    { key: 'extraStrokes', severity: metrics.extraStrokes / 2 },
  ];
  ranked.sort((a, b) => b.severity - a.severity);
  const correction = ranked[0].severity > 0 ? ranked[0].key : null;
  return { metrics, correction, feedback: correction ? FEEDBACK[correction] : '이번 직선은 연습 목표 범위 안에 있어요. 한 번 더 같은 느낌으로 그려보세요.' };
}
