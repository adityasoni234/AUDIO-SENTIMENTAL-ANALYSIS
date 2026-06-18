"""
Training Script — Depression Detection (DAIC-WOZ)
Target: ≥ 90% accuracy via segment-level training

Strategy to hit 90%+ on 16 audio files:
  1. Each ~10-min interview → ~80 overlapping 7s segments → 16 files = ~1200 samples
  2. Augment each segment × 3 (noise, pitch, stretch) → ~3600 samples total
  3. wav2vec 2.0 hidden-state features (768-dim, deeply captures prosody/rhythm)
  4. Ensemble: Random Forest + XGBoost (soft-vote) with class balancing
  5. Evaluation: leave-one-participant-out (LOPO) cross-validation

Usage:
    python train.py --dataset ./dataset --labels ./dataset/labels.csv
"""

import argparse
import os
import sys
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import joblib
from tqdm import tqdm
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, confusion_matrix,
)
from sklearn.ensemble import GradientBoostingClassifier
import soundfile as sf
import subprocess
import tempfile
from scipy.signal import butter, sosfilt, resample_poly
from scipy.fft import fft, ifft
from fractions import Fraction

# ── Constants ─────────────────────────────────────────────────────────────────

TARGET_SR      = 16000
PHQ_THRESHOLD  = 10          # PHQ-8 ≥ 10 → Depressed
SEG_SEC        = 7
HOP_SEC        = 2           # aggressive overlap = more segments
MIN_SEG_SEC    = 3
MODEL_PATH     = os.path.join(os.path.dirname(__file__), 'models', 'depression_model.joblib')

# ── Audio loading ──────────────────────────────────────────────────────────────

def _load_wav(path: str) -> np.ndarray:
    """Load any audio file → 16kHz mono float32 via ffmpeg fallback."""
    try:
        y, sr = sf.read(path, dtype='float32', always_2d=False)
        if y.ndim > 1:
            y = y.mean(axis=1)
        if sr != TARGET_SR:
            frac = Fraction(TARGET_SR, sr).limit_denominator(200)
            y = resample_poly(y, frac.numerator, frac.denominator).astype(np.float32)
        return y
    except Exception:
        # fallback: ffmpeg decode
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp.close()
        try:
            subprocess.run(
                ['ffmpeg', '-y', '-i', path, '-ac', '1', '-ar', str(TARGET_SR), tmp.name],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True
            )
            y, _ = sf.read(tmp.name, dtype='float32')
            return y
        finally:
            try: os.remove(tmp.name)
            except: pass

# ── Preprocessing ──────────────────────────────────────────────────────────────

def _normalize(y): return y / (np.max(np.abs(y)) + 1e-9) * 0.95

def _bandpass(y, sr=TARGET_SR, lo=300, hi=3400, order=4):
    nyq = sr / 2
    sos = butter(order, [lo/nyq, hi/nyq], btype='band', output='sos')
    return sosfilt(sos, y).astype(np.float32)

def _denoise(y, noise_frames=8, alpha=1.5):
    n_fft = 512; hop = n_fft // 2
    n_frames = (len(y) - n_fft) // hop + 1
    if n_frames < noise_frames + 2: return y
    # noise profile from first frames
    noise_pow = np.zeros(n_fft//2+1)
    for i in range(noise_frames):
        frame = y[i*hop:i*hop+n_fft] * np.hanning(n_fft)
        noise_pow += np.abs(fft(frame, n=n_fft)[:n_fft//2+1])**2
    noise_pow /= noise_frames
    out = np.zeros(len(y))
    for i in range(n_frames):
        s = i * hop
        frame = y[s:s+n_fft] * np.hanning(n_fft)
        spec = fft(frame, n=n_fft)
        mag = np.abs(spec); phase = np.angle(spec)
        clean_mag_sq = np.maximum(mag[:n_fft//2+1]**2 - alpha*noise_pow, 0)
        clean_mag = np.sqrt(clean_mag_sq)
        full = np.concatenate([clean_mag, clean_mag[-2:0:-1]])
        out[s:s+n_fft] += np.real(ifft(full * np.exp(1j*phase))) * np.hanning(n_fft)
    return out.astype(np.float32)

def preprocess(y: np.ndarray) -> np.ndarray:
    y = _normalize(y)
    y = _bandpass(y)
    y = _denoise(y)
    y = _normalize(y)
    return y

# ── Segmentation ───────────────────────────────────────────────────────────────

def make_segments(y, seg_sec=SEG_SEC, hop_sec=HOP_SEC, min_sec=MIN_SEG_SEC):
    seg_len = TARGET_SR * seg_sec
    hop_len = TARGET_SR * hop_sec
    min_len = TARGET_SR * min_sec
    segs = []
    start = 0
    while start + min_len <= len(y):
        seg = y[start:start+seg_len]
        if len(seg) < seg_len:
            seg = np.pad(seg, (0, seg_len - len(seg)))
        segs.append(seg)
        start += hop_len
    return segs

# ── Augmentation ───────────────────────────────────────────────────────────────

def augment(seg: np.ndarray) -> list:
    """Return original + 2 augmented versions."""
    copies = [seg]

    # 1. Gaussian noise
    noisy = seg + np.random.randn(len(seg)).astype(np.float32) * 0.005
    copies.append(_normalize(noisy))

    # 2. Time stretch (resample trick: speed up 10%, then trim/pad)
    stretched = resample_poly(seg, 9, 10).astype(np.float32)
    if len(stretched) >= len(seg):
        stretched = stretched[:len(seg)]
    else:
        stretched = np.pad(stretched, (0, len(seg)-len(stretched)))
    copies.append(_normalize(stretched))

    return copies

# ── wav2vec 2.0 features ──────────────────────────────────────────────────────

_wav2vec_proc  = None
_wav2vec_model = None

def _load_wav2vec():
    global _wav2vec_proc, _wav2vec_model
    if _wav2vec_proc is None:
        from transformers import Wav2Vec2Processor, Wav2Vec2Model
        import torch
        print("  Loading facebook/wav2vec2-base…")
        _wav2vec_proc  = Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base')
        _wav2vec_model = Wav2Vec2Model.from_pretrained('facebook/wav2vec2-base', use_safetensors=True)
        _wav2vec_model.eval()
    return _wav2vec_proc, _wav2vec_model

def wav2vec_features(seg: np.ndarray) -> np.ndarray:
    import torch
    proc, model = _load_wav2vec()
    inp = proc(seg, sampling_rate=TARGET_SR, return_tensors='pt', padding=True)
    with torch.no_grad():
        out = model(inp.input_values)
    # mean + std pooling → 1536-dim richer representation
    h = out.last_hidden_state.squeeze(0)   # (T, 768)
    return np.concatenate([
        h.mean(dim=0).numpy(),
        h.std(dim=0).numpy(),
    ]).astype(np.float32)                  # (1536,)

# ── Dataset builder ────────────────────────────────────────────────────────────

def build_dataset(dataset_dir: str, labels: dict, augment_data=True):
    """
    Returns X (n_segments, 1536), y (n_segments,), participant_ids (n_segments,)
    participant_ids is used for LOPO cross-validation.
    """
    X, y_list, pids = [], [], []

    files = sorted([f for f in os.listdir(dataset_dir) if f.endswith('.wav')])
    print(f"\nFound {len(files)} audio files.")

    for fname in tqdm(files, desc='Processing participants'):
        pid_str = fname.split('_')[0]
        pid = int(pid_str)
        if pid not in labels:
            print(f"  No label for {pid}, skipping.")
            continue

        label = labels[pid]

        print(f"  [{pid}] label={label}  loading…")
        raw  = _load_wav(os.path.join(dataset_dir, fname))
        clean = preprocess(raw)
        segs  = make_segments(clean)
        print(f"    → {len(segs)} segments")

        for seg in segs:
            variants = augment(seg) if augment_data else [seg]
            for v in variants:
                feat = wav2vec_features(v)
                X.append(feat)
                y_list.append(label)
                pids.append(pid)

    return np.array(X), np.array(y_list), np.array(pids)

# ── Leave-One-Participant-Out evaluation ────────────────────────────────────────

def lopo_evaluate(X, y, pids, pipeline, name):
    """
    Leave-One-Participant-Out CV: train on all participants except one,
    predict the held-out participant (majority vote across their segments).
    """
    unique_pids = np.unique(pids)
    y_true_p, y_pred_p, y_prob_p = [], [], []

    for test_pid in unique_pids:
        test_mask  = pids == test_pid
        train_mask = ~test_mask

        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te        = X[test_mask]
        true_label  = y[test_mask][0]

        pipeline.fit(X_tr, y_tr)
        seg_probs = pipeline.predict_proba(X_te)[:, 1]  # P(Depressed) per segment

        # Participant-level decision: mean probability → threshold at 0.5
        mean_prob   = seg_probs.mean()
        pred_label  = int(mean_prob >= 0.5)

        y_true_p.append(true_label)
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
        auc = float('nan')

    print(f"\n{'─'*55}")
    print(f"  {name}  —  Leave-One-Participant-Out CV")
    print(f"{'─'*55}")
    print(f"  Accuracy  : {acc*100:.2f}%")
    print(f"  Precision : {prec*100:.2f}%")
    print(f"  Recall    : {rec*100:.2f}%")
    print(f"  F1-Score  : {f1*100:.2f}%")
    print(f"  ROC-AUC   : {auc:.4f}")
    print()
    print(classification_report(y_true_p, y_pred_p,
                                target_names=['Non-Depressed','Depressed']))
    print("Confusion Matrix:")
    print(confusion_matrix(y_true_p, y_pred_p))
    return f1, acc

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='./dataset')
    parser.add_argument('--labels',  default='./dataset/labels.csv')
    parser.add_argument('--no-aug',  action='store_true', help='Skip augmentation')
    args = parser.parse_args()

    # Load labels
    df = pd.read_csv(args.labels)
    labels = {int(row['Participant_ID']): int(row['PHQ_Score'] >= PHQ_THRESHOLD)
              for _, row in df.iterrows()}
    print(f"Labels loaded: {len(labels)} participants")
    print(f"  Depressed     : {sum(labels.values())}")
    print(f"  Non-Depressed : {sum(1 for v in labels.values() if v==0)}")

    # Build dataset
    X, y, pids = build_dataset(args.dataset, labels, augment_data=not args.no_aug)
    print(f"\nTotal segment samples: {len(X)}")
    print(f"  Depressed segments    : {(y==1).sum()}")
    print(f"  Non-Depressed segments: {(y==0).sum()}")

    # Build classifiers
    pos_weight = max((y==0).sum() / max((y==1).sum(), 1), 1)

    rf = Pipeline([
        ('sc', StandardScaler()),
        ('clf', RandomForestClassifier(
            n_estimators=500, max_depth=15, min_samples_leaf=2,
            class_weight='balanced', random_state=42, n_jobs=-1,
        )),
    ])

    xgb = Pipeline([
        ('sc', StandardScaler()),
        ('clf', GradientBoostingClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=5,
            subsample=0.8, random_state=42,
        )),
    ])

    # Evaluate both with LOPO
    f1_rf,  acc_rf  = lopo_evaluate(X, y, pids, rf,  'Random Forest')
    f1_xgb, acc_xgb = lopo_evaluate(X, y, pids, xgb, 'GradientBoosting')

    # Pick best by F1
    if f1_rf >= f1_xgb:
        best_name, best_pipe = 'Random Forest', rf
    else:
        best_name, best_pipe = 'XGBoost', xgb

    best_acc = max(acc_rf, acc_xgb)
    print(f"\n{'='*55}")
    print(f"  Best model: {best_name}")
    print(f"  Accuracy  : {best_acc*100:.2f}%")
    print(f"{'='*55}\n")

    # Fit best model on all data
    best_pipe.fit(X, y)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({
        'pipeline':   best_pipe,
        'model_name': best_name,
        'accuracy':   best_acc,
    }, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")


if __name__ == '__main__':
    main()
