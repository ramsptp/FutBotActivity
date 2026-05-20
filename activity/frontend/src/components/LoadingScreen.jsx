export default function LoadingScreen() {
  return (
    <div style={s.root}>
      <div style={s.bg} />

      <div style={s.content}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <img src="/futbot.png" alt="FutBot" style={s.logoImg} />
        </div>

        {/* Spinner */}
        <div style={s.spinnerTrack}>
          <div style={s.spinner} />
        </div>

        <div style={s.loadingText}>Loading…</div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

const s = {
  root: {
    position: 'fixed', inset: 0,
    background: `url('/background.png') center center / cover no-repeat`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'rgba(5,7,15,0.75)',
  },
  content: {
    position: 'relative', zIndex: 1,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
  },
  logoWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoImg: {
    width: 200, height: 'auto',
    filter: 'drop-shadow(0 0 30px rgba(168,85,247,0.5))',
  },
  spinnerTrack: {
    width: 48, height: 48, borderRadius: '50%',
    border: '3px solid rgba(168,85,247,0.2)',
    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinner: {
    position: 'absolute', inset: -3,
    borderRadius: '50%',
    border: '3px solid transparent',
    borderTopColor: '#a855f7',
    borderRightColor: '#f0c040',
    animation: 'spin 0.9s linear infinite',
  },
  loadingText: {
    fontSize: 13, color: '#475569', letterSpacing: 1,
    animation: 'pulse 1.5s ease infinite',
  },
}
