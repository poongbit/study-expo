// curveExercises.ts — 20-stroke curve exercise definitions.
// Each guide is a cubic Bezier described by start, controlA, controlB, end.
import { sampleBezier } from './practiceEngine';

export interface BezierGuide {
  id: CurveGuideId;
  label: string;
  instruction: string;
  start: { x: number; y: number };
  controlA: { x: number; y: number };
  controlB: { x: number; y: number };
  end: { x: number; y: number };
}

export type CurveGuideId =
  | 'c-right' | 'c-left' | 'c-up' | 'c-down'
  | 's-vertical' | 's-horizontal'
  | 'wave-h' | 'wave-v';

export const CURVE_GUIDES: readonly BezierGuide[] = [
  {
    id: 'c-right',
    label: 'C 커브 · 오른쪽',
    instruction: '위쪽에서 오른쪽 호를 그리며 아래쪽까지',
    start:    { x: .5, y: .15 },
    controlA: { x: .85, y: .15 },
    controlB: { x: .85, y: .85 },
    end:      { x: .5, y: .85 },
  },
  {
    id: 'c-left',
    label: 'C 커브 · 왼쪽 (역방향)',
    instruction: '위쪽에서 왼쪽 호를 그리며 아래쪽까지',
    start:    { x: .5, y: .15 },
    controlA: { x: .15, y: .15 },
    controlB: { x: .15, y: .85 },
    end:      { x: .5, y: .85 },
  },
  {
    id: 'c-up',
    label: 'C 커브 · 위쪽',
    instruction: '왼쪽에서 위쪽 호를 그리며 오른쪽까지',
    start:    { x: .15, y: .5 },
    controlA: { x: .15, y: .15 },
    controlB: { x: .85, y: .15 },
    end:      { x: .85, y: .5 },
  },
  {
    id: 'c-down',
    label: 'C 커브 · 아래쪽',
    instruction: '왼쪽에서 아래쪽 호를 그리며 오른쪽까지',
    start:    { x: .15, y: .5 },
    controlA: { x: .15, y: .85 },
    controlB: { x: .85, y: .85 },
    end:      { x: .85, y: .5 },
  },
  {
    id: 's-vertical',
    label: 'S 커브 · 세로',
    instruction: '위에서 아래로 S자 모양으로',
    start:    { x: .35, y: .1 },
    controlA: { x: .8,  y: .25 },
    controlB: { x: .2,  y: .75 },
    end:      { x: .65, y: .9 },
  },
  {
    id: 's-horizontal',
    label: 'S 커브 · 가로',
    instruction: '왼쪽에서 오른쪽으로 S자 모양으로',
    start:    { x: .1,  y: .35 },
    controlA: { x: .25, y: .8 },
    controlB: { x: .75, y: .2 },
    end:      { x: .9,  y: .65 },
  },
  {
    id: 'wave-h',
    label: '가로 웨이브',
    instruction: '왼쪽에서 오른쪽으로 부드러운 물결을',
    start:    { x: .1, y: .5 },
    controlA: { x: .35, y: .2 },
    controlB: { x: .65, y: .8 },
    end:      { x: .9, y: .5 },
  },
  {
    id: 'wave-v',
    label: '세로 웨이브',
    instruction: '위쪽에서 아래쪽으로 부드러운 물결을',
    start:    { x: .5, y: .1 },
    controlA: { x: .8, y: .35 },
    controlB: { x: .2, y: .65 },
    end:      { x: .5, y: .9 },
  },
] as const;

export function curveGuideForIndex(index: number): BezierGuide {
  return CURVE_GUIDES[index % CURVE_GUIDES.length];
}

export function isKnownCurveGuide(value: unknown): value is BezierGuide {
  if (!value || typeof value !== 'object') return false;
  const g = value as BezierGuide;
  return CURVE_GUIDES.some(item => item.id === g.id);
}

/** Sample the guide bezier into n points for analysis comparison */
export function sampleGuide(guide: BezierGuide, n = 64): { x: number; y: number }[] {
  return sampleBezier(guide.start, guide.controlA, guide.controlB, guide.end, n);
}
