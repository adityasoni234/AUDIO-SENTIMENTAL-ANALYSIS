"""
Training Script — Depression Detection (DAIC-WOZ)
Target: ≥ 90% accuracy

Speed optimisations vs v1:
  - No augmentation (wav2vec2 features are robust enough)
  - Features cached to disk (re-run is instant)
  - Batched wav2vec2 inference (faster on CPU)
  - Larger hop → fewer segments per file
  - GradientBoosting (pure sklearn, no libomp needed)

Usage:
    python train.py --dataset ./dataset --labels ./dataset/labels.csv
"""

import argparse, os, warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import joblib
from tqdm import tqdm
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, classification_report, confusion_matrix,
)
import soundfile as sf
import subprocess, tempfile
from scipy.signal import butter, sosfilt, resample_poly
from scipy.fft import fft, ifft
from fractions import Fraction

TARGET_SR     = 16000
PHQ_THRESHOLD = 10
SEG_SEC       = 7
HOP_SEC       = 4        # larger hop = fewer segments = faster
MIN_SEG_SEC   = 3
BATCH_SIZE    = 8        # wav2vec batching
MODEL_PATH    = os.path.join(os.path.dirname(__file__), 'models', 'depression_model.joblib')
CACHE_PATH    = os.path.join(os.path.dirname(__file__), 'models', 'features_cache.joblib')

# ── Audio helpers ──────────────────────────────────────────────────────────────

def _load_wav(path):
    try:
        y, sr = sf.read(path, dtype='float32', always_2d=False)
        if y.ndim > 1: y = y.mean(axis=1)
        if sr != TARGET_SR:
            frac = Fraction(TARGET_SR, sr).limit_denominator(200)
            y = resample_poly(y, frac.numerator, frac.denominator).astype(np.float32)
        return y
    except Exception:
        tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        tmp.close()
        try:
            subprocess.run(['ffmpeg','-y','-i',path,'-ac','1','-ar',str(TARGET_SR),tmp.name],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            y, _ = sf.read(tmp.name, dtype='float32')
            return y
        finally:
            try: os.remove(tmp.name)
            except: pass

def _normalize(y): return y / (np.max(np.abs(y)) + 1e-9) * 0.95

def _bandpass(y, lo=300, hi=3400, order=4):
    nyq = TARGET_SR / 2
    sos = butter(order, [lo/nyq, hi/nyq], btype='band', output='sos')
    return sosfilt(sos, y).astype(np.float32)

def _denoise(y, noise_frames=8, alpha=1.5):
    n_fft = 512; hop = n_fft // 2
    n_frames = (len(y) - n_fft) // hop + 1
    if n_frames < noise_frames + 2: return y
    noise_pow = np.zeros(n_fft//2+1)
    for i in range(noise_frames):
        frame = y[i*hop:i*hop+n_fft] * np.hanning(n_fft)
        noise_pow += np.abs(fft(frame, n=n_fft)[:n_fft//2+1])**2
    noise_pow /= noise_frames
    out = np.zeros(len(y))
    n_frames2 = (len(y) - n_fft) // hop + 1
    for i in range(n_frames2):
        s = i * hop
        frame = y[s:s+n_fft] * np.hanning(n_fft)
        spec = fft(frame, n=n_fft)
        mag = np.abs(spec); phase = np.angle(spec)
        clean_sq = np.maximum(mag[:n_fft//2+1]**2 - alpha*noise_pow, 0)
        clean_mag = np.sqrt(clean_sq)
        full = np.concatenate([clean_mag, clean_mag[-2:0:-1]])
        out[s:s+n_fft] += np.real(ifft(full * np.exp(1j*phase))) * np.hanning(n_fft)
    return out.astype(np.float32)

def preprocess(y):
    y = _normalize(y)
    y = _bandpass(y)
    y = _denoise(y)
    return _normalize(y)

def make_segments(y):
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
    return segs or [np.pad(y, (0, max(0, seg_len-len(y))))]

# ── wav2vec 2.0 (batched) ──────────────────────────────────────────────────────

_proc = _mdl = None

def _load_wav2vec():
    global _proc, _mdl
    if _proc is None:
        from transformers import Wav2Vec2Processor, Wav2Vec2Model
        import torch
        print("  Loading facebook/wav2vec2-base (first time downloads ~360 MB)…")
        _proc = Wav2Vec2Processor.from_pretrained('facebook/wav2vec2-base')
        _mdl  = Wav2Vec2Model.from_pretrained('facebook/wav2vec2-base', use_safetensors=True)
        _mdl.eval()
    return _proc, _mdl

def _batch_features(segments):
    """Extract 1536-dim features for a list of segments in one batched pass."""
    import torch
    proc, mdl = _load_wav2vec()
    results = []
    for i in range(0, len(segments), BATCH_SIZE):
        batch = segments[i:i+BATCH_SIZE]
        inputs = proc(batch, sampling_rate=TARGET_SR,
                      return_tensors='pt', padding=True)
        with torch.no_grad():
            out = mdl(inputs.input_values)
        h = out.last_hidden_state   # (B, T, 768)
        # mean + std pooling → 1536-dim
        feat = torch.cat([h.mean(dim=1), h.std(dim=1)], dim=1)
        results.append(feat.numpy())
    return np.vstack(results)   # (N, 1536)

# ── Dataset builder with cache ─────────────────────────────────────────────────

def build_dataset(dataset_dir, labels):
    # Return cached features if available
    if os.path.exists(CACHE_PATH):
        print("  Loading cached features…")
        cached = joblib.load(CACHE_PATH)
        return cached['X'], cached['y'], cached['pids']

    files = sorted([f for f in os.listdir(dataset_dir) if f.endswith('.wav')])
    X_all, y_all, pid_all = [], [], []

    print(f"\nProcessing {len(files)} participants…")
    for fname in tqdm(files, desc='Participants'):
        pid = int(fname.split('_')[0])
        if pid not in labels:
            continue
        label = labels[pid]
        raw   = _load_wav(os.path.join(dataset_dir, fname))
        clean = preprocess(raw)
        segs  = make_segments(clean)
        print(f"  [{pid}] label={label}  {len(segs)} segments")

        feats = _batch_features(segs)   # (n_segs, 1536)
        X_all.append(feats)
        y_all.extend([label] * len(segs))
        pid_all.extend([pid] * len(segs))

    X = np.vstack(X_all)
    y = np.array(y_all)
    pids = np.array(pid_all)

    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    joblib.dump({'X': X, 'y': y, 'pids': pids}, CACHE_PATH)
    print(f"  Features cached → {CACHE_PATH}")
    return X, y, pids

# ── Leave-One-Participant-Out evaluation ──────────────────────────────────────

def lopo_evaluate(X, y, pids, pipeline, name):
    unique = np.unique(pids)
    y_true, y_pred, y_prob = [], [], []

    for pid in unique:
        test  = pids == pid
        train = ~test
        pipeline.fit(X[train], y[train])
        proba      = pipeline.predict_proba(X[test])[:, 1].mean()
        pred_label = int(proba >= 0.5)
        y_true.append(y[test][0])
        y_pred.append(pred_label)
        y_prob.append(proba)

    y_true, y_pred, y_prob = np.array(y_true), np.array(y_pred), np.array(y_prob)

    acc  = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec  = recall_score(y_true, y_pred, zero_division=0)
    f1   = f1_score(y_true, y_pred, zero_division=0)
    try:    auc = roc_auc_score(y_true, y_prob)
    except: auc = float('nan')

    print(f"\n{'─'*55}")
    print(f"  {name}  —  Leave-One-Participant-Out CV")
    print(f"{'─'*55}")
    print(f"  Accuracy  : {acc*100:.2f}%")
    print(f"  Precision : {prec*100:.2f}%")
    print(f"  Recall    : {rec*100:.2f}%")
    print(f"  F1-Score  : {f1*100:.2f}%")
    print(f"  ROC-AUC   : {auc:.4f}")
    print()
    print(classification_report(y_true, y_pred, target_names=['Non-Depressed','Depressed']))
    print("Confusion Matrix (rows=actual, cols=predicted):")
    print(confusion_matrix(y_true, y_pred))
    return f1, acc

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='./dataset')
    parser.add_argument('--labels',  default='./dataset/labels.csv')
    parser.add_argument('--no-cache', action='store_true', help='Ignore cached features')
    args = parser.parse_args()

    if args.no_cache and os.path.exists(CACHE_PATH):
        os.remove(CACHE_PATH)
        print("Cache cleared.")

    df = pd.read_csv(args.labels)
    labels = {int(r['Participant_ID']): int(r['PHQ_Score'] >= PHQ_THRESHOLD)
              for _, r in df.iterrows()}

    dep = sum(labels.values())
    print(f"Labels: {len(labels)} participants | Depressed: {dep} | Non-Depressed: {len(labels)-dep}")

    X, y, pids = build_dataset(args.dataset, labels)
    print(f"\nDataset: {len(X)} segments | Depressed: {(y==1).sum()} | Non-Depressed: {(y==0).sum()}")

    pos_weight = (y==0).sum() / max((y==1).sum(), 1)

    rf = Pipeline([
        ('sc',  StandardScaler()),
        ('clf', RandomForestClassifier(
            n_estimators=500, max_depth=20, min_samples_leaf=1,
            class_weight='balanced', random_state=42, n_jobs=-1,
        )),
    ])

    gb = Pipeline([
        ('sc',  StandardScaler()),
        ('clf', GradientBoostingClassifier(
            n_estimators=300, learning_rate=0.05, max_depth=5,
            subsample=0.8, random_state=42,
        )),
    ])

    f1_rf, acc_rf = lopo_evaluate(X, y, pids, rf, 'Random Forest')
    f1_gb, acc_gb = lopo_evaluate(X, y, pids, gb, 'Gradient Boosting')

    if f1_rf >= f1_gb:
        best_name, best_pipe, best_acc = 'Random Forest', rf, acc_rf
    else:
        best_name, best_pipe, best_acc = 'Gradient Boosting', gb, acc_gb

    print(f"\n{'='*55}")
    print(f"  Best model : {best_name}")
    print(f"  Accuracy   : {best_acc*100:.2f}%")
    print(f"{'='*55}\n")

    best_pipe.fit(X, y)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({'pipeline': best_pipe, 'model_name': best_name, 'accuracy': best_acc}, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")


if __name__ == '__main__':
    main()
