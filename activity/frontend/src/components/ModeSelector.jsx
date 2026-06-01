import { useState, useEffect } from 'react'

const EMBERS = [
  { left: '10%', size: 8, delay: '0s', dur: '7s' },
  { left: '25%', size: 12, delay: '2s', dur: '9s' },
  { left: '45%', size: 5, delay: '4s', dur: '6s' },
  { left: '65%', size: 8, delay: '1s', dur: '8s' },
  { left: '80%', size: 12, delay: '3s', dur: '10s' },
  { left: '92%', size: 5, delay: '5s', dur: '7s' },
]

export default function ModeSelector({ onSelectMode }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div style={s.root}>
      {/* Stadium background */}
      <div style={s.bg} />

      {/* Animated embers */}
      {EMBERS.map((e, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: e.left,
            bottom: '-20px',
            width: e.size,
            height: e.size,
            background: 'radial-gradient(circle, rgba(255,200,100,0.9) 0%, rgba(255,100,50,0.4) 50%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(2px)',
            animation: `ember-rise ${e.dur} ease-in infinite`,
            animationDelay: e.delay,
            opacity: 0.7,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Logo */}
      <div style={s.logo}>
        <span style={s.logoText}>FUT</span>
        <span style={s.logoHighlight}>BOT</span>
      </div>

      {/* Subtitle */}
      <div style={s.subtitle}>Choose your game mode</div>

      {/* Mode Cards */}
      <div style={s.cardsContainer}>
        {/* Arena Card */}
        <button
          style={{
            ...s.card,
            ...(hovered === 'arena' ? s.cardHover : {}),
            background: 'linear-gradient(145deg, rgba(15,23,41,0.95) 0%, rgba(30,41,59,0.9) 100%)',
            borderColor: hovered === 'arena' ? 'rgba(168,85,247,0.8)' : 'rgba(168,85,247,0.3)',
          }}
          onMouseEnter={() => setHovered('arena')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelectMode('arena')}
        >
          <div style={s.cardIcon}>🏟️</div>
          <div style={s.cardTitle}>ARENA</div>
          <div style={s.cardDescription}>
            Card Battles & Trading
            <br />
            <span style={s.cardSubtext}>Build decks, open packs, battle friends</span>
          </div>
          <div style={s.cardFeatures}>
            <span style={s.feature}>⚔️ PvP Battles</span>
            <span style={s.feature}>🎴 Card Collection</span>
            <span style={s.feature}>🏪 Transfer Market</span>
          </div>
        </button>

        {/* Social Card */}
        <button
          style={{
            ...s.card,
            ...(hovered === 'social' ? s.cardHover : {}),
            background: 'linear-gradient(145deg, rgba(15,23,41,0.95) 0%, rgba(30,41,59,0.9) 100%)',
            borderColor: hovered === 'social' ? 'rgba(59,130,246,0.8)' : 'rgba(59,130,246,0.3)',
          }}
          onMouseEnter={() => setHovered('social')}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onSelectMode('social')}
        >
          <div style={s.cardIcon}>🎉</div>
          <div style={{ ...s.cardTitle, color: '#60a5fa' }}>SOCIAL</div>
          <div style={s.cardDescription}>
            Party Games
            <br />
            <span style={s.cardSubtext}>Quick games with friends in voice channels</span>
          </div>
          <div style={s.cardFeatures}>
            <span style={{ ...s.feature, background: 'rgba(59,130,246,0.15)', color: '#93bbfc' }}>🎯 Guess The Player</span>
            <span style={{ ...s.feature, background: 'rgba(59,130,246,0.15)', color: '#93bbfc' }}>📈 Higher or Lower</span>
            <span style={{ ...s.feature, background: 'rgba(59,130,246,0.15)', color: '#93bbfc' }}>🏆 Football Survivor</span>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        Play with friends in Discord voice channels
      </div>

      <style>{`
        @keyframes ember-rise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.5; }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const s = {
  root: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
    gap: '24px',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'url(\'/background.png\') center center / cover no-repeat fixed',
    zIndex: -2,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontWeight: 900,
    fontSize: '42px',
    letterSpacing: '2px',
    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  logoText: {
    color: '#fff',
  },
  logoHighlight: {
    color: '#a855f7',
  },
  subtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    marginTop: '-12px',
  },
  cardsContainer: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: '900px',
    width: '100%',
  },
  card: {
    flex: '1 1 300px',
    maxWidth: '380px',
    minHeight: '320px',
    padding: '32px 28px',
    borderRadius: '24px',
    border: '2px solid',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  cardHover: {
    transform: 'translateY(-8px) scale(1.02)',
    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
  },
  cardIcon: {
    fontSize: '56px',
    lineHeight: 1,
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
  },
  cardTitle: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#a855f7',
    letterSpacing: '2px',
    fontFamily: "'Montserrat', system-ui, sans-serif",
  },
  cardDescription: {
    fontSize: '16px',
    color: '#fff',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  cardSubtext: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 400,
  },
  cardFeatures: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '8px',
    width: '100%',
  },
  feature: {
    fontSize: '13px',
    color: '#c4a5f7',
    background: 'rgba(168,85,247,0.15)',
    padding: '10px 16px',
    borderRadius: '10px',
    textAlign: 'center',
    fontWeight: 500,
  },
  footer: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '16px',
  },
}
