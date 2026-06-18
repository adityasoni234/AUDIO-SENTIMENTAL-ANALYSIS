import { useState, useEffect } from 'react'
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
} from 'lucide-react'
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
  'Positive sentiment in customer calls correlates with 23% higher retention rates.',
  'Audio recordings under 60 seconds tend to yield more accurate sentiment predictions.',
  'Neutral sentiment often indicates factual or informational speech — great for meeting notes.',
  'Try analyzing multiple calls from the same customer to track sentiment trends over time.',
  'High confidence scores (>85%) indicate clear speech quality and strong sentiment signals.',
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
      {/* Welcome banner */}
      <div className="dashboard__welcome">
        <div>
          <h1 className="dashboard__welcome-title">
            {getGreeting()}, {displayName} 👋
          </h1>
          <p className="dashboard__welcome-sub">
            Here's a snapshot of your sentiment analysis activity.
          </p>
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
            <StatCard title="Total Analyses" value={stats.total} icon={BarChart2} color="indigo" />
            <StatCard title="Positive" value={stats.positive} icon={ThumbsUp} color="green" />
            <StatCard title="Negative" value={stats.negative} icon={ThumbsDown} color="red" />
            <StatCard title="Neutral" value={stats.neutral} icon={Minus} color="gray" />
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
            Upload an MP3, WAV, or M4A file to analyze its sentiment instantly.
          </p>
          <span className="btn btn--primary btn--sm">Upload now →</span>
        </div>

        <div className="quick-action-card" onClick={() => navigate('/record')} role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/record')}>
          <div className="quick-action-card__icon quick-action-card__icon--green">
            <Mic size={28} />
          </div>
          <h3 className="quick-action-card__title">Record Audio</h3>
          <p className="quick-action-card__desc">
            Use your microphone to record speech and analyze it in real time.
          </p>
          <span className="btn btn--success btn--sm">Record now →</span>
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
