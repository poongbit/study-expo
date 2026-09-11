import type { BatchAnalysis } from './batchAnalysis';

export interface AiFeedback { coreProblem: string; evidence: string; nextAction: string }

export type ExerciseType = 'line' | 'curve' | 'circle';

const shortText = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 180;
function isFeedback(value: unknown): value is AiFeedback {
  if (!value || typeof value !== 'object') return false;
  const feedback = value as AiFeedback;
  return shortText(feedback.coreProblem) && shortText(feedback.evidence) && shortText(feedback.nextAction);
}

// batchId → AiFeedback cache. Same batchId never triggers a second server call.
const _cache = new Map<string, AiFeedback>();

function overlayStrokes(batch: BatchAnalysis) {
  return batch.strokeBatch.map(stroke => {
    const step = Math.max(1, Math.ceil(stroke.points.length / 48));
    const sampled = stroke.points.filter((_, index) => index % step === 0 || index === stroke.points.length - 1);
    return { guideId: stroke.guideId, points: sampled.map(point => ({ x: Math.round(point.x * 10_000) / 10_000, y: Math.round(point.y * 10_000) / 10_000 })) };
  });
}

export async function requestAiFeedback(
  batchId: string,
  batch: BatchAnalysis,
  previousBatch?: BatchAnalysis,
  externalSignal?: AbortSignal,
  exerciseType: ExerciseType = 'line',
): Promise<AiFeedback> {
  // Return cached result for the same batchId without another server call.
  const cached = _cache.get(batchId);
  if (cached) return cached;

  const baseUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('AI 피드백 서버 주소가 설정되지 않았습니다.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  externalSignal?.addEventListener('abort', abort, { once: true });
  if (externalSignal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${baseUrl}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        batchId, exerciseType,
        phaseId: batch.phaseId, totalStrokes: batch.totalStrokes, inputType: batch.inputType,
        metrics: batch.metrics, pressureFailureFrequency: batch.pressureFailureFrequency,
        attemptSummaries: batch.attemptSummaries,
        // overlayStrokes carries the compact 48-point-per-stroke shape only;
        // raw coordinates must NOT be sent as a text prompt to Gemini.
        overlayStrokes: overlayStrokes(batch),
        ...(previousBatch ? { previousBatch: { metrics: previousBatch.metrics, attemptSummaries: previousBatch.attemptSummaries } } : {}),
      }),
    });
    if (!response.ok) throw new Error(`AI 피드백 요청 실패 (${response.status})`);
    const value: unknown = await response.json();
    if (!isFeedback(value)) throw new Error('AI 피드백 형식이 올바르지 않습니다.');
    const result: AiFeedback = { coreProblem: value.coreProblem.trim(), evidence: value.evidence.trim(), nextAction: value.nextAction.trim() };
    _cache.set(batchId, result);
    return result;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abort);
  }
}

/** Generic AI feedback for curve/circle batches (sends only numeric summary, no raw coords). */
export async function requestGenericAiFeedback(
  batchId: string,
  exerciseType: ExerciseType,
  summary: {
    diagnosisCode: string;
    numericEvidence: string;
    allowedPrescription: string;
    halfComparison?: string;
    directionComparison?: string;
  },
  externalSignal?: AbortSignal,
): Promise<AiFeedback> {
  const cached = _cache.get(batchId);
  if (cached) return cached;

  const baseUrl = process.env.EXPO_PUBLIC_FEEDBACK_API_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('AI 피드백 서버 주소가 설정되지 않았습니다.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  externalSignal?.addEventListener('abort', abort, { once: true });
  if (externalSignal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15_000);
  try {
    const response = await fetch(`${baseUrl}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      // Only numeric summary and confirmed prescription — no raw stroke coordinates.
      body: JSON.stringify({ batchId, exerciseType, ...summary }),
    });
    if (!response.ok) throw new Error(`AI 피드백 요청 실패 (${response.status})`);
    const value: unknown = await response.json();
    if (!isFeedback(value)) throw new Error('AI 피드백 형식이 올바르지 않습니다.');
    const result: AiFeedback = { coreProblem: value.coreProblem.trim(), evidence: value.evidence.trim(), nextAction: value.nextAction.trim() };
    _cache.set(batchId, result);
    return result;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abort);
  }
}
