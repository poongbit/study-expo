import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, deriveDiagnostic, parseModelFeedback, validateFeedbackRequest } from '../src/feedback.mjs';
import { renderOverlayPng } from '../src/overlay.mjs';

const aggregate = { mean: .01, standardDeviation: .002, exceededFrequency: .4 };
const guides = ['horizontal-right', 'horizontal-left', 'vertical-down', 'vertical-up', 'diagonal-down', 'diagonal-up-left', 'diagonal-up', 'diagonal-down-left'];
const attempt = index => ({ attemptIndex: index + 1, guideId: guides[index % guides.length], inputType: 'STYLUS', durationMs: 500,
  pointCount: 30, strokeCount: 1, metrics: { endpoints: index < 10 ? .2 : .12, deviation: .01, extraStrokes: 0, wobble: .02, backtracking: .01 },
  correction: 'endpoints', samplingLimited: false, motion: { averageSpeed: 1.4, pauseCount: 0, startAlongError: 0,
    endAlongError: index % 2 ? -.1 : .08, wobbleBySection: { start: .003, middle: .004, end: .008 } } });
const request = { batchId: '123456-test', phaseId: 'level_0_line_control', totalStrokes: 20, inputType: 'STYLUS',
  metrics: { endpoints: { ...aggregate, mean: .16 }, deviation: aggregate, extraStrokes: { ...aggregate, mean: 0, exceededFrequency: 0 }, wobble: aggregate, backtracking: aggregate },
  attemptSummaries: Array.from({ length: 20 }, (_, index) => attempt(index)),
  overlayStrokes: Array.from({ length: 20 }, (_, index) => ({ guideId: guides[index % guides.length], points: [{ x: .15, y: .5 }, { x: .85, y: .5 }] })) };

test('validates eight-direction summaries and derives the largest normalized issue', () => {
  const clean = validateFeedbackRequest({ ...request, ignored: 'removed' });
  assert.equal(clean.attemptSummaries.length, 20);
  const diagnostic = deriveDiagnostic(clean);
  assert.equal(diagnostic.primaryIssue.key, 'endpoints');
  assert.ok(diagnostic.primaryHalfChange < 0);
  assert.match(buildPrompt(clean), /고정 처방표/);
});

test('rejects incomplete or malformed diagnostic input', () => {
  assert.throws(() => validateFeedbackRequest({ ...request, totalStrokes: 19 }));
  assert.throws(() => validateFeedbackRequest({ ...request, attemptSummaries: request.attemptSummaries.slice(1) }));
  assert.throws(() => validateFeedbackRequest({ ...request, overlayStrokes: [{ guideId: 'unknown', points: [] }] }));
});

test('accepts exactly the three coaching lines', () => {
  const value = { coreProblem: '끝점 조절이 가장 불안정해요.', evidence: '평균 끝점 오차가 16%예요.', nextAction: '끝점을 보며 통과하세요.' };
  assert.deepEqual(parseModelFeedback(JSON.stringify(value)), value);
  assert.throws(() => parseModelFeedback('{"coreProblem":"없음"}'));
});

test('renders a valid PNG overlay', () => {
  const png = renderOverlayPng(request.overlayStrokes, 64);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length > 200);
});
