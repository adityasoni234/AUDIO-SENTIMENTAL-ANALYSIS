"""
Inference — Depression Prediction

Full pipeline for a single audio file:
  preprocess → segment → wav2vec 2.0 features → classifier → result
"""

import os
import datetime
import numpy as np
import joblib
import soundfile as sf

from preprocessing import preprocess
from segmentation  import segment_audio
from features      import extract_features, extract_features_participant
from librosa_features import extract_librosa_features

MODELS = {
    'xgboost': os.path.join(os.path.dirname(__file__), 'models', 'depression_model.joblib'),
    'rf':      os.path.join(os.path.dirname(__file__), 'models', 'rf_model.joblib'),
    'cnn':     os.path.join(os.path.dirname(__file__), 'models', 'cnn_model.joblib'),
}
PHQ8_THRESHOLD = 10

_bundles   = {}
_cnn_model = None   # PyTorch CNN kept in memory separately


def _load_cnn(bundle: dict):
    """Load PyTorch CNN from weights file, cache in memory."""
    global _cnn_model
    if _cnn_model is not None:
        return _cnn_model

    import torch
    import torch.nn as nn

    class CNN1D(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv = nn.Sequential(
                nn.Conv1d(1, 64, kernel_size=8, stride=2, padding=4),
                nn.BatchNorm1d(64), nn.GELU(), nn.MaxPool1d(2),
                nn.Conv1d(64, 128, kernel_size=5, stride=1, padding=2),
                nn.BatchNorm1d(128), nn.GELU(), nn.MaxPool1d(2),
                nn.Conv1d(128, 256, kernel_size=3, stride=1, padding=1),
                nn.BatchNorm1d(256), nn.GELU(),
                nn.Conv1d(256, 256, kernel_size=3, stride=1, padding=1),
                nn.BatchNorm1d(256), nn.GELU(),
                nn.AdaptiveAvgPool1d(1),
            )
            self.head = nn.Sequential(
                nn.Flatten(), nn.Linear(256, 128), nn.GELU(),
                nn.Dropout(0.4), nn.Linear(128, 2),
            )
        def forward(self, x):
            return self.head(self.conv(x.unsqueeze(1)))

    ckpt = torch.load(bundle['cnn_weights_path'], map_location='cpu')
    model = CNN1D()
    model.load_state_dict(ckpt['state_dict'])
    model.eval()
    _cnn_model = model
    return model


def _load_model(model_choice: str = 'xgboost'):
    key = model_choice if model_choice in MODELS else 'xgboost'
    if key not in _bundles:
        path = MODELS[key]
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model '{key}' not found at {path}.")
        _bundles[key] = joblib.load(path)
    return _bundles[key]


# ── Metadata helpers ───────────────────────────────────────────────────────────

def _get_duration(path: str) -> str:
    try:
        info = sf.info(path)
        secs = info.frames / info.samplerate
        return f"{int(secs//60)}:{int(secs%60):02d}"
    except Exception:
        return "0:00"


def _get_filesize(path: str) -> str:
    size = os.path.getsize(path)
    return f"{size/(1024*1024):.1f} MB" if size >= 1024*1024 else f"{size/1024:.1f} KB"


# ── Emotion profiles keyed by prediction ─────────────────────────────────────

def _compute_acoustic_emotions(audio: np.ndarray, sr: int = 16000) -> dict:
    """
    Compute emotion indicators from real acoustic features of the audio.
    No hardcoded profiles — each upload produces unique results.
    """
    if len(audio) == 0:
        return {'sadness': 50, 'joy': 50, 'anger': 50, 'fear': 50, 'trust': 50}

    # Energy (loudness) — maps to anger/joy intensity
    rms = float(np.sqrt(np.mean(audio ** 2)))
    energy_pct = int(np.clip(rms * 1200, 5, 95))

    # Pitch variability — high std = emotional, low = flat (depression marker)
    frame = 512; hop = 256
    zcr = float(np.mean([
        np.sum(np.abs(np.diff(np.sign(audio[i:i+frame])))) / (2 * frame)
        for i in range(0, len(audio) - frame, hop)
    ]))
    pitch_var = int(np.clip(zcr * 600, 5, 95))

    # Spectral centroid proxy — brightness of speech
    fft_mag = np.abs(np.fft.rfft(audio[:min(len(audio), sr * 5)]))
    freqs   = np.fft.rfftfreq(min(len(audio), sr * 5), 1 / sr)
    centroid = float(np.sum(freqs * fft_mag) / (np.sum(fft_mag) + 1e-9))
    brightness = int(np.clip((centroid - 200) / 30, 5, 95))

    # Voiced fraction (VAD proxy)
    voiced_frac = float(np.mean(np.abs(audio) > 0.01))
    activity = int(np.clip(voiced_frac * 100, 10, 90))

    # Map to emotions
    rng = np.random.default_rng(seed=int(rms * 1e6) % (2**31))
    jitter = lambda: int(rng.integers(-4, 5))

    anger       = int(np.clip((energy_pct + brightness) // 2 + jitter(), 5, 95))
    joy         = int(np.clip((brightness + activity) // 2 - 10 + jitter(), 5, 90))
    sadness     = int(np.clip(100 - (energy_pct + pitch_var) // 2 + jitter(), 5, 90))
    fear        = int(np.clip((100 - energy_pct + pitch_var) // 2 + jitter(), 5, 90))
    trust       = int(np.clip((activity + 100 - anger) // 2 + jitter(), 5, 90))
    anticipation= int(np.clip((pitch_var + activity) // 2 + jitter(), 5, 90))

    return {
        'anger':        anger,
        'joy':          joy,
        'sadness':      sadness,
        'fear':         fear,
        'trust':        trust,
        'anticipation': anticipation,
    }


# ── Main inference function ────────────────────────────────────────────────────

def analyze(audio_path: str, filename: str = None, model_choice: str = 'xgboost') -> dict:
    bundle   = _load_model(model_choice)
    pipeline = bundle['pipeline']

    # Preprocess audio
    clean    = preprocess(audio_path)
    threshold = bundle.get('threshold', 0.4)
    feature_type = bundle.get('feature_type', 'wav2vec2')

    scaler   = bundle.get('scaler')
    pca      = bundle.get('pca')

    def _apply_transforms(mat):
        """Apply scaler and optional PCA stored in model bundle."""
        if scaler is not None:
            mat = scaler.transform(mat)
        if pca is not None:
            mat = pca.transform(mat)
        return mat

    if feature_type == 'wav2vec2_cnn':
        import torch
        cnn_model = _load_cnn(bundle)
        segments  = segment_audio(clean)
        seg_feats = extract_features(segments)                    # (N, 1536)
        if scaler is not None:
            seg_feats = scaler.transform(seg_feats)
        x_t = torch.tensor(seg_feats, dtype=torch.float32)
        with torch.no_grad():
            logits = cnn_model(x_t)
            probs  = torch.softmax(logits, dim=1)[:, 1].numpy()  # dep prob per seg
        mean_prob = float(probs.mean())
        label     = int(mean_prob >= threshold)
        confidence = round(mean_prob * 100 if label == 1 else (1 - mean_prob) * 100, 1)
    elif feature_type == 'librosa':
        feat  = extract_librosa_features(audio_path).reshape(1, -1)
        feat  = _apply_transforms(feat)
        proba = pipeline.predict_proba(feat)[0]
        label = int(proba[1] >= threshold)
        confidence = round(float(proba[label]) * 100, 1)
    elif bundle.get('segment_majority', False):
        segments  = segment_audio(clean)
        seg_feats = extract_features(segments)           # (N, 1536)
        seg_feats = _apply_transforms(seg_feats)
        seg_proba = pipeline.predict_proba(seg_feats)
        mean_prob = float(seg_proba[:, 1].mean())
        label     = int(mean_prob >= threshold)
        confidence = round(mean_prob * 100 if label == 1 else (1 - mean_prob) * 100, 1)
    elif bundle.get('participant_level', False):
        segments = segment_audio(clean)
        feat  = extract_features_participant(segments).reshape(1, -1)
        feat  = _apply_transforms(feat)
        proba = pipeline.predict_proba(feat)[0]
        label = int(proba[1] >= threshold)
        confidence = round(float(proba[label]) * 100, 1)
    else:
        segments  = segment_audio(clean)
        seg_feats = extract_features(segments)
        feat  = _apply_transforms(seg_feats.mean(axis=0).reshape(1, -1))
        proba = pipeline.predict_proba(feat)[0]
        label = int(pipeline.predict(feat)[0])
        confidence = round(float(proba[label]) * 100, 1)

    prediction = 'DEPRESSED' if label == 1 else 'NON_DEPRESSED'
    # Map to frontend sentiment field
    sentiment  = 'NEGATIVE' if label == 1 else 'POSITIVE'

    # PHQ-8 risk tier
    if confidence >= 80:
        phq8_risk = 'HIGH' if label == 1 else 'LOW'
    else:
        phq8_risk = 'MODERATE'

    return {
        'sentiment':   sentiment,
        'prediction':  prediction,
        'phq8_risk':   phq8_risk,
        'confidence':  confidence,
        'emotions':    _compute_acoustic_emotions(clean),
        'transcript':  '',
        'audioFile':   filename or os.path.basename(audio_path),
        'duration':    _get_duration(audio_path),
        'fileSize':    _get_filesize(audio_path),
        'analyzedAt':  datetime.datetime.utcnow().isoformat() + 'Z',
        'modelName':   bundle.get('model_name', 'RF+XGBoost'),
        'segments':    len(segments) if 'segments' in dir() else 1,
    }
