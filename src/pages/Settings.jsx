import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Bell, Sun, AlertTriangle, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Settings.css'

export default function Settings() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [analysisAlerts, setAnalysisAlerts] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your application preferences.</p>
      </div>

      <div className="settings__container">
        {/* API Config */}
        <div className="card settings__card">
          <div className="settings__card-header">
            <Globe size={18} />
            <h3 className="settings__card-title">API Configuration</h3>
          </div>
          <p className="settings__card-desc">
            The backend API URL is configured via environment variables and cannot be changed here.
          </p>
          <div className="settings__api-row">
            <span className="settings__api-label">API Base URL</span>
            <span className="settings__api-value">{apiBaseUrl}</span>
          </div>
          <div className="settings__api-row">
            <span className="settings__api-label">Status</span>
            <span className="settings__status-badge settings__status-badge--mock">
              Using mock data
            </span>
          </div>
        </div>

        {/* Notifications */}
        <div className="card settings__card">
          <div className="settings__card-header">
            <Bell size={18} />
            <h3 className="settings__card-title">Notifications</h3>
          </div>
          <p className="settings__card-desc">
            Choose which notifications you'd like to receive. These settings are stored locally.
          </p>

          <div className="settings__toggle-row">
            <div>
              <p className="settings__toggle-label">Email Notifications</p>
              <p className="settings__toggle-desc">Receive email summaries of completed analyses.</p>
            </div>
            <button
              className={`toggle-switch ${emailNotifications ? 'toggle-switch--on' : ''}`}
              onClick={() => setEmailNotifications((p) => !p)}
              role="switch"
              aria-checked={emailNotifications}
              aria-label="Toggle email notifications"
            >
              <span className="toggle-switch__thumb" />
            </button>
          </div>

          <div className="settings__toggle-row">
            <div>
              <p className="settings__toggle-label">Analysis Complete Alerts</p>
              <p className="settings__toggle-desc">Get notified when an analysis finishes.</p>
            </div>
            <button
              className={`toggle-switch ${analysisAlerts ? 'toggle-switch--on' : ''}`}
              onClick={() => setAnalysisAlerts((p) => !p)}
              role="switch"
              aria-checked={analysisAlerts}
              aria-label="Toggle analysis alerts"
            >
              <span className="toggle-switch__thumb" />
            </button>
          </div>
        </div>

        {/* Theme */}
        <div className="card settings__card">
          <div className="settings__card-header">
            <Sun size={18} />
            <h3 className="settings__card-title">Appearance</h3>
          </div>
          <p className="settings__card-desc">
            Customize the look of your AudioSense interface.
          </p>
          <div className="settings__theme-row">
            <div className="settings__theme-option settings__theme-option--active">
              <Sun size={16} />
              <span>Light Mode</span>
              <span className="settings__theme-lock">Active</span>
            </div>
            <p className="settings__theme-note">
              Dark mode is not available in this version.
            </p>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card settings__card settings__card--danger">
          <div className="settings__card-header">
            <AlertTriangle size={18} />
            <h3 className="settings__card-title">Danger Zone</h3>
          </div>
          <p className="settings__card-desc">
            Actions here cannot be undone. Proceed with caution.
          </p>
          <button className="btn btn--danger" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out of AudioSense
          </button>
        </div>
      </div>
    </div>
  )
}
