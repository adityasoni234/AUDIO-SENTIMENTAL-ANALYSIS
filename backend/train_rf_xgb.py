"""
Train Random Forest + XGBoost on wav2vec2 segment features.
PCA 256 reduces 1536-dim → 256-dim so training finishes fast.
Segment-level 80/20 stratified split. Inference: majority vote across segments.
No PyTorch import — uses pre-cached features_cache.npz only.
"""

import os, time, warnings
warnings.filterwarnings('ignore')

import numpy as np
import joblib
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (accuracy_score, classification_report,
                             roc_auc_score, confusion_matrix)
from sklearn.model_selection import train_test_split

try:
    import xgboost as xgb
    HAS_XGB = True
    print("XGBoost:", xgb.__version__)
except ImportError:
    HAS_XGB = False
    print("XGBoost not installed — RF only")

CACHE  = os.path.join(os.path.dirname(__file__), 'models', 'features_cache.npz')
OUTDIR = os.path.join(os.path.dirname(__file__), 'models')

# ── Load ──────────────────────────────────────────────────────────────────────
print(f"\nLoading cache …")
data  = np.load(CACHE, allow_pickle=True)
X     = data['X'].astype(np.float32)   # (115467, 1536)
y     = data['y'].astype(int)
pids  = data['pids']
print(f"  Segments : {X.shape}  classes: {np.bincount(y)}")

# ── 80/20 stratified segment split ───────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
print(f"  Train: {X_train.shape}  Test: {X_test.shape}")

# ── Scale + PCA 256 (reduces from 1536 → 256) ────────────────────────────────
print("\nFitting StandardScaler + PCA(256) …")
t0 = time.time()
scaler = StandardScaler()
pca    = PCA(n_components=256, random_state=42)

X_tr_s = scaler.fit_transform(X_train)
X_te_s = scaler.transform(X_test)
X_tr_p = pca.fit_transform(X_tr_s)
X_te_p = pca.transform(X_te_s)
print(f"  Done in {time.time()-t0:.1f}s  |  explained var: {pca.explained_variance_ratio_.sum()*100:.1f}%")

def evaluate(name, clf, X_tr, y_tr, X_te, y_te):
    t0 = time.time()
    clf.fit(X_tr, y_tr)
    elapsed = time.time() - t0
    tr_acc = accuracy_score(y_tr, clf.predict(X_tr))
    te_acc = accuracy_score(y_te, clf.predict(X_te))
    try:
        auc = roc_auc_score(y_te, clf.predict_proba(X_te)[:, 1])
    except Exception:
        auc = float('nan')
    print(f"\n{'='*60}")
    print(f"  {name}  [{elapsed:.1f}s]")
    print(f"  Train Acc : {tr_acc*100:.2f}%")
    print(f"  Test  Acc : {te_acc*100:.2f}%")
    print(f"  ROC-AUC   : {auc:.4f}")
    print(classification_report(y_te, clf.predict(X_te),
          target_names=['Non-Dep','Depressed'], digits=3))
    print(f"  Confusion:\n{confusion_matrix(y_te, clf.predict(X_te))}")
    return te_acc, auc

# ── Random Forest ─────────────────────────────────────────────────────────────
print("\n[1/3] Random Forest …")
rf = RandomForestClassifier(
    n_estimators=300,
    max_depth=None,
    min_samples_leaf=1,
    max_features='sqrt',
    class_weight='balanced',
    n_jobs=-1,
    random_state=42,
)
acc_rf, auc_rf = evaluate('Random Forest', rf, X_tr_p, y_train, X_te_p, y_test)

# ── XGBoost ───────────────────────────────────────────────────────────────────
acc_xgb, auc_xgb, xgb_clf = 0, 0, None
if HAS_XGB:
    print("\n[2/3] XGBoost …")
    scale_pos = int(np.bincount(y_train)[0] / np.bincount(y_train)[1])
    xgb_clf = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=7,
        learning_rate=0.1,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos,
        use_label_encoder=False,
        eval_metric='logloss',
        tree_method='hist',
        device='cpu',
        random_state=42,
        n_jobs=-1,
    )
    acc_xgb, auc_xgb = evaluate('XGBoost', xgb_clf, X_tr_p, y_train, X_te_p, y_test)

# ── Ensemble ──────────────────────────────────────────────────────────────────
best_acc, best_clf, best_name = acc_rf, rf, 'Random Forest'
if HAS_XGB and xgb_clf is not None:
    print("\n[3/3] RF + XGBoost Ensemble (soft vote) …")
    rf2 = RandomForestClassifier(
        n_estimators=300, max_features='sqrt',
        class_weight='balanced', n_jobs=-1, random_state=42)
    xgb2 = xgb.XGBClassifier(
        n_estimators=300, max_depth=7, learning_rate=0.1,
        subsample=0.85, colsample_bytree=0.85,
        scale_pos_weight=scale_pos,
        use_label_encoder=False, eval_metric='logloss',
        tree_method='hist', device='cpu', random_state=42, n_jobs=-1)
    ens = VotingClassifier(
        estimators=[('rf', rf2), ('xgb', xgb2)],
        voting='soft', weights=[1, 2]
    )
    t0 = time.time()
    ens.fit(X_tr_p, y_train)
    print(f"  Trained in {time.time()-t0:.1f}s")
    tr_acc = accuracy_score(y_train, ens.predict(X_tr_p))
    te_acc = accuracy_score(y_test,  ens.predict(X_te_p))
    auc    = roc_auc_score(y_test, ens.predict_proba(X_te_p)[:, 1])
    print(f"  Train Acc : {tr_acc*100:.2f}%")
    print(f"  Test  Acc : {te_acc*100:.2f}%")
    print(f"  ROC-AUC   : {auc:.4f}")
    print(classification_report(y_test, ens.predict(X_te_p),
          target_names=['Non-Dep','Depressed'], digits=3))
    print(f"  Confusion:\n{confusion_matrix(y_test, ens.predict(X_te_p))}")
    if te_acc > best_acc:
        best_acc, best_clf, best_name = te_acc, ens, 'RF+XGBoost Ensemble'

# ── Save ──────────────────────────────────────────────────────────────────────
print(f"\n>>> BEST: {best_name}  Test Acc={best_acc*100:.2f}%")
bundle = {
    'pipeline':         best_clf,
    'scaler':           scaler,
    'pca':              pca,
    'feature_type':     'wav2vec2_segment_pca',
    'segment_majority': True,
    'participant_level': False,
    'threshold':        0.4,
    'model_name':       best_name,
    'test_accuracy':    round(best_acc * 100, 2),
}
out = os.path.join(OUTDIR, 'depression_model.joblib')
joblib.dump(bundle, out)
print(f"Saved → {out}")
print("Done.")
