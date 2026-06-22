import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Cpu, TreePine } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { submitRecordedAudio } from '../api/api'
import AudioRecorder from '../components/AudioRecorder'
import './RecordAudio.css'

const MODEL_OPTIONS = [
  { id: 'xgboost', label: 'XGBoost',       accuracy: '93.76%', desc: 'Higher accuracy — recommended', icon: Cpu },
  { id: 'rf',      label: 'Random Forest',  accuracy: '80.18%', desc: 'Faster, interpretable',         icon: TreePine },
]

export default function RecordAudio() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [recordedBlob, setRecordedBlob] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [modelChoice, setModelChoice] = useState('xgboost')

  const handleRecordingComplete = useCallback((blob) => {
    setRecordedBlob(blob)
    setError('')
  }, [])

  const handleReset = useCallback(() => {
    setRecordedBlob(null)
    setError('')
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!recordedBlob) {
      setError('No recording found. Please record audio before submitting.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const result = await submitRecordedAudio(recordedBlob, currentUser.uid, modelChoice)
      navigate(`/result/${result.id}`, { state: { resultId: result.id, result: result.result } })
    } catch (err) {
      const msg = err?.response?.data?.error || ''
      if (err?.response?.status === 503 || msg.toLowerCase().includes('model not found') || msg.toLowerCase().includes('trained model')) {
        setError('⏳ Model is still training — please wait for it to finish and try again.')
      } else {
        setError('Submission failed. Please check your connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Record Audio</h1>
        <p className="page-subtitle">
          Record directly from your microphone and analyze sentiment in real time.
        </p>
      </div>

      <div className="record-page__container">
        {/* Model selector */}
        <div className="model-selector">
          <p className="model-selector__label">Select Model</p>
          <div className="model-selector__options">
            {MODEL_OPTIONS.map(({ id, label, accuracy, desc, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`model-selector__option${modelChoice === id ? ' model-selector__option--active' : ''}`}
                onClick={() => setModelChoice(id)}
              >
                <Icon size={18} />
                <div className="model-selector__option-text">
                  <span className="model-selector__option-name">{label}</span>
                  <span className="model-selector__option-meta">{accuracy} accuracy · {desc}</span>
                </div>
                {modelChoice === id && <span className="model-selector__check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="record-page__card">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onReset={handleReset}
          />
        </div>

        {error && (
          <div className="alert alert--error" role="alert">{error}</div>
        )}

        {recordedBlob && (
          <form onSubmit={handleSubmit} noValidate>
            <div className="record-page__submit">
              <button
                type="submit"
                className="btn btn--primary btn--large"
                disabled={loading}
              >
                {loading ? (
                  <><span className="loader-spinner loader-spinner--small" />Analyzing…</>
                ) : (
                  <><Send size={18} />Submit for Analysis</>
                )}
              </button>
            </div>
          </form>
        )}

        <div className="record-page__tips">
          <h3 className="record-page__tips-title">Recording tips</h3>
          <ul className="record-page__tips-list">
            <li>Speak clearly and at a steady pace for best accuracy.</li>
            <li>Minimize background noise — quiet environments work best.</li>
            <li>Keep your microphone 20–30 cm from your mouth.</li>
            <li>Recordings of 10 seconds or more yield more reliable results.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
