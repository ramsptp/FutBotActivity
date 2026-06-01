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

export default function GuessThePlayer({ token, onBack }) {
  const [gameState, setGameState] = useState('loading') // loading, playing, guessing, result
  const [currentRound, setCurrentRound] = useState(null)
  const [guess, setGuess] = useState('')
  const [result, setResult] = useState(null)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [streak, setStreak] = useState(0)
  const [revealedClues, setRevealedClues] = useState([])

  const loadNewRound = useCallback(async () => {
    setGameState('loading')
    setGuess('')
    setResult(null)
    setRevealedClues([])
    
    try {
      const data = await apiFetch('/api/social/games/guess-player/random', token)
      setCurrentRound(data)
      setGameState('playing')
    } catch (err) {
      console.error('Failed to load round:', err)
      setGameState('error')
    }
  }, [token])

  useEffect(() => {
    loadNewRound()
  }, [loadNewRound])

  const handleGuess = async () => {
    if (!guess.trim()) return
    
    setGameState('guessing')
    
    try {
      const data = await apiFetch('/api/social/games/guess-player/check', token, {
        method: 'POST',
        body: JSON.stringify({
          guess: guess.trim(),
          player_id: currentRound.player_id
        })
      })
      
      setResult(data)
      setScore(prev => ({
        correct: prev.correct + (data.correct ? 1 : 0),
        total: prev.total + 1
      }))
      setStreak(prev => data.correct ? prev + 1 : 0)
      setGameState('result')
    } catch (err) {
      console.error('Failed to check guess:', err)
      setGameState('playing')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (gameState === 'playing') {
        handleGuess()
      } else if (gameState === 'result') {
        loadNewRound()
      }
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
        <button onClick={onBack} style={s.backBtnSmall}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div style={s.title}>Guess The Player</div>
        <div style={s.score}>
          {score.correct}/{score.total} | Streak: {streak}
        </div>
      </div>

      {/* Game Area */}
      <div style={s.gameArea}>
        {gameState === 'playing' && (
          <>
            <div style={s.clueTitle}>Clues:</div>
            <div style={s.cluesContainer}>
              {currentRound?.clues?.map((clue, idx) => (
                <div key={idx} style={s.clue}>
                  <span style={s.clueType}>{clue.type}:</span>
                  <span style={s.clueValue}>{clue.value}</span>
                </div>
              ))}
            </div>

            <div style={s.inputContainer}>
              <input
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter player name..."
                style={s.input}
                autoFocus
              />
              <button onClick={handleGuess} style={s.guessBtn}>
                Guess
              </button>
            </div>
          </>
        )}

        {gameState === 'guessing' && (
          <div style={s.loading}>Checking...</div>
        )}

        {gameState === 'result' && (
          <div style={s.resultContainer}>
            {result?.correct ? (
              <div style={s.correct}>Correct! 🎉</div>
            ) : (
              <div style={s.wrong}>Wrong! ❌</div>
            )}
            
            <div style={s.playerCard}>
              <div style={s.playerName}>{result?.player?.name}</div>
              <div style={s.playerDetails}>
                <span>{result?.player?.position}</span>
                <span>•</span>
                <span>{result?.player?.nationality}</span>
                <span>•</span>
                <span>{result?.player?.club}</span>
              </div>
              <div style={s.playerStats}>
                <div style={s.stat}>
                  <div style={s.statValue}>{result?.player?.goals || 0}</div>
                  <div style={s.statLabel}>Goals</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statValue}>{result?.player?.assists || 0}</div>
                  <div style={s.statLabel}>Assists</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statValue}>{result?.player?.appearances || 0}</div>
                  <div style={s.statLabel}>Apps</div>
                </div>
              </div>
            </div>

            {result?.correct === false && (
              <div style={s.yourGuess}>You guessed: {result?.your_guess}</div>
            )}

            <button onClick={loadNewRound} style={s.nextBtn}>
              Next Player →
            </button>
          </div>
        )}
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
  score: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)',
    background: 'rgba(15,23,41,0.8)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(168,85,247,0.3)',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },
  clueTitle: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
  },
  cluesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
  },
  clue: {
    background: 'rgba(15,23,41,0.9)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 12,
    padding: '16px 20px',
    display: 'flex',
    gap: '12px',
    backdropFilter: 'blur(8px)',
  },
  clueType: {
    color: '#a855f7',
    fontWeight: 700,
    fontSize: '14px',
    textTransform: 'uppercase',
    minWidth: '100px',
  },
  clueValue: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
  },
  inputContainer: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    marginTop: '20px',
  },
  input: {
    flex: 1,
    background: 'rgba(15,23,41,0.9)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 12,
    padding: '16px 20px',
    color: '#fff',
    fontSize: '16px',
    outline: 'none',
    backdropFilter: 'blur(8px)',
  },
  guessBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 32px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  resultContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    width: '100%',
  },
  correct: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#22c55e',
  },
  wrong: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#ef4444',
  },
  playerCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.5)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  playerName: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '8px',
  },
  playerDetails: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    marginBottom: '24px',
  },
  playerStats: {
    display: 'flex',
    justifyContent: 'center',
    gap: '32px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#a855f7',
  },
  statLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
  },
  yourGuess: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  nextBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 40px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '20px',
  },
}
