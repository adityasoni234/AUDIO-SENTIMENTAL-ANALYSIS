import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, Shield, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Profile.css'

function getInitials(email) {
  if (!email) return 'U'
  return email.charAt(0).toUpperCase()
}

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown'
  const date = new Date(parseInt(timestamp, 10))
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function Profile() {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const createdAt = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : 'Unknown'

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Profile</h1>
        <p className="page-subtitle">Your account information</p>
      </div>

      <div className="profile__container">
        {/* Avatar & name */}
        <div className="profile__hero">
          <div className="profile__avatar">
            {getInitials(currentUser?.email)}
          </div>
          <div className="profile__hero-info">
            <h2 className="profile__display-name">
              {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
            </h2>
            <p className="profile__email">{currentUser?.email}</p>
          </div>
        </div>

        {/* Details card */}
        <div className="card profile__details-card">
          <h3 className="profile__section-title">Account Details</h3>

          <div className="profile__field">
            <div className="profile__field-label">
              <Mail size={15} />
              Email Address
            </div>
            <div className="profile__field-value">{currentUser?.email}</div>
          </div>

          <div className="profile__field">
            <div className="profile__field-label">
              <Shield size={15} />
              Firebase UID
            </div>
            <div className="profile__field-value profile__field-value--mono">
              {currentUser?.uid}
            </div>
          </div>

          <div className="profile__field">
            <div className="profile__field-label">
              <Calendar size={15} />
              Account Created
            </div>
            <div className="profile__field-value">{createdAt}</div>
          </div>

          <div className="profile__field">
            <div className="profile__field-label">
              <Shield size={15} />
              Auth Provider
            </div>
            <div className="profile__field-value">Email &amp; Password</div>
          </div>
        </div>

        {/* Logout */}
        <div className="card profile__logout-card">
          <h3 className="profile__section-title">Session</h3>
          <p className="profile__logout-desc">
            You are currently signed in as <strong>{currentUser?.email}</strong>.
            Signing out will redirect you to the login page.
          </p>
          <button className="btn btn--danger" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
