// curveStore.web.ts — localStorage store for curve attempts (web/test).
import { type CurveAttempt } from './analyzeCurve';
import { isKnownCurveGuide } from './curveExercises';
import { newId, validateStrokes, inputTypeOf } from './straightLine';
import { analyzeCurve } from './analyzeCurve';
import type { CurveHistory } from './curveStore';

const PREFIX = 'chibicoach:curve-v1:';

function parseCurveAttempt(text: string): CurveAttempt {
  const a = JSON.parse(text) as CurveAttempt;
  if (!a || a.schemaVersion !== 1 || a.exerciseId !== 'curve-v1' || a.metricVersion !== 1 ||
      typeof a.attemptId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(a.attemptId) ||
      !(a.previousAttemptId === null || typeof a.previousAttemptId === 'string') ||
      !Number.isFinite(a.createdAt) || !isKnownCurveGuide(a.guide) ||
      !Array.isArray(a.strokes) || validateStrokes(a.strokes) ||
      a.inputType !== inputTypeOf(a.strokes))
    throw new Error('지원하지 않거나 손상된 커브 기록입니다.');
  return { ...a, analysis: analyzeCurve(a.strokes, a.guide) };
}

export async function loadCurveAttempts(): Promise<CurveHistory> {
  const attempts: CurveAttempt[] = [];
  let unreadable = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try { attempts.push(parseCurveAttempt(localStorage.getItem(key)!)); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}

export async function saveCurveAttempt(attempt: CurveAttempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseCurveAttempt(text);
  const key = PREFIX + attempt.attemptId;
  const existing = localStorage.getItem(key);
  if (existing !== null && existing !== text) throw new Error('같은 ID의 다른 커브 기록이 있습니다.');
  localStorage.setItem(key, text);
}

export function createCurveAttempt(
  strokes: CurveAttempt['strokes'],
  previous: CurveAttempt | null,
  guide: import('./curveExercises').BezierGuide,
  options: { practiceSetId?: string; setRuleVersion?: 1 } = {},
): CurveAttempt {
  return {
    schemaVersion: 1,
    exerciseId: 'curve-v1',
    metricVersion: 1,
    attemptId: newId(),
    previousAttemptId: previous?.attemptId ?? null,
    createdAt: Date.now(),
    inputType: inputTypeOf(strokes),
    guide,
    strokes: strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })),
    analysis: analyzeCurve(strokes, guide),
    ...(options.practiceSetId ? { practiceSetId: options.practiceSetId } : {}),
    ...(options.setRuleVersion ? { setRuleVersion: options.setRuleVersion } : {}),
  };
}
