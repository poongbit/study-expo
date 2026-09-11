import { METRIC_LABELS, METRIC_VERSION, TARGETS, metricText, type Attempt, type MetricKey } from './straightLine';
import { analyzeBatch } from './batchAnalysis';

export const SET_SIZE = 20;
export const REQUIRED_SUCCESSES = 12;
export const SET_RULE_VERSION = 4;
export type GoalStatus = 'achieved' | 'practice' | 'pending';
export const GOAL_LABELS: Record<GoalStatus, string> = {
  achieved: '목표 달성', practice: '연습 중', pending: '판정 보류',
};
export function goalStatus(attempt: Attempt): GoalStatus {
  if (attempt.metricVersion !== METRIC_VERSION || attempt.analysis.samplingNote || attempt.inputType === 'MIXED') return 'pending';
  if (attempt.pressureTask && !attempt.pressureAnalysis?.available) return 'pending';
  if (attempt.pressureTask && attempt.pressureAnalysis?.achieved === false) return 'practice';
  const keys = Object.keys(TARGETS) as MetricKey[];
  if (keys.some(k => !Number.isFinite(attempt.analysis.metrics[k]))) return 'pending';
  return keys.every(k => attempt.analysis.metrics[k] <= TARGETS[k]) ? 'achieved' : 'practice';
}
export function attemptsInSet(history: Attempt[], setId: string): Attempt[] {
  const unique = new Map(history.filter(a => a.practiceSetId === setId && a.setRuleVersion === SET_RULE_VERSION).map(a => [a.attemptId, a]));
  return [...unique.values()].sort((a, b) => a.createdAt - b.createdAt).slice(0, SET_SIZE);
}
export function latestSetId(history: Attempt[]): string | null {
  return history.filter(a => a.practiceSetId && a.setRuleVersion === SET_RULE_VERSION).sort((a,b) => b.createdAt - a.createdAt)[0]?.practiceSetId ?? null;
}
export function summarizeSet(attempts: Attempt[]) {
  const statuses = attempts.map(goalStatus);
  const achieved = statuses.filter(s => s === 'achieved').length;
  const pending = statuses.filter(s => s === 'pending').length;
  const complete = attempts.length >= SET_SIZE;
  const recommended = complete && achieved >= REQUIRED_SUCCESSES;
  const first = attempts[0], last = attempts.at(-1);
  let improvement = '이번 세트에서는 뚜렷하게 줄어든 항목을 확인하지 못했어요. 다음 연습에서 한 가지만 살펴보세요.';
  if (first && last && first !== last && first.metricVersion === last.metricVersion && first.inputType === last.inputType && first.inputType !== 'MIXED') {
    const candidates = (Object.keys(TARGETS) as MetricKey[])
      .filter(key => key !== 'wobble' || (!first.analysis.samplingNote && !last.analysis.samplingNote))
      .map(key => ({ key, reduction: (Math.max(0, first.analysis.metrics[key] - TARGETS[key]) - Math.max(0, last.analysis.metrics[key] - TARGETS[key])) / (TARGETS[key] || 1) }))
      .filter(item => Number.isFinite(item.reduction) && item.reduction > 0.05)
      .sort((a,b) => b.reduction - a.reduction);
    if (candidates.length) {
      const key = candidates[0].key;
      improvement = `첫 선 → 마지막 선에서 가장 줄어든 항목은 ${METRIC_LABELS[key]}예요: ${metricText(key, first.analysis.metrics[key])} → ${metricText(key, last.analysis.metrics[key])}.`;
    }
  } else if (complete) improvement = '입력 도구나 측정 기준이 달라 첫 선과 마지막 선의 개선 비교는 보류했어요.';
  const pressureIssue = last?.pressureTask && (!last.pressureAnalysis?.available || last.pressureAnalysis.achieved === false) ? last.pressureAnalysis?.feedback : undefined;
  const remaining = pressureIssue ?? (last?.analysis.samplingNote
    ? '기록이 부족한 선이 있어요. 다음 연습에서는 같은 입력 도구로 편한 리듬을 이어가세요.'
    : last?.analysis.correction ? last.analysis.feedback : '다음 연습에서도 덧고치지 않고 한 번에 이어가는 리듬을 유지해보세요.');
  return { statuses, achieved, pending, complete, recommended, improvement, remaining, batch: analyzeBatch(attempts) };
}
