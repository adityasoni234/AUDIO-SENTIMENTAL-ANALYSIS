import { useNavigate } from 'react-router-dom'
import { Calendar, Clock, HardDrive, ChevronRight } from 'lucide-react'
import './ResultCard.css'

function formatDate(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sentimentClass(sentiment) {
  const map = { POSITIVE: 'badge--positive', NEGATIVE: 'badge--negative', NEUTRAL: 'badge--neutral' }
  return map[sentiment] || 'badge--neutral'
}

export default function ResultCard({ result }) {
  const navigate = useNavigate()

  function handleClick() {
    navigate(`/result/${result.id}`, { state: { result } })
  }

  return (
    <div className="result-card" onClick={handleClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}>
      <div className="result-card__main">
        <p className="result-card__filename">{result.audioFile}</p>
        <div className="result-card__meta">
          <span className="result-card__meta-item">
            <Calendar size={13} />
            {formatDate(result.analyzedAt)}
          </span>
          <span className="result-card__meta-item">
            <Clock size={13} />
            {result.duration}
          </span>
          <span className="result-card__meta-item">
            <HardDrive size={13} />
            {result.fileSize}
          </span>
        </div>
      </div>
      <div className="result-card__right">
        <span className={`badge ${sentimentClass(result.sentiment)}`}>{result.sentiment}</span>
        <span className="result-card__confidence">{result.confidence}%</span>
        <ChevronRight size={16} className="result-card__arrow" />
      </div>
    </div>
  )
}
