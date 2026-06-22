import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Upload,
  Mic,
  Lightbulb,
  Clock,
  Activity,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { getUserStats, getAnalysisHistory } from '../api/api'
import StatCard from '../components/StatCard'
import ResultCard from '../components/ResultCard'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import './Dashboard.css'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const INSIGHTS = [
  'PHQ-8 scores ≥ 10 are associated with moderate-to-severe depression — AudioSense uses this threshold.',
  'Audio clarity matters: recordings with minimal background noise yield more accurate predictions.',
  'Tracking sessions over time is more informative than a single reading.',
  'AudioSense is a screening aid — a clinical professional should always confirm results.',
  'High confidence scores (>85%) indicate strong acoustic signals for the model prediction.',
]

export default function Dashboard() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [modelReady, setModelReady] = useState(null)
  const pollRef = useRef(null)

  useEffect(() => {
    async function checkModel() {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/health`
        )
        setModelReady(res.data.model_ready)
        if (!res.data.model_ready) {
          pollRef.current = setTimeout(checkModel, 15000)
        }
      } catch {
        pollRef.current = setTimeout(checkModel, 15000)
      }
    }
    checkModel()
    return () => clearTimeout(pollRef.current)
  }, [])

  const insightTip = INSIGHTS[new Date().getDay() % INSIGHTS.length]

  useEffect(() => {
    if (!currentUser) return

    async function fetchStats() {
      setStatsError('')
      setLoadingStats(true)
      try {
        const data = await getUserStats(currentUser.uid)
        setStats(data)
      } catch {
        setStatsError('Failed to load stats.')
      } finally {
        setLoadingStats(false)
      }
    }

    async function fetchHistory() {
      setHistoryError('')
      setLoadingHistory(true)
      try {
        const data = await getAnalysisHistory(currentUser.uid)
        setHistory(data.slice(0, 5))
      } catch {
        setHistoryError('Failed to load recent analyses.')
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchStats()
    fetchHistory()
  }, [currentUser])

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'there'

  return (
    <div className="page-content">
      {/* Model training banner */}
      {modelReady === false && (
        <div className="dashboard__training-banner">
          <Loader2 size={16} className="dashboard__training-spinner" />
          <span>
            <strong>Model is still training</strong> — feature extraction running on 275 participants.
            Analysis will be available once training completes (~4–5 hrs remaining). This page refreshes automatically.
          </span>
        </div>
      )}
      {modelReady === true && (
        <div className="dashboard__ready-banner">
          <ShieldCheck size={16} />
          <span><strong>Model ready</strong> — depression detection is live. Upload or record audio to analyze.</span>
        </div>
      )}

      {/* Welcome banner */}
      <div className="dashboard__welcome">
        <div className="dashboard__welcome-body">
          <div className="dashboard__welcome-icon-wrap">
            <Activity size={26} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="dashboard__welcome-title">
              {getGreeting()}, {displayName}
            </h1>
            <p className="dashboard__welcome-sub">
              Your depression-risk audio analysis hub. Upload or record audio to get started.
            </p>
          </div>
        </div>
        <div className="dashboard__welcome-badges">
          <span className="dashboard__welcome-badge"><ShieldCheck size={13} /> Extended DAIC-WOZ Trained</span>
          <span className="dashboard__welcome-badge"><TrendingUp size={13} /> PHQ-8 Screener</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dashboard__stats">
        {loadingStats ? (
          <div className="dashboard__stats-loader">
            <Loader size="medium" text="Loading stats…" />
          </div>
        ) : statsError ? (
          <div className="alert alert--error">{statsError}</div>
        ) : stats ? (
          <>
            <StatCard title="Total Analyses" value={stats.total}    icon={BarChart2}   color="indigo" subtitle="all time" />
            <StatCard title="Not Depressed"  value={stats.positive} icon={ThumbsUp}    color="green"  subtitle="low risk" />
            <StatCard title="Depressed"      value={stats.negative} icon={ThumbsDown}  color="red"    subtitle="high risk (PHQ-8 ≥ 10)" />
            <StatCard title="Inconclusive"   value={stats.neutral}  icon={Minus}       color="gray"   subtitle="needs review" />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <h2 className="dashboard__section-title">Quick Actions</h2>
      <div className="dashboard__quick-actions">
        <div className="quick-action-card" onClick={() => navigate('/upload')} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/upload')}>
          <div className="quick-action-card__icon quick-action-card__icon--indigo">
            <Upload size={28} />
          </div>
          <h3 className="quick-action-card__title">Upload Audio</h3>
          <p className="quick-action-card__desc">
            Upload an MP3, WAV, or M4A file to screen for depression risk instantly.
          </p>
          <span className="btn btn--primary btn--sm">Upload now <ArrowRight size={13} /></span>
        </div>

        <div className="quick-action-card" onClick={() => navigate('/record')} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/record')}>
          <div className="quick-action-card__icon quick-action-card__icon--green">
            <Mic size={28} />
          </div>
          <h3 className="quick-action-card__title">Record Audio</h3>
          <p className="quick-action-card__desc">
            Use your microphone to record speech and get a live risk assessment.
          </p>
          <span className="btn btn--success btn--sm">Record now <ArrowRight size={13} /></span>
        </div>
      </div>

      {/* Recent analyses */}
      <div className="dashboard__recent-header">
        <h2 className="dashboard__section-title">Recent Analyses</h2>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate('/history')}>
          <Clock size={14} />
          View all
        </button>
      </div>

      {loadingHistory ? (
        <Loader size="medium" text="Loading history…" />
      ) : historyError ? (
        <div className="alert alert--error">{historyError}</div>
      ) : history.length === 0 ? (
        <EmptyState
          title="No analyses yet"
          description="Upload or record your first audio file to see results here."
        />
      ) : (
        <div className="dashboard__recent-list">
          {history.map((item) => (
            <ResultCard key={item.id} result={item} />
          ))}
        </div>
      )}

      {/* Insight tip */}
      <div className="dashboard__insight">
        <div className="dashboard__insight-icon">
          <Lightbulb size={18} />
        </div>
        <div>
          <p className="dashboard__insight-label">Insight of the day</p>
          <p className="dashboard__insight-text">{insightTip}</p>
        </div>
      </div>
    </div>
  )
}
