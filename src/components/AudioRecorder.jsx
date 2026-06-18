import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, Square, RotateCcw, AlertCircle } from 'lucide-react'
import './AudioRecorder.css'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function AudioRecorder({ onRecordingComplete, onReset }) {
  const [status, setStatus] = useState('idle') // idle | requesting | recording | stopped | error
  const [elapsed, setElapsed] = useState(0)
  const [audioUrl, setAudioUrl] = useState(null)
  const [permissionError, setPermissionError] = useState('')

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  const startRecording = useCallback(async () => {
    setPermissionError('')
    setStatus('requesting')
    setElapsed(0)
    setAudioUrl(null)
    onReset?.()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setStatus('stopped')
        onRecordingComplete(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start(250)
      setStatus('recording')

      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      setStatus('error')
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError(
          'Microphone access was denied. Please allow microphone permissions in your browser settings and try again.'
        )
      } else if (err.name === 'NotFoundError') {
        setPermissionError('No microphone found. Please connect a microphone and try again.')
      } else {
        setPermissionError('Could not access your microphone. Please check your device settings.')
      }
    }
  }, [onRecordingComplete, onReset])

  function stopRecording() {
    clearInterval(timerRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  function handleReset() {
    setStatus('idle')
    setElapsed(0)
    setAudioUrl(null)
    setPermissionError('')
    chunksRef.current = []
    onReset?.()
  }

  return (
    <div className="audio-recorder">
      {permissionError && (
        <div className="audio-recorder__error" role="alert">
          <AlertCircle size={16} />
          <span>{permissionError}</span>
        </div>
      )}

      <div className="audio-recorder__stage">
        <div className={`audio-recorder__mic-wrap ${status === 'recording' ? 'audio-recorder__mic-wrap--pulsing' : ''}`}>
          <div className="audio-recorder__mic-icon">
            <Mic size={36} />
          </div>
        </div>

        <div className="audio-recorder__timer">
          {status === 'recording' && (
            <span className="audio-recorder__recording-dot" aria-hidden="true" />
          )}
          <span className="audio-recorder__time">{formatTime(elapsed)}</span>
        </div>

        <p className="audio-recorder__status-text">
          {status === 'idle' && 'Click the button below to start recording'}
          {status === 'requesting' && 'Requesting microphone access…'}
          {status === 'recording' && 'Recording in progress…'}
          {status === 'stopped' && 'Recording complete — preview below'}
          {status === 'error' && 'Could not start recording'}
        </p>
      </div>

      <div className="audio-recorder__controls">
        {(status === 'idle' || status === 'error') && (
          <button className="btn btn--primary btn--large" onClick={startRecording}>
            <Mic size={18} />
            Start Recording
          </button>
        )}

        {status === 'requesting' && (
          <button className="btn btn--primary btn--large" disabled>
            <span className="loader-spinner loader-spinner--small" />
            Requesting access…
          </button>
        )}

        {status === 'recording' && (
          <button className="btn btn--danger btn--large" onClick={stopRecording}>
            <Square size={18} />
            Stop Recording
          </button>
        )}

        {status === 'stopped' && (
          <button className="btn btn--outline" onClick={handleReset}>
            <RotateCcw size={16} />
            Record Again
          </button>
        )}
      </div>

      {audioUrl && status === 'stopped' && (
        <div className="audio-recorder__playback">
          <p className="audio-recorder__playback-label">Preview your recording:</p>
          <audio controls src={audioUrl} className="audio-recorder__player" />
        </div>
      )}
    </div>
  )
}
