from __future__ import annotations

import argparse
from pathlib import Path

import torch

from model import SketchMLP


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default="models/sketch_mlp.pt")
    parser.add_argument("--out", default="models/sketch_mlp.onnx")
    args = parser.parse_args()

    ckpt = torch.load(args.checkpoint, map_location="cpu")
    model = SketchMLP(ckpt["input_dim"], ckpt["num_classes"])
    model.load_state_dict(ckpt["model_state"])
    model.eval()

    dummy = torch.randn(1, ckpt["input_dim"], dtype=torch.float32)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    # dynamo=False is intentionally used for a simple, broadly compatible ONNX export path.
    torch.onnx.export(
        model,
        dummy,
        out.as_posix(),
        input_names=["features"],
        output_names=["logits"],
        dynamic_axes={"features": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17,
        dynamo=False,
    )
    print(f"saved: {out}")


if __name__ == "__main__":
    main()
