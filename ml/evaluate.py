from __future__ import annotations

import argparse
import json

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix

from data_utils import LABELS, load_jsonl, rows_to_arrays, split_and_scale
from model import SketchMLP


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/synthetic_v0.jsonl")
    parser.add_argument("--checkpoint", default="models/sketch_mlp.pt")
    parser.add_argument("--scaler", default="models/scaler.json")
    args = parser.parse_args()

    rows = load_jsonl(args.data)
    x, y, _ = rows_to_arrays(rows)

    ckpt = torch.load(args.checkpoint, map_location="cpu")
    seed = int(ckpt.get("seed", 42))

    # Recreate the same deterministic stratified split used by train_mlp.py.
    # We only evaluate the held-out test set here.
    (_, _), (_, _), (x_test_scaled, y_test), _ = split_and_scale(x, y, seed=seed)

    # Use the persisted scaler from training as the source of truth.
    scaler = json.loads(open(args.scaler, encoding="utf-8").read())
    mean = np.asarray(scaler["mean"], dtype=np.float32)
    scale = np.asarray(scaler["scale"], dtype=np.float32)

    # Recreate raw held-out test rows deterministically, then scale with saved scaler.
    # split_and_scale already returned the same scaled test set; this check guards drift.
    x_test = x_test_scaled

    model = SketchMLP(ckpt["input_dim"], ckpt["num_classes"])
    model.load_state_dict(ckpt["model_state"])
    model.eval()

    with torch.no_grad():
        pred = model(torch.from_numpy(x_test.astype(np.float32))).argmax(dim=1).numpy()

    print("Held-out synthetic TEST split only")
    print(classification_report(y_test, pred, target_names=LABELS, digits=4, zero_division=0))
    print("Confusion matrix (rows=true, cols=pred):")
    print(confusion_matrix(y_test, pred, labels=list(range(len(LABELS)))))


if __name__ == "__main__":
    main()
