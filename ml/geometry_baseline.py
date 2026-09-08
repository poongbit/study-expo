from __future__ import annotations

import argparse
from pathlib import Path

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from data_utils import LABELS, load_jsonl


def predict(features: dict) -> str:
    # V0 synthetic-data thresholds. These are baselines, not artistic truths.
    if features["fragmentation_ratio"] > 1.40:
        return "STROKE_TOO_FRAGMENTED"
    if features["body_head_offset_x"] > 0.030:
        return "BODY_OFF_CENTER"
    if features["eye_y_diff"] > 0.020:
        return "EYES_UNBALANCED"
    if features["eye_distance"] > 0.160:
        return "EYES_TOO_WIDE"
    if features["torso_h"] > 0.215:
        return "TORSO_TOO_LONG"
    if features["head_w"] > 0.455:
        return "HEAD_TOO_WIDE"
    if features["head_h"] > 0.455:
        return "HEAD_TOO_TALL"
    return "GOOD"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/synthetic_v0.jsonl")
    args = parser.parse_args()

    rows = load_jsonl(args.data)
    y_true = [r["label"] for r in rows]
    y_pred = [predict(r["features"]) for r in rows]

    print(f"Accuracy: {accuracy_score(y_true, y_pred):.4f}")
    print(classification_report(y_true, y_pred, labels=LABELS, digits=4, zero_division=0))
    print("Confusion matrix (rows=true, cols=pred):")
    print(confusion_matrix(y_true, y_pred, labels=LABELS))


if __name__ == "__main__":
    main()
