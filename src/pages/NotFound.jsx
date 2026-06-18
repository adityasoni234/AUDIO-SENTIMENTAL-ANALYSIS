import { useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import './NotFound.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="notfound-page">
      <div className="notfound__content">
        <p className="notfound__number">404</p>
        <h1 className="notfound__title">Page not found</h1>
        <p className="notfound__message">
          Hmm, we couldn't find that page. It may have been moved, deleted, or the URL might be wrong.
        </p>
        <button className="btn btn--primary btn--large" onClick={() => navigate('/dashboard')}>
          <Home size={18} />
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
