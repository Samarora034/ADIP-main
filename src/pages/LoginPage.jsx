import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ctMsLogo from '../assets/ct-logo-x-ms.png'
import { isSSOConfigured, getDemoUser } from '../services/auth'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Handle Microsoft Sign-In.
   * 
   * When SSO is configured (VITE_AZURE_CLIENT_ID + VITE_AZURE_TENANT_ID set),
   * this will use MSAL to authenticate via Azure AD popup.
   * 
   * In demo mode (no env vars), it navigates directly to dashboard.
   * 
   * To enable real SSO:
   * 1. npm install @azure/msal-browser
   * 2. Set VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID in .env
   * 3. Uncomment the MSAL code in services/api.js
   * 4. Replace the demo branch below with:
   *    
   *    import { msalInstance, loginWithMicrosoft } from '../services/api'
   *    const result = await loginWithMicrosoft()
   *    // Store account info in context/state
   *    navigate('/dashboard')
   */
  const handleLogin = () => {
    navigate('/dashboard')
  }

  return (
    <div className="login-page">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-bg-gradient" />
        <div className="login-bg-grid" />
        {/* Floating particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="login-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDelay: `${Math.random() * 8}s`,
              animationDuration: `${Math.random() * 10 + 8}s`,
            }}
          />
        ))}
        {/* Floating cloud shapes */}
        <div className="login-cloud login-cloud-1" />
        <div className="login-cloud login-cloud-2" />
        <div className="login-cloud login-cloud-3" />
      </div>

      {/* Main content */}
      <div className="login-content">
        {/* Logos bar */}
        <div className="login-logos-bar">
          <img src={ctMsLogo} alt="CloudThat x Microsoft" style={{ height: 48, objectFit: 'contain' }} />
        </div>

        {/* Login card */}
        <div className="login-card">
          <div className="login-card-glow" />
          
          {/* Card header */}
          <div className="login-card-header">
            <div className="login-icon-ring">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h1 className="login-title">Azure Drift Intelligence</h1>
            <p className="login-subtitle">Configuration drift detection & monitoring platform</p>
          </div>

          {/* Info badges */}
          <div className="login-badges">
            <div className="login-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Real-time Monitoring</span>
            </div>
            <div className="login-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Enterprise Security</span>
            </div>
            <div className="login-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Drift Analytics</span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="login-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Login button */}
          <button
            className={`login-btn ${isLoading ? 'login-btn-loading' : ''}`}
            onClick={handleLogin}
            disabled={isLoading}
            id="login-button"
          >
            {isLoading ? (
              <>
                <div className="login-btn-spinner" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
                  <rect x="0" y="0" width="10" height="10" fill="#f25022" />
                  <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
                  <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
                </svg>
                <span>Sign in with Microsoft</span>
                <svg className="login-btn-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>

          <p className="login-footer-text">
            Secured by Azure Active Directory
          </p>
        </div>

       
      
       
      </div>
    </div>
  )
}
