import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import {
  Upload, History, Calendar, Clock, HardDrive, FileAudio,
  MessageSquare, Brain, TrendingUp,
  Smile, Handshake, Search, CloudRain, Flame, ShieldAlert, ThumbsDown, Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSentimentResult } from '../api/api'
import Loader from '../components/Loader'
import './Result.css'

const EMOTION_ICONS = {
  joy:          { icon: Smile,       color: '#f59e0b' },
  trust:        { icon: Handshake,   color: '#10b981' },
  anticipation: { icon: Search,      color: '#8b5cf6' },
  sadness:      { icon: CloudRain,   color: '#6366f1' },
  anger:        { icon: Flame,       color: '#ef4444' },
  fear:         { icon: ShieldAlert, color: '#f97316' },
  disgust:      { icon: ThumbsDown,  color: '#84cc16' },
  surprise:     { icon: Zap,         color: '#06b6d4' },
}

const DEPRESSION_INSIGHTS = {
  NON_DEPRESSED:
    'Audio indicators are consistent with a non-depressed speech pattern. Prosodic markers — pitch variability, speaking rate, and energy — fall within normal ranges. This is a screening result only; consult a clinician for a full assessment.',
  DEPRESSED:
    'Audio indicators suggest possible depressive patterns. Speech features such as reduced pitch variability, slower rate, and lower energy have been detected. PHQ-8 score threshold (≥ 10) exceeded. Please consult a qualified mental health professional.',
}

const SENTIMENT_INSIGHTS = {
  POSITIVE: DEPRESSION_INSIGHTS.NON_DEPRESSED,
  NEGATIVE: DEPRESSION_INSIGHTS.DEPRESSED,
  NEUTRAL:  'Inconclusive screening result. Audio quality or recording length may be insufficient for a confident prediction. Try a longer, clearer recording.',
}

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function sentimentClass(sentiment) {
  const map = { POSITIVE: 'badge--positive', NEGATIVE: 'badge--negative', NEUTRAL: 'badge--neutral' }
  return map[sentiment] || 'badge--neutral'
}

function ConfidenceBar({ value }) {
  const barRef = useRef(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.width = '0%'
    const timeout = setTimeout(() => {
      el.style.width = `${value}%`
    }, 100)
    return () => clearTimeout(timeout)
  }, [value])

  let colorClass = 'progress-bar--green'
  if (value < 50) colorClass = 'progress-bar--red'
  else if (value < 70) colorClass = 'progress-bar--yellow'

  return (
    <div className="confidence-bar">
      <div className="progress-track">
        <div ref={barRef} className={`progress-bar progress-bar--transition ${colorClass}`} />
      </div>
      <span className="confidence-bar__pct">{value.toFixed(1)}%</span>
    </div>
  )
}

function EmotionCard({ name, value }) {
  const barRef = useRef(null)
  const meta   = EMOTION_ICONS[name] || { icon: Brain, color: '#6366f1' }
  const Icon   = meta.icon

  useEffect(() => {
    const el = barRef.current
    if (!el) return
    el.style.width = '0%'
    const timeout = setTimeout(() => { el.style.width = `${value}%` }, 200)
    return () => clearTimeout(timeout)
  }, [value])

  return (
    <div className="emotion-card">
      <div className="emotion-card__header">
        <span className="emotion-card__icon" style={{ color: meta.color }}>
          <Icon size={20} />
        </span>
        <span className="emotion-card__name">{name.charAt(0).toUpperCase() + name.slice(1)}</span>
        <span className="emotion-card__pct">{value}%</span>
      </div>
      <div className="progress-track emotion-card__track">
        <div
          ref={barRef}
          className="progress-bar progress-bar--transition"
          style={{ background: meta.color }}
        />
      </div>
    </div>
  )
}

export default function Result() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useAuth()

  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const preloaded = location.state?.result
    if (preloaded) {
      setResult(preloaded)
      setLoading(false)
      return
    }

    async function fetchResult() {
      setError('')
      setLoading(true)
      try {
        const data = await getSentimentResult(id, currentUser.uid)
        setResult(data)
      } catch {
        setError('Failed to load result. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [id, currentUser, location.state])

  if (loading) {
    return (
      <div className="page-content page-content--centered">
        <Loader size="large" text="Loading analysis result…" />
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="page-content">
        <div className="alert alert--error">{error || 'Result not found.'}</div>
        <button className="btn btn--outline" onClick={() => navigate('/history')}>
          ← Back to History
        </button>
      </div>
    )
  }

  const emotions = result.emotions || {}

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Analysis Result</h1>
        <p className="page-subtitle">{result.audioFile}</p>
      </div>

      <div className="result-page__grid">
        {/* Sentiment hero */}
        <div className="result-page__hero">
          <p className="result-page__hero-label">Depression Risk Screening</p>
          <span className={`badge badge--large ${sentimentClass(result.sentiment)}`}>
            {result.prediction || result.sentiment}
          </span>
          {result.phq8_risk && (
            <span className="result-page__phq-badge">
              PHQ-8 Risk: <strong>{result.phq8_risk}</strong>
            </span>
          )}
          <div className="result-page__confidence">
            <div className="result-page__confidence-label">
              <TrendingUp size={15} />
              <span>Confidence Score</span>
            </div>
            <ConfidenceBar value={result.confidence} />
          </div>
        </div>

        {/* AI Insight */}
        <div className="result-page__insight">
          <div className="result-page__insight-header">
            <Brain size={18} />
            <h3>AI Insight</h3>
          </div>
          <p>{SENTIMENT_INSIGHTS[result.sentiment]}</p>
        </div>

        {/* Emotion breakdown */}
        {Object.keys(emotions).length > 0 && (
          <div className="result-page__emotions">
            <h3 className="result-page__section-title">Emotion Breakdown</h3>
            <div className="result-page__emotions-grid">
              {Object.entries(emotions)
                .sort(([, a], [, b]) => b - a)
                .map(([name, value]) => (
                  <EmotionCard key={name} name={name} value={value} />
                ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div className="result-page__transcript">
          <div className="result-page__section-header">
            <MessageSquare size={16} />
            <h3 className="result-page__section-title">Transcript</h3>
          </div>
          {result.transcript ? (
            <p className="result-page__transcript-text">{result.transcript}</p>
          ) : (
            <p className="result-page__transcript-empty">Transcript not available for this recording.</p>
          )}
        </div>

        {/* Audio metadata */}
        <div className="result-page__meta">
          <h3 className="result-page__section-title">Audio Details</h3>
          <div className="result-page__meta-grid">
            <div className="result-page__meta-item">
              <FileAudio size={16} />
              <span className="result-page__meta-label">Filename</span>
              <span className="result-page__meta-value">{result.audioFile}</span>
            </div>
            <div className="result-page__meta-item">
              <Clock size={16} />
              <span className="result-page__meta-label">Duration</span>
              <span className="result-page__meta-value">{result.duration}</span>
            </div>
            <div className="result-page__meta-item">
              <HardDrive size={16} />
              <span className="result-page__meta-label">File Size</span>
              <span className="result-page__meta-value">{result.fileSize}</span>
            </div>
            <div className="result-page__meta-item">
              <Calendar size={16} />
              <span className="result-page__meta-label">Analyzed</span>
              <span className="result-page__meta-value">{formatDate(result.analyzedAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA buttons */}
      <div className="result-page__cta">
        <button className="btn btn--primary btn--large" onClick={() => navigate('/upload')}>
          <Upload size={17} />
          Analyze Another
        </button>
        <button className="btn btn--outline btn--large" onClick={() => navigate('/history')}>
          <History size={17} />
          View History
        </button>
      </div>
    </div>
  )
}
