import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import StarterPackModal from '../components/StarterPackModal'

const NAV = [
  { id: 'home',       icon: '🏠', label: 'HOME' },
  { id: 'collection', icon: '📖', label: 'COLLECTION' },
  { id: 'shop',       icon: '🛒', label: 'SHOP' },
  { id: 'packs',      icon: '🎁', label: 'PACKS' },
  { id: 'battle',     icon: '⚔️', label: 'BATTLE' },
]

export default function Home({ token, user, setPage }) {
  const [player, setPlayer]             = useState(null)
  const [packs, setPacks]               = useState(null)
  const [starterCards, setStarterCards] = useState(null)

  useEffect(() => {
    apiFetch('/api/me', token).then(async data => {
      setPlayer(data.player)
      if (!data.player.has_claimed_starter_pack) {
        try {
          const cards = await apiFetch('/api/packs/starter', token, { method: 'POST' })
          setStarterCards(cards)
        } catch {}
      }
    }).catch(() => {})
    apiFetch('/api/packs', token).then(setPacks).catch(() => {})
  }, [])

  const totalPacks = packs
    ? Object.values(packs).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div style={s.root}>
      {starterCards && <StarterPackModal cards={starterCards} onClose={() => setStarterCards(null)} />}

      {/* ── TOP BAR ── */}
      <header style={s.topbar}>
        {/* Logo */}
        <div style={s.logo}>
          <div style={s.logoIcon}>⚽</div>
          <div>
            <div style={s.logoText}>
              <span style={{ color: '#fff' }}>FUT</span>
              <span style={{ color: '#a855f7' }}>BOT</span>
            </div>
            <div style={s.logoSub}>FOOTBALL CARD BATTLES</div>
          </div>
        </div>

        {/* Coins */}
        <div style={s.currencies}>
          <div style={s.coinChip}>
            <span>🪙</span>
            <span style={{ fontWeight: 700 }}>{player?.coins?.toLocaleString() ?? '—'}</span>
            <span style={s.plus}>+</span>
          </div>
        </div>

        {/* Profile */}
        <div style={s.profileBlock}>
          <img
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
            alt={user.username}
            style={s.avatar}
            onError={e => { e.target.src = `https://cdn.discordapp.com/embed/avatars/0.png` }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.profileName}>{user.username}</div>
            {player?.display_title
              ? <div style={s.profileTitle}>👑 {player.display_title}</div>
              : <div style={s.profileTitle}>⚽ Player</div>
            }
          </div>
          <div style={s.trophy}>🏆</div>
          <div style={s.gear} onClick={() => {}}>⚙️</div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div style={s.main}>


        {/* ── 3 PANELS ── */}
        <div style={s.panels}>

          {/* LEFT — PACKS */}
          <div style={{ ...s.panel, flex: 1, backgroundImage: "url('/packs.png')" }}>
            <div style={s.panelOverlay} />
            <div style={s.panelBottom}>
              {totalPacks > 0 && <div style={s.badge}>{totalPacks}</div>}
              <button style={s.packBtn} onClick={() => setPage('packs')}>OPEN PACKS</button>
            </div>
          </div>

          {/* CENTER — PLAY MATCH */}
          <div style={{ ...s.panel, flex: 1.6, backgroundImage: "url('/playmatch.png')", border: '2px solid rgba(240,192,64,0.6)', boxShadow: '0 0 40px rgba(240,192,64,0.15)' }}>
            <div style={s.panelOverlay} />
            <div style={s.panelBottom}>
              <button style={s.findMatchBtn} onClick={() => setPage('battle')}>FIND MATCH</button>
              <button style={s.friendBtn} onClick={() => setPage('battle')}>👥 PLAY WITH FRIEND</button>
            </div>
          </div>

          {/* RIGHT — DECKS */}
          <div style={{ ...s.panel, flex: 1, backgroundImage: "url('/decks.png')" }}>
            <div style={s.panelOverlay} />
            <div style={s.panelBottom}>
              <button style={s.decksBtn} onClick={() => setPage('decks')}>EDIT DECKS</button>
            </div>
          </div>

        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={s.bottomNav}>
        <div style={s.navItems}>
          {NAV.map(item => {
            const active = item.id === 'home'
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{
                ...s.navItem,
                color: active ? '#f0c040' : '#475569',
                borderTop: `2px solid ${active ? '#f0c040' : 'transparent'}`,
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: 0.5 }}>{item.label}</span>
              </button>
            )
          })}
        </div>
        <div style={s.onlineCount}>
          <span style={s.onlineDot} />
          <span style={{ fontSize: 12, color: '#64748b' }}>Online</span>
        </div>
      </nav>
    </div>
  )
}

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100svh',
    background: `url('/background.png') center center / cover no-repeat`,
    color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden',
    position: 'relative',
  },

  // Top bar
  topbar: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '0 20px', height: 60, flexShrink: 0,
    background: 'rgba(5,7,15,0.85)', backdropFilter: 'blur(16px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 8,
    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
  },
  logoText: { fontSize: 18, fontWeight: 900, letterSpacing: 1, lineHeight: 1.1 },
  logoSub: { fontSize: 9, color: '#475569', letterSpacing: 1.5, fontWeight: 600 },
  currencies: { flex: 1, display: 'flex', justifyContent: 'center', gap: 10 },
  coinChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.3)',
    borderRadius: 20, padding: '5px 14px', fontSize: 15, color: '#f0c040',
  },
  plus: {
    width: 18, height: 18, borderRadius: '50%',
    background: 'rgba(240,192,64,0.2)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14, cursor: 'pointer',
  },
  profileBlock: { display: 'flex', alignItems: 'center', gap: 8, maxWidth: 220 },
  avatar: { width: 38, height: 38, borderRadius: '50%', border: '2px solid #a855f7', objectFit: 'cover', flexShrink: 0 },
  profileName: { fontSize: 13, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  profileTitle: { fontSize: 10, color: '#f0c040', fontWeight: 600, letterSpacing: 0.3 },
  xpBarBg: { width: '100%', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 3 },
  xpBarFill: { height: '100%', background: 'linear-gradient(90deg,#a855f7,#7c3aed)', borderRadius: 2, transition: 'width 0.4s' },
  trophy: { fontSize: 22, flexShrink: 0 },
  gear: { fontSize: 18, opacity: 0.5, cursor: 'pointer', flexShrink: 0 },

  // Main
  main: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px 24px', overflow: 'hidden',
  },

  // Panels
  panels: { display: 'flex', gap: 14, width: '100%', height: '75%', maxHeight: 520 },

  panel: {
    borderRadius: 16, overflow: 'hidden', position: 'relative',
    backgroundSize: 'cover', backgroundPosition: 'center',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  panelOverlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)',
    pointerEvents: 'none',
  },
  panelBottom: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 14px',
  },

  // PACKS panel
  packsPanel: {
    flex: 1, borderRadius: 16, padding: '18px 16px',
    background: 'rgba(88,28,135,0.45)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(168,85,247,0.3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  packVisual: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 0, position: 'relative', minHeight: 0,
  },
  packEmoji: { fontSize: 52, position: 'absolute', opacity: 0.35 },
  badge: {
    width: 26, height: 26, borderRadius: '50%',
    background: '#a855f7', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  packBtn: {
    flex: 1, background: 'rgba(168,85,247,0.25)',
    border: '1px solid rgba(168,85,247,0.5)',
    borderRadius: 10, color: '#fff', padding: '10px 0',
    fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1,
    transition: 'background 0.15s',
  },

  // MATCH panel
  matchPanel: {
    flex: 1.4, borderRadius: 16, padding: '20px 18px',
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(16px)',
    border: '2px solid rgba(240,192,64,0.5)',
    boxShadow: '0 0 30px rgba(240,192,64,0.12)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden',
  },
  matchTitle: { fontSize: 26, fontWeight: 900, color: '#f0c040', letterSpacing: 2, marginBottom: 4 },
  matchSub: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 16, lineHeight: 1.4 },
  swordsShield: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  shieldOuter: {
    width: 110, height: 110, borderRadius: '50%',
    background: 'rgba(240,192,64,0.08)',
    border: '2px solid rgba(240,192,64,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 40px rgba(240,192,64,0.15)',
  },
  shieldInner: { fontSize: 52 },
  findMatchBtn: {
    width: '100%', background: 'linear-gradient(135deg,#d97706,#f0c040)',
    border: 'none', borderRadius: 12, color: '#000',
    padding: '13px 0', fontWeight: 900, fontSize: 16,
    cursor: 'pointer', letterSpacing: 1.5, marginBottom: 8,
    boxShadow: '0 4px 20px rgba(240,192,64,0.3)',
    transition: 'opacity 0.15s',
  },
  friendBtn: {
    width: '100%', background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, color: '#cbd5e1',
    padding: '11px 0', fontWeight: 600, fontSize: 14,
    cursor: 'pointer', letterSpacing: 0.5,
  },

  // DECKS panel
  decksPanel: {
    flex: 1, borderRadius: 16, padding: '18px 16px',
    background: 'rgba(23,37,84,0.5)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(59,130,246,0.3)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  deckVisual: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', minHeight: 0,
  },
  decksBtn: {
    flex: 1, background: 'rgba(59,130,246,0.2)',
    border: '1px solid rgba(59,130,246,0.4)',
    borderRadius: 10, color: '#fff', padding: '10px 0',
    fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1,
  },

  // Bottom nav
  bottomNav: {
    height: 54, flexShrink: 0,
    background: 'rgba(5,7,15,0.9)', backdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', paddingRight: 16,
  },
  navItems: { flex: 1, display: 'flex', height: '100%' },
  navItem: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 2,
    background: 'transparent', border: 'none', cursor: 'pointer',
    transition: 'color 0.15s', padding: '0 4px', height: '100%',
  },
  onlineCount: { display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 },
  onlineDot: { width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' },
}
