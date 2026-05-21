export default function ChallengeNotification({ challenge, onAccept, onDecline }) {
  if (!challenge) return null

  return (
    <div style={s.wrapper}>
      <div style={s.banner} className="anim-fadeUp">
        <div style={s.avatar}>⚔️</div>
        <div style={s.text}>
          <div style={s.title}>
            {challenge.mode === 'draft' ? '🎲 Fantasy Draft Challenge!' : '⚔️ Incoming Challenge!'}
          </div>
          <div style={s.sub}>
            <strong>{challenge.from_name}</strong>
            {challenge.mode === 'draft' ? ' wants a Fantasy Draft' : ' wants to battle'}
          </div>
        </div>
        <div style={s.actions}>
          <button style={s.acceptBtn} onClick={onAccept}>Accept</button>
          <button style={s.declineBtn} onClick={onDecline}>✕</button>
        </div>
      </div>
    </div>
  )
}

const s = {
  wrapper: {
    position: 'fixed', top: 16, left: 0, right: 0,
    display: 'flex', justifyContent: 'center',
    zIndex: 999, padding: '0 16px', pointerEvents: 'none',
  },
  banner: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(10,14,26,0.95)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(240,192,64,0.4)',
    borderRadius: 14, padding: '12px 16px',
    boxShadow: '0 0 30px rgba(240,192,64,0.15), 0 8px 32px rgba(0,0,0,0.5)',
    maxWidth: 420, width: '100%', pointerEvents: 'auto',
  },
  avatar: { fontSize: 28, flexShrink: 0 },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: 700, color: '#f0c040', letterSpacing: 0.5 },
  sub: { fontSize: 14, color: '#fff', marginTop: 2 },
  actions: { display: 'flex', gap: 8, flexShrink: 0 },
  acceptBtn: {
    background: 'linear-gradient(135deg,#22c55e,#16a34a)',
    border: 'none', borderRadius: 8, color: '#fff',
    padding: '7px 16px', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', boxShadow: '0 0 12px rgba(34,197,94,0.3)',
  },
  declineBtn: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, color: '#ef4444',
    padding: '7px 10px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  },
}
