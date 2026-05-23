import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from './FutCard'
import ShowcasePicker from './ShowcasePicker'
import { avatarUrl, FALLBACK_AVATAR } from '../lib/avatar'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const INTER      = "'Inter', system-ui, sans-serif"
const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }

const ALL_ACHIEVEMENTS = [
  { slug: 'battle_beginner', title: 'Battle Beginner', description: 'Win 1 battle',    icon: '⚔️' },
  { slug: 'battle_newbie',   title: 'Battle Newbie',   description: 'Win 10 battles',  icon: '⚔️' },
  { slug: 'battle_pro',      title: 'Battle Pro',      description: 'Win 25 battles',  icon: '🏅' },
  { slug: 'battle_champion', title: 'Battle Champion', description: 'Win 50 battles',  icon: '🏆' },
  { slug: 'battle_master',   title: 'Battle Master',   description: 'Win 100 battles', icon: '👑' },
  { slug: 'round_rookie',    title: 'Round Rookie',    description: 'Win 10 rounds',   icon: '🎯' },
  { slug: 'round_champion',  title: 'Round Champion',  description: 'Win 50 rounds',   icon: '🎯' },
  { slug: 'round_hero',      title: 'Round Hero',      description: 'Win 100 rounds',  icon: '🌟' },
]

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

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '12px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: MONTSERRAT, lineHeight: 1 }}>{value ?? 0}</div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontWeight: 600, letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

// viewUser = { user_id, name, avatar } — when viewing someone else (read-only)
// If viewUser is null, shows own profile
export default function FullScreenProfile({ user, token, viewUser = null, onClose, onTrade, onTitleChange, onlineIds = new Set() }) {
  const [data, setData]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [selected, setSelected] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [profileTab, setProfileTab]     = useState('overview')
  const [historyData, setHistoryData]   = useState(null)
  const [collectionData, setCollectionData] = useState(null)

  const isOwn = !viewUser
  const displayId     = viewUser ? viewUser.user_id : user?.id
  const displayName   = viewUser ? viewUser.name    : user?.username
  const displayAvatar = viewUser ? viewUser.avatar  : user?.avatar

  useEffect(() => {
    const url = viewUser ? `/api/profile/${viewUser.user_id}` : '/api/profile'
    apiFetch(url, token).then(d => {
      setData(d)
      if (isOwn) setSelected(d.player.display_title || '')
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (profileTab !== 'history' || historyData !== null) return
    const targetId = viewUser ? viewUser.user_id : user?.id
    apiFetch(`/api/profile/${targetId}/history`, token)
      .then(setHistoryData)
      .catch(() => setHistoryData({ hidden: false, battles: [] }))
  }, [profileTab])

  useEffect(() => {
    if (profileTab !== 'collection' || collectionData !== null) return
    const targetId = viewUser ? viewUser.user_id : user?.id
    apiFetch(`/api/profile/${targetId}/collection`, token)
      .then(setCollectionData)
      .catch(() => setCollectionData({ hidden: false, cards: [] }))
  }, [profileTab])

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

  const p = data?.player
  const isOnline = viewUser ? (onlineIds.has(String(viewUser.user_id)) || onlineIds.has(viewUser.user_id)) : true

  return (
    <>
      <div style={s.overlay}>
        <style>{`
          @keyframes fspIn {
            0%   { opacity: 0; transform: scale(0.97) translateY(12px); }
            100% { opacity: 1; transform: none; }
          }
        `}</style>

        <div style={s.screen}>
          {/* Background grid pattern */}
          <div style={s.gridBg} />
          {/* Atmospheric glow */}
          <div style={{ position: 'absolute', top: -120, left: '50%', transform: 'translateX(-50%)', width: '80%', height: 300, background: 'radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

          {/* Header bar */}
          <div style={s.topBar}>
            <button onClick={onClose} style={s.backBtn}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONTSERRAT, letterSpacing: '0.06em' }}>BACK</span>
            </button>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: MONTSERRAT }}>
              PLAYER PROFILE
            </div>
            <div style={{ width: 80 }} />
          </div>

          {/* Scrollable content */}
          <div style={s.body}>

            {/* ── HERO ── */}
            <div style={s.hero}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{
                  position: 'absolute', inset: -4, borderRadius: '50%',
                  background: 'conic-gradient(#a855f7, #ffca45, #a855f7)',
                  animation: 'spin 4s linear infinite',
                  filter: 'blur(2px)',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                <img
                  src={avatarUrl(displayId, displayAvatar, 160)}
                  alt={displayName}
                  style={s.heroAvatar}
                  onError={e => { e.target.src = FALLBACK_AVATAR }}
                />
              </div>
              <div style={s.heroInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={s.heroName}>{displayName}</div>
                  {!isOwn && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, fontFamily: MONTSERRAT,
                      color: isOnline ? '#4ade80' : '#475569',
                      background: isOnline ? 'rgba(74,222,128,0.12)' : 'rgba(71,85,105,0.15)',
                      border: `1px solid ${isOnline ? 'rgba(74,222,128,0.3)' : 'rgba(71,85,105,0.3)'}`,
                      borderRadius: 999, padding: '3px 10px',
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: isOnline ? '#4ade80' : '#475569', display: 'inline-block', boxShadow: isOnline ? '0 0 6px rgba(74,222,128,0.8)' : 'none' }} />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  )}
                </div>
                {(data?.player?.display_title || p?.display_title) && (
                  <div style={s.heroTitle}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1", color: '#ffca45' }}>emoji_events</span>
                    {data?.player?.display_title}
                  </div>
                )}
                {isOwn && (
                  <div style={s.heroCoins}>
                    <div style={s.coinDot}>$</div>
                    <span>{data?.player?.coins?.toLocaleString() ?? '—'} coins</span>
                  </div>
                )}
                {!isOwn && onTrade && (
                  <div style={{ position: 'relative', display: 'inline-block', marginTop: 8 }}>
                    <button
                      onClick={() => { if (isOnline) { onTrade(viewUser.user_id); onClose() } }}
                      disabled={!isOnline}
                      style={{ ...s.tradeBtn, ...(!isOnline ? { opacity: 0.4, cursor: 'not-allowed', filter: 'grayscale(0.5)' } : {}) }}
                      onMouseEnter={e => { if (!isOnline) e.currentTarget.nextSibling.style.display = 'block' }}
                      onMouseLeave={e => { if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'none' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>swap_horiz</span>
                      Propose Trade
                    </button>
                    <div style={{
                      display: 'none', position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
                      background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(239,68,68,0.4)',
                      borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                      color: '#fca5a5', whiteSpace: 'nowrap', pointerEvents: 'none',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    }}>
                      Can't trade when offline
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { key: 'overview',    label: 'Overview',   icon: 'person' },
                { key: 'history',     label: 'History',    icon: 'history' },
                { key: 'collection',  label: 'Collection', icon: 'style' },
              ].map(t => (
                <button key={t.key} onClick={() => setProfileTab(t.key)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '9px 8px', border: 'none', borderRadius: 9, cursor: 'pointer',
                  fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 700, fontSize: 11,
                  letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.15s',
                  background: profileTab === t.key ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color: profileTab === t.key ? '#c084fc' : 'rgba(255,255,255,0.4)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: profileTab === t.key ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {!data ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
                <div style={{ width: 32, height: 32, border: '3px solid rgba(168,85,247,0.2)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 13 }}>Loading…</div>
              </div>
            ) : profileTab === 'overview' ? (
              <div style={s.grid}>
                {/* Left column — showcase */}
                <div style={s.leftCol}>
                  <SectionLabel>Showcase Card</SectionLabel>
                  {data.showcase_card ? (
                    <div style={s.showcaseWrap}>
                      <div style={{ width: 160, margin: '0 auto 14px', filter: glowToDropShadow(getCardGlow(data.showcase_card)) }}>
                        <FutCard card={data.showcase_card} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Montserrat', system-ui, sans-serif" }}>{data.showcase_card.name}</div>
                        <div style={{ fontSize: 12, color: RARITY_COLOR[data.showcase_card.card_rarity] || '#fff', marginTop: 3, fontWeight: 600 }}>
                          {data.showcase_card.card_rarity} · {data.showcase_card.card_type}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10 }}>
                          {[['ATK', data.showcase_card.attack, '#ef4444'], ['DEF', data.showcase_card.defense, '#3b82f6'], ['SPD', data.showcase_card.speed, '#22c55e'], ['OVR', data.showcase_card.overall, '#f0c040']].map(([l, v, c]) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 20, fontWeight: 900, color: c, fontFamily: "'Montserrat', system-ui, sans-serif" }}>{v}</div>
                              <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1 }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        {isOwn && (
                          <button onClick={() => setShowPicker(true)} style={s.changeBtn}>Change Card</button>
                        )}
                      </div>
                    </div>
                  ) : (
                    isOwn ? (
                      <button onClick={() => setShowPicker(true)} style={s.emptyShowcase}>
                        <span className="material-symbols-outlined" style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>add_circle</span>
                        Set Showcase Card
                      </button>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#334155', fontSize: 13 }}>No showcase set</div>
                    )
                  )}
                </div>

                {/* Right column — stats */}
                <div style={s.rightCol}>
                  <SectionLabel>Battle Stats</SectionLabel>
                  <div style={s.statsGrid}>
                    <StatBox label="PLAYED"   value={p.battles_played} color="#94a3b8" />
                    <StatBox label="WON"      value={p.battles_won}    color="#22c55e" />
                    <StatBox label="LOST"     value={p.battles_lost}   color="#ef4444" />
                    <StatBox label="DRAWN"    value={p.battles_drawn}  color="#f0c040" />
                    <StatBox label="WIN RATE" value={`${data.win_rate}%`} color="#a855f7" />
                  </div>

                  <SectionLabel style={{ marginTop: 20 }}>Round Stats</SectionLabel>
                  <div style={s.statsGrid}>
                    <StatBox label="PLAYED" value={p.rounds_played} color="#94a3b8" />
                    <StatBox label="WON"    value={p.rounds_won}    color="#22c55e" />
                    <StatBox label="LOST"   value={p.rounds_lost}   color="#ef4444" />
                    <StatBox label="DRAWN"  value={p.rounds_drawn}  color="#f0c040" />
                  </div>

                  <SectionLabel style={{ marginTop: 20 }}>Collection</SectionLabel>
                  <div style={s.statsGrid}>
                    <StatBox label="TOTAL"    value={data.card_counts.total}    color="#fff" />
                    <StatBox label="COMMON"   value={data.card_counts.common}   color={RARITY_COLOR.Common} />
                    <StatBox label="UNCOMMON" value={data.card_counts.uncommon} color={RARITY_COLOR.Uncommon} />
                    <StatBox label="RARE"     value={data.card_counts.rare}     color={RARITY_COLOR.Rare} />
                  </div>

                  <SectionLabel style={{ marginTop: 20 }}>Achievements</SectionLabel>
                  <AchievementsSection
                    earnedTitles={new Set((data.titles || []).map(t => t.title))}
                    isOwn={isOwn}
                    selectedTitle={selected}
                    onSelect={isOwn ? setSelected : undefined}
                  />
                  {isOwn && (
                    <button onClick={saveTitle}
                      disabled={saving || selected === (p.display_title || '')}
                      style={{ ...s.saveBtn, ...(saved ? { background: '#22c55e' } : {}), opacity: saving || selected === (p.display_title || '') ? 0.5 : 1, marginTop: 12 }}>
                      {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Title'}
                    </button>
                  )}
                </div>
              </div>
            ) : profileTab === 'history' ? (
              <HistoryTab data={historyData} />
            ) : (
              <CollectionTab data={collectionData} />
            )}
          </div>
        </div>
      </div>

      {showPicker && <ShowcasePicker token={token} onSelect={setShowcase} onClose={() => setShowPicker(false)} />}
    </>
  )
}

function HistoryTab({ data }) {
  const MONT = "'Montserrat', system-ui, sans-serif"
  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(168,85,247,0.15)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (data.hidden) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4 }}>lock</span>
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#64748b', fontFamily: MONT }}>Battle history is private</div>
    </div>
  )
  if (!data.battles?.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4 }}>history</span>
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#64748b', fontFamily: MONT }}>No battles played yet</div>
    </div>
  )

  function timeAgo(str) {
    try {
      const d = new Date(str.replace(' ', 'T') + 'Z')
      const s = Math.floor((Date.now() - d) / 1000)
      if (s < 60)        return 'just now'
      if (s < 3600)      return `${Math.floor(s / 60)}m ago`
      if (s < 86400)     return `${Math.floor(s / 3600)}h ago`
      if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
      return `${Math.floor(s / (86400 * 7))}w ago`
    } catch { return '' }
  }

  const RESULT_STYLE = {
    win:  { bg: 'rgba(34,197,94,0.15)',  border: 'rgba(34,197,94,0.4)',  color: '#4ade80', label: 'W' },
    loss: { bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.4)',  color: '#f87171', label: 'L' },
    draw: { bg: 'rgba(240,192,64,0.15)', border: 'rgba(240,192,64,0.4)', color: '#fcd34d', label: 'D' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.battles.map(b => {
        const rs = RESULT_STYLE[b.result] || RESULT_STYLE.draw
        return (
          <div key={b.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${rs.border}22`,
            borderRadius: 14, padding: '12px 16px',
            borderLeft: `3px solid ${rs.color}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: rs.bg, border: `1.5px solid ${rs.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, color: rs.color, fontFamily: MONT,
            }}>{rs.label}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                vs {b.opp_name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                {b.mode === 'draft' ? '⚡ Draft' : '🃏 Deck'} · {timeAgo(b.played_at)}
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: MONT, lineHeight: 1 }}>
                {b.my_score} <span style={{ fontSize: 14, color: '#475569' }}>-</span> {b.opp_score}
              </div>
              <div style={{ fontSize: 9, color: rs.color, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>
                {b.result}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CollectionTab({ data }) {
  const MONT = "'Montserrat', system-ui, sans-serif"
  const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }
  const [selected, setSelected] = useState(null)

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: 28, height: 28, border: '3px solid rgba(168,85,247,0.15)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  if (data.hidden) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4 }}>lock</span>
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#64748b', fontFamily: MONT }}>Collection is private</div>
    </div>
  )
  if (!data.cards?.length) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4 }}>style</span>
      <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#64748b', fontFamily: MONT }}>No cards in collection</div>
    </div>
  )

  const grouped = { Rare: [], Uncommon: [], Common: [] }
  data.cards.forEach(c => { (grouped[c.card_rarity] || grouped.Common).push(c) })

  return (
    <>
      <div>
        {Object.entries(grouped).filter(([, cards]) => cards.length > 0).map(([rarity, cards]) => (
          <div key={rarity} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12, fontFamily: MONT }}>
              {rarity} · {cards.length}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 12 }}>
              {cards.map((card, i) => (
                <div key={`${card.card_id}-${i}`}
                  onClick={() => setSelected(card)}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${RARITY_COLOR[rarity] || '#fff'}22`,
                    borderRadius: 12, padding: 10, textAlign: 'center',
                    transition: 'transform 0.15s, border-color 0.15s', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${RARITY_COLOR[rarity]}55` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = `${RARITY_COLOR[rarity] || '#fff'}22` }}
                >
                  {card.image_url ? (
                    <img src={card.image_url} alt={card.name}
                      style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '3/4', background: 'rgba(255,255,255,0.05)', borderRadius: 8, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#334155' }}>style</span>
                    </div>
                  )}
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.name}</div>
                  <div style={{ fontSize: 9, color: '#f0c040', marginTop: 2 }}>{card.overall} OVR</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {selected && <CardDetailModal card={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function CardDetailModal({ card, onClose }) {
  const MONT = "'Montserrat', system-ui, sans-serif"
  const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }
  const rarityColor = RARITY_COLOR[card.card_rarity] || '#fff'
  const winPct = (w, p) => p > 0 ? Math.round(w / p * 100) : 0
  const isFirstOwner = (card.trade_count ?? 0) === 0

  function Row({ icon, label, value, color }) {
    if (value === null || value === undefined || value === '') return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{icon}</span><span>{label}</span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: color || '#e2e8f0' }}>{value}</div>
      </div>
    )
  }

  function Section({ title, children }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 600 }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{
        background: '#0a0e1a', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px',
        width: '100%', maxWidth: 480, border: '1px solid rgba(255,255,255,0.08)',
        maxHeight: '90vh', overflowY: 'auto', color: '#e2e8f0',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ width: '38%', flexShrink: 0, filter: glowToDropShadow(getCardGlow(card)) }}>
            <FutCard card={card} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 3, fontFamily: MONT }}>{card.name}</div>
            <div style={{ fontSize: 12, color: rarityColor, fontWeight: 700, marginBottom: 14 }}>{card.card_rarity} · {card.card_type}</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[['OVR', card.overall, '#f0c040'], ['ATK', card.attack, '#ef4444'], ['DEF', card.defense, '#3b82f6'], ['SPD', card.speed, '#22c55e']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1, fontFamily: MONT }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Section title="ℹ️  Card Info">
          <Row icon="🎯" label="Position" value={card.position} />
          <Row icon="🏟️" label="Club"     value={card.club} />
          <Row icon="🏆" label="League"   value={card.league} />
          <Row icon="🌍" label="Nation"   value={card.nation} />
          <Row icon="🆔" label="Card ID"  value={`#${card.card_id}`} />
        </Section>

        <Section title="📋  Inventory">
          <Row icon="#️⃣" label="Edition"   value={card.edition ? `#${card.edition} of ${card.copies ?? '?'} copies` : '—'} />
          <Row icon="👤" label="Ownership" value={isFirstOwner ? 'First Owner ✨' : 'Traded In'} color={isFirstOwner ? '#22c55e' : '#64748b'} />
        </Section>

        <Section title="⚔️  Battle Record (This Copy)">
          <Row icon="🏅" label="Battles"
            value={`${card.copy_battles_won ?? 0} / ${card.copy_battles_played ?? 0}  (${winPct(card.copy_battles_won, card.copy_battles_played)}%)`} />
          <Row icon="🔄" label="Rounds"
            value={`${card.copy_rounds_won ?? 0} / ${card.copy_rounds_played ?? 0}`} />
        </Section>

        <Section title="🌍  Global Stats">
          <Row icon="❤️" label="Wishlists" value={card.wishlist_count ?? 0} color="#ef4444" />
          <Row icon="⚔️" label="Battles"
            value={`${card.total_battles_won ?? 0} / ${card.total_battles_played ?? 0}  (${winPct(card.total_battles_won, card.total_battles_played)}%)`} />
          <Row icon="🔄" label="Rounds"
            value={`${card.total_rounds_won ?? 0} / ${card.total_rounds_played ?? 0}`} />
        </Section>

        <button onClick={onClose} style={{
          width: '100%', marginTop: 4, padding: '12px',
          background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)',
          borderRadius: 12, color: '#c084fc', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: MONT,
        }}>Close</button>
      </div>
    </div>
  )
}

function AchievementsSection({ earnedTitles, isOwn, selectedTitle, onSelect }) {
  const MONT = "'Montserrat', system-ui, sans-serif"
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {isOwn && (
        <div
          onClick={() => onSelect?.('')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10,
            background: selectedTitle === '' ? 'rgba(71,85,105,0.2)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${selectedTitle === '' ? 'rgba(71,85,105,0.5)' : 'rgba(255,255,255,0.05)'}`,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'rgba(71,85,105,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
          }}>🚫</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: selectedTitle === '' ? '#94a3b8' : '#475569', fontFamily: MONT }}>No Title</div>
            <div style={{ fontSize: 10, color: '#334155', marginTop: 1 }}>Display nothing below your name</div>
          </div>
          {selectedTitle === '' && <span style={{ fontSize: 14, color: '#94a3b8' }}>✓</span>}
        </div>
      )}
      {ALL_ACHIEVEMENTS.map(a => {
        const earned = earnedTitles.has(a.title)
        const isSelected = selectedTitle === a.title
        return (
          <div
            key={a.slug}
            onClick={() => earned && isOwn && onSelect?.(isSelected ? '' : a.title)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10,
              background: isSelected ? 'rgba(255,202,69,0.1)' : earned ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
              border: `1px solid ${isSelected ? 'rgba(255,202,69,0.35)' : earned ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}`,
              cursor: earned && isOwn ? 'pointer' : 'default',
              opacity: earned ? 1 : 0.4,
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: isSelected ? 'rgba(255,202,69,0.18)' : earned ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            }}>
              {earned ? a.icon : '🔒'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#ffca45' : earned ? '#e2e8f0' : '#475569', fontFamily: MONT }}>{a.title}</div>
              <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{a.description}</div>
            </div>
            {isOwn && earned && isSelected && <span style={{ fontSize: 14, color: '#ffca45', flexShrink: 0 }}>✓</span>}
            {!isOwn && earned && <span style={{ fontSize: 12, color: '#4ade80', flexShrink: 0 }}>✓</span>}
          </div>
        )
      })}
    </div>
  )
}

function SectionLabel({ children, style: extra }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#475569',
      letterSpacing: '0.2em', textTransform: 'uppercase',
      marginBottom: 12, fontFamily: MONTSERRAT,
      ...extra,
    }}>{children}</div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 500,
    background: 'rgba(2,4,12,0.6)', backdropFilter: 'blur(4px)',
  },
  screen: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(180deg, #0a0e1a 0%, #060914 100%)',
    display: 'flex', flexDirection: 'column',
    color: '#e2e8f0', fontFamily: INTER,
    animation: 'fspIn 0.3s cubic-bezier(0.34,1.3,0.64,1) both',
    overflow: 'hidden',
  },
  gridBg: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `
      repeating-linear-gradient(90deg, transparent 0, transparent 60px, rgba(168,85,247,0.025) 60px, rgba(168,85,247,0.025) 61px),
      repeating-linear-gradient(0deg,  transparent 0, transparent 60px, rgba(168,85,247,0.025) 60px, rgba(168,85,247,0.025) 61px)
    `,
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0, position: 'relative', zIndex: 2,
    background: 'rgba(10,14,26,0.6)', backdropFilter: 'blur(12px)',
  },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
    padding: '6px 10px', borderRadius: 8,
    transition: 'color 0.15s',
    fontFamily: MONTSERRAT,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '32px 32px 48px',
    position: 'relative', zIndex: 2,
    scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
  },

  // Hero
  hero: {
    display: 'flex', alignItems: 'center', gap: 28,
    marginBottom: 36, padding: '24px 28px',
    background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(255,202,69,0.04))',
    border: '1px solid rgba(168,85,247,0.18)', borderRadius: 20,
  },
  heroAvatar: {
    width: 88, height: 88, borderRadius: '50%', objectFit: 'cover',
    position: 'relative', zIndex: 1, border: '3px solid #0a0e1a',
  },
  heroInfo: { flex: 1 },
  heroName: {
    fontSize: 28, fontWeight: 900, color: '#fff',
    fontFamily: MONTSERRAT, letterSpacing: '0.02em', lineHeight: 1.1,
    marginBottom: 6,
  },
  heroTitle: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: 'rgba(255,202,69,0.1)', border: '1px solid rgba(255,202,69,0.3)',
    borderRadius: 999, padding: '4px 12px',
    fontSize: 11, fontWeight: 700, color: '#ffca45',
    fontFamily: MONTSERRAT, letterSpacing: '0.06em',
    marginBottom: 8,
  },
  heroCoins: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 14, color: '#94a3b8', fontWeight: 600,
  },
  coinDot: {
    width: 20, height: 20, borderRadius: '50%',
    background: 'linear-gradient(135deg, #facc15, #d97706)',
    color: '#3f2e00', fontWeight: 800, fontSize: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  tradeBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(168,85,247,0.06))',
    border: '1px solid rgba(168,85,247,0.4)',
    borderRadius: 10, color: '#c084fc', padding: '8px 18px',
    fontSize: 13, fontWeight: 800, cursor: 'pointer',
    fontFamily: MONTSERRAT, letterSpacing: '0.05em',
    marginTop: 8,
  },

  // Content grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 300px) 1fr',
    gap: 28, alignItems: 'start',
  },

  // Left col
  leftCol: {
    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '20px',
  },
  showcaseWrap: {},
  changeBtn: {
    marginTop: 14, width: '100%',
    background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 8, color: '#a855f7', padding: '8px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: MONTSERRAT, letterSpacing: '0.04em',
  },
  emptyShowcase: {
    width: '100%', padding: '40px 20px',
    background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(168,85,247,0.25)',
    borderRadius: 14, color: '#a855f7', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', textAlign: 'center',
  },

  // Right col
  rightCol: {},
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8,
  },

  // Titles
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
    color: '#fff', padding: '10px', fontWeight: 700, fontSize: 14,
    cursor: 'pointer', transition: 'background 0.2s', fontFamily: MONTSERRAT,
  },
}
