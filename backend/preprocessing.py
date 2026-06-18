"""
Step 1 — Noise-Robust Preprocessing Pipeline

Applies in order:
  1. Resample to 16 kHz
  2. Amplitude normalization
  3. Voice Activity Detection (VAD) — energy-based
  4. Clinically-aware silence trimming
  5. Band-pass filtering (300–3400 Hz telephony band)
  6. Adaptive noise suppression (spectral subtraction)
"""

import numpy as np
import soundfile as sf
import subprocess
import tempfile
import os
from fractions import Fraction
from scipy.signal import butter, sosfilt
from scipy.fft import fft, ifft

TARGET_SR = 16000   # wav2vec 2.0 expects 16 kHz


# ── Audio loading ──────────────────────────────────────────────────────────────

def _convert_to_wav(path: str) -> tuple[str, bool]:
    """Use ffmpeg to convert any format to a temp WAV at TARGET_SR. Returns (path, is_temp)."""
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.wav', '.flac'):
        return path, False
    try:
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp.close()
        subprocess.run(
            ['ffmpeg', '-y', '-i', path, '-ac', '1', '-ar', str(TARGET_SR), tmp.name],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
        )
        return tmp.name, True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return path, False


def load_audio(path: str) -> tuple[np.ndarray, int]:
    """Load audio file and return (mono float32 array, sample_rate)."""
    wav_path, is_temp = _convert_to_wav(path)
    try:
        y, sr = sf.read(wav_path, dtype='float32', always_2d=False)
    finally:
        if is_temp:
            try: os.remove(wav_path)
            except OSError: pass

    if y.ndim > 1:
        y = y.mean(axis=1)
    return y, sr


# ── Step 1: Resample to 16 kHz ────────────────────────────────────────────────

def resample(y: np.ndarray, orig_sr: int, target_sr: int = TARGET_SR) -> np.ndarray:
    if orig_sr == target_sr:
        return y
    from scipy.signal import resample_poly
    frac = Fraction(target_sr, orig_sr).limit_denominator(200)
    return resample_poly(y, frac.numerator, frac.denominator).astype(np.float32)


# ── Step 2: Amplitude normalization ───────────────────────────────────────────

def normalize(y: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(y))
    if peak < 1e-9:
        return y
    return y / peak * 0.95


# ── Step 3: Voice Activity Detection (energy-based) ───────────────────────────

def vad(y: np.ndarray, sr: int, frame_ms: int = 20,
        energy_threshold_db: float = -40.0) -> np.ndarray:
    """
    Return a boolean mask (per sample) of voiced regions.
    Uses short-time energy with a dB threshold.
    """
    frame_len = int(sr * frame_ms / 1000)
    hop_len   = frame_len // 2
    n_frames  = 1 + (len(y) - frame_len) // hop_len

    mask = np.zeros(len(y), dtype=bool)
    for i in range(n_frames):
        start = i * hop_len
        frame = y[start: start + frame_len]
        rms_db = 20 * np.log10(np.sqrt(np.mean(frame ** 2)) + 1e-9)
        if rms_db >= energy_threshold_db:
            mask[start: start + frame_len] = True

    return mask


# ── Step 4: Clinically-aware silence trimming ─────────────────────────────────

def trim_silence(y: np.ndarray, sr: int,
                 min_silence_ms: int = 300,
                 energy_db: float = -40.0) -> np.ndarray:
    """
    Remove leading/trailing silence and internal pauses longer than min_silence_ms.
    Clinical note: short pauses (< 300 ms) are preserved as they carry prosodic info.
    """
    mask       = vad(y, sr, energy_threshold_db=energy_db)
    min_frames = int(sr * min_silence_ms / 1000)

    # Smooth: fill gaps shorter than min_frames
    in_silence = False
    silence_start = 0
    for i in range(len(mask)):
        if not mask[i] and not in_silence:
            in_silence    = True
            silence_start = i
        elif mask[i] and in_silence:
            in_silence = False
            if i - silence_start < min_frames:
                mask[silence_start:i] = True

    voiced = y[mask]
    return voiced if len(voiced) > sr * 0.1 else y   # fallback if too short


# ── Step 5: Band-pass filter 300–3400 Hz ──────────────────────────────────────

def bandpass_filter(y: np.ndarray, sr: int,
                    low_hz: float = 300.0, high_hz: float = 3400.0,
                    order: int = 4) -> np.ndarray:
    """
    Telephony-band filter that preserves clinical speech features.
    Removes low-frequency noise (HVAC, rumble) and high-frequency hiss.
    """
    nyq = sr / 2.0
    sos = butter(order, [low_hz / nyq, high_hz / nyq], btype='band', output='sos')
    return sosfilt(sos, y).astype(np.float32)


# ── Step 6: Adaptive noise suppression (spectral subtraction) ─────────────────

def noise_suppress(y: np.ndarray, sr: int,
                   noise_frames: int = 10,
                   alpha: float = 2.0) -> np.ndarray:
    """
    Spectral subtraction using the first `noise_frames` frames as noise estimate.
    alpha: over-subtraction factor (higher = more aggressive suppression).
    """
    n_fft    = 512
    hop      = n_fft // 2
    n_frames = (len(y) - n_fft) // hop + 1

    if n_frames < noise_frames + 1:
        return y

    # Estimate noise power from the first few frames
    noise_power = np.zeros(n_fft // 2 + 1)
    for i in range(noise_frames):
        frame  = y[i * hop: i * hop + n_fft] * np.hanning(n_fft)
        spec   = fft(frame, n=n_fft)
        noise_power += np.abs(spec[:n_fft // 2 + 1]) ** 2
    noise_power /= noise_frames

    # Apply spectral subtraction frame by frame
    output = np.zeros(len(y))
    for i in range(n_frames):
        start = i * hop
        frame = y[start: start + n_fft] * np.hanning(n_fft)
        spec  = fft(frame, n=n_fft)
        mag   = np.abs(spec)
        phase = np.angle(spec)

        mag_sq     = mag ** 2
        mag_sq_pos = mag_sq[:n_fft // 2 + 1]
        clean_sq   = np.maximum(mag_sq_pos - alpha * noise_power, 0)
        clean_mag  = np.sqrt(clean_sq)

        # Mirror for real IFFT
        full_mag = np.concatenate([clean_mag, clean_mag[-2:0:-1]])
        full_spec = full_mag * np.exp(1j * phase)
        clean_frame = np.real(ifft(full_spec))[:n_fft]

        output[start: start + n_fft] += clean_frame * np.hanning(n_fft)

    return output.astype(np.float32)


# ── Full pipeline ──────────────────────────────────────────────────────────────

def preprocess(audio_path: str) -> np.ndarray:
    """
    Full noise-robust preprocessing pipeline.
    Returns a clean mono float32 array at 16 kHz.
    """
    y, sr = load_audio(audio_path)
    y = resample(y, sr)
    y = normalize(y)
    y = trim_silence(y, TARGET_SR)
    y = bandpass_filter(y, TARGET_SR)
    y = noise_suppress(y, TARGET_SR)
    y = normalize(y)          # renormalize after suppression
    return y
