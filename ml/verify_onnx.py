from __future__ import annotations

import argparse
import numpy as np
import onnxruntime as ort
import torch

from model import SketchMLP


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default="models/sketch_mlp.pt")
    parser.add_argument("--onnx", default="models/sketch_mlp.onnx")
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location="cpu")
    model = SketchMLP(ckpt["input_dim"], ckpt["num_classes"])
    model.load_state_dict(ckpt["model_state"])
    model.eval()

    x = np.random.default_rng(42).normal(size=(4, ckpt["input_dim"])).astype(np.float32)
    with torch.no_grad():
        torch_out = model(torch.from_numpy(x)).numpy()

    session = ort.InferenceSession(args.onnx, providers=["CPUExecutionProvider"])
    ort_out = session.run(["logits"], {"features": x})[0]

    max_abs_diff = float(np.max(np.abs(torch_out - ort_out)))
    print(f"max_abs_diff={max_abs_diff:.8f}")
    if max_abs_diff > 1e-4:
        raise SystemExit("ONNX verification failed: output difference is too large")
    print("ONNX verification: OK")


if __name__ == "__main__":
    main()
