import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import UploadAudio from './pages/UploadAudio'
import RecordAudio from './pages/RecordAudio'
import Result from './pages/Result'
import History from './pages/History'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import CompareResult from './pages/CompareResult'
import NotFound from './pages/NotFound'
import './styles/variables.css'
import './App.css'

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={`app-main ${sidebarOpen ? 'app-main--sidebar-open' : ''}`}>
        <Navbar onMenuClick={() => setSidebarOpen((prev) => !prev)} />
        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected dashboard routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={<DashboardLayout><Dashboard /></DashboardLayout>}
        />
        <Route
          path="/upload"
          element={<DashboardLayout><UploadAudio /></DashboardLayout>}
        />
        <Route
          path="/record"
          element={<DashboardLayout><RecordAudio /></DashboardLayout>}
        />
        <Route
          path="/result/:id"
          element={<DashboardLayout><Result /></DashboardLayout>}
        />
        <Route
          path="/history"
          element={<DashboardLayout><History /></DashboardLayout>}
        />
        <Route
          path="/profile"
          element={<DashboardLayout><Profile /></DashboardLayout>}
        />
        <Route
          path="/settings"
          element={<DashboardLayout><Settings /></DashboardLayout>}
        />
        <Route
          path="/compare"
          element={<DashboardLayout><CompareResult /></DashboardLayout>}
        />
      </Route>

      {/* Default redirects */}
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
