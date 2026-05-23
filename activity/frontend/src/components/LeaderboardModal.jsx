import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { avatarUrl, FALLBACK_AVATAR } from '../lib/avatar'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const INTER      = "'Inter', system-ui, sans-serif"

const STATS = [
  { key: 'battles_won',    name: 'Battles Won',    icon: 'military_tech', color: '#ffca45' },
  { key: 'battles_played', name: 'Battles Played', icon: 'swords',        color: '#a855f7' },
  { key: 'rounds_won',     name: 'Rounds Won',     icon: 'sports_mma',    color: '#22c55e' },
  { key: 'rounds_played',  name: 'Rounds Played',  icon: 'replay',        color: '#60a5fa' },
  { key: 'coins',          name: 'Richest',        icon: 'paid',          color: '#f97316' },
  { key: 'cards_owned',    name: 'Collectors',     icon: 'style',         color: '#ec4899' },
]

const SCOPES = [
  { key: 'vc',      label: 'Voice',   icon: 'graphic_eq' },
  { key: 'server',  label: 'Server',  icon: 'castle' },
  { key: 'global',  label: 'Global',  icon: 'public' },
  { key: 'friends', label: 'Friends', icon: 'group' },
]

const PODIUM_TINTS = [
  { color: '#ffca45', tint: 'rgba(255,202,69,0.2)',  glow: 'rgba(255,202,69,0.6)',  label: 'CHAMPION' },
  { color: '#cbd5e1', tint: 'rgba(203,213,225,0.15)', glow: 'rgba(203,213,225,0.4)', label: 'RUNNER-UP' },
  { color: '#c97939', tint: 'rgba(201,121,57,0.18)',  glow: 'rgba(201,121,57,0.5)',  label: '3RD PLACE' },
]

function formatVal(n) {
  return (n ?? 0).toLocaleString()
}

export default function LeaderboardModal({ token, channelId, guildId, initialScope = 'global', onClose, onViewProfile }) {
  const [stat, setStat]     = useState('battles_won')
  const [scope, setScope]   = useState(initialScope)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const bodyRef = useRef(null)

  useEffect(() => { load() }, [stat, scope, channelId, guildId])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const p = new URLSearchParams({ stat, scope, limit: 50 })
      if (channelId && (scope === 'vc' || scope === 'server')) p.set('channel_id', channelId)
      if (guildId   && scope === 'server') p.set('guild_id',   guildId)
      const res = await apiFetch(`/api/leaderboard?${p}`, token)
      setData(res)
      if (bodyRef.current) bodyRef.current.scrollTop = 0
    } catch {
      setData({ entries: [], my_entry: null, total: 0 })
    }
    setLoading(false)
  }

  const currentStat  = STATS.find(s => s.key === stat) || STATS[0]
  const podium       = data?.entries.slice(0, 3) || []
  const rest         = data?.entries.slice(3) || []
  const inTop50      = data?.my_entry && data?.entries.some(e => e.is_me)

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()} className="anim-fadeUp">

        {/* Atmospheric backdrop */}
        <div style={s.backdrop} />
        <div style={s.glowTop(currentStat.color)} />

        {/* Header */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={s.titleHex(currentStat.color)}>
              <span className="material-symbols-outlined" style={{ fontSize: 22, color: currentStat.color, fontVariationSettings: "'FILL' 1" }}>
                {currentStat.icon}
              </span>
            </div>
            <div>
              <div style={s.kicker}>RANKINGS</div>
              <div style={s.title}>{currentStat.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>close</span>
          </button>
        </div>

        {/* Scope toggle */}
        <div style={s.scopePillRow}>
          <div style={s.scopePillGroup}>
            {SCOPES.map(sc => {
              const active = scope === sc.key
              return (
                <button key={sc.key} onClick={() => setScope(sc.key)} style={{
                  ...s.scopePill,
                  background: active ? 'linear-gradient(135deg, rgba(255,202,69,0.22), rgba(255,202,69,0.06))' : 'transparent',
                  color: active ? '#ffca45' : 'rgba(255,255,255,0.4)',
                  borderColor: active ? 'rgba(255,202,69,0.5)' : 'transparent',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{sc.icon}</span>
                  {sc.label}
                </button>
              )
            })}
          </div>
          <div style={s.totalChip}>
            {(data?.total ?? 0).toLocaleString()} players
          </div>
        </div>

        {/* Stat tabs (horizontally scrollable with arrows) */}
        <StatTabStrip
          stat={stat}
          onChange={setStat}
        />

        {/* Body */}
        <div ref={bodyRef} style={s.body}>

          {loading && (
            <div style={s.spinnerWrap}>
              <div style={s.spinner} />
            </div>
          )}

          {!loading && data?.entries.length === 0 && (
            <div style={s.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>leaderboard</span>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginTop: 8, fontFamily: MONTSERRAT }}>No ranks yet</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                {scope === 'friends' ? 'Add some friends to build a leaderboard.' :
                 scope === 'vc'      ? 'Nobody else is in this voice channel.' :
                 scope === 'server'  ? 'No one from this server has played yet.' :
                                       'Be the first to play!'}
              </div>
            </div>
          )}

          {!loading && podium.length > 0 && (
            <>
              {/* PODIUM — top 3 in special layout */}
              <div style={s.podium}>
                {podium.map((e, i) => (
                  <PodiumCard
                    key={e.user_id}
                    entry={e}
                    tier={PODIUM_TINTS[i]}
                    onView={() => onViewProfile?.({ user_id: String(e.user_id), name: e.name, avatar: e.avatar })}
                  />
                ))}
              </div>

              {/* REST — list */}
              {rest.length > 0 && (
                <div style={s.restWrap}>
                  <div style={s.restLabel}>RANK 4 — {3 + rest.length}</div>
                  <div style={s.restList}>
                    {rest.map((e, i) => (
                      <ListRow
                        key={e.user_id}
                        entry={e}
                        delay={i * 0.02}
                        onView={() => onViewProfile?.({ user_id: String(e.user_id), name: e.name, avatar: e.avatar })}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky "Your rank" footer if not visible above */}
        {data?.my_entry && !inTop50 && (
          <div style={s.myRankFooter}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={s.myRankBadge}>#{data.my_entry.rank}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: MONTSERRAT }}>Your Rank</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Top {Math.round((data.my_entry.rank / data.total) * 100)}%</div>
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: currentStat.color, fontFamily: MONTSERRAT }}>
              {formatVal(data.my_entry.value)}
            </div>
          </div>
        )}

        <style>{`
          @keyframes lbSpin { to { transform: rotate(360deg); } }
          @keyframes lbPodium {
            0%   { opacity: 0; transform: translateY(20px) scale(0.9); }
            100% { opacity: 1; transform: none; }
          }
          @keyframes lbRow {
            0%   { opacity: 0; transform: translateX(-12px); }
            100% { opacity: 1; transform: none; }
          }
        `}</style>
      </div>
    </div>
  )
}

function StatTabStrip({ stat, onChange }) {
  const stripRef = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  function update() {
    const el = stripRef.current
    if (!el) return
    const left  = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges({ left, right })
  }

  useLayoutEffect(() => {
    update()
    const el = stripRef.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  // Auto-scroll active tab into view — compute scrollLeft manually so we never
  // touch ancestor scroll positions (scrollIntoView would shift the whole modal).
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const active = el.querySelector('[data-active="true"]')
    if (!active) return
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
    const max    = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' })
  }, [stat])

  function scrollBy(delta) {
    stripRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div style={s.statRowWrap}>
      <button
        onClick={() => scrollBy(-180)}
        style={{ ...s.scrollChev, left: 0, opacity: edges.left ? 1 : 0, pointerEvents: edges.left ? 'auto' : 'none' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
      </button>

      <div ref={stripRef} style={s.statRow}>
        {STATS.map(st => {
          const active = stat === st.key
          return (
            <button
              key={st.key}
              data-active={active}
              onClick={() => onChange(st.key)}
              style={{
                ...s.statTab,
                color: active ? st.color : 'rgba(255,255,255,0.4)',
                borderBottomColor: active ? st.color : 'transparent',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{st.icon}</span>
              <span>{st.name}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => scrollBy(180)}
        style={{ ...s.scrollChev, right: 0, opacity: edges.right ? 1 : 0, pointerEvents: edges.right ? 'auto' : 'none' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
      </button>

      {/* Edge gradients to hint scrollability */}
      <div style={{ ...s.edgeFade, left: 0, background: 'linear-gradient(90deg, #0a0e1a, transparent)', opacity: edges.left ? 1 : 0 }} />
      <div style={{ ...s.edgeFade, right: 0, background: 'linear-gradient(-90deg, #0a0e1a, transparent)', opacity: edges.right ? 1 : 0 }} />
    </div>
  )
}

function PodiumCard({ entry, tier, onView }) {
  const rank = entry.rank
  return (
    <div
      onClick={onView}
      style={{
        position: 'relative',
        background: `linear-gradient(180deg, ${tier.tint} 0%, rgba(0,0,0,0.4) 100%)`,
        border: `1px solid ${tier.color}55`,
        borderRadius: 14, padding: '14px 12px 12px',
        textAlign: 'center', flex: 1, minWidth: 0,
        cursor: 'pointer',
        animation: `lbPodium 0.5s cubic-bezier(0.34,1.3,0.64,1) ${(rank - 1) * 0.1}s both`,
        boxShadow: rank === 1 ? `0 8px 30px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,0.1)` : '0 4px 14px rgba(0,0,0,0.3)',
        transform: rank === 1 ? 'translateY(-8px)' : 'none',
      }}
    >
      <div style={{
        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
        background: tier.color, color: rank === 1 ? '#3f2a00' : '#1a1a1a',
        fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 999,
        fontFamily: MONTSERRAT, letterSpacing: '0.08em',
        boxShadow: `0 2px 12px ${tier.glow}`,
      }}>
        {tier.label}
      </div>

      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8, marginTop: 4 }}>
        <img
          src={avatarUrl(entry.user_id, entry.avatar, 128)}
          alt={entry.name}
          style={{
            width: rank === 1 ? 56 : 44,
            height: rank === 1 ? 56 : 44,
            borderRadius: '50%', objectFit: 'cover',
            border: `2px solid ${tier.color}`,
            boxShadow: `0 0 ${rank === 1 ? 18 : 10}px ${tier.glow}`,
          }}
          onError={e => { e.target.src = FALLBACK_AVATAR }}
        />
        {entry.is_me && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            background: '#ffca45', color: '#1a0a00',
            fontSize: 8, fontWeight: 900, padding: '1px 5px', borderRadius: 4,
            border: '2px solid #060914', fontFamily: MONTSERRAT,
          }}>YOU</div>
        )}
      </div>

      <div style={{
        fontSize: rank === 1 ? 13 : 12, fontWeight: 800,
        color: entry.is_me ? '#ffca45' : '#fff',
        fontFamily: MONTSERRAT,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{entry.name}</div>

      {entry.display_title && (
        <div style={{
          fontSize: 9, color: tier.color, marginTop: 2,
          fontWeight: 700, letterSpacing: '0.05em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>👑 {entry.display_title}</div>
      )}

      <div style={{
        marginTop: 10, fontSize: rank === 1 ? 22 : 18,
        fontWeight: 900, color: tier.color,
        fontFamily: MONTSERRAT, letterSpacing: '-0.02em',
        textShadow: `0 2px 12px ${tier.glow}`,
      }}>{formatVal(entry.value)}</div>
    </div>
  )
}

function ListRow({ entry, delay, onView }) {
  return (
    <div
      onClick={onView}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px',
        background: entry.is_me
          ? 'linear-gradient(90deg, rgba(255,202,69,0.12), rgba(255,202,69,0.02))'
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${entry.is_me ? 'rgba(255,202,69,0.35)' : 'rgba(255,255,255,0.04)'}`,
        borderRadius: 10, cursor: 'pointer',
        animation: `lbRow 0.3s ease ${delay}s both`,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{
        width: 32, fontSize: 13, fontWeight: 900,
        color: entry.is_me ? '#ffca45' : '#475569',
        fontFamily: MONTSERRAT, flexShrink: 0,
      }}>#{entry.rank}</div>
      <img
        src={avatarUrl(entry.user_id, entry.avatar, 64)}
        alt={entry.name}
        style={{
          width: 32, height: 32, borderRadius: '50%', objectFit: 'cover',
          border: '1.5px solid rgba(255,255,255,0.06)', flexShrink: 0,
        }}
        onError={e => { e.target.src = FALLBACK_AVATAR }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700,
          color: entry.is_me ? '#ffca45' : '#e2e8f0',
          fontFamily: INTER,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{entry.name}{entry.is_me && <span style={{ color: '#ffca45', fontWeight: 800, marginLeft: 6, fontSize: 10, letterSpacing: 1 }}>YOU</span>}</div>
        {entry.display_title && (
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>👑 {entry.display_title}</div>
        )}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 900, color: '#fff',
        fontFamily: MONTSERRAT, flexShrink: 0,
      }}>{formatVal(entry.value)}</div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(2,4,12,0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 400, padding: '20px',
  },
  modal: {
    position: 'relative', width: '100%', maxWidth: 880,
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, #0a0e1a 0%, #060914 100%)',
    border: '1px solid rgba(255,202,69,0.2)',
    borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(255,202,69,0.08)',
    color: '#e2e8f0', fontFamily: INTER,
  },
  backdrop: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: `
      repeating-linear-gradient(90deg, transparent 0, transparent 80px, rgba(255,202,69,0.025) 80px, rgba(255,202,69,0.025) 81px),
      repeating-linear-gradient(0deg, transparent 0, transparent 80px, rgba(255,202,69,0.025) 80px, rgba(255,202,69,0.025) 81px)
    `,
  },
  glowTop: (color) => ({
    position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
    width: '140%', height: 240, borderRadius: '50%',
    background: `radial-gradient(ellipse, ${color}30 0%, transparent 70%)`,
    filter: 'blur(30px)', pointerEvents: 'none',
    transition: 'background 0.3s',
  }),

  // Header
  header: {
    position: 'relative', zIndex: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 22px 14px', flexShrink: 0,
  },
  titleHex: (color) => ({
    width: 44, height: 44,
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    background: `linear-gradient(135deg, ${color}25, rgba(0,0,0,0.5))`,
    border: `1px solid ${color}55`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.3s',
  }),
  kicker: {
    fontSize: 9, fontFamily: MONTSERRAT, fontWeight: 700,
    color: '#64748b', letterSpacing: '0.3em', textTransform: 'uppercase',
  },
  title: {
    fontSize: 22, fontFamily: MONTSERRAT, fontWeight: 900,
    color: '#fff', letterSpacing: '0.02em', lineHeight: 1.1,
    textShadow: '0 2px 12px rgba(0,0,0,0.4)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  },

  // Scope toggle
  scopePillRow: {
    position: 'relative', zIndex: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 22px 12px', gap: 12, flexShrink: 0, flexWrap: 'wrap',
  },
  scopePillGroup: {
    display: 'flex', gap: 4, flexWrap: 'wrap',
    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 999, padding: 3,
  },
  scopePill: {
    display: 'flex', alignItems: 'center', gap: 6,
    border: '1px solid', borderRadius: 999,
    padding: '7px 14px', fontSize: 11, fontWeight: 700,
    cursor: 'pointer', fontFamily: MONTSERRAT,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    transition: 'all 0.2s',
  },
  totalChip: {
    fontSize: 10, fontWeight: 700, color: '#475569',
    letterSpacing: '0.15em', textTransform: 'uppercase',
    fontFamily: MONTSERRAT,
  },

  // Stat tabs strip (with scroll affordances)
  statRowWrap: {
    position: 'relative', zIndex: 2,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  statRow: {
    display: 'flex', overflowX: 'auto',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  statTab: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '11px 14px', background: 'transparent',
    border: 'none', borderBottom: '2px solid',
    cursor: 'pointer', fontFamily: MONTSERRAT, fontWeight: 700, fontSize: 11,
    letterSpacing: '0.06em', textTransform: 'uppercase',
    whiteSpace: 'nowrap', transition: 'color 0.2s, border-color 0.2s',
    flexShrink: 0,
  },
  scrollChev: {
    position: 'absolute', top: 0, bottom: 2,
    width: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(10,14,26,0.85)', backdropFilter: 'blur(6px)',
    border: 'none', borderRadius: 0,
    color: '#ffca45', cursor: 'pointer', zIndex: 4,
    transition: 'opacity 0.2s',
  },
  edgeFade: {
    position: 'absolute', top: 0, bottom: 2,
    width: 24, pointerEvents: 'none', zIndex: 3,
    transition: 'opacity 0.2s',
  },

  // Body
  body: {
    position: 'relative', zIndex: 2,
    flex: 1, overflowY: 'auto',
    padding: '20px 22px 24px',
    scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent',
  },

  // Podium
  podium: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    marginBottom: 24, paddingTop: 14,
  },

  // Rest list
  restWrap: {},
  restLabel: {
    fontSize: 10, color: '#475569', fontWeight: 700,
    letterSpacing: '0.2em', textTransform: 'uppercase',
    fontFamily: MONTSERRAT, marginBottom: 10,
  },
  restList: { display: 'flex', flexDirection: 'column', gap: 6 },

  // Spinner / empty
  spinnerWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  spinner: {
    width: 32, height: 32, border: '3px solid rgba(255,202,69,0.15)',
    borderTopColor: '#ffca45', borderRadius: '50%',
    animation: 'lbSpin 0.8s linear infinite',
  },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#475569' },

  // Sticky footer
  myRankFooter: {
    position: 'relative', zIndex: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 22px',
    background: 'linear-gradient(180deg, rgba(255,202,69,0.05) 0%, rgba(255,202,69,0.1) 100%)',
    borderTop: '1px solid rgba(255,202,69,0.2)',
    flexShrink: 0,
  },
  myRankBadge: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(255,202,69,0.15)', border: '1px solid rgba(255,202,69,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 900, color: '#ffca45',
    fontFamily: MONTSERRAT, flexShrink: 0,
  },
}
