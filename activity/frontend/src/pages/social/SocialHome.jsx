import { useState, useEffect } from 'react'
import { apiFetch } from '../../lib/api'

const GAMES = [
  {
    id: 'guess-player',
    name: 'Guess The Player',
    icon: '🎯',
    description: 'Guess the footballer from clues',
    color: '#a855f7',
    status: 'ready',
  },
  {
    id: 'higher-lower',
    name: 'Higher or Lower',
    icon: '📈',
    description: 'Compare player stats',
    color: '#3b82f6',
    status: 'ready',
  },
  {
    id: 'football-survivor',
    name: 'Football Survivor',
    icon: '🏆',
    description: 'Vote and eliminate players',
    color: '#22c55e',
    status: 'ready',
  },
]

const EMBERS = [
  { left: '10%', size: 8, delay: '0s', dur: '7s' },
  { left: '25%', size: 12, delay: '2s', dur: '9s' },
  { left: '45%', size: 5, delay: '4s', dur: '6s' },
  { left: '65%', size: 8, delay: '1s', dur: '8s' },
  { left: '80%', size: 12, delay: '3s', dur: '10s' },
  { left: '92%', size: 5, delay: '5s', dur: '7s' },
]

export default function SocialHome({ token, user, onBackToMenu, onSelectGame }) {
  const [playerCount, setPlayerCount] = useState(null)
  const [hoveredGame, setHoveredGame] = useState(null)

  useEffect(() => {
    // Fetch player count from Supabase
    apiFetch('/api/social/player-count', token)
      .then(data => setPlayerCount(data.count))
      .catch(() => setPlayerCount(0))
  }, [token])

  return (
    <div style={s.root}>
      {/* Background */}
      <div style={s.bg} />

      {/* Embers */}
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

      {/* Header */}
      <div style={s.header}>
        <div style={s.logo}>
          <span style={s.logoText}>FUT</span>
          <span style={s.logoHighlight}>BOT</span>
          <span style={s.logoSocial}>SOCIAL</span>
        </div>
        {playerCount !== null && (
          <div style={s.playerCount}>
            {playerCount.toLocaleString()} players in database
          </div>
        )}
      </div>

      {/* Game Grid */}
      <div style={s.gameGrid}>
        {GAMES.map(game => (
          <button
            key={game.id}
            style={{
              ...s.gameCard,
              borderColor: hoveredGame === game.id ? game.color : 'rgba(255,255,255,0.1)',
              boxShadow: hoveredGame === game.id ? `0 0 30px ${game.color}30` : 'none',
            }}
            onMouseEnter={() => setHoveredGame(game.id)}
            onMouseLeave={() => setHoveredGame(null)}
            onClick={() => onSelectGame(game.id)}
            disabled={game.status === 'coming-soon'}
          >
            <div style={s.gameIcon}>{game.icon}</div>
            <div style={s.gameName}>{game.name}</div>
            <div style={s.gameDescription}>{game.description}</div>
            {game.status === 'coming-soon' && (
              <div style={s.comingSoon}>Coming Soon</div>
            )}
          </button>
        ))}
      </div>

      {/* Footer */}
      <div style={s.footer}>
        Quick party games for Discord voice channels
      </div>

      {/* Back button */}
      <button onClick={onBackToMenu} style={s.backButton}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Menu
      </button>

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
    padding: '40px 20px',
    gap: '32px',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: 'url(\'/background.png\') center center / cover no-repeat fixed',
    zIndex: -2,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    fontFamily: "'Montserrat', system-ui, sans-serif",
    fontWeight: 900,
    fontSize: '36px',
    letterSpacing: '2px',
    textShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  logoText: {
    color: '#fff',
  },
  logoHighlight: {
    color: '#a855f7',
  },
  logoSocial: {
    color: '#60a5fa',
    marginLeft: '8px',
    fontSize: '28px',
  },
  playerCount: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
  },
  gameGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    maxWidth: '900px',
    width: '100%',
  },
  gameCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '28px 24px',
    borderRadius: '20px',
    border: '2px solid',
    background: 'rgba(15,23,41,0.9)',
    backdropFilter: 'blur(12px)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
  },
  gameIcon: {
    fontSize: '48px',
    lineHeight: 1,
  },
  gameName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  gameDescription: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  comingSoon: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    fontSize: '10px',
    fontWeight: 700,
    color: '#fff',
    background: 'rgba(168,85,247,0.3)',
    padding: '4px 10px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  footer: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    marginTop: '8px',
  },
  backButton: {
    position: 'fixed',
    top: 16,
    left: 16,
    zIndex: 50,
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 10,
    padding: '10px 16px',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backdropFilter: 'blur(8px)',
  },
}
