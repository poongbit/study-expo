// circleStore.web.ts — localStorage store for circle attempts (web/test).
import { type CircleAttempt } from './analyzeCircle';
import { isKnownCircleGuide } from './circleExercises';
import { newId, validateStrokes, inputTypeOf } from './straightLine';
import { analyzeCircle } from './analyzeCircle';
import type { CircleHistory } from './circleStore';

const PREFIX = 'chibicoach:circle-v1:';

function parseCircleAttempt(text: string): CircleAttempt {
  const a = JSON.parse(text) as CircleAttempt;
  if (!a || a.schemaVersion !== 1 || a.exerciseId !== 'circle-v1' || a.metricVersion !== 1 ||
      typeof a.attemptId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(a.attemptId) ||
      !(a.previousAttemptId === null || typeof a.previousAttemptId === 'string') ||
      !Number.isFinite(a.createdAt) || !isKnownCircleGuide(a.guide) ||
      !Array.isArray(a.strokes) || validateStrokes(a.strokes) ||
      a.inputType !== inputTypeOf(a.strokes))
    throw new Error('지원하지 않거나 손상된 원 기록입니다.');
  return { ...a, analysis: analyzeCircle(a.strokes, a.guide) };
}

export async function loadCircleAttempts(): Promise<CircleHistory> {
  const attempts: CircleAttempt[] = [];
  let unreadable = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try { attempts.push(parseCircleAttempt(localStorage.getItem(key)!)); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}

export async function saveCircleAttempt(attempt: CircleAttempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseCircleAttempt(text);
  const key = PREFIX + attempt.attemptId;
  const existing = localStorage.getItem(key);
  if (existing !== null && existing !== text) throw new Error('같은 ID의 다른 원 기록이 있습니다.');
  localStorage.setItem(key, text);
}

export function createCircleAttempt(
  strokes: CircleAttempt['strokes'],
  previous: CircleAttempt | null,
  guide: import('./circleExercises').CircleGuide,
  options: { practiceSetId?: string; setRuleVersion?: 1 } = {},
): CircleAttempt {
  return {
    schemaVersion: 1,
    exerciseId: 'circle-v1',
    metricVersion: 1,
    attemptId: newId(),
    previousAttemptId: previous?.attemptId ?? null,
    createdAt: Date.now(),
    inputType: inputTypeOf(strokes),
    guide,
    strokes: strokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) })),
    analysis: analyzeCircle(strokes, guide),
    ...(options.practiceSetId ? { practiceSetId: options.practiceSetId } : {}),
    ...(options.setRuleVersion ? { setRuleVersion: options.setRuleVersion } : {}),
  };
}
