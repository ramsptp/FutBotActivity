import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../lib/api'

const EMBERS = [
  { left: '10%', size: 8, delay: '0s', dur: '7s' },
  { left: '25%', size: 12, delay: '2s', dur: '9s' },
  { left: '45%', size: 5, delay: '4s', dur: '6s' },
  { left: '65%', size: 8, delay: '1s', dur: '8s' },
  { left: '80%', size: 12, delay: '3s', dur: '10s' },
  { left: '92%', size: 5, delay: '5s', dur: '7s' },
]

const STAT_LABELS = {
  goals: 'Career Goals',
  assists: 'Career Assists',
  appearances: 'Career Appearances',
}

export default function HigherOrLower({ token, onBack }) {
  const [gameState, setGameState] = useState('loading')
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [nextPlayerId, setNextPlayerId] = useState(null)
  const [stat, setStat] = useState('goals')
  const [streak, setStreak] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('hol-highscore') || '0')
  })
  const [result, setResult] = useState(null)
  const [nextPlayer, setNextPlayer] = useState(null)

  const startGame = useCallback(async () => {
    setGameState('loading')
    setResult(null)
    
    try {
      const data = await apiFetch('/api/social/games/higher-lower/start', token)
      setCurrentPlayer(data.current_player)
      setNextPlayerId(data.next_player_id)
      setStat(data.stat)
      setGameState('playing')
    } catch (err) {
      console.error('Failed to start game:', err)
      setGameState('error')
    }
  }, [token])

  useEffect(() => {
    startGame()
  }, [startGame])

  const handleGuess = async (guess) => {
    if (gameState !== 'playing') return
    
    setGameState('checking')
    
    try {
      const data = await apiFetch('/api/social/games/higher-lower/guess', token, {
        method: 'POST',
        body: JSON.stringify({
          guess,
          current_player_id: currentPlayer.id,
          next_player_id: nextPlayerId,
          stat
        })
      })
      
      setResult(data)
      setNextPlayer(data.next_player)
      
      if (data.correct) {
        setStreak(prev => {
          const newStreak = prev + 1
          if (newStreak > highScore) {
            setHighScore(newStreak)
            localStorage.setItem('hol-highscore', newStreak.toString())
          }
          return newStreak
        })
        setGameState('correct')
      } else {
        setStreak(0)
        setGameState('wrong')
      }
    } catch (err) {
      console.error('Failed to check guess:', err)
      setGameState('playing')
    }
  }

  const continueGame = () => {
    if (result?.new_next_player_id) {
      setCurrentPlayer(nextPlayer)
      setNextPlayerId(result.new_next_player_id)
      setResult(null)
      setNextPlayer(null)
      setGameState('playing')
    } else {
      startGame()
    }
  }

  if (gameState === 'loading') {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        <div style={s.loading}>Loading...</div>
      </div>
    )
  }

  if (gameState === 'error') {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        <div style={s.error}>
          <div>Failed to load game</div>
          <button onClick={onBack} style={s.backBtn}>Back</button>
        </div>
      </div>
    )
  }

  return (
    <div style={s.container}>
      <div style={s.bg} />
      
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
        <button onClick={onBack} style={s.backBtnSmall}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div style={s.title}>Higher or Lower</div>
        <div style={s.scores}>
          <div style={s.streak}>Streak: {streak}</div>
          <div style={s.highScore}>Best: {highScore}</div>
        </div>
      </div>

      {/* Game Area */}
      <div style={s.gameArea}>
        {/* Current Player */}
        <div style={s.playerCard}>
          <div style={s.cardLabel}>Current Player</div>
          <div style={s.playerName}>{currentPlayer?.name}</div>
          <div style={s.playerDetails}>
            {currentPlayer?.position} • {currentPlayer?.club}
          </div>
          <div style={s.statDisplay}>
            <div style={s.statValue}>{currentPlayer?.[stat] || 0}</div>
            <div style={s.statLabel}>{STAT_LABELS[stat]}</div>
          </div>
        </div>

        {/* VS */}
        <div style={s.vs}>VS</div>

        {/* Next Player (Hidden Stat) */}
        <div style={s.playerCard}>
          <div style={s.cardLabel}>Next Player</div>
          <div style={s.playerName}>{nextPlayer?.name || '???'}</div>
          <div style={s.playerDetails}>
            {nextPlayer ? `${nextPlayer?.position} • ${nextPlayer?.club}` : 'Hidden'}
          </div>
          
          {gameState === 'playing' && (
            <div style={s.guessButtons}>
              <div style={s.guessLabel}>Has {STAT_LABELS[stat].toLowerCase()}:</div>
              <div style={s.buttonRow}>
                <button 
                  onClick={() => handleGuess('higher')} 
                  style={{...s.guessBtn, background: 'linear-gradient(135deg, #22c55e, #16a34a)'}}
                >
                  Higher ↑
                </button>
                <button 
                  onClick={() => handleGuess('lower')} 
                  style={{...s.guessBtn, background: 'linear-gradient(135deg, #ef4444, #dc2626)'}}
                >
                  Lower ↓
                </button>
              </div>
            </div>
          )}

          {(gameState === 'correct' || gameState === 'wrong') && (
            <div style={s.reveal}>
              <div style={s.revealValue}>{result?.next_value || 0}</div>
              <div style={s.revealLabel}>{STAT_LABELS[stat]}</div>
              
              {gameState === 'correct' ? (
                <div style={s.correctMsg}>Correct! ✓</div>
              ) : (
                <div style={s.wrongMsg}>Wrong! ✗</div>
              )}
              
              {gameState === 'correct' && (
                <button onClick={continueGame} style={s.continueBtn}>
                  Continue →
                </button>
              )}
              
              {gameState === 'wrong' && (
                <button onClick={startGame} style={s.restartBtn}>
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
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
  container: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bg: {
    position: 'fixed',
    inset: 0,
    background: "url('/background.png') center center / cover no-repeat fixed",
    zIndex: -2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    marginBottom: '20px',
  },
  backBtnSmall: {
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 10,
    padding: '8px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    backdropFilter: 'blur(8px)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
    fontFamily: "'Montserrat', system-ui, sans-serif",
  },
  scores: {
    display: 'flex',
    gap: '12px',
  },
  streak: {
    fontSize: '14px',
    color: '#fff',
    background: 'rgba(168,85,247,0.3)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(168,85,247,0.5)',
  },
  highScore: {
    fontSize: '14px',
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.2)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(251,191,36,0.4)',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
  },
  playerCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  cardLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  playerName: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '4px',
  },
  playerDetails: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '20px',
  },
  statDisplay: {
    background: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    padding: '20px',
  },
  statValue: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#a855f7',
  },
  statLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  vs: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#fbbf24',
    textShadow: '0 0 20px rgba(251,191,36,0.5)',
  },
  guessButtons: {
    marginTop: '20px',
  },
  guessLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '12px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  guessBtn: {
    border: 'none',
    borderRadius: 12,
    padding: '16px 32px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    flex: 1,
  },
  reveal: {
    marginTop: '20px',
  },
  revealValue: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#a855f7',
  },
  revealLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '16px',
  },
  correctMsg: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#22c55e',
    marginBottom: '16px',
  },
  wrongMsg: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#ef4444',
    marginBottom: '16px',
  },
  continueBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 40px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  restartBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 40px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  loading: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '18px',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    color: '#ef4444',
    fontSize: '18px',
  },
  backBtn: {
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 10,
    padding: '12px 24px',
    color: '#fff',
    cursor: 'pointer',
  },
}
