import { useState } from 'react'
import { apiFetch } from '../lib/api'
import OnlinePanel from './OnlinePanel'
import ProfileModal from './ProfileModal'

const TABS = [
  { id: 'home',       icon: 'home',          label: 'Home' },
  { id: 'collection', icon: 'style',          label: 'Collection' },
  { id: 'shop',       icon: 'shopping_cart',  label: 'Shop' },
  { id: 'packs',      icon: 'inventory_2',    label: 'Packs' },
  { id: 'decks',      icon: 'layers',         label: 'Decks' },
  { id: 'battle',     icon: 'swords',         label: 'Battle' },
]

export default function Nav({ page, setPage, participants = [], user, token, setBattleMode, setAutoChallenge }) {
  const [showPanel, setShowPanel]       = useState(false)
  const [viewingProfile, setViewingProfile] = useState(null)

  function handleChallenge(participant) {
    setAutoChallenge?.(participant)
    setBattleMode?.('match')
    setPage('battle')
  }

  return (
    <>
    <nav style={s.nav}>
      <div style={s.inner}>
        {/* Centered dock */}
        <div style={s.dock}>
          {TABS.map(tab => {
            const active = tab.id === page
            return (
              <button
                key={tab.id}
                id={`tutorial-nav-${tab.id}`}
                onClick={() => setPage(tab.id)}
                style={{ ...s.item, color: active ? '#ffca45' : 'rgba(255,255,255,0.9)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{tab.icon}</span>
                <span style={{ ...s.label, fontWeight: active ? 700 : 400 }}>{tab.label}</span>
                {active && <div style={s.activeLine} />}
              </button>
            )
          })}
        </div>

        {/* Online indicator — clickable */}
        <div style={{ position: 'absolute', right: 0, zIndex: 1 }}>
          <div style={{ ...s.online, position: 'static', cursor: 'pointer' }} onClick={() => setShowPanel(p => !p)}>
            {user && (
              <div style={{ display: 'flex', marginRight: 2 }}>
                <img
                  src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                  style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #050914', objectFit: 'cover', marginRight: -6, zIndex: 2 }}
                  onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                />
                {participants.slice(0, 3).map((p, i) => (
                  <img
                    key={p.user_id}
                    src={p.avatar
                      ? `https://cdn.discordapp.com/avatars/${p.user_id}/${p.avatar}.png?size=32`
                      : `https://cdn.discordapp.com/embed/avatars/${Number(p.user_id) % 5}.png`}
                    style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #050914', objectFit: 'cover', marginRight: -6, zIndex: 1 - i }}
                    onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/1.png' }}
                  />
                ))}
              </div>
            )}
            <span style={s.onlineDot} />
            <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{participants.length + 1}</span>
            <span style={s.onlineText}>Online</span>
          </div>

          {showPanel && user && (
            <OnlinePanel
              user={user}
              participants={participants}
              onChallenge={handleChallenge}
              onClose={() => setShowPanel(false)}
              onViewProfile={p => { setViewingProfile(p); setShowPanel(false) }}
            />
          )}
        </div>
      </div>
    </nav>

    {viewingProfile && user && (
      <ProfileModal
        user={user}
        token={token}
        viewUser={viewingProfile}
        onClose={() => setViewingProfile(null)}
      />
    )}
    </>
  )
}

const s = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
    padding: '0 24px 20px',
    background: 'linear-gradient(to top, #050914 0%, transparent 100%)',
    pointerEvents: 'none',
  },
  inner: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', pointerEvents: 'auto',
  },
  dock: {
    display: 'flex', alignItems: 'center', gap: 28,
    padding: '12px 32px',
  },
  item: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'transparent', border: 'none', cursor: 'pointer',
    position: 'relative', paddingBottom: 4,
    transition: 'transform 0.15s, color 0.15s',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  label: {
    fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  activeLine: {
    position: 'absolute', bottom: -4, left: 0, right: 0, height: 2,
    background: '#ffca45',
    boxShadow: '0 0 8px rgba(255,202,69,0.8)',
    borderRadius: 1,
  },
  online: {
    position: 'absolute', right: 0,
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)',
    borderRadius: 20, padding: '4px 12px',
    border: '1px solid rgba(255,255,255,0.1)',
    userSelect: 'none',
  },
  onlineDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.8)',
  },
  onlineText: { fontSize: 11, color: '#4ade80', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
}
