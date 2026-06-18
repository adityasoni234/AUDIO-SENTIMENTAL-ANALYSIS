import './StatCard.css'

export default function StatCard({ title, value, icon: Icon, color, subtitle = '' }) {
  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <div className="stat-card__info">
          <p className="stat-card__title">{title}</p>
          <p className="stat-card__value">{value}</p>
          {subtitle && <p className="stat-card__subtitle">{subtitle}</p>}
        </div>
        <div className={`stat-card__icon stat-card__icon--${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}
