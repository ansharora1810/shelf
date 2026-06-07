import React from 'react'

const C = {
  BG: '#F2EDE4',
  SURFACE: '#FFFFFF',
  PRIMARY: '#2D4A35',
  ACCENT: '#C4532A',
  MUTED: '#8A8A8A',
}

// Real project names, not tag/category names
const PROJECTS = [
  {
    name: 'App launch ideas', count: 14,
    images: ['https://picsum.photos/seed/r1/200/200', 'https://picsum.photos/seed/r2/200/200', 'https://picsum.photos/seed/r3/200/200', 'https://picsum.photos/seed/r4/200/200'],
  },
  {
    name: 'Content creation', count: 9,
    images: ['https://picsum.photos/seed/l1/200/200', 'https://picsum.photos/seed/l2/200/200', 'https://picsum.photos/seed/l3/200/200', 'https://picsum.photos/seed/l4/200/200'],
  },
  {
    name: 'Finance & investing', count: 21,
    images: ['https://picsum.photos/seed/m1/200/200', 'https://picsum.photos/seed/m2/200/200', 'https://picsum.photos/seed/m3/200/200', 'https://picsum.photos/seed/m4/200/200'],
  },
  {
    name: 'Career growth', count: 17,
    images: ['https://picsum.photos/seed/t1/200/200', 'https://picsum.photos/seed/t2/200/200', 'https://picsum.photos/seed/t3/200/200', 'https://picsum.photos/seed/t4/200/200'],
  },
  {
    name: 'Home renovation', count: 6,
    images: ['https://picsum.photos/seed/d1/200/200', 'https://picsum.photos/seed/d2/200/200', 'https://picsum.photos/seed/d3/200/200', 'https://picsum.photos/seed/d4/200/200'],
  },
  {
    name: 'Reading list', count: 31,
    images: ['https://picsum.photos/seed/y1/200/200', 'https://picsum.photos/seed/y2/200/200', 'https://picsum.photos/seed/y3/200/200', 'https://picsum.photos/seed/y4/200/200'],
  },
]

const TABS = ['#all', 'Projects', '#motivation', '#tech', '#design']

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

function TabBar({ active = 'Projects' }) {
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

function ProjectCard({ name, count, images }) {
  return (
    <div>
      <div style={{ borderRadius: 14, overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {images.map((src, i) => (
          <img key={i} src={src} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
        ))}
      </div>
      <div style={{ marginTop: 9 }}>
        <p style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 15, color: C.PRIMARY, fontWeight: 400 }}>
          {name}
        </p>
        <p style={{ fontFamily: 'Inter', fontSize: 11, color: C.MUTED, marginTop: 2 }}>
          {count} saved
        </p>
      </div>
    </div>
  )
}

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

export default function ProjectsScreen() {
  return (
    <div style={{ width: 390, height: 844, background: C.BG, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <StatusBar />
      <Header />
      <TabBar active="Projects" />
      {/* Grid — no redundant "Projects" heading */}
      <div className="no-scroll" style={{
        flex: 1, overflowY: 'auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 20, padding: '4px 20px 100px',
        alignContent: 'start',
      }}>
        {PROJECTS.map((p) => (
          <ProjectCard key={p.name} {...p} />
        ))}
      </div>
      <FAB />
    </div>
  )
}
