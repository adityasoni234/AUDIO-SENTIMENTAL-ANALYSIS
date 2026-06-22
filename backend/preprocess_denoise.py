"""
Step 1 — Noise Reduction + Interviewer Voice Removal
-----------------------------------------------------
For each DAIC-WOZ audio file:
  1. Spectral-gating noise reduction (noisereduce)
  2. Energy-based VAD: detect participant vs interviewer turns using
     long-pause detection and energy thresholding, keep only
     participant segments (those after the first long interviewer pause)
  3. Save cleaned audio to data/clean_audio/<pid>_clean.wav

Estimated time: ~5-8 minutes for 219 files.
"""

import os, warnings, time
warnings.filterwarnings('ignore')

import numpy as np
import librosa, soundfile as sf
import noisereduce as nr
import pandas as pd
from tqdm import tqdm

AUDIO_DIR   = '/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset/audio'
LABELS_CSV  = '/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset/labels.csv'
OUT_DIR     = os.path.join(os.path.dirname(__file__), 'data', 'clean_audio')
SR          = 16000

os.makedirs(OUT_DIR, exist_ok=True)


def remove_interviewer_turns(y: np.ndarray, sr: int) -> np.ndarray:
    """
    DAIC-WOZ interviews follow a fixed pattern: the Ellie robot (interviewer)
    speaks first, then the participant responds, then Ellie again, etc.
    We detect long silence gaps (>0.8s) to split turns and remove short-energy
    turn segments that resemble the robotic interviewer voice.

    Strategy:
    - Compute RMS in 100ms frames
    - Detect voice-active regions (VAD)
    - Split into speech turns separated by ≥0.7s silence
    - Ellie's voice is higher-frequency and more uniform; participant speech
      is more varied in energy. We use energy variance to heuristically
      keep turns with higher variance (participant speech).
    - Keep the top-70% variance turns and concatenate them.
    """
    frame_len  = int(sr * 0.1)   # 100ms frame
    hop_len    = int(sr * 0.05)  # 50ms hop
    rms        = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]

    # Voice activity: RMS > 5% of max
    threshold  = rms.max() * 0.05
    voiced     = rms > threshold

    # Find speech regions
    turns, in_speech, start = [], False, 0
    silence_frames = int(0.7 * sr / hop_len)   # 0.7s in frames

    for i, v in enumerate(voiced):
        if v and not in_speech:
            start = i
            in_speech = True
        elif not v and in_speech:
            # check silence length
            j = i
            while j < len(voiced) and not voiced[j]:
                j += 1
            if j - i >= silence_frames:
                turns.append((start, i))
                in_speech = False
                start = j

    if in_speech:
        turns.append((start, len(voiced)))

    if not turns:
        return y

    # Energy variance per turn — participant = higher variance
    def turn_audio(t):
        s = int(t[0] * hop_len)
        e = int(t[1] * hop_len)
        return y[s:min(e, len(y))]

    variances = [np.var(turn_audio(t)) for t in turns]
    median_var = np.median(variances)

    # Keep turns whose variance exceeds median (participant)
    # Skip first 2 turns (typically Ellie introduction)
    kept = [turn_audio(t) for i, t in enumerate(turns)
            if i >= 2 and variances[i] >= median_var * 0.5]

    if not kept:
        # Fallback: skip first 20% of audio (usually Ellie's intro)
        return y[int(0.2 * len(y)):]

    return np.concatenate(kept)


def process(audio_path: str, pid: int) -> str:
    out_path = os.path.join(OUT_DIR, f'{pid}_clean.wav')
    if os.path.exists(out_path):
        return out_path

    y, sr = librosa.load(audio_path, sr=SR, mono=True)

    # 1. Noise reduction — use first 0.5s as noise profile (room tone)
    noise_clip = y[:SR // 2]
    y_denoised = nr.reduce_noise(
        y=y, sr=sr, y_noise=noise_clip,
        prop_decrease=0.8,
        stationary=False,
        n_fft=1024,
    )

    # 2. Remove interviewer turns
    y_clean = remove_interviewer_turns(y_denoised, sr)

    # 3. Normalize
    peak = np.abs(y_clean).max()
    if peak > 0:
        y_clean = y_clean / peak * 0.95

    sf.write(out_path, y_clean, sr)
    return out_path


# ── Run ───────────────────────────────────────────────────────────────────────
labels = pd.read_csv(LABELS_CSV)
t0     = time.time()
ok, skipped = 0, 0

for _, row in tqdm(labels.iterrows(), total=len(labels), desc='Denoising+diarizing'):
    pid  = int(row['Participant_ID'])
    path = os.path.join(AUDIO_DIR, f'{pid}_INTERVIEW.wav')
    if not os.path.exists(path):
        skipped += 1
        continue
    process(path, pid)
    ok += 1

elapsed = time.time() - t0
print(f'\nDone: {ok} files in {elapsed/60:.1f} min  |  skipped: {skipped}')
print(f'Clean audio saved to: {OUT_DIR}')
