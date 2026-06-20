import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Bell, Sun, AlertTriangle, LogOut, CheckCircle2, Loader2, XCircle, Cpu } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import './Settings.css'

export default function Settings() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [emailNotifications, setEmailNotifications] = useState(true)
  const [analysisAlerts, setAnalysisAlerts] = useState(false)
  const [apiStatus, setApiStatus] = useState('checking') // checking | live | model-training | error
  const [modelReady, setModelReady] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await axios.get(`${apiBaseUrl}/health`, { timeout: 4000 })
        setModelReady(res.data.model_ready)
        setApiStatus(res.data.model_ready ? 'live' : 'model-training')
      } catch {
        setApiStatus('error')
      }
    }
    checkHealth()
  }, [apiBaseUrl])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const statusBadge = () => {
    switch (apiStatus) {
      case 'checking':
        return (
          <span className="settings__status-badge settings__status-badge--checking">
            <Loader2 size={12} className="settings__spin" /> Checking…
          </span>
        )
      case 'live':
        return (
          <span className="settings__status-badge settings__status-badge--live">
            <CheckCircle2 size={12} /> Connected — Real data
          </span>
        )
      case 'model-training':
        return (
          <span className="settings__status-badge settings__status-badge--training">
            <Loader2 size={12} className="settings__spin" /> Connected — Model training
          </span>
        )
      case 'error':
        return (
          <span className="settings__status-badge settings__status-badge--error">
            <XCircle size={12} /> Backend unreachable
          </span>
        )
      default:
        return null
    }
  }

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
            <span className="settings__api-label">Backend Status</span>
            {statusBadge()}
          </div>
          <div className="settings__api-row">
            <span className="settings__api-label">Model</span>
            <span className={`settings__status-badge ${modelReady ? 'settings__status-badge--live' : 'settings__status-badge--training'}`}>
              <Cpu size={12} />
              {modelReady ? 'wav2vec2 + GradientBoosting — Ready' : 'wav2vec2 + GradientBoosting — Training…'}
            </span>
          </div>
          <div className="settings__api-row">
            <span className="settings__api-label">Dataset</span>
            <span className="settings__api-value">DAIC-WOZ (275 participants, PHQ-8)</span>
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
