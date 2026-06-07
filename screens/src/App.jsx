import React from 'react'
import HomeScreen from './screens/HomeScreen'
import ProjectsScreen from './screens/ProjectsScreen'
import LinkDetailScreen from './screens/LinkDetailScreen'
import PostProcessingScreen from './screens/PostProcessingScreen'

function PhoneFrame({ children, label }) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{
        width: 390, height: 844,
        position: 'relative',
        borderRadius: 55,
        background: '#1C1C1E',
        boxShadow: '0 0 0 1px #444, 0 0 0 9px #1C1C1E, 0 40px 80px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 2, borderRadius: 53, overflow: 'hidden' }}>
          {children}
        </div>
        <div style={{
          position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)',
          width: 126, height: 37, background: '#1C1C1E', borderRadius: 20, zIndex: 30,
        }} />
        <div style={{
          position: 'absolute', bottom: 9, left: '50%', transform: 'translateX(-50%)',
          width: 134, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3, zIndex: 30,
        }} />
      </div>
      {label && (
        <p style={{
          marginTop: 16, fontFamily: 'Inter, sans-serif', fontSize: 13,
          color: '#666', letterSpacing: '0.03em', textAlign: 'center',
        }}>{label}</p>
      )}
    </div>
  )
}

const SCREENS = [
  { key: 'home',     Screen: HomeScreen,           label: 'Home — #all feed' },
  { key: 'projects', Screen: ProjectsScreen,        label: 'Projects — Plan tab' },
  { key: 'detail',   Screen: LinkDetailScreen,      label: 'Link Detail' },
  { key: 'add',      Screen: PostProcessingScreen,  label: 'Add Link — Post-processing' },
]

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const single = params.get('screen')
  const match = SCREENS.find(s => s.key === single)

  // Single-screen view — clean, no label, centred for screenshots
  if (match) {
    return (
      <div style={{
        background: '#111', width: 470, height: 924,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PhoneFrame>
          <match.Screen />
        </PhoneFrame>
      </div>
    )
  }

  // Gallery view
  return (
    <div style={{ background: '#111', minHeight: '100vh', padding: 48 }}>
      <div style={{ marginBottom: 48 }}>
        <h1 style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 34, color: '#F2EDE4', fontWeight: 400, marginBottom: 6,
        }}>Shelf</h1>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#555' }}>
          Screen designs — draft 1
        </p>
      </div>
      <div style={{ display: 'flex', gap: 36, overflowX: 'auto', paddingBottom: 48, alignItems: 'flex-start' }}>
        {SCREENS.map(({ key, Screen, label }) => (
          <PhoneFrame key={key} label={label}>
            <Screen />
          </PhoneFrame>
        ))}
      </div>
    </div>
  )
}
