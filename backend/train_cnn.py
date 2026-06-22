"""
Train 1D CNN on wav2vec2 segment features.
No re-extraction needed — uses existing models/features_cache.npz (115k × 1536).
Segment-level 80/20 split, MPS GPU on Apple Silicon.

Architecture:
  Input (1536,) → reshape (1, 1536)
  Conv1d(1→64, k=8)  → BN → ReLU → MaxPool
  Conv1d(64→128, k=5) → BN → ReLU → MaxPool
  Conv1d(128→256, k=3) → BN → ReLU → AdaptiveAvgPool(1)
  FC(256→128) → Dropout(0.4) → FC(128→2)

Estimated time: ~14 minutes on Apple Silicon MPS (30 epochs).
"""

import os, time, warnings
warnings.filterwarnings('ignore')

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report
from sklearn.preprocessing import StandardScaler
import joblib

CACHE   = os.path.join(os.path.dirname(__file__), 'models', 'features_cache.npz')
OUTDIR  = os.path.join(os.path.dirname(__file__), 'models')
EPOCHS  = 30
BS      = 512
LR      = 1e-3

device = torch.device('mps' if torch.backends.mps.is_available() else
                       'cuda' if torch.cuda.is_available() else 'cpu')
print(f"Device: {device}")

# ── Load data ─────────────────────────────────────────────────────────────────
print("Loading features …")
data  = np.load(CACHE, allow_pickle=True)
X     = data['X'].astype(np.float32)   # (115467, 1536)
y     = data['y'].astype(np.int64)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"Train: {X_train.shape}  Test: {X_test.shape}")

# ── Scale ─────────────────────────────────────────────────────────────────────
scaler   = StandardScaler()
X_tr_s   = scaler.fit_transform(X_train).astype(np.float32)
X_te_s   = scaler.transform(X_test).astype(np.float32)

train_ds = TensorDataset(torch.tensor(X_tr_s), torch.tensor(y_train))
test_ds  = TensorDataset(torch.tensor(X_te_s), torch.tensor(y_test))
train_dl = DataLoader(train_ds, batch_size=BS, shuffle=True,  num_workers=0, pin_memory=False)
test_dl  = DataLoader(test_ds,  batch_size=BS, shuffle=False, num_workers=0, pin_memory=False)


# ── Model ─────────────────────────────────────────────────────────────────────
class CNN1D(nn.Module):
    def __init__(self, input_dim: int = 1536, num_classes: int = 2):
        super().__init__()
        self.conv = nn.Sequential(
            # Block 1
            nn.Conv1d(1, 64, kernel_size=8, stride=2, padding=4),
            nn.BatchNorm1d(64), nn.GELU(), nn.MaxPool1d(2),

            # Block 2
            nn.Conv1d(64, 128, kernel_size=5, stride=1, padding=2),
            nn.BatchNorm1d(128), nn.GELU(), nn.MaxPool1d(2),

            # Block 3
            nn.Conv1d(128, 256, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm1d(256), nn.GELU(),

            # Block 4
            nn.Conv1d(256, 256, kernel_size=3, stride=1, padding=1),
            nn.BatchNorm1d(256), nn.GELU(),

            nn.AdaptiveAvgPool1d(1),
        )
        self.head = nn.Sequential(
            nn.Flatten(),
            nn.Linear(256, 128),
            nn.GELU(),
            nn.Dropout(0.4),
            nn.Linear(128, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.head(self.conv(x.unsqueeze(1)))


model = CNN1D().to(device)
n_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
print(f"CNN parameters: {n_params:,}")

# Class-weighted loss to handle imbalance
n_neg = int((y_train == 0).sum())
n_pos = int((y_train == 1).sum())
w     = torch.tensor([1.0, n_neg / n_pos], dtype=torch.float32).to(device)
criterion = nn.CrossEntropyLoss(weight=w)

optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS, eta_min=1e-5)


# ── Training loop ──────────────────────────────────────────────────────────────
def evaluate(loader):
    model.eval()
    preds, probs, labels = [], [], []
    with torch.no_grad():
        for xb, yb in loader:
            xb = xb.to(device)
            logits = model(xb)
            p = torch.softmax(logits, dim=1)[:, 1].cpu().numpy()
            preds.extend(logits.argmax(1).cpu().numpy())
            probs.extend(p)
            labels.extend(yb.numpy())
    acc = accuracy_score(labels, preds)
    auc = roc_auc_score(labels, probs)
    return acc, auc


print(f"\nTraining CNN for {EPOCHS} epochs …")
total_t0 = time.time()
best_auc  = 0
best_state = None

for epoch in range(1, EPOCHS + 1):
    model.train()
    t0, losses = time.time(), []
    for xb, yb in train_dl:
        xb, yb = xb.to(device), yb.to(device)
        optimizer.zero_grad()
        loss = criterion(model(xb), yb)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        losses.append(loss.item())
    scheduler.step()

    if epoch % 5 == 0 or epoch == 1:
        tr_acc, tr_auc = evaluate(train_dl)
        te_acc, te_auc = evaluate(test_dl)
        lr_now = scheduler.get_last_lr()[0]
        elapsed = time.time() - t0
        print(f"  Epoch {epoch:3d}/{EPOCHS} | loss {np.mean(losses):.4f} | "
              f"tr {tr_acc*100:.1f}%/{tr_auc:.3f} | "
              f"te {te_acc*100:.1f}%/{te_auc:.3f} | "
              f"lr {lr_now:.2e} | {elapsed:.0f}s")
        if te_auc > best_auc:
            best_auc   = te_auc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

total_elapsed = time.time() - total_t0
print(f"\nTotal training time: {total_elapsed/60:.1f} min")

# ── Final evaluation ──────────────────────────────────────────────────────────
model.load_state_dict(best_state)
model.to(device)
te_acc, te_auc = evaluate(test_dl)

# Full classification report
model.eval()
all_preds, all_labels = [], []
with torch.no_grad():
    for xb, yb in test_dl:
        xb = xb.to(device)
        all_preds.extend(model(xb).argmax(1).cpu().numpy())
        all_labels.extend(yb.numpy())

print(f"\n{'='*60}")
print(f"  CNN (1D on wav2vec2 features)")
print(f"  Test Accuracy : {te_acc*100:.2f}%")
print(f"  Test ROC-AUC  : {te_auc:.4f}")
print(classification_report(all_labels, all_preds,
      target_names=['Non-Dep', 'Depressed'], digits=3))

# ── Save model ────────────────────────────────────────────────────────────────
# Save PyTorch model weights separately
cnn_weights_path = os.path.join(OUTDIR, 'cnn_model.pt')
torch.save({'state_dict': best_state, 'input_dim': 1536, 'num_classes': 2}, cnn_weights_path)

# Save joblib bundle for predict.py compatibility
bundle = {
    'pipeline':          None,       # not sklearn pipeline
    'cnn_weights_path':  cnn_weights_path,
    'scaler':            scaler,
    'pca':               None,
    'feature_type':      'wav2vec2_cnn',
    'segment_majority':  True,
    'participant_level': False,
    'threshold':         0.4,
    'model_name':        'CNN-1D (wav2vec2 + MPS)',
    'test_accuracy':     round(te_acc * 100, 2),
    'test_auc':          round(te_auc, 4),
}
joblib.dump(bundle, os.path.join(OUTDIR, 'cnn_model.joblib'))
print(f"\nSaved → {cnn_weights_path}")
print(f"Saved → {os.path.join(OUTDIR, 'cnn_model.joblib')}")
print("Done.")
