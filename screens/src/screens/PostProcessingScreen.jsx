import React from 'react'

const C = {
  BG: '#F2EDE4',
  SURFACE: '#FFFFFF',
  PRIMARY: '#2D4A35',
  ACCENT: '#C4532A',
  MUTED: '#8A8A8A',
}

const TAGS_AI = ['#productivity', '#deep-work', '#focus', '#career', '#books', '#long-read', '#cal-newport', '#knowledge', '#habits', '#performance']

function Tag({ label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: `${C.ACCENT}10`, border: `1px solid ${C.ACCENT}28`,
      borderRadius: 999, padding: '4px 10px',
    }}>
      <span style={{ fontFamily: 'Inter', fontSize: 12, color: C.ACCENT }}>{label}</span>
      <span style={{ fontFamily: 'Inter', fontSize: 12, color: C.ACCENT, opacity: 0.5, lineHeight: 1 }}>×</span>
    </div>
  )
}

export default function PostProcessingScreen() {
  return (
    <div style={{ width: 390, height: 844, background: C.BG, position: 'relative', overflow: 'hidden' }}>

      {/* Background: ghost of the home screen */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <div style={{ height: 59, background: C.BG, display: 'flex', alignItems: 'flex-end', padding: '0 28px 8px' }}>
          <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: C.PRIMARY }}>9:41</span>
        </div>
        <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[22, 15, 22].map((w, i) => <div key={i} style={{ width: w, height: 2, background: C.PRIMARY, borderRadius: 1 }} />)}
          </div>
          <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 30, color: C.PRIMARY }}>Shelf</span>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="9.5" cy="9.5" r="7" stroke={C.PRIMARY} strokeWidth="2" />
            <line x1="15" y1="15" x2="20.5" y2="20.5" stroke={C.PRIMARY} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ padding: '0 20px', display: 'flex', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ flex: 1, borderRadius: 12, aspectRatio: '1/1', background: `${C.PRIMARY}08` }} />
          ))}
        </div>
      </div>

      {/* Blur overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(18, 28, 20, 0.42)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 10,
      }} />

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 668,
        background: C.SURFACE,
        borderRadius: '24px 24px 0 0',
        zIndex: 20,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#DEDEDE', borderRadius: 2 }} />
        </div>

        {/* Title */}
        <div style={{ padding: '6px 24px 16px', borderBottom: `1px solid ${C.PRIMARY}10`, flexShrink: 0 }}>
          <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 20, color: C.PRIMARY }}>
            Review & save
          </p>
        </div>

        {/* Form */}
        <div className="no-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 8px' }}>

          {/* Name */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: C.MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>Name</p>
            <div style={{ background: C.BG, border: `1.5px solid ${C.PRIMARY}15`, borderRadius: 10, padding: '11px 13px' }}>
              <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 15, color: C.PRIMARY }}>
                why deep work is the real competitive advantage
              </span>
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: C.MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>Tags</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TAGS_AI.map(t => <Tag key={t} label={t} />)}
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: `${C.PRIMARY}10`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: 'Inter', fontSize: 16, color: C.PRIMARY, lineHeight: 1 }}>+</span>
              </div>
            </div>
          </div>

          {/* Project */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: C.MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>Project</p>
            <div style={{
              background: C.BG, border: `1.5px solid ${C.PRIMARY}15`, borderRadius: 10,
              padding: '11px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontFamily: 'Inter', fontSize: 14, color: C.MUTED }}>Select a project…</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 5l3 3 3-3" stroke={C.MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Source */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: C.MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>Source</p>
            <div style={{ background: `${C.PRIMARY}06`, border: `1.5px solid ${C.PRIMARY}10`, borderRadius: 10, padding: '11px 13px' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: C.MUTED }}>youtube.com/watch?v=ioNqpJGrfVM</span>
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, color: C.MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 7 }}>Summary</p>
            <div style={{ background: `${C.PRIMARY}06`, border: `1.5px solid ${C.PRIMARY}10`, borderRadius: 10, padding: '11px 13px' }}>
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: C.PRIMARY, lineHeight: 1.65, opacity: 0.75 }}>
                Cal Newport argues that the ability to focus without distraction is becoming rare — and more valuable. A compelling case for restructuring how you spend your working hours.
              </span>
            </div>
          </div>

          {/* Reminder */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
            <div>
              <p style={{ fontFamily: 'Inter', fontSize: 14, fontWeight: 500, color: C.PRIMARY }}>Nudge me</p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: C.MUTED, marginTop: 2 }}>Send me a gentle poke to come back to this</p>
            </div>
            <div style={{ width: 44, height: 26, background: C.PRIMARY, borderRadius: 13, position: 'relative', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', top: 3, right: 3, width: 20, height: 20,
                background: 'white', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div style={{ padding: '12px 24px 28px', flexShrink: 0 }}>
          <div style={{ background: C.PRIMARY, borderRadius: 14, padding: '15px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 500, color: 'white' }}>Save to Shelf</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
