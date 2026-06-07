import React from 'react'

const C = {
  BG: '#F2EDE4',
  SURFACE: '#FFFFFF',
  PRIMARY: '#2D4A35',
  ACCENT: '#C4532A',
  MUTED: '#8A8A8A',
}

const TAGS = ['#productivity', '#deep-work', '#focus', '#career', '#books', '#long-read']

function StatusBarLight() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 59, display: 'flex', alignItems: 'flex-end', padding: '0 24px 8px', zIndex: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: 'white' }}>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
            <rect x="0" y="4" width="3" height="7" rx="1" fill="white" />
            <rect x="4.5" y="2.5" width="3" height="8.5" rx="1" fill="white" />
            <rect x="9" y="0.5" width="3" height="10.5" rx="1" fill="white" />
            <rect x="13.5" y="3" width="2.5" height="8" rx="1" fill="white" opacity="0.4" />
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11">
            <circle cx="7.5" cy="10" r="1.3" fill="white" />
            <path d="M4.5 7C5.5 5.9 6.4 5.4 7.5 5.4s2 .5 3 1.6" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <path d="M1.5 4C3.2 2 5.2 1 7.5 1S11.8 2 13.5 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 24, height: 12, border: '1.5px solid white', borderRadius: 3, padding: 1.5 }}>
              <div style={{ width: '80%', height: '100%', background: 'white', borderRadius: 1.5 }} />
            </div>
            <div style={{ width: 2, height: 6, background: 'white', borderRadius: 1, marginLeft: 1, opacity: 0.4 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LinkDetailScreen() {
  return (
    <div style={{ width: 390, height: 844, background: C.BG, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Hero image */}
      <div style={{ height: 290, position: 'relative', flexShrink: 0 }}>
        <img
          src="https://picsum.photos/seed/hero1/390/290"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 40%, rgba(0,0,0,0.4) 100%)',
        }} />
        <StatusBarLight />
        {/* Back */}
        <button style={{
          position: 'absolute', top: 63, left: 16, zIndex: 10,
          width: 34, height: 34, borderRadius: 999,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* Share */}
        <button style={{
          position: 'absolute', top: 63, right: 16, zIndex: 10,
          width: 34, height: 34, borderRadius: 999,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', cursor: 'pointer',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v8M5 5l3-3 3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 10v4h10v-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Body — all left-aligned, consistent 20px horizontal padding */}
      <div className="no-scroll" style={{ flex: 1, overflowY: 'auto', padding: '22px 20px 32px' }}>

        {/* Title */}
        <p style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 24, color: C.PRIMARY, lineHeight: 1.35, marginBottom: 14,
        }}>
          <span style={{ color: C.ACCENT }}>why </span>deep work is the real competitive advantage
        </p>

        {/* Source */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 5, background: '#1A1A1A',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="2" />
              <path d="M10 6v4l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontFamily: 'Inter', fontSize: 13, color: C.MUTED }}>youtube.com</span>
        </div>

        {/* Summary */}
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: C.PRIMARY, lineHeight: 1.7, marginBottom: 20, opacity: 0.82 }}>
          Cal Newport argues that the ability to focus without distraction is becoming increasingly rare — and simultaneously more valuable. A compelling case for restructuring how you spend your working hours.
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
          {TAGS.map(tag => (
            <div key={tag} style={{
              background: C.SURFACE,
              border: `1px solid ${C.PRIMARY}18`,
              borderRadius: 999, padding: '5px 13px',
            }}>
              <span style={{ fontFamily: 'Inter', fontSize: 12, color: C.ACCENT }}>{tag}</span>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: `${C.PRIMARY}12`, marginBottom: 18 }} />

        {/* Reminder */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28,
        }}>
          <div>
            <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: C.PRIMARY }}>Nudge me</p>
            <p style={{ fontFamily: 'Inter', fontSize: 12, color: C.MUTED, marginTop: 3 }}>Send me a gentle poke to come back to this</p>
          </div>
          <div style={{ width: 44, height: 26, background: '#D9D9D9', borderRadius: 13, position: 'relative', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', top: 3, left: 3, width: 20, height: 20,
              background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </div>
        </div>

        {/* Open button — full-width, intentionally centred text inside */}
        <div style={{
          background: C.PRIMARY, borderRadius: 14, padding: '15px 20px',
          textAlign: 'left', marginBottom: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 500, color: 'white' }}>Open link</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Delete — left-aligned, not centred */}
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#D94F3D', cursor: 'pointer', textAlign: 'center' }}>Delete</p>
      </div>
    </div>
  )
}
