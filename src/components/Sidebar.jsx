import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ctLogo from '../assets/ct-logo.png'
import './Sidebar.css'

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Drift Scanner',
    path: '/dashboard',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
]


export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className={`sidebar-nav ${collapsed ? 'collapsed' : ''}`}>
      {/* Top: hamburger + logo */}
      <div className="sidebar-nav-top">
        <button
          className="sidebar-hamburger"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle navigation"
          id="sidebar-toggle"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {collapsed ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
        {!collapsed && (
          <div className="sidebar-nav-brand">
            <img src={ctLogo} alt="CloudThat" style={{ height: 32, objectFit: "contain" }} />
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="sidebar-nav-list">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path
          const isAvailable = item.path === '/dashboard'
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''} ${!isAvailable ? 'coming-soon' : ''}`}
              onClick={() => isAvailable ? navigate(item.path) : null}
              title={collapsed ? item.label : (isAvailable ? '' : `${item.label} — Coming Soon`)}
              id={`nav-${item.id}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {!collapsed && (
                <span className="sidebar-nav-label">
                  {item.label}
                  {!isAvailable && <span className="sidebar-badge-soon">Soon</span>}
                </span>
              )}
              {isActive && <div className="sidebar-active-indicator" />}
            </button>
          )
        })}
      </nav>

      {/* Bottom: user */}
      <div className="sidebar-nav-bottom">
        <button
          className="sidebar-nav-item sidebar-user-btn"
          onClick={() => navigate('/')}
          title="Sign Out"
          id="nav-signout"
        >
          <span className="sidebar-nav-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          {!collapsed && <span className="sidebar-nav-label">Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
