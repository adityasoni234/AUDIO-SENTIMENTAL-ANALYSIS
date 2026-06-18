import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Trash2, Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getAnalysisHistory, deleteAnalysis } from '../api/api'
import Loader from '../components/Loader'
import EmptyState from '../components/EmptyState'
import './History.css'

const FILTER_OPTIONS = ['All', 'POSITIVE', 'NEGATIVE', 'NEUTRAL']

function sentimentClass(sentiment) {
  const map = { POSITIVE: 'badge--positive', NEGATIVE: 'badge--negative', NEUTRAL: 'badge--neutral' }
  return map[sentiment] || 'badge--neutral'
}

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function History() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    async function fetchHistory() {
      setError('')
      setLoading(true)
      try {
        const data = await getAnalysisHistory(currentUser.uid)
        setHistory(data)
      } catch {
        setError('Failed to load history. Please refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [currentUser])

  const filtered = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch = item.audioFile.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filter === 'All' || item.sentiment === filter
      return matchesSearch && matchesFilter
    })
  }, [history, searchQuery, filter])

  async function handleDelete(e, id) {
    e.stopPropagation()
    setDeletingId(id)
    // Optimistic update
    setHistory((prev) => prev.filter((item) => item.id !== id))
    try {
      await deleteAnalysis(id, currentUser.uid)
    } catch {
      // Rollback is complex without original — just show error
      setError('Failed to delete entry. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleRowClick(item) {
    navigate(`/result/${item.id}`, { state: { result: item } })
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Analysis History</h1>
        <p className="page-subtitle">All your past audio sentiment analyses in one place.</p>
      </div>

      {/* Controls */}
      <div className="history__controls">
        <div className="history__search-wrap">
          <Search size={16} className="history__search-icon" />
          <input
            type="search"
            className="form-input history__search-input"
            placeholder="Search by filename…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search analyses"
          />
        </div>

        <div className="history__filter-wrap">
          <Filter size={15} />
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by sentiment"
          >
            {FILTER_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'All' ? 'All Sentiments' : opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <Loader size="medium" text="Loading history…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={searchQuery || filter !== 'All' ? 'No matching results' : 'No analyses yet'}
          description={
            searchQuery || filter !== 'All'
              ? 'Try adjusting your search or filter.'
              : 'Upload or record an audio file to get started.'
          }
          action={
            !searchQuery && filter === 'All' ? (
              <button className="btn btn--primary" onClick={() => navigate('/upload')}>
                Upload Audio
              </button>
            ) : null
          }
        />
      ) : (
        <div className="history__table-wrapper">
          <table className="history__table" role="grid">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Sentiment</th>
                <th>Confidence</th>
                <th>Date</th>
                <th>Duration</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="history__row"
                  onClick={() => handleRowClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleRowClick(item)}
                  aria-label={`View result for ${item.audioFile}`}
                >
                  <td>
                    <span className="history__filename">{item.audioFile}</span>
                  </td>
                  <td>
                    <span className={`badge ${sentimentClass(item.sentiment)}`}>
                      {item.sentiment}
                    </span>
                  </td>
                  <td>
                    <span className="history__confidence">{item.confidence}%</span>
                  </td>
                  <td>
                    <span className="history__date">{formatDate(item.analyzedAt)}</span>
                  </td>
                  <td>
                    <span className="history__duration">{item.duration}</span>
                  </td>
                  <td>
                    <button
                      className="history__delete-btn"
                      onClick={(e) => handleDelete(e, item.id)}
                      disabled={deletingId === item.id}
                      aria-label={`Delete ${item.audioFile}`}
                    >
                      {deletingId === item.id ? (
                        <span className="loader-spinner loader-spinner--small" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="history__count">
            Showing {filtered.length} of {history.length} analyses
          </p>
        </div>
      )}
    </div>
  )
}
