import { Inbox } from 'lucide-react'
import './EmptyState.css'

export default function EmptyState({ title = 'No data yet', description = '', action = null }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Inbox size={48} />
      </div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
