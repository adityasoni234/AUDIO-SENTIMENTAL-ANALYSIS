import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import {
  Upload, Mic, BarChart2, CheckCircle, AlertTriangle, XCircle,
  Brain, Cpu, TreePine, Network, Activity, Shield,
  Clock, HardDrive, FileAudio, Calendar, TrendingUp, Users,
} from 'lucide-react'
import './CompareResult.css'

// ── Severity config ────────────────────────────────────────────────────────
const SEVERITY_CONFIG = {
  Minimal:            { level: 1, color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', icon: CheckCircle,    phq: '0–4'  },
  Mild:               { level: 2, color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', icon: AlertTriangle,  phq: '5–9'  },
  Moderate:           { level: 3, color: '#f97316', bg: '#fff7ed', border: '#fdba74', icon: AlertTriangle,  phq: '10–14'},
  'Moderately Severe':{ level: 4, color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', icon: XCircle,        phq: '15–19'},
  Severe:             { level: 5, color: '#dc2626', bg: '#fef2f2', border: '#f87171', icon: XCircle,        phq: '20–27'},
}

const MODEL_META = {
  xgboost: { label: 'XGBoost',       icon: Cpu,      accuracy: '93.76%', color: '#6366f1' },
  rf:       { label: 'Random Forest', icon: TreePine, accuracy: '80.18%', color: '#10b981' },
  cnn:      { label: 'CNN (1D)',      icon: Network,  accuracy: '96.82%', color: '#f59e0b' },
}

const ALL_MODELS = ['xgboost', 'rf', 'cnn']

// ── Severity Gauge ──────────────────────────────────────────────────────────
function SeverityGauge({ severity, confidence }) {
  const cfg     = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.Minimal
  const pct     = ((cfg.level - 1) / 4) * 100
  const barRef  = useRef(null)
  const needleRef = useRef(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (barRef.current)    barRef.current.style.width    = `${pct}%`
      if (needleRef.current) needleRef.current.style.left  = `${pct}%`
    }, 200)
    return () => clearTimeout(timeout)
  }, [pct])

  const Icon = cfg.icon

  return (
    <div className="severity-gauge">
      <div className="severity-gauge__header">
        <div className="severity-gauge__icon" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
          <Icon size={24} />
        </div>
        <div>
          <p className="severity-gauge__label">Depression Severity</p>
          <h2 className="severity-gauge__value" style={{ color: cfg.color }}>{severity}</h2>
          <p className="severity-gauge__phq">PHQ-8 equivalent: <strong>{cfg.phq}</strong></p>
        </div>
      </div>

      {/* Scale bar */}
      <div className="severity-gauge__scale">
        <div className="severity-gauge__track">
          <div className="severity-gauge__gradient" />
          <div className="severity-gauge__needle" ref={needleRef} />
        </div>
        <div className="severity-gauge__ticks">
          {['Minimal','Mild','Moderate','Mod. Severe','Severe'].map((t, i) => (
            <span key={t} className={`severity-gauge__tick ${cfg.level - 1 === i ? 'severity-gauge__tick--active' : ''}`}>{t}</span>
          ))}
        </div>
      </div>

      {/* 5 level dots */}
      <div className="severity-gauge__dots">
        {[1,2,3,4,5].map(lvl => (
          <div
            key={lvl}
            className={`severity-gauge__dot ${lvl <= cfg.level ? 'severity-gauge__dot--filled' : ''}`}
            style={lvl <= cfg.level ? { background: cfg.color, boxShadow: `0 0 8px ${cfg.color}` } : {}}
          />
        ))}
      </div>
    </div>
  )
}

// ── Confidence bar ──────────────────────────────────────────────────────────
function ConfBar({ value, color }) {
  const ref = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => { if (ref.current) ref.current.style.width = `${value}%` }, 300)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div className="cmp-conf-bar">
      <div className="cmp-conf-bar__track">
        <div ref={ref} className="cmp-conf-bar__fill" style={{ background: color }} />
      </div>
      <span className="cmp-conf-bar__pct">{value}%</span>
    </div>
  )
}

// ── Single model card ───────────────────────────────────────────────────────
function ModelCard({ modelKey, result }) {
  const meta = MODEL_META[modelKey] || { label: modelKey, icon: Brain, accuracy: '—', color: '#6366f1' }
  const Icon = meta.icon
  const isError  = !!result.error
  const isDep    = result.prediction === 'DEPRESSED'
  const sevCfg   = SEVERITY_CONFIG[result.severity] || SEVERITY_CONFIG.Minimal

  return (
    <div className={`model-card ${isDep ? 'model-card--dep' : 'model-card--nodep'} ${isError ? 'model-card--error' : ''}`}
         style={{ '--model-color': meta.color }}>
      <div className="model-card__header">
        <div className="model-card__icon" style={{ background: `${meta.color}18`, color: meta.color }}>
          <Icon size={20} />
        </div>
        <div className="model-card__title">
          <h3>{meta.label}</h3>
          <span className="model-card__acc">Test accuracy: {meta.accuracy}</span>
        </div>
      </div>

      {isError ? (
        <div className="model-card__error">
          <XCircle size={16} /> Model not available — train first
        </div>
      ) : (
        <>
          <div className={`model-card__verdict ${isDep ? 'model-card__verdict--dep' : 'model-card__verdict--ok'}`}>
            {isDep ? <XCircle size={16} /> : <CheckCircle size={16} />}
            {result.prediction.replace('_', ' ')}
          </div>

          <div className="model-card__severity" style={{ background: sevCfg.bg, borderColor: sevCfg.border, color: sevCfg.color }}>
            Severity: <strong>{result.severity}</strong>
          </div>

          <div className="model-card__conf">
            <span className="model-card__conf-label">Confidence</span>
            <ConfBar value={result.confidence} color={meta.color} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Emotion wheel ───────────────────────────────────────────────────────────
function EmotionBars({ emotions }) {
  if (!emotions || !Object.keys(emotions).length) return null
  const COLORS = { anger: '#ef4444', joy: '#f59e0b', sadness: '#6366f1', fear: '#f97316', trust: '#10b981', anticipation: '#8b5cf6' }
  return (
    <div className="cmp-emotions">
      <h3 className="cmp-section-title"><Activity size={16} /> Acoustic Emotion Profile</h3>
      <div className="cmp-emotions__grid">
        {Object.entries(emotions).sort(([,a],[,b]) => b - a).map(([name, val]) => {
          const ref = useRef(null)
          useEffect(() => {
            const t = setTimeout(() => { if (ref.current) ref.current.style.width = `${val}%` }, 400)
            return () => clearTimeout(t)
          }, [val])
          return (
            <div key={name} className="cmp-emotion-row">
              <span className="cmp-emotion-name">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
              <div className="cmp-emotion-track">
                <div ref={ref} className="cmp-emotion-bar" style={{ background: COLORS[name] || '#6366f1' }} />
              </div>
              <span className="cmp-emotion-pct">{val}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function CompareResult() {
  const location = useLocation()
  const navigate = useNavigate()
  const data     = location.state?.compareResult

  if (!data) {
    return (
      <div className="page-content page-content--centered">
        <div className="alert alert--error">No comparison data found. Please run a comparison first.</div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className="btn btn--primary" onClick={() => navigate('/upload')}>Upload Audio</button>
          <button className="btn btn--outline" onClick={() => navigate('/record')}>Record Audio</button>
        </div>
      </div>
    )
  }

  const { models, ensemble, emotions, audioFile, duration, fileSize, analyzedAt, segments } = data
  const ensSevCfg = SEVERITY_CONFIG[ensemble.severity] || SEVERITY_CONFIG.Minimal

  return (
    <div className="page-content cmp-page">
      <div className="page-header">
        <h1 className="page-title"><BarChart2 size={24} style={{ display: 'inline', marginRight: 10, verticalAlign: 'middle' }} />Model Comparison</h1>
        <p className="page-subtitle">All 3 models analysed simultaneously — compare predictions, severity and confidence.</p>
      </div>

      {/* ── Severity hero ── */}
      <div className="cmp-hero">
        <SeverityGauge severity={ensemble.severity} confidence={ensemble.confidence} />

        <div className="cmp-hero__ensemble">
          <p className="cmp-hero__ensemble-label">Ensemble Verdict</p>
          <div className={`cmp-hero__ensemble-badge ${ensemble.prediction === 'DEPRESSED' ? 'cmp-hero__ensemble-badge--dep' : 'cmp-hero__ensemble-badge--ok'}`}>
            {ensemble.prediction === 'DEPRESSED' ? <XCircle size={18}/> : <CheckCircle size={18}/>}
            {ensemble.prediction.replace('_', ' ')}
          </div>
          <div className="cmp-hero__stats">
            <div className="cmp-hero__stat">
              <span className="cmp-hero__stat-value" style={{ color: ensSevCfg.color }}>{ensemble.confidence}%</span>
              <span className="cmp-hero__stat-label">Confidence</span>
            </div>
            <div className="cmp-hero__divider" />
            <div className="cmp-hero__stat">
              <span className="cmp-hero__stat-value">{ensemble.agreement}%</span>
              <span className="cmp-hero__stat-label">Models agree</span>
            </div>
            <div className="cmp-hero__divider" />
            <div className="cmp-hero__stat">
              <span className="cmp-hero__stat-value">{ensemble.phq8_risk}</span>
              <span className="cmp-hero__stat-label">PHQ-8 Risk</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Model cards ── */}
      <div className="cmp-section">
        <h2 className="cmp-section-title"><Users size={17} /> Individual Model Results</h2>
        <div className="cmp-cards">
          {ALL_MODELS.map(key => (
            <ModelCard key={key} modelKey={key} result={models[key] || { error: 'Model not available' }} />
          ))}
        </div>
      </div>

      {/* ── Severity guide ── */}
      <div className="cmp-severity-guide">
        <h2 className="cmp-section-title"><Shield size={17} /> PHQ-8 Severity Scale</h2>
        <div className="cmp-severity-guide__grid">
          {Object.entries(SEVERITY_CONFIG).map(([sev, cfg]) => {
            const SIcon = cfg.icon
            const isActive = sev === ensemble.severity
            return (
              <div key={sev} className={`cmp-severity-item ${isActive ? 'cmp-severity-item--active' : ''}`}
                   style={isActive ? { borderColor: cfg.color, background: cfg.bg } : {}}>
                <SIcon size={16} style={{ color: cfg.color }} />
                <div>
                  <div className="cmp-severity-item__name" style={{ color: isActive ? cfg.color : undefined }}>{sev}</div>
                  <div className="cmp-severity-item__phq">PHQ-8: {cfg.phq}</div>
                </div>
                {isActive && <div className="cmp-severity-item__current" style={{ background: cfg.color }}>Current</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Emotions ── */}
      <EmotionBars emotions={emotions} />

      {/* ── Meta ── */}
      <div className="cmp-meta">
        <h2 className="cmp-section-title"><FileAudio size={17} /> Audio Details</h2>
        <div className="cmp-meta__grid">
          {[
            { icon: FileAudio,  label: 'File',      val: audioFile },
            { icon: Clock,      label: 'Duration',  val: duration  },
            { icon: HardDrive,  label: 'Size',      val: fileSize  },
            { icon: Activity,   label: 'Segments',  val: segments  },
            { icon: Calendar,   label: 'Analysed',  val: formatDate(analyzedAt) },
          ].map(({ icon: I, label, val }) => (
            <div key={label} className="cmp-meta__item">
              <I size={15} className="cmp-meta__icon" />
              <span className="cmp-meta__label">{label}</span>
              <span className="cmp-meta__val">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="cmp-cta">
        <button className="btn btn--primary btn--large" onClick={() => navigate('/upload')}>
          <Upload size={17} /> Analyse Another
        </button>
        <button className="btn btn--outline btn--large" onClick={() => navigate('/record')}>
          <Mic size={17} /> Record New
        </button>
        <button className="btn btn--ghost btn--large" onClick={() => navigate('/history')}>
          View History
        </button>
      </div>

      <div className="cmp-disclaimer">
        This is an AI screening tool — not a clinical diagnosis. If you or someone you know may be experiencing depression, please consult a qualified mental health professional.
      </div>
    </div>
  )
}
