"""
Training Script — Depression Detection (DAIC-WOZ)

Pipeline (matches project specification):
  1. Data Collection      — Extended DAIC-WOZ, PHQ-8 labels
  2. Preprocessing        — resample 16kHz, normalize, VAD, bandpass, spectral subtraction
  3. Segmentation         — 7s overlapping segments (5–10 s range)
  4. Annotation/Labeling  — PHQ-8 ≥ 10 → Depressed (1), else Non-Depressed (0)
  5. wav2vec 2.0 features — prosodic/rhythm/energy/emotion patterns (1536-dim)
  6. Model Training       — Random Forest + XGBoost (ensemble, best by LOPO-F1)
  7. Depression Prediction— Depressed | Non-Depressed
  8. Model Evaluation     — Accuracy, Precision, Recall, F1-score, ROC-AUC

Features are cached to disk — safe to interrupt and resume.

Usage:
    python3 train.py
    python3 train.py --dataset /path/to/audio --labels /path/to/labels.csv
"""

import argparse
import os
import sys
import warnings
warnings.filterwarnings("ignore")

# Prevent OpenMP / PyTorch thread conflicts on Apple Silicon
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")

import numpy as np
import pandas as pd
import joblib
from tqdm import tqdm
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, confusion_matrix,
)
from xgboost import XGBClassifier
import soundfile as sf
import subprocess
import tempfile
from scipy.signal import butter, sosfilt, resample_poly
from scipy.fft import fft, ifft, rfft, irfft
from fractions import Fraction

# ── Constants ─────────────────────────────────────────────────────────────────

TARGET_SR     = 16000
PHQ_THRESHOLD = 10
SEG_SEC       = 7
HOP_SEC       = 2
MIN_SEG_SEC   = 3
MODEL_PATH    = os.path.join(os.path.dirname(__file__), "models", "depression_model.joblib")
CACHE_PATH    = os.path.join(os.path.dirname(__file__), "models", "features_cache.npz")

DEFAULT_DATASET = "/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset/audio"
DEFAULT_LABELS  = "/Users/ieeesbmac1/Desktop/DAIC-WOZ-Dataset/labels.csv"

# ── Step 1: Audio loading ──────────────────────────────────────────────────────

def _load_wav(path: str) -> np.ndarray:
    """Load any audio → 16kHz mono float32. Falls back to ffmpeg."""
    try:
        y, sr = sf.read(path, dtype="float32", always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != TARGET_SR:
            frac = Fraction(TARGET_SR, sr).limit_denominator(200)
            y = resample_poly(y, frac.numerator, frac.denominator).astype(np.float32)
        return y
    except Exception:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp.close()
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", path, "-ac", "1", "-ar", str(TARGET_SR), tmp.name],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True,
            )
            y, _ = sf.read(tmp.name, dtype="float32")
            return y
        finally:
            try: os.remove(tmp.name)
            except: pass


# ── Step 2: Noise-Robust Preprocessing ────────────────────────────────────────

def _normalize(y: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(y))
    return y / (peak + 1e-9) * 0.95 if peak > 1e-9 else y


def _vad_mask(y: np.ndarray, frame_ms=20, threshold_db=-40.0) -> np.ndarray:
    """Energy-based Voice Activity Detection — returns boolean sample mask."""
    frame_len = int(TARGET_SR * frame_ms / 1000)
    hop_len   = frame_len // 2
    n_frames  = 1 + (len(y) - frame_len) // hop_len
    mask = np.zeros(len(y), dtype=bool)
    for i in range(n_frames):
        s = i * hop_len
        rms_db = 20 * np.log10(np.sqrt(np.mean(y[s:s+frame_len]**2)) + 1e-9)
        if rms_db >= threshold_db:
            mask[s:s+frame_len] = True
    return mask


def _trim_silence(y: np.ndarray, min_silence_ms=300) -> np.ndarray:
    """Clinically-aware silence trim — preserves short pauses (<300 ms)."""
    mask      = _vad_mask(y)
    min_samp  = int(TARGET_SR * min_silence_ms / 1000)
    in_sil, sil_start = False, 0
    for i in range(len(mask)):
        if not mask[i] and not in_sil:
            in_sil, sil_start = True, i
        elif mask[i] and in_sil:
            in_sil = False
            if i - sil_start < min_samp:
                mask[sil_start:i] = True
    voiced = y[mask]
    return voiced if len(voiced) > TARGET_SR * 0.1 else y


def _bandpass(y: np.ndarray, lo=300, hi=3400, order=4) -> np.ndarray:
    """Band-pass filter 300–3400 Hz (telephony band)."""
    nyq = TARGET_SR / 2
    sos = butter(order, [lo / nyq, hi / nyq], btype="band", output="sos")
    return sosfilt(sos, y).astype(np.float32)


def _noise_suppress(y: np.ndarray, noise_frames=10, alpha=2.0) -> np.ndarray:
    """Vectorized spectral subtraction — processes all frames at once via matrix FFT."""
    from scipy.fft import rfft, irfft
    n_fft = 512; hop = n_fft // 2
    win   = np.hanning(n_fft).astype(np.float32)
    n_frames = (len(y) - n_fft) // hop + 1
    if n_frames < noise_frames + 1:
        return y

    # Stack all frames into a matrix (n_frames, n_fft)
    idx    = np.arange(n_fft) + np.arange(n_frames)[:, None] * hop
    frames = y[idx] * win  # (n_frames, n_fft)

    # Batch FFT
    specs  = rfft(frames, n=n_fft, axis=1)       # (n_frames, n_fft//2+1)
    mag    = np.abs(specs)
    phase  = np.angle(specs)

    # Noise estimate from first frames
    noise_pow = (mag[:noise_frames] ** 2).mean(axis=0)

    # Spectral subtraction
    clean_sq  = np.maximum(mag**2 - alpha * noise_pow, 0)
    clean_mag = np.sqrt(clean_sq)
    clean_specs = clean_mag * np.exp(1j * phase)

    # Batch IFFT + overlap-add
    clean_frames = irfft(clean_specs, n=n_fft, axis=1) * win  # (n_frames, n_fft)
    output = np.zeros(len(y), dtype=np.float32)
    for i in range(n_frames):
        s = i * hop
        output[s:s + n_fft] += clean_frames[i]
    return output.astype(np.float32)


def preprocess(y: np.ndarray) -> np.ndarray:
    """Full 6-step noise-robust preprocessing pipeline."""
    y = _normalize(y)        # Step 1: Amplitude normalization
    y = _trim_silence(y)     # Step 2: VAD + clinically-aware silence trim
    y = _bandpass(y)         # Step 3: Band-pass 300–3400 Hz
    y = _noise_suppress(y)   # Step 4: Adaptive noise suppression
    y = _normalize(y)        # Step 5: Re-normalize after suppression
    return y


# ── Step 3: Speech Segmentation ───────────────────────────────────────────────

def make_segments(y: np.ndarray) -> list:
    """Split audio into overlapping 7s segments (5–10 s range)."""
    seg_len = TARGET_SR * SEG_SEC
    hop_len = TARGET_SR * HOP_SEC
    min_len = TARGET_SR * MIN_SEG_SEC
    segs, start = [], 0
    while start + min_len <= len(y):
        seg = y[start:start+seg_len]
        if len(seg) < seg_len:
            seg = np.pad(seg, (0, seg_len - len(seg)))
        segs.append(seg)
        start += hop_len
    return segs or [np.pad(y[:seg_len], (0, max(0, seg_len-len(y))))]


# ── Augmentation ───────────────────────────────────────────────────────────────

def augment(seg: np.ndarray) -> list:
    """Return original + Gaussian noise + time-stretch variants."""
    copies = [seg]
    noisy = seg + np.random.randn(len(seg)).astype(np.float32) * 0.005
    copies.append(_normalize(noisy))
    stretched = resample_poly(seg, 9, 10).astype(np.float32)
    stretched = stretched[:len(seg)] if len(stretched) >= len(seg) \
                else np.pad(stretched, (0, len(seg)-len(stretched)))
    copies.append(_normalize(stretched))
    return copies


# ── Step 5: wav2vec 2.0 Feature Learning ──────────────────────────────────────

_wav2vec_proc  = None
_wav2vec_model = None


def _load_wav2vec():
    global _wav2vec_proc, _wav2vec_model
    if _wav2vec_proc is None:
        from transformers import Wav2Vec2Processor, Wav2Vec2Model
        print("  Loading facebook/wav2vec2-base…")
        _wav2vec_proc  = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base")
        _wav2vec_model = Wav2Vec2Model.from_pretrained("facebook/wav2vec2-base", use_safetensors=True)
        _wav2vec_model.eval()
    return _wav2vec_proc, _wav2vec_model


def wav2vec_features(seg: np.ndarray) -> np.ndarray:
    """
    Extract wav2vec 2.0 hidden states capturing:
    - Prosodic flattening
    - Speech rhythm irregularities
    - Vocal energy variations
    - Emotional and cognitive speech patterns

    Returns 1536-dim vector (mean + std pooling over time axis).
    """
    import torch
    proc, model = _load_wav2vec()
    inp = proc(seg, sampling_rate=TARGET_SR, return_tensors="pt", padding=True)
    with torch.no_grad():
        out = model(inp.input_values)
    h = out.last_hidden_state.squeeze(0)   # (T, 768)
    return np.concatenate([
        h.mean(dim=0).numpy(),
        h.std(dim=0).numpy(),
    ]).astype(np.float32)                  # (1536,)


# ── Feature extraction with disk cache ────────────────────────────────────────

def build_dataset(dataset_dir: str, labels: dict, augment_data=True):
    """
    Extract wav2vec 2.0 features for all participants.
    Features are cached to models/features_cache.npz — safe to interrupt and resume.
    Returns X (n_samples, 1536), y (n_samples,), pids (n_samples,)
    """
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)

    # Pre-load wav2vec2 before any iteration (avoids crash inside tqdm loop)
    _load_wav2vec()

    # Load existing cache if available
    cache = {}
    if os.path.exists(CACHE_PATH):
        data  = np.load(CACHE_PATH, allow_pickle=True)
        X_c   = data["X"]
        y_c   = data["y"]
        p_c   = data["pids"]
        for pid in np.unique(p_c):
            mask = p_c == pid
            cache[int(pid)] = (X_c[mask], y_c[mask])
        print(f"  Loaded cache: {len(cache)} participants already processed")

    wav_files = sorted([f for f in os.listdir(dataset_dir) if f.lower().endswith(".wav")])
    print(f"\nFound {len(wav_files)} audio files. Extracting features…")

    changed = False
    for fname in tqdm(wav_files, desc="wav2vec2 features"):
        try:
            pid = int(fname.split("_")[0])
        except ValueError:
            continue
        if pid not in labels:
            continue
        if pid in cache:
            continue   # already cached

        label = labels[pid]
        try:
            raw   = _load_wav(os.path.join(dataset_dir, fname))
            clean = preprocess(raw)
            segs  = make_segments(clean)
        except Exception as e:
            tqdm.write(f"  [SKIP] {pid} load/preprocess error: {e}")
            continue

        X_pid, y_pid = [], []
        for seg in segs:
            variants = augment(seg) if augment_data else [seg]
            for v in variants:
                try:
                    feat = wav2vec_features(v)
                    X_pid.append(feat)
                    y_pid.append(label)
                except Exception as e:
                    tqdm.write(f"  [WARN] {pid} feature error: {e}")

        if X_pid:
            cache[pid] = (np.array(X_pid, dtype=np.float32), np.array(y_pid))
            changed = True

        # Save cache after every participant
        if changed:
            _save_cache(cache)
            changed = False

    return _flatten_cache(cache)


def _save_cache(cache: dict):
    X_all, y_all, p_all = _flatten_cache(cache)
    np.savez_compressed(CACHE_PATH, X=X_all, y=y_all, pids=p_all)


def _flatten_cache(cache: dict):
    X_all, y_all, p_all = [], [], []
    for pid, (X_p, y_p) in cache.items():
        X_all.append(X_p)
        y_all.extend(y_p)
        p_all.extend([pid] * len(y_p))
    if not X_all:
        return np.array([]), np.array([]), np.array([])
    return (np.vstack(X_all).astype(np.float32),
            np.array(y_all),
            np.array(p_all))


# ── Step 8: Model Evaluation — Leave-One-Participant-Out CV ───────────────────

def lopo_evaluate(X, y, pids, pipeline, name):
    """
    LOPO CV: train on all participants except one, predict that participant
    via majority vote across their segments. Reports all 5 metrics.
    """
    unique_pids = np.unique(pids)
    y_true_p, y_pred_p, y_prob_p = [], [], []

    for test_pid in tqdm(unique_pids, desc=f"LOPO {name}"):
        test_mask  = pids == test_pid
        train_mask = ~test_mask
        if train_mask.sum() == 0:
            continue

        pipeline.fit(X[train_mask], y[train_mask])
        seg_probs  = pipeline.predict_proba(X[test_mask])[:, 1]
        mean_prob  = seg_probs.mean()
        pred_label = int(mean_prob >= 0.5)

        y_true_p.append(y[test_mask][0])
        y_pred_p.append(pred_label)
        y_prob_p.append(mean_prob)

    y_true_p = np.array(y_true_p)
    y_pred_p = np.array(y_pred_p)
    y_prob_p = np.array(y_prob_p)

    acc  = accuracy_score(y_true_p, y_pred_p)
    prec = precision_score(y_true_p, y_pred_p, zero_division=0)
    rec  = recall_score(y_true_p, y_pred_p, zero_division=0)
    f1   = f1_score(y_true_p, y_pred_p, zero_division=0)
    try:
        auc = roc_auc_score(y_true_p, y_prob_p)
    except Exception:
        auc = float("nan")

    print(f"\n{'─'*58}")
    print(f"  {name}  —  Leave-One-Participant-Out CV")
    print(f"{'─'*58}")
    print(f"  Accuracy  : {acc*100:.2f}%")
    print(f"  Precision : {prec*100:.2f}%")
    print(f"  Recall    : {rec*100:.2f}%")
    print(f"  F1-Score  : {f1*100:.2f}%")
    print(f"  ROC-AUC   : {auc:.4f}")
    print()
    print(classification_report(y_true_p, y_pred_p,
                                target_names=["Non-Depressed", "Depressed"]))
    print("Confusion Matrix:")
    print(confusion_matrix(y_true_p, y_pred_p))
    return f1, acc


# ── Step 6: Model Building ────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset",  default=DEFAULT_DATASET)
    parser.add_argument("--labels",   default=DEFAULT_LABELS)
    parser.add_argument("--no-aug",   action="store_true", help="Skip augmentation")
    parser.add_argument("--no-cache", action="store_true", help="Ignore existing feature cache")
    args = parser.parse_args()

    if not os.path.isdir(args.dataset):
        print(f"ERROR: Dataset not found: {args.dataset}")
        sys.exit(1)
    if not os.path.isfile(args.labels):
        print(f"ERROR: Labels not found: {args.labels}")
        sys.exit(1)

    # Step 4: Load annotations
    df     = pd.read_csv(args.labels)
    labels = {int(r["Participant_ID"]): int(r["PHQ_Score"] >= PHQ_THRESHOLD)
              for _, r in df.iterrows()}
    dep    = sum(labels.values())
    print(f"\n── Step 4: Data Annotation ──────────────────────────")
    print(f"  Total participants : {len(labels)}")
    print(f"  Depressed (PHQ≥10) : {dep}")
    print(f"  Non-Depressed      : {len(labels)-dep}")

    if args.no_cache and os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)
        print("  Feature cache cleared.")

    # Steps 2, 3, 5: Preprocess → Segment → Extract features
    print(f"\n── Steps 2–5: Preprocessing → Segmentation → wav2vec2 ──")
    X, y, pids = build_dataset(args.dataset, labels, augment_data=not args.no_aug)

    if len(X) == 0:
        print("ERROR: No features extracted.")
        sys.exit(1)

    print(f"\n  Total segments (with augmentation) : {len(X)}")
    print(f"  Depressed segments                 : {(y==1).sum()}")
    print(f"  Non-Depressed segments             : {(y==0).sum()}")
    print(f"  Feature dimensionality             : {X.shape[1]}")

    # Step 6: Build models — Random Forest and XGBoost
    print(f"\n── Step 6: Model Building ───────────────────────────")
    scale_pos = int((y==0).sum() / max((y==1).sum(), 1))

    rf = Pipeline([
        ("sc",  StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=500, max_depth=15, min_samples_leaf=2,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )),
    ])

    xgb = Pipeline([
        ("sc",  StandardScaler()),
        ("clf", XGBClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=5,
            subsample=0.8, colsample_bytree=0.8,
            scale_pos_weight=scale_pos,
            use_label_encoder=False, eval_metric="logloss",
            random_state=42, n_jobs=-1,
        )),
    ])

    # Step 8: Evaluate both with LOPO-CV
    print(f"\n── Step 8: Model Evaluation (LOPO Cross-Validation) ──")
    f1_rf,  acc_rf  = lopo_evaluate(X, y, pids, rf,  "Random Forest")
    f1_xgb, acc_xgb = lopo_evaluate(X, y, pids, xgb, "XGBoost")

    # Pick best by F1
    if f1_rf >= f1_xgb:
        best_name, best_pipe, best_acc, best_f1 = "Random Forest", rf, acc_rf, f1_rf
    else:
        best_name, best_pipe, best_acc, best_f1 = "XGBoost", xgb, acc_xgb, f1_xgb

    print(f"\n{'='*58}")
    print(f"  Best model : {best_name}")
    print(f"  Accuracy   : {best_acc*100:.2f}%")
    print(f"  F1-Score   : {best_f1*100:.2f}%")
    print(f"{'='*58}\n")

    # Step 7: Fit final model on all data
    print("Fitting final model on full dataset…")
    best_pipe.fit(X, y)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({
        "pipeline":   best_pipe,
        "model_name": best_name,
        "accuracy":   best_acc,
        "f1":         best_f1,
    }, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")
    print("\nTraining complete. Start the Flask server with: python3 app.py")


if __name__ == "__main__":
    main()
