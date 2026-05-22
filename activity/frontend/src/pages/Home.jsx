import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import OnlinePanel from '../components/OnlinePanel'
import ProfileModal from '../components/ProfileModal'
import HowToPlayModal from '../components/HowToPlayModal'
import SettingsModal from '../components/SettingsModal'
import { toggleMute } from '../lib/sounds'

const NAV = [
  { id: 'home',       icon: 'home',         label: 'Home' },
  { id: 'collection', icon: 'style',         label: 'Collection' },
  { id: 'shop',       icon: 'shopping_cart', label: 'Shop' },
  { id: 'market',     icon: 'storefront',    label: 'Market' },
  { id: 'packs',      icon: 'inventory_2',   label: 'Packs' },
  { id: 'decks',      icon: 'layers',        label: 'Decks' },
  { id: 'battle',     icon: 'swords',        label: 'Battle' },
]

const EMBERS = [
  { left: '10%', size: 8,  delay: '0s',  dur: '7s' },
  { left: '25%', size: 12, delay: '2s',  dur: '9s' },
  { left: '45%', size: 5,  delay: '4s',  dur: '6s' },
  { left: '65%', size: 8,  delay: '1s',  dur: '8s' },
  { left: '80%', size: 12, delay: '3s',  dur: '10s' },
  { left: '92%', size: 5,  delay: '5s',  dur: '7s' },
]

export default function Home({ token, user, setPage, participants = [], setBattleMode, onStarterClaim, tutorialStep = 0, onTutorialAdvance, onTutorialSkip, setAutoChallenge }) {
  const [player, setPlayer]             = useState(null)
  const [packs, setPacks]               = useState(null)
  const [showOnlinePanel, setShowOnlinePanel] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [viewingProfile, setViewingProfile] = useState(null) // { user_id, name, avatar }
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [muted, setMuted] = useState(() => localStorage.getItem('futbot-muted') === 'true')

  useEffect(() => {
    apiFetch('/api/me', token).then(async data => {
      setPlayer(data.player)
      if (!data.player.has_claimed_starter_pack) {
        try {
          const cards = await apiFetch('/api/packs/starter', token, { method: 'POST' })
          onStarterClaim?.(cards)
        } catch {}
      }
    }).catch(() => {})
    apiFetch('/api/packs', token).then(setPacks).catch(() => {})
  }, [])

  const totalPacks = packs ? Object.values(packs).reduce((a, b) => a + b, 0) : 0

  return (
    <div style={s.root}>
      {viewingProfile && (
        <ProfileModal
          user={user}
          token={token}
          viewUser={viewingProfile}
          onClose={() => setViewingProfile(null)}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          token={token}
          onClose={() => setShowProfile(false)}
          onTitleChange={title => setPlayer(p => ({ ...p, display_title: title || null }))}
        />
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {/* Ember particles */}
      <div style={s.embers}>
        {EMBERS.map((e, i) => (
          <div key={i} style={{
            position: 'absolute', left: e.left,
            width: e.size, height: e.size,
            background: '#ffca45', borderRadius: '50%',
            filter: 'blur(1px)', opacity: 0,
            animation: `floatEmber ${e.dur} ${e.delay} infinite linear`,
          }} />
        ))}
      </div>

      {/* ── TOP BAR ── */}
      <header style={s.topbar}>
        {/* Logo */}
        <div style={s.logoArea}>
          <div style={s.logoHex}>
            <span className="material-symbols-outlined" style={{ fontSize: 26, color: '#fff', fontVariationSettings: "'FILL' 1" }}>sports_soccer</span>
          </div>
          <div>
            <div style={s.logoText}>FUTBOT</div>
            <div style={s.logoSub}>FOOTBALL CARD BATTLES</div>
          </div>
        </div>

        {/* Currency + Profile */}
        <div style={s.topRight}>
          {/* Mute toggle */}
          <button onClick={() => { const m = toggleMute(); setMuted(m) }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 32, height: 32, color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.7)', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {muted ? '🔇' : '🔊'}
          </button>
          {/* How to Play */}
          <button onClick={() => setShowHowToPlay(true)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 32, height: 32, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>?</button>
          {/* Currency pill */}
          <div style={s.currencyPill}>
            <div style={s.coinBlock}>
              <div style={s.coinIcon}>$</div>
              <span style={s.currencyVal}>{player?.coins?.toLocaleString() ?? '—'}</span>
            </div>
          </div>

          {/* Profile pill */}
          <div style={{ ...s.profilePill, cursor: 'pointer' }} onClick={() => setShowProfile(true)}>
            <img
              src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
              alt={user.username}
              style={s.avatar}
              onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
            />
            <div>
              <div style={s.profileName}>{user.username}</div>
              <div style={s.profileTitle}>
                <span className="material-symbols-outlined" style={{ fontSize: 10, fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                {player?.display_title ?? 'Player'}
              </div>
            </div>
          </div>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)} style={s.settingsBtn}><span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>settings</span></button>
        </div>
      </header>

      {/* ── PANELS ── */}
      <div style={s.main}>
        <div style={s.panels}>

          {/* LEFT — PACKS */}
          <div style={{ ...s.sidePanel, ...s.purplePanel }}>
            <div style={s.panelOverlay} />
            <div style={s.panelBottom}>
              <div style={s.panelFooter}>
                {totalPacks > 0 && <div style={s.badge}>{totalPacks}</div>}
                <button style={s.packBtn} onClick={() => setPage('packs')}>OPEN PACKS</button>
              </div>
            </div>
          </div>

          {/* CENTER — PLAY MATCH */}
          <div style={{ ...s.centerPanel, ...s.goldPanel }}>
            <div style={s.centerOverlay} />
            <div style={s.centerBottom}>
              <button style={{ ...s.findMatchBtn }} onClick={() => { setBattleMode?.('match'); setPage('battle') }}>
                FIND MATCH
              </button>
              <button style={s.friendBtn} onClick={() => { setBattleMode?.('friend'); setPage('battle') }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>group</span>
                PLAY WITH FRIEND
              </button>
            </div>
          </div>

          {/* RIGHT — DECKS */}
          <div style={{ ...s.sidePanel, ...s.bluePanel }}>
            <div style={s.panelOverlay} />
            <div style={s.panelBottom}>
              <div style={s.panelFooter}>
                <button style={s.decksBtn} onClick={() => setPage('decks')}>EDIT DECKS</button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── BOTTOM NAV ── */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <div style={s.dock}>
            {NAV.map(tab => {
              const active = tab.id === 'home'
              return (
                <button key={tab.id} id={`tutorial-nav-${tab.id}`} onClick={() => setPage(tab.id)} style={{ ...s.navItem, color: active ? '#ffca45' : 'rgba(255,255,255,0.45)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                  <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: active ? 700 : 400 }}>{tab.label}</span>
                  {active && <div style={s.activeLine} />}
                </button>
              )
            })}
          </div>
          <div style={{ position: 'absolute', right: 0 }}>
            <div style={{ ...s.onlineChip, cursor: 'pointer' }} onClick={() => setShowOnlinePanel(p => !p)}>
              <div style={{ display: 'flex' }}>
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #0f172a', objectFit: 'cover', marginRight: -6, zIndex: 2 }}
                  onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                />
                {participants.slice(0, 3).map((p, i) => (
                  <img
                    key={p.user_id}
                    src={p.avatar
                      ? `https://cdn.discordapp.com/avatars/${p.user_id}/${p.avatar}.png?size=32`
                      : `https://cdn.discordapp.com/embed/avatars/${Number(p.user_id) % 5}.png`}
                    style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #0f172a', objectFit: 'cover', marginRight: -6, zIndex: 1 - i }}
                    onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/1.png' }}
                  />
                ))}
              </div>
              <span style={s.onlineDot} />
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{participants.length + 1}</span>
              <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Online</span>
            </div>
            {showOnlinePanel && (
              <OnlinePanel
                user={user}
                participants={participants}
                onChallenge={(p, mode) => { setAutoChallenge?.({ ...p, mode }); setBattleMode?.('match'); setPage('battle') }}
                onClose={() => setShowOnlinePanel(false)}
                onViewProfile={p => { setViewingProfile(p); setShowOnlinePanel(false) }}
              />
            )}
          </div>
        </div>
      </nav>

      <style>{`
        @keyframes floatEmber {
          0%   { transform: translateY(100vh) scale(0.5); opacity: 0; }
          20%  { opacity: 0.8; }
          80%  { opacity: 0.6; }
          100% { transform: translateY(-20vh) scale(1.5) translateX(50px); opacity: 0; }
        }
        @keyframes pulseBtnGold {
          0%,100% { box-shadow: 0 4px 20px rgba(228,174,0,0.5); transform: scale(1); }
          50%      { box-shadow: 0 4px 30px rgba(228,174,0,0.7); transform: scale(1.02); }
        }
      `}</style>
    </div>
  )
}

const HEX = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const INTER = "'Inter', system-ui, sans-serif"

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100svh', overflow: 'hidden',
    background: `url('/background.png') center center / cover no-repeat`,
    backgroundColor: '#050914',
    color: '#dae2fd', fontFamily: INTER, position: 'relative',
  },
  embers: { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' },

  // Top bar
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', position: 'relative', zIndex: 10, flexShrink: 0,
  },
  logoArea: { display: 'flex', alignItems: 'center', gap: 12 },
  logoHex: {
    width: 48, height: 48, clipPath: HEX,
    background: '#171f33', border: '1px solid rgba(255,255,255,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 20px rgba(168,85,247,0.2)',
  },
  logoText: { fontFamily: MONTSERRAT, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 2, lineHeight: 1 },
  logoSub: { fontFamily: INTER, fontSize: 8, color: '#988d9f', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 3 },

  topRight: { display: 'flex', alignItems: 'center', gap: 12 },
  currencyPill: {
    display: 'flex', alignItems: 'center',
    background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)',
    borderRadius: 999, padding: '4px 4px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  coinBlock: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 10px' },
  gemBlock:  { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' },
  coinIcon: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'linear-gradient(135deg,#facc15,#d97706)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#3f2e00', fontWeight: 700, fontSize: 11,
  },
  currencyVal: { fontFamily: INTER, fontWeight: 700, fontSize: 14, color: '#fff' },
  addBtn: {
    width: 22, height: 22, borderRadius: '50%',
    background: 'rgba(255,255,255,0.1)', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', marginLeft: 2,
  },
  currencyDivider: { width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 2px' },

  profilePill: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)',
    borderRadius: 999, padding: '4px 20px 4px 4px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
    border: '1.5px solid #ef4444',
    boxShadow: '0 0 10px rgba(239,68,68,0.3)',
  },
  profileName: { fontFamily: INTER, fontWeight: 700, fontSize: 13, color: '#fff', lineHeight: 1.2 },
  profileTitle: {
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 9, color: '#ffca45', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
  },
  settingsBtn: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },

  // Panels
  main: {
    flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'center',
    padding: '10px 20px', position: 'relative', zIndex: 1, overflow: 'hidden',
  },
  panels: {
    display: 'flex', gap: 'clamp(8px, 1.2vw, 16px)',
    alignItems: 'stretch', width: '100%', maxWidth: 1200,
  },

  sidePanel: {
    flex: 1, borderRadius: 'clamp(12px,1.5vw,20px)', overflow: 'hidden',
    position: 'relative', backgroundSize: 'cover', backgroundPosition: 'center',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    minHeight: 0,
  },
  centerPanel: {
    flex: 1.4, borderRadius: 'clamp(12px,1.5vw,20px)', overflow: 'hidden',
    position: 'relative', backgroundSize: 'cover', backgroundPosition: 'center',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    minHeight: 0,
  },
  purplePanel: {
    backgroundImage: "url('/packs.png')",
    border: '1px solid rgba(183,109,255,0.6)',
    boxShadow: '0 0 40px rgba(183,109,255,0.2)',
  },
  goldPanel: {
    backgroundImage: "url('/playmatch.png')",
    border: '2px solid rgba(255,202,69,0.6)',
    boxShadow: '0 0 40px rgba(255,202,69,0.15)',
  },
  bluePanel: {
    backgroundImage: "url('/decks.png')",
    border: '1px solid rgba(59,130,246,0.5)',
    boxShadow: '0 0 40px rgba(59,130,246,0.2)',
  },

  panelOverlay: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'linear-gradient(to top, rgba(5,9,20,0.95) 0%, rgba(5,9,20,0.2) 50%, transparent 100%)',
  },
  centerOverlay: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'linear-gradient(to top, rgba(5,9,20,0.98) 0%, rgba(5,9,20,0.1) 45%, transparent 100%)',
  },
  panelBottom: { position: 'relative', zIndex: 1, padding: 'clamp(0px,1vh,0px) clamp(10px,1.2vw,14px) clamp(10px,1.5vh,16px)' },
  centerBottom: { position: 'relative', zIndex: 1, padding: 'clamp(0px,1vh,0px) clamp(12px,1.4vw,16px) clamp(12px,1.8vh,20px)', display: 'flex', flexDirection: 'column', gap: 'clamp(6px,0.8vh,10px)' },

  panelFooter: { display: 'flex', alignItems: 'center', gap: 8 },
  badge: {
    width: 26, height: 26, borderRadius: '50%', background: '#a855f7',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  packBtn: {
    flex: 1, background: 'rgba(58,27,122,0.8)', border: '1px solid rgba(168,85,247,0.6)',
    borderRadius: 12, color: '#fff', padding: '11px 0',
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 13,
    cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
    boxShadow: '0 0 15px rgba(183,109,255,0.3)',
  },
  findMatchBtn: {
    width: '100%',
    background: 'linear-gradient(180deg, #ffca45 0%, #e4ae00 100%)',
    border: 'none', borderRadius: 12, color: '#1a0a00',
    padding: '13px 0', fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 16,
    cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase',
    boxShadow: '0 4px 20px rgba(228,174,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
    animation: 'pulseBtnGold 2.5s infinite',
  },
  friendBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'rgba(11,19,38,0.6)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
    color: 'rgba(255,255,255,0.7)', padding: '11px 0',
    fontFamily: INTER, fontWeight: 600, fontSize: 14, cursor: 'pointer', letterSpacing: '0.05em',
  },
  decksBtn: {
    width: '100%', background: 'rgba(23,37,84,0.8)', border: '1px solid rgba(59,130,246,0.5)',
    borderRadius: 12, color: '#fff', padding: '11px 0',
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 13,
    cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
    boxShadow: '0 0 15px rgba(59,130,246,0.2)',
  },

  // Bottom nav
  nav: {
    position: 'relative', zIndex: 10, flexShrink: 0,
    padding: '0 24px 20px',
    background: 'linear-gradient(to top, #050914 0%, transparent 100%)',
  },
  navInner: { display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' },
  dock: { display: 'flex', alignItems: 'center', gap: 28, padding: '10px 0' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: 'none', cursor: 'pointer',
    position: 'relative', paddingBottom: 4,
    fontFamily: INTER, transition: 'color 0.15s',
  },
  activeLine: {
    position: 'absolute', bottom: -4, left: 0, right: 0, height: 2,
    background: '#ffca45', boxShadow: '0 0 8px rgba(255,202,69,0.8)', borderRadius: 1,
  },
  onlineChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
    borderRadius: 20, padding: '4px 12px', border: '1px solid rgba(255,255,255,0.1)',
  },
  onlineDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.8)',
  },
}
