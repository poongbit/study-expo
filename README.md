# SD Sketch Coach — Starter

온디바이스 SD 캐릭터 드로잉 코치의 첫 실험용 repository입니다.

## 현재 목표

`synthetic trajectory → geometry baseline → MLP → ONNX` 파이프라인을 먼저 검증합니다.

## 프로젝트 구조

```text
sd-sketch-coach-starter/
├── app/                     # React Native (후속 단계)
├── data/
│   ├── ontology.json
│   ├── expert_template.json
│   └── synthetic_v0.jsonl
├── ml/
│   ├── data_utils.py
│   ├── model.py
│   ├── geometry_baseline.py
│   ├── train_mlp.py
│   ├── evaluate.py
│   ├── export_onnx.py
│   └── verify_onnx.py
├── models/
├── results/
├── notebooks/
│   └── SD_Sketch_Coach_Colab.ipynb
├── requirements.txt
└── README.md
```

## Antigravity / Mac 로컬 실행

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python ml/geometry_baseline.py
python ml/train_mlp.py
python ml/evaluate.py
python ml/export_onnx.py
python ml/verify_onnx.py
```

### 예상 산출물

```text
models/sketch_mlp.pt
models/scaler.json
models/metrics.json
models/sketch_mlp.onnx
```

> MLP는 매우 작기 때문에 첫 실험은 GPU가 필요하지 않습니다.

## Colab 사용 방식

1. 이 폴더를 GitHub repository에 push합니다.
2. `notebooks/SD_Sketch_Coach_Colab.ipynb`를 Colab에서 엽니다.
3. 첫 셀의 `GITHUB_REPO_URL`을 자신의 repository 주소로 수정합니다.
4. 순서대로 실행합니다.
5. 생성한 `.onnx`와 평가 결과를 내려받거나 Google Drive에 저장합니다.

## 중요한 실험 원칙

현재 synthetic dataset에서 높은 성능이 나와도 실제 초보자 그림 성능을 의미하지 않습니다.
V0의 목적은 다음 두 가지뿐입니다.

1. 데이터/라벨/feature pipeline이 정상적인가?
2. Geometry baseline과 작은 ML baseline을 비교할 수 있는가?

실제 성능 검증은 real beginner dataset을 수집한 뒤 수행합니다.
