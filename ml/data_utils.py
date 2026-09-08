from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

FEATURE_NAMES = [
    "head_w",
    "head_h",
    "eye_distance",
    "eye_y_diff",
    "torso_h",
    "body_head_offset_x",
    "fragmentation_ratio",
]

LABELS = [
    "GOOD",
    "HEAD_TOO_WIDE",
    "HEAD_TOO_TALL",
    "EYES_TOO_WIDE",
    "EYES_UNBALANCED",
    "TORSO_TOO_LONG",
    "BODY_OFF_CENTER",
    "STROKE_TOO_FRAGMENTED",
]
LABEL_TO_ID = {name: i for i, name in enumerate(LABELS)}


def load_jsonl(path: str | Path) -> List[dict]:
    path = Path(path)
    rows: List[dict] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def rows_to_arrays(rows: List[dict]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    x = np.asarray(
        [[float(row["features"][name]) for name in FEATURE_NAMES] for row in rows],
        dtype=np.float32,
    )
    y = np.asarray([LABEL_TO_ID[row["label"]] for row in rows], dtype=np.int64)
    severity = np.asarray([float(row.get("severity", 0.0)) for row in rows], dtype=np.float32)
    return x, y, severity


def split_and_scale(
    x: np.ndarray,
    y: np.ndarray,
    seed: int = 42,
    test_size: float = 0.15,
    val_size: float = 0.15,
):
    x_train_val, x_test, y_train_val, y_test = train_test_split(
        x, y, test_size=test_size, random_state=seed, stratify=y
    )
    val_fraction_of_train_val = val_size / (1.0 - test_size)
    x_train, x_val, y_train, y_val = train_test_split(
        x_train_val,
        y_train_val,
        test_size=val_fraction_of_train_val,
        random_state=seed,
        stratify=y_train_val,
    )

    scaler = StandardScaler()
    x_train = scaler.fit_transform(x_train).astype(np.float32)
    x_val = scaler.transform(x_val).astype(np.float32)
    x_test = scaler.transform(x_test).astype(np.float32)

    return (x_train, y_train), (x_val, y_val), (x_test, y_test), scaler


def scaler_to_dict(scaler: StandardScaler) -> Dict[str, list]:
    return {
        "feature_names": FEATURE_NAMES,
        "mean": scaler.mean_.astype(float).tolist(),
        "scale": scaler.scale_.astype(float).tolist(),
    }
