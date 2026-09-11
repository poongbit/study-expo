// circleStore.ts — native file-system store for circle attempts.
import { Directory, File, Paths } from 'expo-file-system';
import { type CircleAttempt } from './analyzeCircle';
import { isKnownCircleGuide } from './circleExercises';
import { newId, validateStrokes, inputTypeOf } from './straightLine';
import { analyzeCircle } from './analyzeCircle';

export interface CircleHistory { attempts: CircleAttempt[]; unreadable: number }

const directory = () => new Directory(Paths.document, 'chibicoach', 'circle-v1');

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
  const dir = directory();
  if (!dir.exists) return { attempts: [], unreadable: 0 };
  const attempts: CircleAttempt[] = [];
  let unreadable = 0;
  for (const file of dir.list()) {
    if (!(file instanceof File) || !file.name.endsWith('.json')) continue;
    try { attempts.push(parseCircleAttempt(await file.text())); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}

export async function saveCircleAttempt(attempt: CircleAttempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseCircleAttempt(text);
  const dir = directory();
  dir.create({ intermediates: true, idempotent: true });
  const finalFile = new File(dir, `${attempt.attemptId}.json`);
  if (finalFile.exists) {
    if (await finalFile.text() === text) return;
    throw new Error('같은 ID의 다른 원 기록이 있습니다.');
  }
  const temporary = new File(dir, `${attempt.attemptId}.tmp`);
  temporary.write(text);
  temporary.move(finalFile);
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
