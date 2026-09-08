# Initial sanity check

검증 환경의 첫 실행 결과입니다.

- Geometry rule baseline: accuracy ≈ **0.9881** on the full synthetic V0 set.
- MLP: held-out synthetic test split accuracy / macro-F1 = **1.0000 / 1.0000** in the sanity run.

## 해석

이 수치는 실제 초보자 그림 성능을 의미하지 않습니다. 오히려 현재 synthetic class가 feature space에서 너무 쉽게 분리된다는 뜻입니다.

다음 단계에서는 다음을 우선합니다.

1. class 경계가 겹치는 더 약한 오류(severity) 추가
2. 동시에 2개 이상 오류가 있는 multi-error sample 추가
3. 실제 초보자 그림 30~50개로 domain gap 측정
4. synthetic-only 점수와 real-user 점수를 반드시 분리 보고
