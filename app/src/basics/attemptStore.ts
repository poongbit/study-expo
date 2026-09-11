import { Directory, File, Paths } from 'expo-file-system';
import { parseAttempt, type Attempt } from './straightLine';

export interface History { attempts: Attempt[]; unreadable: number }
const directory = () => new Directory(Paths.document, 'chibicoach', 'straight-line-v1');
export async function loadAttempts(): Promise<History> {
  const dir = directory();
  if (!dir.exists) return { attempts: [], unreadable: 0 };
  const attempts: Attempt[] = [];
  let unreadable = 0;
  for (const file of dir.list()) {
    if (!(file instanceof File) || !file.name.endsWith('.json')) continue;
    try { attempts.push(parseAttempt(await file.text())); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}
export async function saveAttempt(attempt: Attempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseAttempt(text);
  const dir = directory();
  dir.create({ intermediates: true, idempotent: true });
  const finalFile = new File(dir, `${attempt.attemptId}.json`);
  if (finalFile.exists) {
    if (await finalFile.text() === text) return;
    throw new Error('같은 ID의 다른 기록이 있습니다.');
  }
  const temporary = new File(dir, `${attempt.attemptId}.tmp`);
  temporary.write(text);
  temporary.move(finalFile);
}
