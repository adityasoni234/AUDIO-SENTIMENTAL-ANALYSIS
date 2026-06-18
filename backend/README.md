# Depression Detection from Audio — Python Backend

Flask REST API implementing depression detection from speech using the pipeline:

```
Extended DAIC-WOZ Audio
        ↓
Noise-Robust Preprocessing
(Resample 16kHz → Normalize → VAD → Silence Trim → Bandpass 300–3400Hz → Noise Suppression)
        ↓
Speech Segmentation  (5–10 second windows, 1s overlap)
        ↓
PHQ-8 Label Mapping  (score ≥ 10 → Depressed, < 10 → Non-Depressed)
        ↓
wav2vec 2.0 Feature Learning  (768-dim mean-pooled hidden states)
        ↓
Random Forest / XGBoost Classifier  (best F1 is kept)
        ↓
Depression Prediction  (Depressed | Non-Depressed)
        ↓
Accuracy · Precision · Recall · F1 · ROC-AUC
```

---

## File structure

```
backend/
├── app.py              ← Flask server
├── preprocessing.py    ← Steps 1: resample, normalize, VAD, trim, bandpass, denoise
├── segmentation.py     ← Step 2: 5–10 second speech segments
├── features.py         ← Step 3: wav2vec 2.0 feature extraction (768-dim)
├── train.py            ← Step 4–7: RF + XGBoost training + evaluation
├── predict.py          ← Inference pipeline
├── requirements.txt
├── data/
│   └── DAIC-WOZ/
│       ├── labels.csv          ← Participant_ID, PHQ_Score
│       ├── 300_P/300_AUDIO.wav
│       ├── 301_P/301_AUDIO.wav
│       └── ...
└── models/
    └── depression_model.joblib
```

---

## Setup

### 1. Prerequisites

```bash
brew install ffmpeg      # macOS
# sudo apt install ffmpeg   # Ubuntu
```

### 2. Install packages

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> **Note:** `torch` + `transformers` are ~2 GB. First run downloads `facebook/wav2vec2-base` (~360 MB) automatically from HuggingFace.

### 3. Obtain DAIC-WOZ dataset

The Extended DAIC-WOZ dataset requires a data use agreement:

👉 **Apply here:** https://dcapswoz.ict.usc.edu/

After approval, extract so you have:
```
data/DAIC-WOZ/
├── labels.csv            # must contain: Participant_ID, PHQ_Score
├── 300_P/300_AUDIO.wav
├── 301_P/301_AUDIO.wav
└── ...
```

The `labels.csv` should have at minimum:
| Participant_ID | PHQ_Score |
|:-:|:-:|
| 300 | 8 |
| 301 | 14 |

### 4. Train

```bash
python train.py --data ./data/DAIC-WOZ --labels ./data/DAIC-WOZ/labels.csv
```

Training outputs cross-validated metrics for both RF and XGBoost, then saves the best model.

### 5. Start API server

```bash
python app.py
# → http://localhost:5000
```

---

## API

### GET /api/health

### POST /api/analyze/upload
```
Content-Type: multipart/form-data
Field: audio  (wav, mp3, m4a, webm, ogg, flac, aac)
```

### POST /api/analyze/record
```
Field: audio  (webm blob from MediaRecorder)
```

### Response

```json
{
  "sentiment":   "NEGATIVE",
  "prediction":  "DEPRESSED",
  "phq8_risk":   "HIGH",
  "confidence":  84.2,
  "emotions":    { "sadness": 76, "fear": 48, "anger": 33, "disgust": 22, "joy": 9 },
  "transcript":  "",
  "audioFile":   "interview.wav",
  "duration":    "4:32",
  "fileSize":    "8.2 MB",
  "analyzedAt":  "2026-06-17T10:00:00Z",
  "modelName":   "XGBoost",
  "segments":    37
}
```

---

## PHQ-8 Label Mapping

| PHQ-8 Score | Label | Binary |
|:-----------:|-------|:------:|
| 0–9         | Non-Depressed | 0 |
| 10–27       | Depressed     | 1 |

---

## Preprocessing Details

| Step | Operation | Parameters |
|------|-----------|-----------|
| Resample | scipy resample_poly | → 16 kHz |
| Normalize | Peak normalization | target 0.95 |
| VAD | Energy-based frame gating | 20ms frames, −40 dB threshold |
| Silence trim | Remove pauses > 300ms | clinical pause preservation |
| Bandpass | Butterworth filter | 300–3400 Hz, order 4 |
| Noise suppress | Spectral subtraction | α = 2.0 over-subtraction |
