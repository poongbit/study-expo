// curveStore.ts — native file-system store for curve attempts.
import { Directory, File, Paths } from 'expo-file-system';
import { type CurveAttempt } from './analyzeCurve';
import { isKnownCurveGuide } from './curveExercises';
import { newId, validateStrokes, inputTypeOf } from './straightLine';
import { analyzeCurve } from './analyzeCurve';

export interface CurveHistory { attempts: CurveAttempt[]; unreadable: number }

const directory = () => new Directory(Paths.document, 'chibicoach', 'curve-v1');

function parseCurveAttempt(text: string): CurveAttempt {
  const a = JSON.parse(text) as CurveAttempt;
  if (!a || a.schemaVersion !== 1 || a.exerciseId !== 'curve-v1' || a.metricVersion !== 1 ||
      typeof a.attemptId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(a.attemptId) ||
      !(a.previousAttemptId === null || typeof a.previousAttemptId === 'string') ||
      !Number.isFinite(a.createdAt) || !isKnownCurveGuide(a.guide) ||
      !Array.isArray(a.strokes) || validateStrokes(a.strokes) ||
      a.inputType !== inputTypeOf(a.strokes))
    throw new Error('지원하지 않거나 손상된 커브 기록입니다.');
  // Re-derive analysis from raw strokes.
  return { ...a, analysis: analyzeCurve(a.strokes, a.guide) };
}

export async function loadCurveAttempts(): Promise<CurveHistory> {
  const dir = directory();
  if (!dir.exists) return { attempts: [], unreadable: 0 };
  const attempts: CurveAttempt[] = [];
  let unreadable = 0;
  for (const file of dir.list()) {
    if (!(file instanceof File) || !file.name.endsWith('.json')) continue;
    try { attempts.push(parseCurveAttempt(await file.text())); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}

export async function saveCurveAttempt(attempt: CurveAttempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseCurveAttempt(text); // validate before write
  const dir = directory();
  dir.create({ intermediates: true, idempotent: true });
  const finalFile = new File(dir, `${attempt.attemptId}.json`);
  if (finalFile.exists) {
    if (await finalFile.text() === text) return;
    throw new Error('같은 ID의 다른 커브 기록이 있습니다.');
  }
  const temporary = new File(dir, `${attempt.attemptId}.tmp`);
  temporary.write(text);
  temporary.move(finalFile);
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
