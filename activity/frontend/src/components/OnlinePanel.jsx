import { useEffect, useRef, useState } from 'react'

export default function OnlinePanel({ user, participants, onChallenge, onClose, onViewProfile }) {
  const ref = useRef(null)
  const [pickingMode, setPickingMode] = useState(null) // participant being challenged

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function challenge(p, mode) {
    onChallenge(p, mode)
    onClose()
  }

  return (
    <div ref={ref} style={s.panel}>
      <div style={s.heading}>In this session</div>

      {/* Yourself */}
      <div style={s.row}>
        <img src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=40`}
          style={s.avatar} onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }} />
        <div style={{ flex: 1 }}>
          <div style={s.name}>{user.username} <span style={s.you}>(you)</span></div>
          <div style={s.online}>● Online</div>
        </div>
      </div>

      {participants.length === 0 ? (
        <div style={s.empty}>No one else here yet</div>
      ) : participants.map(p => (
        <div key={p.user_id}>
          <div style={s.row}>
            <img
              src={p.avatar ? `https://cdn.discordapp.com/avatars/${p.user_id}/${p.avatar}.png?size=40`
                : `https://cdn.discordapp.com/embed/avatars/${Number(p.user_id) % 5}.png`}
              style={{ ...s.avatar, cursor: onViewProfile ? 'pointer' : 'default' }}
              onClick={() => onViewProfile && onViewProfile(p)}
              onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
            />
            <div style={{ flex: 1, cursor: onViewProfile ? 'pointer' : 'default' }} onClick={() => onViewProfile && onViewProfile(p)}>
              <div style={{ ...s.name, color: onViewProfile ? '#c4b5fd' : '#e2e8f0' }}>{p.name}</div>
              <div style={s.online}>● Online</div>
            </div>
            <button
              onClick={() => setPickingMode(pickingMode?.user_id === p.user_id ? null : p)}
              style={{ ...s.challengeBtn, background: pickingMode?.user_id === p.user_id ? 'rgba(240,192,64,0.25)' : 'rgba(240,192,64,0.1)' }}
            >
              ⚔ Challenge
            </button>
          </div>

          {/* Mode picker — shown inline below row */}
          {pickingMode?.user_id === p.user_id && (
            <div style={s.modePicker} className="anim-fadeUp">
              <div style={s.modeLabel}>Choose mode:</div>
              <button onClick={() => challenge(p, 'draft')} style={s.modeBtn}>
                <span style={{ fontSize: 16 }}>🎲</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>Fantasy Draft</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Pick from random cards</div>
                </div>
              </button>
              <button onClick={() => challenge(p, 'deck')} style={s.modeBtn}>
                <span style={{ fontSize: 16 }}>🃏</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>Use My Deck</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>Use your saved squad</div>
                </div>
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const s = {
  panel: {
    position: 'absolute', bottom: '100%', right: 0, marginBottom: 10,
    width: 270, background: 'rgba(10,14,26,0.97)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14, padding: '10px 0',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
    zIndex: 200,
  },
  heading: { fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '2px 14px 8px' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', transition: 'background 0.15s' },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.1)' },
  name: { fontSize: 13, fontWeight: 600, color: '#e2e8f0' },
  you: { fontSize: 11, color: '#475569', fontWeight: 400 },
  online: { fontSize: 10, color: '#4ade80', fontWeight: 600 },
  challengeBtn: {
    background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.35)',
    borderRadius: 7, color: '#ffca45', padding: '5px 10px',
    fontSize: 11, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.05em', whiteSpace: 'nowrap',
  },
  modePicker: {
    margin: '0 14px 10px', background: 'rgba(255,255,255,0.04)',
    borderRadius: 10, padding: '10px', border: '1px solid rgba(255,255,255,0.07)',
  },
  modeLabel: { fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  modeBtn: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8, padding: '8px 10px', color: '#e2e8f0', cursor: 'pointer',
    marginBottom: 6, textAlign: 'left', transition: 'background 0.15s',
  },
  empty: { fontSize: 13, color: '#475569', padding: '8px 14px 4px', textAlign: 'center' },
}
