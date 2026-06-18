import { useState, useRef, useCallback } from 'react'
import { Upload, FileAudio, X, CheckCircle } from 'lucide-react'
import './AudioUploader.css'

const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4', 'audio/m4a']
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.m4a']
const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function validateFile(file) {
  const isValidType =
    ACCEPTED_TYPES.includes(file.type) ||
    ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
  if (!isValidType) {
    return 'Invalid file type. Please upload an MP3, WAV, or M4A file.'
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large. Maximum allowed size is 50 MB (your file: ${formatFileSize(file.size)}).`
  }
  return null
}

export default function AudioUploader({ onFileSelected, error: externalError }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [validationError, setValidationError] = useState('')
  const fileInputRef = useRef(null)
  const audioRef = useRef(null)

  const handleFile = useCallback((selectedFile) => {
    setValidationError('')
    const err = validateFile(selectedFile)
    if (err) {
      setValidationError(err)
      setFile(null)
      onFileSelected(null)
      return
    }
    setFile(selectedFile)
    onFileSelected(selectedFile)
  }, [onFileSelected])

  function handleInputChange(e) {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  function handleRemove() {
    setFile(null)
    setValidationError('')
    onFileSelected(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const displayError = validationError || externalError

  return (
    <div className="audio-uploader">
      {!file ? (
        <div
          className={`audio-uploader__dropzone ${dragOver ? 'audio-uploader__dropzone--active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Click or drag to upload audio file"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <div className="audio-uploader__drop-icon">
            <Upload size={36} />
          </div>
          <p className="audio-uploader__drop-title">
            {dragOver ? 'Drop your audio file here' : 'Drag & drop your audio file here'}
          </p>
          <p className="audio-uploader__drop-subtitle">or click to browse</p>
          <p className="audio-uploader__drop-hint">Supports MP3, WAV, M4A — up to 50 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/x-m4a"
            className="audio-uploader__input"
            onChange={handleInputChange}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      ) : (
        <div className="audio-uploader__preview">
          <div className="audio-uploader__preview-header">
            <div className="audio-uploader__file-info">
              <div className="audio-uploader__file-icon">
                <FileAudio size={24} />
              </div>
              <div>
                <p className="audio-uploader__filename">{file.name}</p>
                <p className="audio-uploader__filesize">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <div className="audio-uploader__preview-actions">
              <span className="audio-uploader__ready-badge">
                <CheckCircle size={14} />
                Ready
              </span>
              <button
                className="audio-uploader__remove-btn"
                onClick={handleRemove}
                aria-label="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <audio
            ref={audioRef}
            controls
            src={URL.createObjectURL(file)}
            className="audio-uploader__player"
          />
        </div>
      )}

      {displayError && (
        <div className="audio-uploader__error" role="alert">
          {displayError}
        </div>
      )}
    </div>
  )
}
