import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Mic,
  History,
  User,
  Settings,
  X,
  BarChart2,
} from 'lucide-react'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/upload', label: 'Upload Audio', icon: Upload },
  { to: '/record', label: 'Record Audio', icon: Mic },
  { to: '/history', label: 'History', icon: History },
]

const BOTTOM_ITEMS = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {isOpen && <div className="sidebar__overlay" onClick={onClose} aria-hidden="true" />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__header">
          <div className="sidebar__brand">
            <span className="sidebar__brand-icon">🎙</span>
            <span className="sidebar__brand-name">AudioSense</span>
          </div>
          <button className="sidebar__close-btn" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        <div className="sidebar__section-label">Main Menu</div>
        <nav className="sidebar__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
              onClick={onClose}
            >
              <Icon size={18} className="sidebar__nav-icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__divider" />
        <div className="sidebar__section-label">Account</div>
        <nav className="sidebar__nav">
          {BOTTOM_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
              }
              onClick={onClose}
            >
              <Icon size={18} className="sidebar__nav-icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <BarChart2 size={14} />
          <span>AudioSense v1.0.0</span>
        </div>
      </aside>
    </>
  )
}
