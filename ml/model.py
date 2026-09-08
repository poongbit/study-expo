from __future__ import annotations

import torch
from torch import nn


class SketchMLP(nn.Module):
    def __init__(self, input_dim: int = 7, num_classes: int = 8):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)
