import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Cpu, TreePine, Network, BarChart2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { uploadAudio, compareModels } from '../api/api'
import AudioUploader from '../components/AudioUploader'
import './UploadAudio.css'

const MODEL_OPTIONS = [
  { id: 'xgboost', label: 'XGBoost',       accuracy: '93.76%',   desc: 'Highest accuracy — recommended', icon: Cpu      },
  { id: 'rf',      label: 'Random Forest', accuracy: '80.18%',   desc: 'Fast · interpretable',           icon: TreePine  },
  { id: 'cnn',     label: 'CNN (1D)',      accuracy: 'Training…',desc: 'Deep learning · wav2vec2',       icon: Network   },
]

export default function UploadAudio() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading]     = useState(false)
  const [comparing, setComparing] = useState(false)
  const [error, setError]         = useState('')
  const [progress, setProgress]   = useState(0)
  const [modelChoice, setModelChoice] = useState('xgboost')

  function handleFileSelected(file) {
    setSelectedFile(file)
    setError('')
    setProgress(0)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!selectedFile) { setError('Please select an audio file before submitting.'); return }
    setError(''); setLoading(true); setProgress(0)

    const iv = setInterval(() => {
      setProgress(p => { if (p >= 85) { clearInterval(iv); return 85 } return p + 5 })
    }, 150)

    try {
      const result = await uploadAudio(selectedFile, currentUser.uid, modelChoice)
      clearInterval(iv); setProgress(100)
      await new Promise(r => setTimeout(r, 400))
      navigate(`/result/${result.id}`, { state: { resultId: result.id, result: result.result } })
    } catch (err) {
      clearInterval(iv); setProgress(0)
      const msg = err?.response?.data?.error || ''
      setError(
        err?.response?.status === 503 || msg.toLowerCase().includes('model not found')
          ? '⏳ Model is still training — please wait and try again.'
          : 'Upload failed. Please check your connection and try again.'
      )
    } finally { setLoading(false) }
  }

  async function handleCompare() {
    if (!selectedFile) { setError('Please select an audio file first.'); return }
    setError(''); setComparing(true)
    try {
      const result = await compareModels(selectedFile, currentUser.uid)
      navigate('/compare', { state: { compareResult: result } })
    } catch (err) {
      setError('Comparison failed. Make sure the backend is running.')
    } finally { setComparing(false) }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Upload Audio</h1>
        <p className="page-subtitle">Upload an audio file to analyze for depression indicators using AI.</p>
      </div>

      <div className="upload-page__container">
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
                  <span className="model-selector__option-meta">{accuracy} · {desc}</span>
                </div>
                {modelChoice === id && <span className="model-selector__check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="upload-page__card">
            <AudioUploader onFileSelected={handleFileSelected} error={!selectedFile ? error : ''} />
          </div>

          {loading && (
            <div className="upload-page__progress">
              <div className="upload-page__progress-header">
                <span className="upload-page__progress-label">Analyzing audio…</span>
                <span className="upload-page__progress-pct">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-bar progress-bar--animated" style={{ width: `${progress}%` }}
                     role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
              </div>
              <p className="upload-page__progress-hint">Please don't close this tab while analysis is running.</p>
            </div>
          )}

          {error && selectedFile && <div className="alert alert--error" role="alert">{error}</div>}

          <div className="upload-page__actions">
            <button type="submit" className="btn btn--primary btn--large" disabled={loading || comparing || !selectedFile}>
              {loading
                ? <><span className="loader-spinner loader-spinner--small" />Analyzing…</>
                : <><Upload size={18} />Analyze Audio</>}
            </button>

            <button type="button" className="btn btn--outline btn--large upload-page__compare-btn"
                    onClick={handleCompare} disabled={loading || comparing || !selectedFile}>
              {comparing
                ? <><span className="loader-spinner loader-spinner--small loader-spinner--dark" />Comparing…</>
                : <><BarChart2 size={18} />Compare All 3 Models</>}
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
