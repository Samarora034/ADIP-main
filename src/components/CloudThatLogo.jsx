import React from 'react'

export default function CloudThatLogo({ variant = 'full', size = 'md', color = 'dark' }) {
  const sizes = {
    sm: { icon: 32, text: 14 },
    md: { icon: 48, text: 20 },
    lg: { icon: 72, text: 32 },
    xl: { icon: 96, text: 42 },
  }

  const s = sizes[size] || sizes.md
  const isDark = color === 'dark'
  const cloudColor = isDark ? '#8e9baa' : '#ffffff'
  const arrowColor = isDark ? '#20629b' : '#ffffff'
  const textCloudColor = isDark ? '#20629b' : '#ffffff'
  const textThatColor = isDark ? '#8e9baa' : 'rgba(255,255,255,0.8)'
  const taglineColor = isDark ? '#1995ff' : 'rgba(255,255,255,0.9)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: s.icon * 0.3 }}>
      {/* Cloud Icon with Arrow */}
      <svg width={s.icon} height={s.icon * 0.75} viewBox="0 0 120 90" fill="none">
        {/* Cloud outline */}
        <path
          d="M95 55c0-16.5-13.5-30-30-30-12 0-22.5 7-27.5 17.5C25 42 15 51.5 15 63.5 15 76 25 86 37.5 86H90c11 0 20-9 20-20s-9-20-15-11"
          stroke={cloudColor}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        {/* Arrow */}
        <path
          d="M30 58 L70 58 L55 43"
          stroke={arrowColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M70 58 L85 38"
          stroke={arrowColor}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {variant === 'full' && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <div style={{ fontSize: s.text, fontWeight: 300, letterSpacing: '-0.02em' }}>
            <span style={{ color: textCloudColor }}>cloud</span>
            <span style={{ color: textThatColor }}>that</span>
          </div>
          <div style={{
            fontSize: s.text * 0.45,
            fontWeight: 600,
            color: taglineColor,
            letterSpacing: '0.05em',
            marginTop: 2
          }}>
            move up
          </div>
        </div>
      )}
    </div>
  )
}
