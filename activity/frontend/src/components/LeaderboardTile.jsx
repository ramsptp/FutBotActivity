import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { avatarUrl, FALLBACK_AVATAR } from '../lib/avatar'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const INTER      = "'Inter', system-ui, sans-serif"

// Stats to cycle through in the slideshow. Each one shapes the header title + accent.
const STATS = [
  { key: 'battles_won',    label: 'TOP PLAYERS',    icon: 'emoji_events',  accent: '#ffca45' },
  { key: 'coins',          label: 'RICHEST',        icon: 'paid',          accent: '#f97316' },
  { key: 'cards_owned',    label: 'TOP COLLECTORS', icon: 'style',         accent: '#ec4899' },
  { key: 'rounds_won',     label: 'ROUND CHAMPS',   icon: 'sports_mma',    accent: '#22c55e' },
]

const RANK_COLOR = ['#ffca45', '#cbd5e1', '#c97939']
const ROTATE_MS  = 5500

function formatVal(n) {
  if (n == null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000)    return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

// Floating "TOP PLAYERS" widget pinned under the FUTBOT logo.
// Cycles through stat leaderboards (Server scope) as a slideshow.
export default function LeaderboardTile({ token, channelId, guildId, onOpen, onViewProfile, collapsed = false }) {
  const [statIdx, setStatIdx] = useState(0)
  const [data, setData]       = useState({})  // { [statKey]: response }
  const pausedRef = useRef(false)

  const stat = STATS[statIdx]
  const wasCollapsedRef = useRef(collapsed)

  // Load every stat in parallel (and refetch when channel/guild changes)
  useEffect(() => {
    STATS.forEach(loadStat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, guildId])

  // Refresh all stats when expanding (collapsed → visible)
  useEffect(() => {
    const wasCollapsed = wasCollapsedRef.current
    wasCollapsedRef.current = collapsed
    if (wasCollapsed && !collapsed) {
      STATS.forEach(loadStat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed])

  // Refresh the current stat whenever the slide changes
  useEffect(() => {
    loadStat(STATS[statIdx])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statIdx])

  // Rotate stats on a timer
  useEffect(() => {
    if (collapsed) return  // don't spin while hidden
    const id = setInterval(() => {
      if (pausedRef.current) return
      setStatIdx(i => (i + 1) % STATS.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [collapsed])

  async function loadStat(s) {
    try {
      const p = new URLSearchParams({ stat: s.key, scope: 'server', limit: 3 })
      if (channelId) p.set('channel_id', channelId)
      if (guildId)   p.set('guild_id',   guildId)
      const res = await apiFetch(`/api/leaderboard?${p}`, token)
      setData(d => ({ ...d, [s.key]: res }))
    } catch {
      setData(d => ({ ...d, [s.key]: { entries: [] } }))
    }
  }

  const current = data[stat.key]
  const entries = current?.entries || []

  return (
    <div
      style={{
        ...s.widget,
        opacity:       collapsed ? 0 : 1,
        transform:     collapsed ? 'translateY(-10px) scale(0.96)' : 'none',
        pointerEvents: collapsed ? 'none' : 'auto',
      }}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false }}
      className={collapsed ? '' : 'anim-fadeUp'}
    >
      {/* Header */}
      <div style={s.header}>
        <div style={s.titleWrap}>
          <span
            className="material-symbols-outlined"
            style={{ ...s.statIcon, color: stat.accent, filter: `drop-shadow(0 0 4px ${stat.accent}55)` }}
          >
            {stat.icon}
          </span>
          <span key={stat.key} style={s.title} className="lb-title-fade">{stat.label}</span>
        </div>
        <button onClick={() => onOpen?.('server')} style={s.viewBtn}>
          VIEW LEADERBOARD
          <span className="material-symbols-outlined" style={{ fontSize: 14, marginLeft: 2 }}>chevron_right</span>
        </button>
      </div>

      {/* Top 3 list (with cross-fade on stat change) */}
      <div style={s.list} key={stat.key}>
        {!current && (
          <div style={s.muted}>Loading…</div>
        )}
        {current && entries.length === 0 && (
          <div style={s.muted}>Nobody yet</div>
        )}
        {entries.slice(0, 3).map((e, i) => {
          const color = RANK_COLOR[i] || '#475569'
          return (
            <div
              key={`${stat.key}-${e.user_id}`}
              style={{
                ...s.row,
                animationDelay: `${i * 0.06}s`,
                cursor: onViewProfile ? 'pointer' : 'default',
              }}
              className="lb-row-fade"
              onClick={() => onViewProfile?.({ user_id: String(e.user_id), name: e.name, avatar: e.avatar })}
            >
              <div style={{ ...s.rankPill, color, borderColor: `${color}55` }}>{i + 1}</div>
              <img
                src={avatarUrl(e.user_id, e.avatar, 32)}
                alt={e.name}
                style={{ ...s.avatar, borderColor: `${color}aa`, boxShadow: `0 0 6px ${color}33` }}
                onError={ev => { ev.target.src = FALLBACK_AVATAR }}
              />
              <div style={{ ...s.name, color: e.is_me ? color : '#fff' }}>{e.name}</div>
              <div style={{ ...s.value, color }}>{formatVal(e.value)}</div>
            </div>
          )
        })}
      </div>

      {/* Slideshow dots */}
      <div style={s.dots}>
        {STATS.map((sc, i) => (
          <button
            key={sc.key}
            onClick={() => setStatIdx(i)}
            style={{
              ...s.dot,
              background: i === statIdx ? sc.accent : 'rgba(255,255,255,0.18)',
              width: i === statIdx ? 14 : 4,
              boxShadow: i === statIdx ? `0 0 6px ${sc.accent}80` : 'none',
            }}
            title={sc.label}
          />
        ))}
      </div>

      <style>{`
        @keyframes lbFadeRow {
          0%   { opacity: 0; transform: translateX(-6px); }
          100% { opacity: 1; transform: none; }
        }
        @keyframes lbTitleFade {
          0%   { opacity: 0; transform: translateY(-3px); }
          100% { opacity: 1; transform: none; }
        }
        .lb-row-fade   { animation: lbFadeRow 0.35s cubic-bezier(0.34,1.3,0.64,1) both; }
        .lb-title-fade { animation: lbTitleFade 0.3s ease both; }
      `}</style>
    </div>
  )
}

const s = {
  widget: {
    position: 'fixed',
    top: 90, left: 24, zIndex: 8,
    width: 250,
    background: 'linear-gradient(180deg, rgba(10,14,26,0.92), rgba(6,9,20,0.92))',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,202,69,0.15)',
    borderRadius: 14,
    padding: '12px 14px 10px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 24px rgba(255,202,69,0.08)',
    fontFamily: INTER,
    pointerEvents: 'auto',
    transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.3,0.64,1)',
    transformOrigin: 'top left',
  },

  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10, gap: 8,
  },
  titleWrap: {
    display: 'flex', alignItems: 'center', gap: 6,
  },
  statIcon: {
    fontSize: 16,
    fontVariationSettings: "'FILL' 1",
    transition: 'color 0.3s, filter 0.3s',
  },
  title: {
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 11,
    color: '#fff', letterSpacing: '0.12em', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  viewBtn: {
    display: 'flex', alignItems: 'center',
    background: 'transparent', border: 'none',
    color: '#a855f7', fontSize: 9, fontWeight: 800,
    fontFamily: MONTSERRAT, letterSpacing: '0.06em', textTransform: 'uppercase',
    cursor: 'pointer', padding: 0,
    transition: 'color 0.15s',
  },

  list: {
    display: 'flex', flexDirection: 'column', gap: 5,
    minHeight: 102,  // reserves space so the slideshow doesn't reflow
  },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 8, padding: '5px 8px',
  },
  rankPill: {
    fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 10,
    border: '1px solid', borderRadius: 5,
    width: 18, textAlign: 'center', flexShrink: 0,
    padding: '1px 0',
  },
  avatar: {
    width: 22, height: 22, borderRadius: '50%', objectFit: 'cover',
    border: '1.5px solid', flexShrink: 0,
  },
  name: {
    flex: 1, minWidth: 0,
    fontFamily: INTER, fontWeight: 600, fontSize: 12,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  value: {
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 12,
    flexShrink: 0,
  },

  muted: {
    fontSize: 11, color: '#475569', textAlign: 'center',
    padding: '12px 0', fontStyle: 'italic',
  },

  dots: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 10,
  },
  dot: {
    height: 4, borderRadius: 999, border: 'none',
    transition: 'all 0.4s cubic-bezier(0.34,1.3,0.64,1)',
    padding: 0, cursor: 'pointer',
  },
}
