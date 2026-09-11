/**
 * Mappings for ML prediction classes to user-friendly feedback strings.
 */

export const FEEDBACK_MAPPING: Record<string, string> = {
  'GOOD': '현재 임시 규칙에서 교정할 항목이 탐지되지 않았어요.',
  'HEAD_TOO_WIDE': '머리의 가로 폭을 조금 줄여보세요.',
  'HEAD_TOO_TALL': '머리가 세로로 조금 길어요. 높이를 조금 줄여보세요.',
  'EYES_TOO_WIDE': '두 눈 사이의 간격을 조금 좁혀보세요.',
  'EYES_UNBALANCED': '두 눈의 높이를 맞춰보세요.',
  'TORSO_TOO_LONG': '몸통 길이를 조금 줄여보세요.',
  'BODY_OFF_CENTER': '몸통 중심을 머리 중심에 조금 더 맞춰보세요.',
  'STROKE_TOO_FRAGMENTED': '선을 너무 자주 끊지 말고 조금 더 길게 이어서 그려보세요.'
};

export function getFeedbackText(label: string): string {
  return FEEDBACK_MAPPING[label] || '분석 결과를 확인해 주세요.';
}
