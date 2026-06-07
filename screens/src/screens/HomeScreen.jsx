import React from 'react'

const C = {
  BG: '#F2EDE4',
  SURFACE: '#FFFFFF',
  PRIMARY: '#2D4A35',
  ACCENT: '#C4532A',
  MUTED: '#8A8A8A',
}

// Diverse bookmarks — not recipes
const THIS_WEEK = [
  { descriptor: 'why', title: 'deep work is the real competitive advantage', duration: '12m', img: 'https://picsum.photos/seed/lnk1/300/300' },
  { descriptor: 'building', title: 'a personal knowledge base that actually works', duration: '8m', img: 'https://picsum.photos/seed/lnk2/300/300' },
  { descriptor: 'the best', title: 'VS Code extensions for 2025', duration: '6m', img: 'https://picsum.photos/seed/lnk3/300/300' },
]

const LAST_WEEK = [
  { descriptor: 'how to', title: 'negotiate a higher salary (scripts included)', duration: '18m', img: 'https://picsum.photos/seed/lnk4/300/300' },
  { descriptor: 'understanding', title: 'compound interest visually', duration: '5m', img: 'https://picsum.photos/seed/lnk5/300/300' },
  { descriptor: 'react 19', title: 'new features deep dive', duration: '22m', img: 'https://picsum.photos/seed/lnk6/300/300' },
]

function StatusBar() {
  return (
    <div style={{ height: 59, background: C.BG, display: 'flex', alignItems: 'flex-end', padding: '0 28px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 15, color: C.PRIMARY }}>9:41</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
            <rect x="0" y="4" width="3" height="7" rx="1" fill={C.PRIMARY} />
            <rect x="4.5" y="2.5" width="3" height="8.5" rx="1" fill={C.PRIMARY} />
            <rect x="9" y="0.5" width="3" height="10.5" rx="1" fill={C.PRIMARY} />
            <rect x="13.5" y="3" width="2.5" height="8" rx="1" fill={C.PRIMARY} opacity="0.3" />
          </svg>
          <svg width="15" height="11" viewBox="0 0 15 11">
            <circle cx="7.5" cy="10" r="1.3" fill={C.PRIMARY} />
            <path d="M4.5 7C5.5 5.9 6.4 5.4 7.5 5.4s2 .5 3 1.6" stroke={C.PRIMARY} strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <path d="M1.5 4C3.2 2 5.2 1 7.5 1S11.8 2 13.5 4" stroke={C.PRIMARY} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 24, height: 12, border: `1.5px solid ${C.PRIMARY}`, borderRadius: 3, padding: 1.5 }}>
              <div style={{ width: '80%', height: '100%', background: C.PRIMARY, borderRadius: 1.5 }} />
            </div>
            <div style={{ width: 2, height: 6, background: C.PRIMARY, borderRadius: 1, marginLeft: 1, opacity: 0.4 }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 14px', background: C.BG }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[22, 15, 22].map((w, i) => (
          <div key={i} style={{ width: w, height: 2, background: C.PRIMARY, borderRadius: 1 }} />
        ))}
      </div>
      <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 30, color: C.PRIMARY, fontWeight: 400 }}>
        Shelf
      </span>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="9.5" cy="9.5" r="7" stroke={C.PRIMARY} strokeWidth="2" />
        <line x1="15" y1="15" x2="20.5" y2="20.5" stroke={C.PRIMARY} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

// Projects is a tab alongside hashtags — no # prefix, same visual treatment
const TABS = ['#all', 'Projects', '#motivation', '#tech', '#design']

function TabBar({ active = '#all' }) {
  return (
    <div className="no-scroll" style={{ display: 'flex', gap: 22, padding: '0 20px 14px', background: C.BG, overflowX: 'auto' }}>
      {TABS.map(tab => (
        <div key={tab} style={{ flexShrink: 0 }}>
          <span style={{
            fontFamily: 'Inter', fontWeight: 500, fontSize: 11,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: tab === active ? C.ACCENT : C.MUTED,
          }}>{tab}</span>
          {tab === active && <div style={{ height: 2, background: C.ACCENT, marginTop: 4, borderRadius: 1 }} />}
        </div>
      ))}
    </div>
  )
}

function Badge({ duration }) {
  return (
    <div style={{
      position: 'absolute', bottom: 8, left: 8,
      background: C.BG, borderRadius: 999, padding: '3px 8px',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke={C.ACCENT} strokeWidth="1.5" />
        <path d="M6 3.5V6l1.8 1.8" stroke={C.ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontFamily: 'Inter', fontSize: 10, color: C.ACCENT }}>{duration}</span>
    </div>
  )
}

function LinkCard({ descriptor, title, duration, img }) {
  return (
    <div style={{ width: 145, flexShrink: 0 }}>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
        <img src={img} alt={title} style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
        <Badge duration={duration} />
      </div>
      <p style={{ marginTop: 7, lineHeight: 1.35, paddingRight: 4 }}>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 13, color: C.ACCENT }}>{descriptor} </span>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 13, color: C.PRIMARY }}>{title}</span>
      </p>
    </div>
  )
}

function SectionHeader({ label, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 20px 12px' }}>
      <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, color: C.PRIMARY, fontWeight: 400 }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase', color: C.ACCENT }}>
        {count} SAVED ›
      </span>
    </div>
  )
}

function CardRow({ cards }) {
  return (
    <div className="no-scroll" style={{ display: 'flex', gap: 12, paddingLeft: 20, overflowX: 'auto', marginBottom: 28 }}>
      {cards.map((c, i) => <LinkCard key={i} {...c} />)}
      <div style={{ width: 8, flexShrink: 0 }} />
    </div>
  )
}

// Liquid glass FAB — closed state, bottom right
function FAB() {
  return (
    <div style={{
      position: 'absolute', bottom: 32, right: 20, zIndex: 50,
      width: 56, height: 56, borderRadius: 999,
      background: 'rgba(255,255,255,0.38)',
      backdropFilter: 'blur(24px) saturate(200%) brightness(1.08)',
      WebkitBackdropFilter: 'blur(24px) saturate(200%) brightness(1.08)',
      border: '1px solid rgba(255,255,255,0.7)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <line x1="10" y1="4" x2="10" y2="16" stroke={C.PRIMARY} strokeWidth="2.2" strokeLinecap="round" />
        <line x1="4" y1="10" x2="16" y2="10" stroke={C.PRIMARY} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

export default function HomeScreen() {
  return (
    <div style={{ width: 390, height: 844, background: C.BG, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusBar />
      <Header />
      <TabBar active="#all" />
      <div className="no-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        <SectionHeader label="This week" count="12" />
        <CardRow cards={THIS_WEEK} />
        <SectionHeader label="Last week" count="8" />
        <CardRow cards={LAST_WEEK} />
      </div>
      <FAB />
    </div>
  )
}
