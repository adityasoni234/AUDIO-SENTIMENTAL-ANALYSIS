import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { uploadAudio } from '../api/api'
import AudioUploader from '../components/AudioUploader'
import './UploadAudio.css'

export default function UploadAudio() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  function handleFileSelected(file) {
    setSelectedFile(file)
    setError('')
    setProgress(0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) {
      setError('Please select an audio file before submitting.')
      return
    }

    setError('')
    setLoading(true)
    setProgress(0)

    // Simulate progress animation while waiting
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          clearInterval(progressInterval)
          return 85
        }
        return prev + 5
      })
    }, 150)

    try {
      const result = await uploadAudio(selectedFile, currentUser.uid)
      clearInterval(progressInterval)
      setProgress(100)
      await new Promise((r) => setTimeout(r, 400))
      navigate(`/result/${result.id}`, { state: { resultId: result.id } })
    } catch (err) {
      clearInterval(progressInterval)
      setProgress(0)
      const msg = err?.response?.data?.error || ''
      if (err?.response?.status === 503 || msg.toLowerCase().includes('model not found') || msg.toLowerCase().includes('trained model')) {
        setError('⏳ Model is still training — please wait for it to finish and try again.')
      } else {
        setError('Upload failed. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Upload Audio</h1>
        <p className="page-subtitle">
          Upload an audio file to analyze its sentiment using AI.
        </p>
      </div>

      <div className="upload-page__container">
        <form onSubmit={handleSubmit} noValidate>
          <div className="upload-page__card">
            <AudioUploader
              onFileSelected={handleFileSelected}
              error={!selectedFile ? error : ''}
            />
          </div>

          {loading && (
            <div className="upload-page__progress">
              <div className="upload-page__progress-header">
                <span className="upload-page__progress-label">Analyzing audio…</span>
                <span className="upload-page__progress-pct">{progress}%</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-bar progress-bar--animated"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <p className="upload-page__progress-hint">
                Please don't close this tab while the analysis is running.
              </p>
            </div>
          )}

          {error && selectedFile && (
            <div className="alert alert--error" role="alert">{error}</div>
          )}

          <div className="upload-page__actions">
            <button
              type="submit"
              className="btn btn--primary btn--large"
              disabled={loading || !selectedFile}
            >
              {loading ? (
                <><span className="loader-spinner loader-spinner--small" />Analyzing…</>
              ) : (
                <><Upload size={18} />Analyze Audio</>
              )}
            </button>
          </div>
        </form>

        <div className="upload-page__tips">
          <h3 className="upload-page__tips-title">Tips for best results</h3>
          <ul className="upload-page__tips-list">
            <li>Use clear, noise-free recordings for higher accuracy.</li>
            <li>Files under 5 minutes yield the fastest results.</li>
            <li>Mono audio files process faster than stereo.</li>
            <li>Supported formats: MP3, WAV, M4A (max 50 MB).</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
