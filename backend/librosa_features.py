"""
Clinical acoustic feature extraction using librosa.
Matches features extracted during training (extract_librosa_features.py).
"""
import warnings
warnings.filterwarnings("ignore")
import numpy as np
import librosa

SR = 16000

def extract_librosa_features(audio_path: str, max_secs: int = 300) -> np.ndarray:
    """
    Extract 100-dim clinical acoustic feature vector from an audio file.
    Matches training feature set exactly.
    """
    try:
        y, sr = librosa.load(audio_path, sr=SR, mono=True, duration=max_secs)
    except Exception:
        return np.zeros(100, dtype=np.float32)

    if len(y) < SR * 2:
        y = np.pad(y, (0, SR * 2 - len(y)))

    feats = []

    # 1. MFCCs (13 × mean + std + delta mean + delta std = 52)
    mfcc  = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    dmfcc = librosa.feature.delta(mfcc)
    for m in [mfcc, dmfcc]:
        feats += list(m.mean(axis=1)) + list(m.std(axis=1))

    # 2. Pitch (F0) statistics (6)
    try:
        f0, voiced_flag, _ = librosa.pyin(y, fmin=50, fmax=500, sr=sr)
        f0_voiced = f0[voiced_flag & ~np.isnan(f0)] if f0 is not None else np.array([])
    except Exception:
        f0_voiced, voiced_flag = np.array([]), np.array([False])

    if len(f0_voiced) > 10:
        feats += [float(f0_voiced.mean()), float(f0_voiced.std()),
                  float(np.percentile(f0_voiced, 10)), float(np.percentile(f0_voiced, 90)),
                  float(f0_voiced.max() - f0_voiced.min()),
                  float(np.mean(voiced_flag))]
    else:
        feats += [0.0] * 6

    # 3. Spectral features (4 × mean+std = 8)
    cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    bw   = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    roll = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    flat = librosa.feature.spectral_flatness(y=y)[0]
    for f in [cent, bw, roll, flat]:
        feats += [float(f.mean()), float(f.std())]

    # 4. Energy / RMS (4)
    rms = librosa.feature.rms(y=y)[0]
    feats += [float(rms.mean()), float(rms.std()), float(rms.max()), float(rms.min())]

    # 5. ZCR (2)
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    feats += [float(zcr.mean()), float(zcr.std())]

    # 6. Chroma (12 × mean+std = 24)
    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    feats += list(chroma.mean(axis=1)) + list(chroma.std(axis=1))

    # 7. Tempo + beat regularity (2)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
    feats += [float(tempo), float(np.std(np.diff(beats))) if len(beats) > 1 else 0.0]

    # 8. Mel spectrogram summary (4)
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=64)
    mel_db = librosa.power_to_db(mel)
    feats += [float(mel_db.mean()), float(mel_db.std()), float(mel_db.max()), float(mel_db.min())]

    arr = np.array(feats, dtype=np.float32)
    # Replace NaN/Inf
    arr = np.where(np.isnan(arr) | np.isinf(arr), 0.0, arr)
    return arr
