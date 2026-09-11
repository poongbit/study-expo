// circleExercises.ts — 20-stroke circle/ellipse exercise definitions.

export type CircleGuideId =
  | 'circle-cw-large'   | 'circle-ccw-large'
  | 'circle-cw-medium'  | 'circle-ccw-medium'
  | 'circle-cw-small'   | 'circle-ccw-small'
  | 'ellipse-h-cw'      | 'ellipse-h-ccw'
  | 'ellipse-v-cw'      | 'ellipse-v-ccw';

export interface CircleGuide {
  id: CircleGuideId;
  label: string;
  instruction: string;
  cx: number;     // centre x (0–1)
  cy: number;     // centre y (0–1)
  rx: number;     // x-radius (0–1)
  ry: number;     // y-radius (0–1)
  clockwise: boolean;
}

export const CIRCLE_GUIDES: readonly CircleGuide[] = [
  { id: 'circle-cw-large',   label: '큰 원 · 시계',       instruction: '큰 원을 시계 방향으로',        cx: .5, cy: .5, rx: .35, ry: .35, clockwise: true },
  { id: 'circle-ccw-large',  label: '큰 원 · 반시계',      instruction: '큰 원을 반시계 방향으로',      cx: .5, cy: .5, rx: .35, ry: .35, clockwise: false },
  { id: 'circle-cw-medium',  label: '중간 원 · 시계',      instruction: '중간 원을 시계 방향으로',      cx: .5, cy: .5, rx: .25, ry: .25, clockwise: true },
  { id: 'circle-ccw-medium', label: '중간 원 · 반시계',    instruction: '중간 원을 반시계 방향으로',    cx: .5, cy: .5, rx: .25, ry: .25, clockwise: false },
  { id: 'circle-cw-small',   label: '작은 원 · 시계',      instruction: '작은 원을 시계 방향으로',      cx: .5, cy: .5, rx: .15, ry: .15, clockwise: true },
  { id: 'circle-ccw-small',  label: '작은 원 · 반시계',    instruction: '작은 원을 반시계 방향으로',    cx: .5, cy: .5, rx: .15, ry: .15, clockwise: false },
  { id: 'ellipse-h-cw',      label: '가로 타원 · 시계',    instruction: '가로 타원을 시계 방향으로',    cx: .5, cy: .5, rx: .35, ry: .20, clockwise: true },
  { id: 'ellipse-h-ccw',     label: '가로 타원 · 반시계',  instruction: '가로 타원을 반시계 방향으로',  cx: .5, cy: .5, rx: .35, ry: .20, clockwise: false },
  { id: 'ellipse-v-cw',      label: '세로 타원 · 시계',    instruction: '세로 타원을 시계 방향으로',    cx: .5, cy: .5, rx: .20, ry: .35, clockwise: true },
  { id: 'ellipse-v-ccw',     label: '세로 타원 · 반시계',  instruction: '세로 타원을 반시계 방향으로',  cx: .5, cy: .5, rx: .20, ry: .35, clockwise: false },
] as const;

export function circleGuideForIndex(index: number): CircleGuide {
  return CIRCLE_GUIDES[index % CIRCLE_GUIDES.length];
}

export function isKnownCircleGuide(value: unknown): value is CircleGuide {
  if (!value || typeof value !== 'object') return false;
  const g = value as CircleGuide;
  return CIRCLE_GUIDES.some(item => item.id === g.id);
}

/**
 * Sample the ellipse guide into n points starting from the top (angle = -PI/2).
 * Clockwise: angle increases. Counter-clockwise: angle decreases.
 */
export function sampleCircleGuide(guide: CircleGuide, n = 128): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const fraction = i / n;
    const angle = -Math.PI / 2 + (guide.clockwise ? 1 : -1) * 2 * Math.PI * fraction;
    return {
      x: guide.cx + guide.rx * Math.cos(angle),
      y: guide.cy + guide.ry * Math.sin(angle),
    };
  });
}
