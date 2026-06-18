import { useNavigate } from 'react-router-dom'
import { Menu, Bell, User, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

function getInitials(email) {
  if (!email) return 'U'
  return email.charAt(0).toUpperCase()
}

export default function Navbar({ onMenuClick }) {
  const { currentUser, logout } = useAuth()
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <div className="navbar__left">
        <button className="navbar__menu-btn" onClick={onMenuClick} aria-label="Toggle sidebar">
          <Menu size={20} />
        </button>
        <div className="navbar__brand">
          <span className="navbar__brand-icon">🎙</span>
          <span className="navbar__brand-name">AudioSense</span>
        </div>
      </div>

      <div className="navbar__right">
        <button className="navbar__icon-btn" aria-label="Notifications">
          <Bell size={18} />
          <span className="navbar__badge">3</span>
        </button>

        <div className="navbar__user" ref={dropdownRef}>
          <button
            className="navbar__user-btn"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <div className="navbar__avatar">{getInitials(currentUser?.email)}</div>
            <span className="navbar__email">{currentUser?.email}</span>
            <ChevronDown size={14} className={`navbar__chevron ${dropdownOpen ? 'navbar__chevron--open' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="navbar__dropdown">
              <button
                className="navbar__dropdown-item"
                onClick={() => { navigate('/profile'); setDropdownOpen(false) }}
              >
                <User size={15} />
                Profile
              </button>
              <div className="navbar__dropdown-divider" />
              <button className="navbar__dropdown-item navbar__dropdown-item--danger" onClick={handleLogout}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
