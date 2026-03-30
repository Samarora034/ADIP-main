import React from 'react'

export default function MicrosoftLogo({ size = 'md', showText = true }) {
  const sizes = {
    sm: 14,
    md: 20,
    lg: 28,
    xl: 36,
  }

  const s = sizes[size] || sizes.md

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s * 0.6 }}>
      {/* Microsoft 4-square logo */}
      <svg width={s} height={s} viewBox="0 0 21 21" fill="none">
        <rect x="0" y="0" width="10" height="10" fill="#f25022" />
        <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
        <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
        <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
      </svg>
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{
            fontSize: s * 0.85,
            fontWeight: 600,
            color: '#2d3748',
            letterSpacing: '-0.01em'
          }}>
            Microsoft
          </span>
          <span style={{
            fontSize: s * 0.7,
            fontWeight: 500,
            color: '#4a5568',
            letterSpacing: '0.01em'
          }}>
            Azure
          </span>
        </div>
      )}
    </div>
  )
}
