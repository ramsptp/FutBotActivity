import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }

export default function ProfileModal({ user, token, onClose, onTitleChange }) {
  const [data, setData]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    apiFetch('/api/profile', token).then(d => {
      setData(d)
      setSelected(d.player.display_title || '')
    }).catch(() => {})
  }, [])

  async function saveTitle() {
    setSaving(true)
    await apiFetch('/api/profile/title', token, {
      method: 'PUT',
      body: JSON.stringify({ title: selected }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setData(d => d ? { ...d, player: { ...d.player, display_title: selected || null } } : d)
    onTitleChange?.(selected)
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()} className="anim-slideR">

        {/* Header */}
        <div style={s.header}>
          <img
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=80`}
            style={s.avatar}
            onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
          />
          <div style={{ flex: 1 }}>
            <div style={s.username}>{user.username}</div>
            <div style={s.titleDisplay}>
              {data?.player?.display_title
                ? <span style={{ color: '#f0c040' }}>👑 {data.player.display_title}</span>
                : <span style={{ color: '#475569' }}>No title set</span>
              }
            </div>
            <div style={s.coins}>🪙 {data?.player?.coins?.toLocaleString() ?? '—'} coins</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>✕</button>
        </div>

        {!data ? (
          <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>Loading…</div>
        ) : (
          <div style={s.body}>

            {/* Battle Stats */}
            <div style={s.section}>
              <div style={s.sectionLabel}>BATTLE STATS</div>
              <div style={s.statsGrid}>
                {[
                  ['Played',   data.player.battles_played,  '#94a3b8'],
                  ['Won',      data.player.battles_won,     '#22c55e'],
                  ['Lost',     data.player.battles_lost,    '#ef4444'],
                  ['Drawn',    data.player.battles_drawn,   '#f0c040'],
                  ['Win Rate', `${data.win_rate}%`,         '#a855f7'],
                ].map(([l, v, c]) => (
                  <div key={l} style={s.statCard}>
                    <div style={{ ...s.statVal, color: c }}>{v}</div>
                    <div style={s.statLabel}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Round Stats */}
            <div style={s.section}>
              <div style={s.sectionLabel}>ROUND STATS</div>
              <div style={s.statsGrid}>
                {[
                  ['Played', data.player.rounds_played, '#94a3b8'],
                  ['Won',    data.player.rounds_won,    '#22c55e'],
                  ['Lost',   data.player.rounds_lost,   '#ef4444'],
                  ['Drawn',  data.player.rounds_drawn,  '#f0c040'],
                ].map(([l, v, c]) => (
                  <div key={l} style={s.statCard}>
                    <div style={{ ...s.statVal, color: c }}>{v}</div>
                    <div style={s.statLabel}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card Collection */}
            <div style={s.section}>
              <div style={s.sectionLabel}>COLLECTION</div>
              <div style={s.statsGrid}>
                {[
                  ['Total',    data.card_counts.total,    '#fff'],
                  ['Common',   data.card_counts.common,   RARITY_COLOR.Common],
                  ['Uncommon', data.card_counts.uncommon, RARITY_COLOR.Uncommon],
                  ['Rare',     data.card_counts.rare,     RARITY_COLOR.Rare],
                ].map(([l, v, c]) => (
                  <div key={l} style={s.statCard}>
                    <div style={{ ...s.statVal, color: c }}>{v}</div>
                    <div style={s.statLabel}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Title selector */}
            <div style={s.section}>
              <div style={s.sectionLabel}>DISPLAY TITLE</div>
              {data.titles.length === 0 ? (
                <div style={{ fontSize: 13, color: '#475569', padding: '8px 0' }}>
                  No titles earned yet. Win battles to unlock them!
                </div>
              ) : (
                <>
                  <div style={s.titlesGrid}>
                    <div
                      onClick={() => setSelected('')}
                      style={{ ...s.titleChip, ...(selected === '' ? s.titleChipActive : {}) }}
                    >
                      None
                    </div>
                    {data.titles.map(t => (
                      <div
                        key={t.achievement_id}
                        onClick={() => setSelected(t.title)}
                        style={{ ...s.titleChip, ...(selected === t.title ? s.titleChipActive : {}) }}
                        title={t.description}
                      >
                        👑 {t.title}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={saveTitle}
                    disabled={saving || selected === (data.player.display_title || '')}
                    style={{
                      ...s.saveBtn,
                      ...(saved ? { background: '#22c55e' } : {}),
                      opacity: saving || selected === (data.player.display_title || '') ? 0.5 : 1,
                    }}
                  >
                    {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Title'}
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 300,
  },
  panel: {
    width: 340, height: '100%', background: 'rgba(10,14,26,0.98)',
    backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.02)', flexShrink: 0,
  },
  avatar: { width: 52, height: 52, borderRadius: '50%', border: '2px solid #a855f7', objectFit: 'cover', flexShrink: 0 },
  username: { fontSize: 17, fontWeight: 700, fontFamily: MONTSERRAT },
  titleDisplay: { fontSize: 12, fontWeight: 600, margin: '2px 0' },
  coins: { fontSize: 12, color: '#64748b' },
  closeBtn: {
    background: 'transparent', border: 'none', color: '#475569',
    fontSize: 18, cursor: 'pointer', padding: 4, alignSelf: 'flex-start',
  },
  body: { flex: 1, overflowY: 'auto', padding: '16px' },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10, fontFamily: MONTSERRAT, fontWeight: 700, color: '#475569',
    letterSpacing: '0.2em', marginBottom: 10,
  },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px,1fr))', gap: 8 },
  statCard: {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10,
    padding: '10px 8px', textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  statVal: { fontSize: 20, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 10, color: '#475569', marginTop: 4, fontWeight: 600 },
  titlesGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  titleChip: {
    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s',
  },
  titleChipActive: {
    background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.5)',
    color: '#a855f7',
  },
  saveBtn: {
    width: '100%', background: '#a855f7', border: 'none', borderRadius: 10,
    color: '#fff', padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    transition: 'background 0.2s',
  },
}
