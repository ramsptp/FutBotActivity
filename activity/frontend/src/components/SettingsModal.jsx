import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const PACK_STYLES = [
  { id: 'fan',     icon: '🎴', label: 'Fan Reveal',   desc: 'All cards dealt face-down — tap each one to flip it in any order.' },
  { id: 'quick',   icon: '⚡', label: 'Quick Reveal',  desc: 'Featured card gets the full animated reveal, then straight to your cards.' },
  { id: 'layered', icon: '🃏', label: 'Layered Peel',  desc: 'Cards stacked in a pile, worst to best. Each tap peels one off — last card gets the full reveal.' },
]

const STORAGE_KEY = 'futbot-pack-style'

export function getPackStyle() {
  return localStorage.getItem(STORAGE_KEY) || 'fan'
}

export default function SettingsModal({ onClose, token, player, onPlayerPatch }) {
  const [packStyle, setPackStyle] = useState(getPackStyle)
  const [hideHistory,    setHideHistory]    = useState(player?.hide_battle_history ? true : false)
  const [hideCollection, setHideCollection] = useState(player?.hide_collection     ? true : false)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  function selectStyle(id) {
    setPackStyle(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  async function savePrivacy(field, value) {
    if (!token) return
    setSaving(true)
    try {
      await apiFetch('/api/profile/settings', token, {
        method: 'PUT',
        body: JSON.stringify({ [field]: value }),
      })
      onPlayerPatch?.({ [field]: value })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch {}
    setSaving(false)
  }

  function toggleHistory() {
    const next = !hideHistory
    setHideHistory(next)
    savePrivacy('hide_battle_history', next)
  }

  function toggleCollection() {
    const next = !hideCollection
    setHideCollection(next)
    savePrivacy('hide_collection', next)
  }

  const MONT = "'Montserrat', sans-serif"

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 20px 48px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: MONT }}>Settings</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Pack style */}
        <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>Pack Opening Style</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          {PACK_STYLES.map(style => {
            const active = packStyle === style.id
            return (
              <button key={style.id} onClick={() => selectStyle(style.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: active ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${active ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
              }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{style.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#c4b5fd' : '#e2e8f0', marginBottom: 3 }}>{style.label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{style.desc}</div>
                </div>
                {active && <span style={{ fontSize: 18, color: '#a855f7', flexShrink: 0 }}>✓</span>}
              </button>
            )
          })}
        </div>

        {/* Privacy */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>Privacy</div>
          {saved && <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700 }}>Saved ✓</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Hide battle history',   sub: 'Others cannot see your match history',   val: hideHistory,    toggle: toggleHistory },
            { label: 'Hide my collection',    sub: 'Others cannot browse your card collection', val: hideCollection, toggle: toggleCollection },
          ].map(({ label, sub, val, toggle }) => (
            <div key={label} onClick={toggle} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13,
                background: val ? '#a855f7' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 3, left: val ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
