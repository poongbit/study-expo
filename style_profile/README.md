# Style Profile Extraction Pipeline

이 디렉토리는 `anime-face-detector`를 활용하여 애니메이션 이미지에서 얼굴 랜드마크를 추출하고, 기하학적 특징(geometry features)을 기반으로 스타일 프로필(예: `chibi_2head_front_v1`)을 생성하는 Python 파이프라인을 포함하고 있습니다.

## Directory Structure
- `images/`: 원본 애니메이션/일러스트 이미지 폴더 (사용자가 직접 이미지를 이 곳에 넣어야 합니다).
- `outputs/`: 랜드마크 추출, 특징 계산, 최종 스타일 통계 프로필 JSON 등이 저장되는 폴더.
- `detect_landmarks.py`: `images/`에서 이미지를 읽어 얼굴 BBox 및 28개 랜드마크를 추출합니다.
- `extract_style_features.py`: 추출된 랜드마크를 바탕으로 얼굴 비율, 눈 사이 간격 등을 계산합니다.
- `build_profile.py`: 각 이미지의 특징 값을 집계하여 최종 통계 프로필을 생성합니다.

## Landmark Indices (anime-face-detector 28 points)
본 파이프라인에서 사용하는 `anime-face-detector` (HRNetV2)의 28개 랜드마크 인덱스 매핑은 다음과 같습니다.
- **0~4**: 얼굴 윤곽/턱선 (5 points)
- **5~7**: 왼쪽 눈썹 (3 points)
- **8~10**: 오른쪽 눈썹 (3 points)
- **11~16**: 왼쪽 눈 (6 points)
- **17~22**: 오른쪽 눈 (6 points)
- **23**: 코 (1 point)
- **24~27**: 입 (4 points)

## Usage
이미지들을 `images/` 폴더에 모은 후, 다음 스크립트를 순서대로 실행하세요.
```bash
python detect_landmarks.py
python extract_style_features.py
python build_profile.py
```
최종 결과는 `outputs/chibi_2head_front_v1.json`으로 저장됩니다.
