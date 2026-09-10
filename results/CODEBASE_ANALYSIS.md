# ChibiCoach / sd-sketch-coach — 코드베이스 정밀 분석

분석 일자: 2026-09-09 · 대상 커밋 `52e06c4` (다중 오류를 탐지하도록 수정)

---

## 0. 결론 먼저

파이프라인의 **뼈대는 정확하게 잘 놓였다.** 온톨로지 → 합성데이터 → geometry baseline → MLP → ONNX → RN 앱까지 층이 전부 존재하고, README에 "합성 데이터 점수는 실성능이 아니다"라고 스스로 못 박아둔 판단은 이 단계 프로젝트에서 보기 드물게 성숙하다.

문제는 **층들이 서로 연결되어 있지 않다**는 것이다. Python이 학습한 모델은 앱에서 단 한 번도 실행되지 않고, 앱이 실제로 쓰는 규칙은 Python 온톨로지와 다른 좌표계에서 살고 있으며, 그 규칙의 임계값은 어떤 데이터로도 검증된 적이 없다.

**정량 증거**: 합성 데이터 1,600개를 앱의 판정 로직(`multiErrorDetector` + `multiErrorConfig`)에 그대로 투입하면 —

| 지표 | 값 |
|---|---|
| Python geometry baseline 정확도 | **0.9881** |
| 앱 규칙 정확도 | **0.1250** |
| 앱이 내놓은 서로 다른 답의 개수 | **1개** (전부 `STROKE_TOO_FRAGMENTED`) |

즉 현재 앱은 무엇을 그리든 "선을 너무 자주 끊지 말고 조금 더 길게 이어서 그려보세요"만 출력한다. 이건 성능 문제가 아니라 **배선(wiring) 문제**다. 그래서 고칠 수 있다.

---

## 1. 현재 자산 지도

```
sd-sketch-coach/
├─ data/            온톨로지 8클래스 · 전문가 템플릿 1종 · 합성 1,600샘플
├─ ml/              feature/split/scale · MLP(7-32-32-8) · geometry baseline · ONNX export/verify
├─ models/          sketch_mlp.pt · scaler.json · sketch_mlp.onnx · metrics.json
├─ notebooks/       Colab 재현 노트북 12셀
└─ app/             Expo 57 / RN 0.86 / Skia 드로잉 · TS feature 추출 · 규칙 기반 다중오류 탐지
   └─ ios-native/   PencilKit(PKCanvasView) 브리지 (Swift + ObjC)
```

### 1-1. 잘 되어 있는 것

- **온톨로지의 설계 사상.** `ontology.json`의 `v0_policy`에 `aesthetic_judgment: false`, `style_target: "사용자가 선택한 템플릿 기준"`을 명시했다. "채점이 아니라 교정"이라는 서비스 정의가 데이터 스키마 레벨에 박혀 있다. 이게 이 프로젝트의 가장 값나가는 자산이다.
- **severity_metric을 클래스마다 문자열로 정의**해둔 것. 나중에 자동 라벨링·자동 검증으로 승격시킬 수 있는 형태다.
- **ONNX 수치 검증 루틴**(`verify_onnx.py`, 1e-4 임계) 존재. 온디바이스 이식에서 가장 흔한 사고를 미리 막아뒀다.
- **`results/INITIAL_SANITY_CHECK.md`.** 정확도 1.0을 성과가 아니라 "클래스가 feature space에서 너무 쉽게 분리된다"는 경고로 읽었다. 이 자기비판이 없었으면 프로젝트가 이미 잘못된 방향으로 반년 갔을 것이다.
- **PencilKit 브리지**가 `force / azimuth / altitude / timeOffset`을 전부 뽑도록 이미 작성되어 있음. 향후 stroke trajectory 코칭에 필요한 원재료 확보 경로가 준비돼 있다.

---

## 2. 비전 대비 구현 갭

| 서비스 정의 | 현재 구현 | 판정 |
|---|---|---|
| 구조적 비율 + stroke 데이터 분석 | 비율 6종만. stroke는 "개수"만 사용 | 부분 |
| **여러** 오류 탐지 | `multiErrorDetector`가 6종 병렬 평가 | 구조는 있음 / 동작 불능 |
| 그중 **가장 먼저 고칠 하나** 선정 | severity 내림차순 정렬 후 1위 | 구조는 있음 / 항상 같은 답 |
| 다시 그리면 **이전 시도와 비교** | **미구현** — 저장소·비교 로직·UI 전무 | 없음 |
| 온디바이스 AI | ONNX 미탑재, `mockInference`가 대역 | 없음 |
| stroke trajectory(순서·끊김·수정 패턴) | `t` 수집만 하고 미사용, PencilCanvas 미마운트 | 없음 |

핵심: **"재시도 비교"가 이 서비스의 차별점인데 코드가 0줄이다.** `testSamples`는 컴포넌트 state라 화면을 벗어나면 증발한다. 지금 이 프로젝트에서 가장 먼저 존재해야 할 것은 더 좋은 모델이 아니라 **attempt를 영속화하는 저장소**다.

---

## 3. 치명적 결함 (심각도 순)

### 🔴 C1. `STROKE_TOO_FRAGMENTED`가 항상, 최대 severity로 발화

`featureExtractor.ts`:
```ts
const fragmentation_ratio = headStrokes.length;   // 정수 개수 (머리를 그렸으면 최소 1)
```
`multiErrorConfig.ts`:
```ts
STROKE_TOO_FRAGMENTED: { value: 0.4, max: 1.0 }
```

머리를 한 획으로 완벽하게 그려도 `1 > 0.4` → detected, severity = `(1-0.4)/(1.0-0.4)` = **1.0**. severity 1.0은 상한이라 다른 어떤 오류도 이길 수 없고, 정렬 1위가 영구 고정된다.

Python 쪽 정의는 완전히 다르다 — `fragmentation_ratio = stroke_count / expert_stroke_count` (정상 1.0, 오류 평균 1.83). **같은 이름의 feature가 두 언어에서 다른 물리량을 가리킨다.**

### 🔴 C2. 나머지 임계값이 템플릿 기준 4~10배 느슨 — 사실상 발화 불가

`expert_template.json` 기준값과 대조:

| 오류 | 템플릿 목표값 | 앱 임계값 | 배율 | 합성 오류 샘플 실측 | 발화? |
|---|---|---|---|---|---|
| EYES_TOO_WIDE | 0.35 | 0.50 | ×1.43 | 0.456 | ❌ |
| EYES_UNBALANCED | ~0.005 | 0.20 | ×40 | 0.110 | ❌ |
| TORSO_TOO_LONG | **0.475** | **2.0** | **×4.2** | 0.636 | ❌ |
| BODY_OFF_CENTER | ~0.015 | 0.30 | ×20 | 0.175 | ❌ |
| HEAD_TOO_WIDE | 1.00 | 1.20 | ×1.2 | 1.247 | ⚠️ 겨우 |

`TORSO_TOO_LONG`은 몸통이 머리의 2배 길이여야 발화한다. 2등신 치비에서 그건 몸통이 정답의 4.2배라는 뜻이고, 그런 그림은 존재하지 않는다.

**임계값이 전문가 템플릿에서 유도된 것이 아니라 손으로 찍힌 숫자다.** 이게 C1보다 더 구조적인 문제다.

### 🔴 C3. 학습된 모델이 제품에 존재하지 않음

- `package.json`에 `onnxruntime-react-native` 없음. `sketch_mlp.onnx`는 앱 번들에 포함되지도 않는다.
- `mockInference.ts`가 대신 들어가 있고, 그 결과(`inferenceResult`)는 UI 디버그 영역에 **표시만** 되고 사용자에게 보여줄 피드백 선택에는 관여하지 않는다.
- 즉 Python 학습 파이프라인 전체가 현재 제품에 0의 기여를 하고 있다. `scaler.ts`에 하드코딩된 mean/scale은 `models/scaler.json`과 값은 일치하지만, 쓰이는 곳이 mock뿐이다.

### 🟠 C4. `TestSample` 타입 미정의 — 타입체크 실패

`drawing.tsx:17`이 `../types/drawing`에서 `TestSample`을 import하지만 `types/drawing.ts`에 그 선언이 없다. Metro는 타입을 지우고 돌리므로 런타임은 살지만 `tsc`는 깨진다. **CI가 없어서 아무도 모르고 있다.**

### 🟠 C5. `HEAD_TOO_TALL` 클래스 증발

온톨로지 8클래스 → `multiErrorDetector` 6종 평가 → `EXPECTED_LABELS` 7종. `HEAD_TOO_TALL`이 탐지기에도, 라벨 선택기에도 없다. `head_aspect_ratio < 0.83` 조건이 통째로 빠졌다.

### 🟠 C6. PencilKit 브리지의 이벤트가 JS에 절대 도달하지 않음

`PencilCanvasBridge.m`에 ViewManager의 prop export가 없다:
```objc
@interface RCT_EXTERN_MODULE(PencilCanvasViewManager, RCTViewManager)
@end   // ← RCT_EXPORT_VIEW_PROPERTY(onStrokesExported, RCTDirectEventBlock) 누락
```
`onStrokesExported` / `onDrawingChanged`가 등록되지 않아 Swift에서 콜백을 호출해도 JS 핸들러는 비어 있다. 덧붙여 `PencilCanvasView.m`은 `RCT_EXTERN__BLOCK_PROP_GROUP`이라는 **존재하지 않는 매크로**를 쓰고 있고 pbxproj에 등록도 안 돼 있다(= 죽은 파일, 삭제 대상). 그리고 `PencilCanvas` 컴포넌트는 앱 어디에서도 마운트되지 않는다.

또한 네이티브 소스가 `app/ios-native/`와 `app/ios/SDSketchCoach/` 두 곳에 **동일 사본으로 중복 존재**한다(현재는 일치하지만 반드시 드리프트한다). 정식 해법은 `expo-module` 또는 config plugin으로 단일화하는 것.

### 🟡 C7. V0 feature가 절대 좌표계 — 스케일 종속

Python MLP가 학습한 것은 `head_w`, `torso_h` 같은 **캔버스 정규화 절대값**이다. 사용자가 캔버스 구석에 작게 그리면 전부 오분류된다. `featureExtractorV1`의 상대비율 설계가 정답인데, **V1 feature로 학습된 Python 모델이 없다.** 앱은 V1로 판정하고 Python은 V0로 학습하는, 서로 만나지 않는 두 갈래.

### 🟡 C8. 합성 데이터 생성기 스크립트 부재

`data/synthetic_v0.jsonl`(1,600행)은 있는데 이걸 만든 코드가 저장소에 없다. `INITIAL_SANITY_CHECK.md`가 다음 과제로 지목한 "약한 severity 추가 / multi-error 샘플 추가"를 **수행할 수단이 없다.** 재현성 관점에서 이게 조용한 최대 리스크다.

부수 확인: 현재 합성 데이터는 클래스당 정확히 200개, 오류 1개만 주입, feature space가 축 정렬로 완벽 분리 — 정확도 1.0이 나온 이유가 데이터에 그대로 찍혀 있다.

### 🟡 C9. 잡음

- `app/package.json`의 `"name": "privacy-lens"` — 다른 프로젝트 템플릿 잔재.
- `src/app/index.tsx`가 아직 Expo 기본 "Welcome to Expo" 화면.
- 테스트 0개. lint/typecheck CI 0개.
- `getCenter`가 빈 stroke에 `{0,0}`을 반환하고 `x!==0||y!==0`로 존재 여부를 판정 — 캔버스 좌상단에 그리면 오판하는 sentinel 안티패턴.
- `.venv/`가 저장소에 커밋되어 있음(.gitignore 확인 필요).

---

## 4. 권장 실행 순서

### Phase A — 배선 복구 (1~2일, 이걸 안 하면 아래는 전부 무의미)

1. `fragmentation_ratio` 정의를 Python과 통일: `stroke_count / expert_stroke_count`. 임계값은 `1.4`.
2. **임계값을 손으로 찍지 말고 `expert_template.json`에서 유도**한다. 코드로:
   `EYES_TOO_WIDE.value = (0.14/0.40) × 1.25 = 0.4375` 식으로 템플릿 × 허용오차 계수로 생성. 그러면 템플릿을 바꿔도 임계값이 따라온다.
3. `TestSample` 타입 선언 추가, `HEAD_TOO_TALL` 탐지 브랜치 추가.
4. `tsc --noEmit` + `expo lint`를 CI에 건다. C4 같은 결함이 두 번 나오지 않게.
5. **회귀 테스트**: 합성 1,600개를 앱 규칙(TS)에 투입해 정확도를 찍는 스크립트를 만든다. 지금 0.125 → Phase A 후 0.9 이상이 목표. 이 숫자가 앞으로 모든 변경의 기준선이 된다.

### Phase B — 재시도 비교 (서비스의 실제 차별점)

6. `attempts` 영속화: `expo-sqlite` 또는 AsyncStorage에 `{attemptId, timestamp, v1Features, detectedErrors, primaryError, strokes}` 저장.
7. **개선 측정 정의를 먼저 문서로 못 박는다.** 예: "직전 attempt의 primaryError severity가 30% 이상 감소하면 개선". 이 정의가 서비스의 정체성이므로 코드보다 먼저 와야 한다.
8. UI: "지난번 대비 눈 간격 오차 0.11 → 0.04" 같은 **한 줄 델타**. 점수 대신 변화량을 보여주는 것이 "채점이 아니라 교정"의 UI적 구현이다.

### Phase C — 모델 복권

9. `generate_synthetic.py`를 작성해 데이터 생성을 재현 가능하게 만들고, ① 약한 severity(경계 겹침) ② multi-error 샘플 ③ 캔버스 위치·스케일 지터를 주입한다.
10. **V1 상대 feature로 재학습**한다. multi-label(sigmoid + BCE) + severity 회귀 헤드를 붙이면 앱의 `detectErrorsV1`과 출력 계약이 일치한다.
11. `onnxruntime-react-native` 도입, Development Build 전환, `mockInference` 교체. `verify_onnx.py`의 기준을 그대로 온디바이스 스모크 테스트로 재사용.

### Phase D — trajectory 코칭 (원래 목표)

12. PencilKit 브리지 수리(`RCT_EXPORT_VIEW_PROPERTY` 추가) → `force/azimuth/altitude/timeOffset` 수집 개시. 네이티브 소스 중복 제거.
13. 전문가 stroke 시퀀스 확보 → DTW 정렬 → 순서·끊김·재수정 패턴 지표화.
14. 실제 초보자 그림 30~50개로 domain gap 측정. **synthetic 점수와 real-user 점수는 반드시 분리 보고** (README가 이미 명령해둔 사항).

---

## 5. 한 문장

이 프로젝트에서 지금 필요한 것은 더 똑똑한 모델이 아니라, **이미 만들어 놓은 층들을 서로 이어붙이고 그 접합부를 숫자로 감시하는 회귀 테스트**다. 정확도 0.125라는 사실을 아무도 몰랐다는 것 자체가 최우선 과제를 가리키고 있다.
