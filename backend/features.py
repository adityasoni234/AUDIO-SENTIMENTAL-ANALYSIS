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


def extract_segment_features(segment: np.ndarray) -> np.ndarray:
    """
    Extract wav2vec 2.0 hidden-state features from a single audio segment.

    Returns a 768-dimensional feature vector (mean-pooled last hidden state).
    """
    processor, model = _load_model()

    inputs = processor(
        segment,
        sampling_rate=TARGET_SR,
        return_tensors='pt',
        padding=True,
    )

    input_values = inputs.input_values
    if torch.cuda.is_available():
        input_values = input_values.cuda()

    with torch.no_grad():
        outputs = model(input_values)

    # Mean-pool over the time axis → (768,)
    hidden = outputs.last_hidden_state.squeeze(0)   # (T, 768)
    return hidden.mean(dim=0).cpu().numpy().astype(np.float32)


def extract_features(segments: List[np.ndarray]) -> np.ndarray:
    """
    Extract and aggregate features from all segments of one recording.

    Strategy: average the per-segment feature vectors → one 768-d vector per recording.
    This captures the overall prosodic/cognitive pattern across the interview.
    """
    seg_feats = [extract_segment_features(seg) for seg in segments]
    return np.mean(seg_feats, axis=0)   # (768,)
