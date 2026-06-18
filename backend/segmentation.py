"""
Step 2 — Speech Segmentation

Splits a long audio recording into overlapping 5–10 second segments.
Segments shorter than min_seg_sec are discarded.
"""

import numpy as np
from typing import List

TARGET_SR    = 16000
SEG_SEC      = 7       # target segment length in seconds
OVERLAP_SEC  = 1       # overlap between segments
MIN_SEG_SEC  = 3       # discard segments shorter than this


def segment_audio(y: np.ndarray, sr: int = TARGET_SR,
                  seg_sec: int = SEG_SEC,
                  overlap_sec: int = OVERLAP_SEC,
                  min_sec: float = MIN_SEG_SEC) -> List[np.ndarray]:
    """
    Slice audio into fixed-length overlapping segments.

    Args:
        y:           mono float32 audio array
        sr:          sample rate (should be 16000)
        seg_sec:     segment length in seconds
        overlap_sec: overlap in seconds
        min_sec:     minimum valid segment length

    Returns:
        List of audio segment arrays, each of length sr * seg_sec (zero-padded if needed)
    """
    seg_len     = sr * seg_sec
    hop_len     = sr * (seg_sec - overlap_sec)
    min_len     = int(sr * min_sec)
    segments    = []

    if len(y) < min_len:
        # Audio shorter than minimum — pad and return as one segment
        padded = np.zeros(seg_len, dtype=np.float32)
        padded[:len(y)] = y
        return [padded]

    start = 0
    while start < len(y):
        end = start + seg_len
        seg = y[start:end]

        if len(seg) < min_len:
            break

        if len(seg) < seg_len:
            # Zero-pad the last short segment
            padded = np.zeros(seg_len, dtype=np.float32)
            padded[:len(seg)] = seg
            seg = padded

        segments.append(seg)
        start += hop_len

    return segments if segments else [y[:seg_len]]
