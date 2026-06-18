import './Loader.css'

export default function Loader({ size = 'medium', text = '' }) {
  return (
    <div className={`loader-wrapper loader-wrapper--${size}`}>
      <div className={`loader-spinner loader-spinner--${size}`}></div>
      {text && <p className="loader-text">{text}</p>}
    </div>
  )
}
