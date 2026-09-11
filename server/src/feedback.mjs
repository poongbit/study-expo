const METRIC_KEYS = ['endpoints', 'deviation', 'extraStrokes', 'wobble', 'backtracking'];
const INPUT_TYPES = ['TOUCH', 'STYLUS', 'MIXED'];
const GUIDE_IDS = ['horizontal-right', 'horizontal-left', 'vertical-down', 'vertical-up', 'diagonal-down', 'diagonal-up-left', 'diagonal-up', 'diagonal-down-left'];
const PRESSURE_TASKS = ['natural', 'steady', 'light', 'increase', 'decrease'];
const TARGETS = { endpoints: .025, deviation: .008, extraStrokes: 1, wobble: .03, backtracking: .015 };

export const feedbackSchema = {
  type: 'object',
  properties: {
    coreProblem: { type: 'string', description: '이번 세트에서 먼저 고칠 움직임 한 가지' },
    evidence: { type: 'string', description: '가장 큰 수치와 방향 또는 전후 비교를 포함한 근거' },
    nextAction: { type: 'string', description: '다음 20획에서 실행할 구체적인 행동 한 가지' },
  },
  required: ['coreProblem', 'evidence', 'nextAction'],
  additionalProperties: false,
};

const finite = value => typeof value === 'number' && Number.isFinite(value);
const shortText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 180;
const rounded = value => Math.round(value * 10_000) / 10_000;
const average = values => rounded(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length));
const metricMeans = attempts => Object.fromEntries(METRIC_KEYS.map(key => [key, average(attempts.map(attempt => attempt.metrics[key]))]));

function cleanMetricValues(metrics, label) {
  return Object.fromEntries(METRIC_KEYS.map(key => {
    const value = metrics?.[key];
    if (!finite(value) || value < 0) throw new Error(`${label}의 ${key} 측정값이 올바르지 않습니다.`);
    return [key, value];
  }));
}
function cleanAggregateMetrics(metrics) {
  return Object.fromEntries(METRIC_KEYS.map(key => {
    const metric = metrics?.[key];
    if (!metric || !finite(metric.mean) || !finite(metric.standardDeviation) || !finite(metric.exceededFrequency) ||
        metric.mean < 0 || metric.standardDeviation < 0 || metric.exceededFrequency < 0 || metric.exceededFrequency > 1)
      throw new Error(`${key} 집계값이 올바르지 않습니다.`);
    return [key, { mean: metric.mean, standardDeviation: metric.standardDeviation, exceededFrequency: metric.exceededFrequency }];
  }));
}
function cleanMotion(motion) {
  if (!motion || !finite(motion.averageSpeed) || motion.averageSpeed < 0 || motion.averageSpeed > 100 ||
      !Number.isInteger(motion.pauseCount) || motion.pauseCount < 0 || motion.pauseCount > 1_000 ||
      !finite(motion.startAlongError) || !finite(motion.endAlongError)) throw new Error('움직임 요약이 올바르지 않습니다.');
  const sections = motion.wobbleBySection;
  if (!sections || !['start', 'middle', 'end'].every(key => finite(sections[key]) && sections[key] >= 0)) throw new Error('구간별 흔들림이 올바르지 않습니다.');
  return { averageSpeed: motion.averageSpeed, pauseCount: motion.pauseCount, startAlongError: motion.startAlongError,
    endAlongError: motion.endAlongError, wobbleBySection: { start: sections.start, middle: sections.middle, end: sections.end } };
}
function cleanAttempt(value, expectedIndex) {
  if (!value || typeof value !== 'object' || value.attemptIndex !== expectedIndex) throw new Error('시도 순서가 올바르지 않습니다.');
  if (!GUIDE_IDS.includes(value.guideId) || !INPUT_TYPES.includes(value.inputType)) throw new Error('시도 조건이 올바르지 않습니다.');
  if (!Number.isInteger(value.durationMs) || value.durationMs < 0 || value.durationMs > 120_000 ||
      !Number.isInteger(value.pointCount) || value.pointCount < 2 || value.pointCount > 100_000 ||
      !Number.isInteger(value.strokeCount) || value.strokeCount < 1 || value.strokeCount > 100)
    throw new Error('시도 입력 요약이 올바르지 않습니다.');
  if (!(value.correction === null || METRIC_KEYS.includes(value.correction)) || typeof value.samplingLimited !== 'boolean') throw new Error('시도 판정이 올바르지 않습니다.');
  let pressure;
  if (value.pressure !== undefined) {
    if (!value.pressure || !PRESSURE_TASKS.includes(value.pressure.task) || typeof value.pressure.available !== 'boolean') throw new Error('필압 시도 요약이 올바르지 않습니다.');
    pressure = { task: value.pressure.task, available: value.pressure.available };
    for (const key of ['mean', 'variation', 'change']) if (value.pressure[key] !== undefined) {
      if (!finite(value.pressure[key]) || Math.abs(value.pressure[key]) > 10) throw new Error('필압 수치가 올바르지 않습니다.');
      pressure[key] = value.pressure[key];
    }
    if (value.pressure.achieved !== undefined) {
      if (typeof value.pressure.achieved !== 'boolean') throw new Error('필압 판정이 올바르지 않습니다.');
      pressure.achieved = value.pressure.achieved;
    }
  }
  return { attemptIndex: expectedIndex, guideId: value.guideId, inputType: value.inputType, durationMs: value.durationMs,
    pointCount: value.pointCount, strokeCount: value.strokeCount, metrics: cleanMetricValues(value.metrics, `시도 ${expectedIndex}`),
    correction: value.correction, samplingLimited: value.samplingLimited, motion: cleanMotion(value.motion), ...(pressure ? { pressure } : {}) };
}
function cleanAttempts(values) {
  if (!Array.isArray(values) || values.length !== 20) throw new Error('20개의 시도 요약이 필요합니다.');
  return values.map((attempt, index) => cleanAttempt(attempt, index + 1));
}
function cleanOverlay(values) {
  if (!Array.isArray(values) || values.length !== 20) throw new Error('20개의 오버레이 획이 필요합니다.');
  return values.map(stroke => {
    if (!GUIDE_IDS.includes(stroke?.guideId) || !Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 49) throw new Error('오버레이 획이 올바르지 않습니다.');
    return { guideId: stroke.guideId, points: stroke.points.map(point => {
      if (!finite(point?.x) || !finite(point?.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) throw new Error('오버레이 좌표가 올바르지 않습니다.');
      return { x: point.x, y: point.y };
    }) };
  });
}

export function validateFeedbackRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('요청 본문은 객체여야 합니다.');
  if (typeof value.batchId !== 'string' || !/^[a-zA-Z0-9-]{6,100}$/.test(value.batchId)) throw new Error('batchId가 올바르지 않습니다.');
  if (value.phaseId !== 'level_0_line_control' || value.totalStrokes !== 20) throw new Error('완료된 20획 배치만 분석할 수 있습니다.');
  if (!INPUT_TYPES.includes(value.inputType)) throw new Error('inputType이 올바르지 않습니다.');
  if (value.pressureFailureFrequency !== undefined && (!finite(value.pressureFailureFrequency) || value.pressureFailureFrequency < 0 || value.pressureFailureFrequency > 1)) throw new Error('필압 측정값이 올바르지 않습니다.');
  let previousBatch;
  if (value.previousBatch !== undefined) previousBatch = { metrics: cleanAggregateMetrics(value.previousBatch?.metrics), attemptSummaries: cleanAttempts(value.previousBatch?.attemptSummaries) };
  return { batchId: value.batchId, phaseId: value.phaseId, totalStrokes: value.totalStrokes, inputType: value.inputType,
    metrics: cleanAggregateMetrics(value.metrics), attemptSummaries: cleanAttempts(value.attemptSummaries), overlayStrokes: cleanOverlay(value.overlayStrokes),
    ...(value.pressureFailureFrequency !== undefined ? { pressureFailureFrequency: value.pressureFailureFrequency } : {}), ...(previousBatch ? { previousBatch } : {}) };
}

function directionSummary(attempts) {
  return GUIDE_IDS.map(guideId => {
    const selected = attempts.filter(attempt => attempt.guideId === guideId);
    const means = metricMeans(selected);
    const normalizedScore = average(METRIC_KEYS.map(key => means[key] / TARGETS[key]));
    return { guideId, attempts: selected.length, normalizedScore, meanMetrics: means, meanSpeed: average(selected.map(attempt => attempt.motion.averageSpeed)),
      pauses: selected.reduce((sum, attempt) => sum + attempt.motion.pauseCount, 0) };
  }).filter(summary => summary.attempts > 0);
}
function sectionSummary(attempts) {
  return { meanMetrics: metricMeans(attempts), meanSpeed: average(attempts.map(attempt => attempt.motion.averageSpeed)),
    pauses: attempts.reduce((sum, attempt) => sum + attempt.motion.pauseCount, 0) };
}

export function deriveDiagnostic(data) {
  const attempts = data.attemptSummaries;
  const directions = directionSummary(attempts).sort((a, b) => a.normalizedScore - b.normalizedScore);
  const primary = METRIC_KEYS.map(key => ({ key, mean: data.metrics[key].mean,
    severity: key === 'extraStrokes' ? data.metrics[key].exceededFrequency : data.metrics[key].mean / TARGETS[key] }))
    .sort((a, b) => b.severity - a.severity)[0];
  const firstHalf = sectionSummary(attempts.slice(0, 10)), secondHalf = sectionSummary(attempts.slice(10));
  const primaryHalfChange = rounded((secondHalf.meanMetrics[primary.key] - firstHalf.meanMetrics[primary.key]) / Math.max(firstHalf.meanMetrics[primary.key], .0001));
  const endpointOvershoots = attempts.filter(attempt => attempt.motion.endAlongError > .025).length;
  const endpointUndershoots = attempts.filter(attempt => attempt.motion.endAlongError < -.025).length;
  const wobbleSections = ['start', 'middle', 'end'].map(section => ({ section,
    mean: average(attempts.map(attempt => attempt.motion.wobbleBySection[section])) })).sort((a, b) => b.mean - a.mean);
  const speedSorted = [...attempts].sort((a, b) => a.motion.averageSpeed - b.motion.averageSpeed);
  const slow = speedSorted.slice(0, 10), fast = speedSorted.slice(10);
  const speedRelation = { slowMeanSpeed: average(slow.map(a => a.motion.averageSpeed)), slowMeanWobble: average(slow.map(a => a.metrics.wobble)),
    fastMeanSpeed: average(fast.map(a => a.motion.averageSpeed)), fastMeanWobble: average(fast.map(a => a.metrics.wobble)) };
  const previous = data.previousBatch ? sectionSummary(data.previousBatch.attemptSummaries) : undefined;
  const previousChange = previous ? rounded((data.metrics[primary.key].mean - previous.meanMetrics[primary.key]) / Math.max(previous.meanMetrics[primary.key], .0001)) : undefined;
  let actionCode = `correct_${primary.key}`;
  if (primary.key === 'wobble' && speedRelation.slowMeanWobble > speedRelation.fastMeanWobble * 1.15) actionCode = 'wobble_slow_speed';
  if (primary.key === 'wobble' && wobbleSections[0].section === 'end') actionCode = 'wobble_at_end';
  if (primary.key === 'endpoints' && endpointUndershoots > endpointOvershoots && attempts.reduce((sum, a) => sum + a.motion.pauseCount, 0) > 2) actionCode = 'endpoint_undershoot_with_pause';
  if (primary.key === 'endpoints' && endpointOvershoots > endpointUndershoots) actionCode = 'endpoint_overshoot';
  if (directions.at(-1).normalizedScore > directions[0].normalizedScore * 1.25) actionCode += '_direction_bias';
  return { primaryIssue: primary, bestDirection: directions[0], worstDirection: directions.at(-1), directions, firstHalf, secondHalf,
    primaryHalfChange, previousSet: previous ? { summary: previous, primaryChange: previousChange } : null,
    endpointPattern: { overshoots: endpointOvershoots, undershoots: endpointUndershoots }, dominantWobbleSection: wobbleSections[0],
    speedRelation, totalPauses: attempts.reduce((sum, attempt) => sum + attempt.motion.pauseCount, 0), actionCode };
}

export function buildPrompt(data) {
  return `당신은 진단을 새로 만들지 않고, 앱이 확정한 진단을 초보자가 이해할 한국어로 다듬는 드로잉 코치입니다.

반드시 아래 규칙을 지키세요.
- coreProblem: diagnostic.primaryIssue 한 가지만 말하세요. worstDirection 차이가 있으면 그 방향을 함께 특정하세요.
- evidence: primaryIssue의 평균 수치와 bestDirection/worstDirection 또는 전반/후반 비교를 숫자로 제시하세요.
- nextAction: actionCode에 해당하는 아래 처방 하나만 구체적으로 쓰세요.
- 오버레이 PNG는 진단 수치를 시각적으로 확인하는 보조 자료입니다. 이미지에서 새로운 질병·성격·신체 원인을 추측하지 마세요.
- 잘했다/못했다는 평가, 여러 문제 나열, 근거 없는 원인 추정은 금지합니다.
- 세 필드는 각각 한 문장, 100자 이내로 쓰세요.

고정 처방표:
- endpoint_overshoot: 펜촉 대신 끝점을 보고 목표에서 멈추기
- endpoint_undershoot_with_pause: 공중에서 2~3회 고스팅한 뒤 말미에 감속하거나 멈추지 않고 끝점까지 통과하기
- correct_endpoints: 펜촉 대신 끝점을 보고 고스팅 후 목표까지 통과하기
- wobble_slow_speed: 속도를 조금 올리고 손목보다 팔꿈치·어깨로 한 번에 긋기
- wobble_at_end: 끝점을 보되 말미에 급감속하지 않고 같은 리듬으로 통과하기
- correct_wobble: 고스팅 후 편한 일정 속도로 팔꿈치·어깨를 써서 긋기
- correct_deviation: 두 점 사이 경로를 고스팅하고 같은 경로로 한 번에 긋기
- correct_backtracking: 어긋나도 되돌아가 고치지 않고 같은 방향으로 끝까지 긋기
- correct_extraStrokes: 중간에 펜을 떼거나 덧그리지 않고 한 획으로 끝내기
- actionCode가 _direction_bias로 끝나면 해당 처방에 더해 최악 방향만 10회 연습하고 캔버스 각도를 편한 방향으로 조정하기

앱이 확정한 진단:
${JSON.stringify(deriveDiagnostic(data))}`;
}

export function parseModelFeedback(text) {
  const value = JSON.parse(text);
  if (!shortText(value?.coreProblem) || !shortText(value?.evidence) || !shortText(value?.nextAction)) throw new Error('모델 응답 형식이 올바르지 않습니다.');
  return { coreProblem: value.coreProblem.trim(), evidence: value.evidence.trim(), nextAction: value.nextAction.trim() };
}
