import { parseAttempt, type Attempt } from './straightLine';
import type { History } from './attemptStore';
const PREFIX = 'chibicoach:straight-line-v1:';
export async function loadAttempts(): Promise<History> {
  const attempts: Attempt[] = [];
  let unreadable = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try { attempts.push(parseAttempt(localStorage.getItem(key)!)); } catch { unreadable++; }
  }
  return { attempts: attempts.sort((a, b) => a.createdAt - b.createdAt), unreadable };
}
export async function saveAttempt(attempt: Attempt): Promise<void> {
  const text = JSON.stringify(attempt);
  parseAttempt(text);
  const key = PREFIX + attempt.attemptId;
  const existing = localStorage.getItem(key);
  if (existing !== null && existing !== text) throw new Error('같은 ID의 다른 기록이 있습니다.');
  localStorage.setItem(key, text);
}
