from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import accuracy_score, f1_score
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

from data_utils import LABELS, load_jsonl, rows_to_arrays, scaler_to_dict, split_and_scale
from model import SketchMLP


def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def evaluate(model, x, y):
    model.eval()
    with torch.no_grad():
        logits = model(torch.from_numpy(x))
        pred = logits.argmax(dim=1).cpu().numpy()
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "macro_f1": float(f1_score(y, pred, average="macro")),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/synthetic_v0.jsonl")
    parser.add_argument("--out", default="models")
    parser.add_argument("--epochs", type=int, default=120)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    set_seed(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rows = load_jsonl(args.data)
    x, y, _ = rows_to_arrays(rows)
    (x_train, y_train), (x_val, y_val), (x_test, y_test), scaler = split_and_scale(
        x, y, seed=args.seed
    )

    train_ds = TensorDataset(torch.from_numpy(x_train), torch.from_numpy(y_train))
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True)

    model = SketchMLP(input_dim=x_train.shape[1], num_classes=len(LABELS))
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)
    criterion = nn.CrossEntropyLoss()

    best_state = None
    best_val_f1 = -1.0

    for epoch in range(1, args.epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in train_loader:
            optimizer.zero_grad()
            logits = model(xb)
            loss = criterion(logits, yb)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * xb.shape[0]

        if epoch == 1 or epoch % 10 == 0 or epoch == args.epochs:
            val_metrics = evaluate(model, x_val, y_val)
            avg_loss = total_loss / len(train_ds)
            print(
                f"epoch={epoch:03d} loss={avg_loss:.5f} "
                f"val_acc={val_metrics['accuracy']:.4f} "
                f"val_macro_f1={val_metrics['macro_f1']:.4f}"
            )
            if val_metrics["macro_f1"] > best_val_f1:
                best_val_f1 = val_metrics["macro_f1"]
                best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)

    test_metrics = evaluate(model, x_test, y_test)
    print("TEST", json.dumps(test_metrics, ensure_ascii=False))

    torch.save(
        {
            "model_state": model.state_dict(),
            "input_dim": x_train.shape[1],
            "num_classes": len(LABELS),
            "labels": LABELS,
            "seed": args.seed,
        },
        out / "sketch_mlp.pt",
    )

    (out / "scaler.json").write_text(
        json.dumps(scaler_to_dict(scaler), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out / "metrics.json").write_text(
        json.dumps({"best_val_macro_f1": best_val_f1, "test": test_metrics}, indent=2),
        encoding="utf-8",
    )
    print(f"saved: {out / 'sketch_mlp.pt'}")
    print(f"saved: {out / 'scaler.json'}")


if __name__ == "__main__":
    main()
