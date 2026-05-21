import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from './FutCard'
import ShowcasePicker from './ShowcasePicker'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }

function getCardGlow(card) {
  const r = card?.card_rarity, t = card?.card_type
  if (r === 'Common')   return '0 0 24px rgba(180,180,200,0.5)'
  if (r === 'Uncommon') return '0 0 30px rgba(180,150,0,0.6)'
  if (r === 'Rare') {
    if (t === 'Icon')              return '0 0 50px rgba(255,255,255,0.9), 0 0 100px rgba(255,255,255,0.4)'
    if (t === 'Hero')              return '0 0 50px rgba(255,80,200,0.8), 0 0 100px rgba(255,80,200,0.35)'
    if (t === 'Copa America TOTT') return '0 0 50px rgba(0,120,255,0.8), 0 0 100px rgba(0,120,255,0.35)'
    if (t === 'Euro TOTT')         return '0 0 50px rgba(255,110,0,0.8), 0 0 100px rgba(255,110,0,0.35)'
    return '0 0 50px rgba(240,192,64,0.9), 0 0 100px rgba(240,192,64,0.45)'
  }
  return '0 0 30px rgba(240,192,64,0.5)'
}

function glowToDropShadow(glow) {
  return glow.split(', ').map(s => {
    const m = s.match(/rgba?\([^)]+\)/)
    const parts = s.trim().split(/\s+/)
    return `drop-shadow(0 0 ${parts[2] || '20px'} ${m?.[0] || 'gold'})`
  }).join(' ')
}

// viewUser = { user_id, name, avatar } — if set, viewing someone else's profile (read-only)
export default function ProfileModal({ user, token, onClose, onTitleChange, viewUser = null }) {
  const [data, setData]             = useState(null)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [selected, setSelected]     = useState(null)
  const [showPicker, setShowPicker] = useState(false)

  const isOwn = !viewUser

  useEffect(() => {
    const url = viewUser ? `/api/profile/${viewUser.user_id}` : '/api/profile'
    apiFetch(url, token).then(d => {
      setData(d)
      if (isOwn) setSelected(d.player.display_title || '')
    }).catch(() => {})
  }, [])

  async function saveTitle() {
    setSaving(true)
    await apiFetch('/api/profile/title', token, { method: 'PUT', body: JSON.stringify({ title: selected }) }).catch(() => {})
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setData(d => d ? { ...d, player: { ...d.player, display_title: selected || null } } : d)
    onTitleChange?.(selected)
  }

  async function setShowcase(card) {
    await apiFetch('/api/profile/showcase', token, { method: 'PUT', body: JSON.stringify({ card_id: card.card_id }) }).catch(() => {})
    setData(d => d ? { ...d, showcase_card: card } : d)
  }

  const displayId     = viewUser ? viewUser.user_id : user?.id
  const displayName   = viewUser ? viewUser.name    : user?.username
  const displayAvatar = viewUser ? viewUser.avatar  : user?.avatar
  const avatarUrl = displayAvatar
    ? `https://cdn.discordapp.com/avatars/${displayId}/${displayAvatar}.png?size=80`
    : `https://cdn.discordapp.com/embed/avatars/${Number(displayId) % 5}.png`

  return (
    <>
      <div style={s.overlay} onClick={onClose}>
        <div style={s.panel} onClick={e => e.stopPropagation()} className="anim-slideR">

          {/* Header */}
          <div style={s.header}>
            <img src={avatarUrl} style={s.avatar} onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }} />
            <div style={{ flex: 1 }}>
              <div style={s.username}>{displayName}</div>
              {data?.player?.display_title
                ? <div style={s.titleDisplay}><span style={{ color: '#f0c040' }}>👑 {data.player.display_title}</span></div>
                : isOwn && <div style={s.titleDisplay}><span style={{ color: '#475569' }}>No title set</span></div>
              }
              {isOwn && <div style={s.coins}>🪙 {data?.player?.coins?.toLocaleString() ?? '—'} coins</div>}
            </div>
            <button onClick={onClose} style={s.closeBtn}>✕</button>
          </div>

          {!data ? (
            <div style={{ textAlign: 'center', color: '#475569', padding: 40 }}>Loading…</div>
          ) : (
            <div style={s.body}>

              {/* ── SHOWCASE ── */}
              <div style={s.section}>
                <div style={s.sectionLabel}>SHOWCASE</div>
                {data.showcase_card ? (
                  <div style={{ background: 'linear-gradient(135deg,rgba(168,85,247,0.07),rgba(240,192,64,0.04))', borderRadius: 16, padding: '18px 16px', border: '1px solid rgba(168,85,247,0.18)', textAlign: 'center' }}>
                    <div style={{ width: 130, margin: '0 auto 10px', filter: glowToDropShadow(getCardGlow(data.showcase_card)) }}>
                      <FutCard card={data.showcase_card} />
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{data.showcase_card.name}</div>
                    <div style={{ fontSize: 12, color: RARITY_COLOR[data.showcase_card.card_rarity] || '#fff', marginTop: 2 }}>
                      {data.showcase_card.card_rarity} · {data.showcase_card.card_type}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                      {[['ATK', data.showcase_card.attack, '#ef4444'], ['DEF', data.showcase_card.defense, '#3b82f6'], ['SPD', data.showcase_card.speed, '#22c55e'], ['OVR', data.showcase_card.overall, '#f0c040']].map(([l, v, c]) => (
                        <div key={l} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div>
                          <div style={{ fontSize: 9, color: '#475569' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {isOwn && (
                      <button onClick={() => setShowPicker(true)} style={{ marginTop: 12, background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 8, color: '#a855f7', padding: '6px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Change
                      </button>
                    )}
                  </div>
                ) : isOwn ? (
                  <button onClick={() => setShowPicker(true)} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(168,85,247,0.3)', borderRadius: 16, color: '#a855f7', padding: '28px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + Set Showcase Card
                  </button>
                ) : (
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: '20px 0' }}>No showcase card set</div>
                )}
              </div>

              {/* Battle Stats */}
              <div style={s.section}>
                <div style={s.sectionLabel}>BATTLE STATS</div>
                <div style={s.statsGrid}>
                  {[
                    ['Played',   data.player.battles_played, '#94a3b8'],
                    ['Won',      data.player.battles_won,    '#22c55e'],
                    ['Lost',     data.player.battles_lost,   '#ef4444'],
                    ['Drawn',    data.player.battles_drawn,  '#f0c040'],
                    ['Win Rate', `${data.win_rate}%`,        '#a855f7'],
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

              {/* Collection */}
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

              {/* Title selector — own profile only */}
              {isOwn && (
                <div style={s.section}>
                  <div style={s.sectionLabel}>DISPLAY TITLE</div>
                  {data.titles.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#475569', padding: '8px 0' }}>No titles earned yet. Win battles to unlock them!</div>
                  ) : (
                    <>
                      <div style={s.titlesGrid}>
                        <div onClick={() => setSelected('')} style={{ ...s.titleChip, ...(selected === '' ? s.titleChipActive : {}) }}>None</div>
                        {data.titles.map(t => (
                          <div key={t.achievement_id} onClick={() => setSelected(t.title)}
                            style={{ ...s.titleChip, ...(selected === t.title ? s.titleChipActive : {}) }} title={t.description}>
                            👑 {t.title}
                          </div>
                        ))}
                      </div>
                      <button onClick={saveTitle} disabled={saving || selected === (data.player.display_title || '')}
                        style={{ ...s.saveBtn, ...(saved ? { background: '#22c55e' } : {}), opacity: saving || selected === (data.player.display_title || '') ? 0.5 : 1 }}>
                        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Title'}
                      </button>
                    </>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {showPicker && <ShowcasePicker token={token} onSelect={setShowcase} onClose={() => setShowPicker(false)} />}
    </>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 300 },
  panel: { width: 360, height: '100%', background: 'rgba(10,14,26,0.98)', backdropFilter: 'blur(20px)', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif", color: '#e2e8f0' },
  header: { display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 },
  avatar: { width: 52, height: 52, borderRadius: '50%', border: '2px solid #a855f7', objectFit: 'cover', flexShrink: 0 },
  username: { fontSize: 17, fontWeight: 700, fontFamily: MONTSERRAT },
  titleDisplay: { fontSize: 12, fontWeight: 600, margin: '2px 0' },
  coins: { fontSize: 12, color: '#64748b' },
  closeBtn: { background: 'transparent', border: 'none', color: '#475569', fontSize: 18, cursor: 'pointer', padding: 4, alignSelf: 'flex-start' },
  body: { flex: 1, overflowY: 'auto', padding: '16px' },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontFamily: MONTSERRAT, fontWeight: 700, color: '#475569', letterSpacing: '0.2em', marginBottom: 10 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px,1fr))', gap: 8 },
  statCard: { background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' },
  statVal: { fontSize: 20, fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: 10, color: '#475569', marginTop: 4, fontWeight: 600 },
  titlesGrid: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  titleChip: { padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#94a3b8', transition: 'all 0.15s' },
  titleChipActive: { background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.5)', color: '#a855f7' },
  saveBtn: { width: '100%', background: '#a855f7', border: 'none', borderRadius: 10, color: '#fff', padding: '10px', fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'background 0.2s' },
}
