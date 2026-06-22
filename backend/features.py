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
    Return per-segment feature matrix: shape (n_segments, 1536).
    Caller decides how to aggregate (mean-only vs mean+std).
    """
    seg_feats = [extract_segment_features(seg) for seg in segments]
    return np.array(seg_feats, dtype=np.float32)  # (N, 1536)


def extract_features_participant(segments: List[np.ndarray]) -> np.ndarray:
    """
    Participant-level feature: mean+std across all segments → 3072-dim.
    Matches training aggregation in retrain script.
    """
    seg_feats = extract_features(segments)  # (N, 1536)
    if len(seg_feats) == 1:
        return np.concatenate([seg_feats[0], np.zeros(seg_feats.shape[1])]).astype(np.float32)
    return np.concatenate([seg_feats.mean(axis=0), seg_feats.std(axis=0)]).astype(np.float32)
