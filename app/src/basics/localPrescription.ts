// localPrescription.ts — shape-specific diagnosis tables.
// Gemini is only given { diagnosisCode, numericEvidence, allowedPrescription } as text.
// It polishes the wording; it never generates free-form diagnoses.

export type ExerciseType = 'line' | 'curve' | 'circle';

export interface DiagnosisCode {
  code: string;
  label: string;
  prescription: string;
}

// ── Line prescriptions ──────────────────────────────────────────────────────

export const LINE_PRESCRIPTIONS: Record<string, DiagnosisCode> = {
  wobble_slow: {
    code: 'wobble_slow',
    label: '흔들림 + 상대적 저속',
    prescription: '속도를 조금 올리고 팔꿈치·어깨를 함께 사용해 보세요.',
  },
  wobble_end: {
    code: 'wobble_end',
    label: '말미 흔들림 + 감속',
    prescription: '끝점을 보되 같은 리듬으로 통과하세요. 끝점에서 멈추지 마세요.',
  },
  undershoot_pause: {
    code: 'undershoot_pause',
    label: '언더슈트 + 말미 정지',
    prescription: '고스팅 후 멈추지 않고 끝점까지 통과하세요.',
  },
  direction_unstable: {
    code: 'direction_unstable',
    label: '특정 방향만 불안정',
    prescription: '해당 방향 10회 집중 및 캔버스 각도를 조정해 보세요.',
  },
  backtracking: {
    code: 'backtracking',
    label: '되돌아감',
    prescription: '어긋나도 고치지 말고 끝점 방향으로 통과한 뒤 다음 획에서 조정하세요.',
  },
  extraStrokes: {
    code: 'extraStrokes',
    label: '획 끊김',
    prescription: '화면 위에서 동작을 미리 연습한 뒤 한 획으로 이어보세요.',
  },
  deviation: {
    code: 'deviation',
    label: '가이드 이탈',
    prescription: '출발 전 시작점과 끝점을 번갈아 본 뒤 팔 전체로 두 점을 잇는 경로를 만들어보세요.',
  },
  endpoints: {
    code: 'endpoints',
    label: '시작·끝점 오차',
    prescription: '긋기 전에 멈출 위치를 먼저 확인하고 끝점까지 시선을 보내세요.',
  },
};

// ── Curve prescriptions ─────────────────────────────────────────────────────

export const CURVE_PRESCRIPTIONS: Record<string, DiagnosisCode> = {
  curvature_spike: {
    code: 'curvature_spike',
    label: '곡률 급변',
    prescription: '커브 전체 리듬을 고스팅한 뒤 한 번에 그리세요.',
  },
  s_inflection_stop: {
    code: 's_inflection_stop',
    label: 'S 커브 변곡점 정지',
    prescription: '변곡점을 멈춤 지점이 아닌 통과 지점으로 연습하세요.',
  },
  flatness: {
    code: 'flatness',
    label: '커브가 납작하거나 과도하게 부품',
    prescription: '가이드 곡선을 보며 전체 호의 깊이를 먼저 파악한 뒤 그리세요.',
  },
  direction_reversal: {
    code: 'direction_reversal',
    label: '의도치 않은 방향 전환',
    prescription: '곡선 방향을 공중에서 여러 번 연습한 뒤 같은 리듬으로 그리세요.',
  },
  backtracking: {
    code: 'backtracking',
    label: '되돌아감·덧그리기',
    prescription: '어긋나도 되돌아가지 말고 끝까지 진행하세요.',
  },
  extraStrokes: {
    code: 'extraStrokes',
    label: '획 끊김',
    prescription: '한 호를 한 획으로 잇는 연습을 반복하세요.',
  },
  averageGuideDistance: {
    code: 'averageGuideDistance',
    label: '가이드 곡선 이탈',
    prescription: '가이드를 따라 공중에서 경로를 먼저 연습하세요.',
  },
  endpointError: {
    code: 'endpointError',
    label: '시작·끝점 오차',
    prescription: '시작점과 끝점 위치를 먼저 확인한 뒤 그리세요.',
  },
};

// ── Circle prescriptions ────────────────────────────────────────────────────

export const CIRCLE_PRESCRIPTIONS: Record<string, DiagnosisCode> = {
  closure_error: {
    code: 'closure_error',
    label: '원 폐쇄 오차',
    prescription: '시작점 대신 원 전체 궤적을 보며 한 바퀴를 통과하세요.',
  },
  junction_kink: {
    code: 'junction_kink',
    label: '접합부 꺾임',
    prescription: '시작 전 원을 공중에서 반복 회전한 뒤 같은 속도로 완주하세요.',
  },
  radius_variance: {
    code: 'radius_variance',
    label: '반지름 편차',
    prescription: '중심점을 응시하면서 팔 전체로 원을 그리세요.',
  },
  sector_distortion: {
    code: 'sector_distortion',
    label: '구간별 찌그러짐',
    prescription: '찌그러진 구간에 진입하기 전에 속도와 힘을 일정하게 유지하세요.',
  },
  center_error: {
    code: 'center_error',
    label: '중심 위치 오차',
    prescription: '가이드 중심점을 기준으로 시작점 위치를 먼저 확인하세요.',
  },
  completion_ratio: {
    code: 'completion_ratio',
    label: '한 바퀴 초과 또는 미완성',
    prescription: '한 바퀴를 공중에서 여러 번 연습한 뒤 정확히 한 번 완주하세요.',
  },
};

// ── Selection helper ────────────────────────────────────────────────────────

const TABLES: Record<ExerciseType, Record<string, DiagnosisCode>> = {
  line: LINE_PRESCRIPTIONS,
  curve: CURVE_PRESCRIPTIONS,
  circle: CIRCLE_PRESCRIPTIONS,
};

export function prescriptionFor(exerciseType: ExerciseType, diagnosisCode: string): DiagnosisCode | null {
  return TABLES[exerciseType][diagnosisCode] ?? null;
}
