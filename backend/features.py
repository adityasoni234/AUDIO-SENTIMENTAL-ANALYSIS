"""
Step 3 — wav2vec 2.0 Feature Learning

Loads facebook/wav2vec2-base and extracts the mean-pooled hidden states
from the transformer layers as a fixed-size feature vector per segment.

The model captures:
  - Prosodic flattening
  - Speech rhythm irregularities
  - Vocal energy variations
  - Emotional and cognitive speech patterns
"""

import numpy as np
import torch
from transformers import Wav2Vec2Processor, Wav2Vec2Model
from typing import List

MODEL_NAME = 'facebook/wav2vec2-base'
TARGET_SR  = 16000

_processor = None
_model     = None


def _load_model():
    global _processor, _model
    if _processor is None:
        print(f"Loading {MODEL_NAME}…")
        _processor = Wav2Vec2Processor.from_pretrained(MODEL_NAME)
        _model     = Wav2Vec2Model.from_pretrained(MODEL_NAME, use_safetensors=True)
        _model.eval()
        if torch.cuda.is_available():
            _model = _model.cuda()
    return _processor, _model


def _get_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def extract_segment_features(segment: np.ndarray) -> np.ndarray:
    """
    Extract wav2vec 2.0 hidden-state features: mean + std concat → 1536-dim.
    Matches the feature extraction used during training (train.py).
    """
    processor, model = _load_model()
    device = _get_device()
    model.to(device)

    inputs = processor(
        segment,
        sampling_rate=TARGET_SR,
        return_tensors='pt',
        padding=True,
    )

    input_values = inputs.input_values.to(device)

    with torch.no_grad():
        outputs = model(input_values)

    # mean + std concat over time axis → (1536,)
    hidden = outputs.last_hidden_state.squeeze(0).cpu()  # (T, 768)
    feat = np.concatenate([
        hidden.mean(dim=0).numpy(),
        hidden.std(dim=0).numpy(),
    ]).astype(np.float32)
    return feat


def extract_features(segments: List[np.ndarray]) -> np.ndarray:
    """
    Aggregate per-segment features into one vector per recording (mean across segments).
    """
    seg_feats = [extract_segment_features(seg) for seg in segments]
    return np.mean(seg_feats, axis=0)   # (1536,)
