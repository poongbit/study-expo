export interface GuidePoint { x: number; y: number }
export interface GuideGeometry { start: GuidePoint; end: GuidePoint }
export interface LineGuide extends GuideGeometry {
  id: 'horizontal-right' | 'vertical-down' | 'diagonal-down' | 'diagonal-up' | 'horizontal-left' |
    'vertical-up' | 'diagonal-down-left' | 'diagonal-up-left';
  label: string;
  instruction: string;
  start: GuidePoint;
  end: GuidePoint;
}

export const LINE_GUIDES: readonly LineGuide[] = [
  { id: 'horizontal-right', label: '가로 · 오른쪽', instruction: '왼쪽 점에서 오른쪽 점까지', start: { x: .15, y: .5 }, end: { x: .85, y: .5 } },
  { id: 'vertical-down', label: '세로 · 아래쪽', instruction: '위쪽 점에서 아래쪽 점까지', start: { x: .5, y: .15 }, end: { x: .5, y: .85 } },
  { id: 'diagonal-down', label: '대각선 · 오른쪽 아래', instruction: '왼쪽 위에서 오른쪽 아래까지', start: { x: .22, y: .22 }, end: { x: .78, y: .78 } },
  { id: 'diagonal-up', label: '대각선 · 오른쪽 위', instruction: '왼쪽 아래에서 오른쪽 위까지', start: { x: .22, y: .78 }, end: { x: .78, y: .22 } },
  { id: 'horizontal-left', label: '가로 · 왼쪽', instruction: '오른쪽 점에서 왼쪽 점까지', start: { x: .85, y: .5 }, end: { x: .15, y: .5 } },
  { id: 'vertical-up', label: '세로 · 위쪽', instruction: '아래쪽 점에서 위쪽 점까지', start: { x: .5, y: .85 }, end: { x: .5, y: .15 } },
  { id: 'diagonal-down-left', label: '대각선 · 왼쪽 아래', instruction: '오른쪽 위에서 왼쪽 아래까지', start: { x: .78, y: .22 }, end: { x: .22, y: .78 } },
  { id: 'diagonal-up-left', label: '대각선 · 왼쪽 위', instruction: '오른쪽 아래에서 왼쪽 위까지', start: { x: .78, y: .78 }, end: { x: .22, y: .22 } },
] as const;

export type PressureTask = 'natural' | 'steady' | 'light' | 'increase' | 'decrease';
export const PRESSURE_TASKS: readonly PressureTask[] = ['natural', 'steady', 'light', 'increase', 'decrease'];
export const PRESSURE_COPY: Record<PressureTask, { label: string; instruction: string }> = {
  natural: { label: '편한 필압 찾기', instruction: '평소처럼 편하게 그어 개인 기준을 잡아보세요.' },
  steady: { label: '일정한 필압', instruction: '처음부터 끝까지 같은 굵기를 유지해보세요.' },
  light: { label: '가벼운 필압', instruction: '기준보다 가볍게, 선은 끊기지 않게 그어보세요.' },
  increase: { label: '점점 강하게', instruction: '가볍게 시작해 끝으로 갈수록 힘을 더해보세요.' },
  decrease: { label: '점점 약하게', instruction: '힘 있게 시작해 끝으로 갈수록 가볍게 마무리하세요.' },
};

export function guideForIndex(index: number) { return LINE_GUIDES[index % LINE_GUIDES.length]; }
export function pressureTaskForIndex(index: number) { return PRESSURE_TASKS[index % PRESSURE_TASKS.length]; }
export function isKnownGuide(value: unknown): value is LineGuide {
  if (!value || typeof value !== 'object') return false;
  const guide = value as LineGuide;
  return LINE_GUIDES.some(item => JSON.stringify(item) === JSON.stringify(guide));
}
