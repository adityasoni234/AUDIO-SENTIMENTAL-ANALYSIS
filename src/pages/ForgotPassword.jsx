import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, CheckCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function ForgotPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldError('')

    if (!email.trim()) {
      setFieldError('Email is required')
      return
    }
    if (!validateEmail(email)) {
      setFieldError('Enter a valid email address')
      return
    }

    setLoading(true)
    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err) {
      const code = err.code
      if (code === 'auth/user-not-found') {
        setError('No account found with that email address.')
      } else if (code === 'auth/invalid-email') {
        setFieldError('Invalid email address.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a moment and try again.')
      } else {
        setError('Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <span className="auth-card__brand-icon">🎙</span>
          <h1 className="auth-card__brand-name">AudioSense</h1>
          <p className="auth-card__brand-tagline">Audio Sentiment Analysis Platform</p>
        </div>

        {success ? (
          <div className="auth-success">
            <div className="auth-success__icon">
              <CheckCircle size={48} />
            </div>
            <h2 className="auth-success__title">Check your inbox</h2>
            <p className="auth-success__message">
              We sent a password reset link to <strong>{email}</strong>. Check your spam folder if you don't see it.
            </p>
            <Link to="/login" className="btn btn--primary btn--full">
              Back to Sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="auth-card__title">Reset your password</h2>
            <p className="auth-card__subtitle">
              Enter the email address associated with your account and we'll send you a reset link.
            </p>

            {error && (
              <div className="alert alert--error" role="alert">
                {error}
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <div className={`input-wrapper ${fieldError ? 'input-wrapper--error' : ''}`}>
                  <Mail size={16} className="input-icon" />
                  <input
                    id="email"
                    type="email"
                    className="form-input form-input--icon"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldError('') }}
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
                {fieldError && <p className="field-error">{fieldError}</p>}
              </div>

              <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
                {loading
                  ? <><span className="loader-spinner loader-spinner--small" />Sending…</>
                  : 'Send reset link'}
              </button>
            </form>

            <p className="auth-card__footer">
              Remember your password?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
