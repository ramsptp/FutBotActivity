import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../lib/api'

const EMBERS = [
  { left: '10%', size: 8, delay: '0s', dur: '7s' },
  { left: '25%', size: 12, delay: '2s', dur: '9s' },
  { left: '45%', size: 5, delay: '4s', dur: '6s' },
  { left: '65%', size: 8, delay: '1s', dur: '8s' },
  { left: '80%', size: 12, delay: '3s', dur: '10s' },
  { left: '92%', size: 5, delay: '5s', dur: '7s' },
]

const STAT_OPTIONS = [
  { key: 'goals', label: 'Career Goals', icon: '⚽' },
  { key: 'assists', label: 'Career Assists', icon: '🅰️' },
  { key: 'appearances', label: 'Appearances', icon: '👕' },
]

const COUNTDOWN_SECONDS = 5
const TOTAL_ROUNDS = 15

export default function HigherOrLower({ token, user, onBack }) {
  const [gameState, setGameState] = useState('menu') // menu, playing, result, gameover
  const [selectedStat, setSelectedStat] = useState('goals')
  const [currentRound, setCurrentRound] = useState(1)
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [nextPlayerId, setNextPlayerId] = useState(null)
  const [statLabel, setStatLabel] = useState('Career Goals')
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [result, setResult] = useState(null)
  const [streak, setStreak] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('hol-highscore') || '0')
  })
  const [gameStats, setGameStats] = useState({ correct: 0, total: 0 })

  const timerRef = useRef(null)

  const startGame = async () => {
    setGameState('playing')
    setCurrentRound(1)
    setStreak(0)
    setGameStats({ correct: 0, total: 0 })
    await startRound()
  }

  const startRound = async () => {
    setHasAnswered(false)
    setResult(null)
    setCountdown(COUNTDOWN_SECONDS)

    try {
      const data = await apiFetch(`/api/social/games/higher-lower/start?stat=${selectedStat}`, token)
      setCurrentPlayer(data.current_player)
      setNextPlayerId(data.next_player_id)
      setStatLabel(data.stat_label)

      // Start countdown
      startCountdown()
    } catch (err) {
      console.error('Failed to start round:', err)
    }
  }

  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current)

    let timeLeft = COUNTDOWN_SECONDS
    setCountdown(timeLeft)

    timerRef.current = setInterval(() => {
      timeLeft -= 1
      setCountdown(timeLeft)

      if (timeLeft <= 0) {
        clearInterval(timerRef.current)
        if (!hasAnswered) {
          // Time's up - auto wrong answer
          handleGuess(null)
        }
      }
    }, 1000)
  }

  const handleGuess = async (guess) => {
    if (hasAnswered) return
    setHasAnswered(true)

    if (timerRef.current) clearInterval(timerRef.current)

    try {
      const data = await apiFetch('/api/social/games/higher-lower/guess2', token, {
        method: 'POST',
        body: JSON.stringify({
          guess: guess || 'timeout',
          current_player_id: currentPlayer.id,
          next_player_id: nextPlayerId,
          stat: selectedStat
        })
      })

      setResult(data)

      if (data.correct) {
        setStreak(prev => {
          const newStreak = prev + 1
          if (newStreak > highScore) {
            setHighScore(newStreak)
            localStorage.setItem('hol-highscore', newStreak.toString())
          }
          return newStreak
        })
        setGameStats(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }))
      } else {
        setStreak(0)
        setGameStats(prev => ({ ...prev, total: prev.total + 1 }))
      }

      if (currentRound >= TOTAL_ROUNDS) {
        setGameState('gameover')
      } else {
        setGameState('result')
      }
    } catch (err) {
      console.error('Failed to check guess:', err)
    }
  }

  const nextRound = async () => {
    if (currentRound >= TOTAL_ROUNDS) {
      setGameState('gameover')
    } else {
      setCurrentRound(prev => prev + 1)
      setGameState('playing')
      await startRound()
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Menu Screen
  if (gameState === 'menu') {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        {EMBERS.map((e, i) => (
          <span key={i} style={{
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
          }} />
        ))}

        <div style={s.header}>
          <button onClick={onBack} style={s.backBtnSmall}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div style={s.title}>Higher or Lower</div>
          <div style={s.highScoreBadge}>Best: {highScore}</div>
        </div>

        <div style={s.menuContainer}>
          <div style={s.statCard}>
            <div style={s.statTitle}>Select Stat Category</div>
            <div style={s.statOptions}>
              {STAT_OPTIONS.map((stat) => (
                <button
                  key={stat.key}
                  onClick={() => setSelectedStat(stat.key)}
                  style={{
                    ...s.statBtn,
                    background: selectedStat === stat.key
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                      : 'rgba(15,23,41,0.8)',
                    borderColor: selectedStat === stat.key ? '#a855f7' : 'rgba(168,85,247,0.3)',
                  }}
                >
                  <span style={s.statIcon}>{stat.icon}</span>
                  <span style={s.statLabel}>{stat.label}</span>
                </button>
              ))}
            </div>

            <div style={s.gameInfo}>
              <div style={s.infoItem}>⏱️ {COUNTDOWN_SECONDS} seconds per round</div>
              <div style={s.infoItem}>🎯 {TOTAL_ROUNDS} rounds</div>
              <div style={s.infoItem}>🏆 Build your streak!</div>
            </div>

            <button onClick={startGame} style={s.startBtn}>
              Start Game
            </button>
          </div>

          <div style={s.howToPlay}>
            <div style={s.howToPlayTitle}>How to Play</div>
            <ul style={s.howToPlayList}>
              <li>Compare two players' stats</li>
              <li>Guess if next player is Higher or Lower</li>
              <li>You have {COUNTDOWN_SECONDS} seconds to decide</li>
              <li>Build the longest streak possible!</li>
            </ul>
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

  // Game Over Screen
  if (gameState === 'gameover') {
    const accuracy = Math.round((gameStats.correct / gameStats.total) * 100) || 0
    return (
      <div style={s.container}>
        <div style={s.bg} />

        <div style={s.gameOverContainer}>
          <div style={s.gameOverTitle}>Game Over!</div>

          <div style={s.finalStats}>
            <div style={s.finalStat}>
              <div style={s.finalStatValue}>{gameStats.correct}/{TOTAL_ROUNDS}</div>
              <div style={s.finalStatLabel}>Correct</div>
            </div>
            <div style={s.finalStat}>
              <div style={s.finalStatValue}>{accuracy}%</div>
              <div style={s.finalStatLabel}>Accuracy</div>
            </div>
            <div style={s.finalStat}>
              <div style={s.finalStatValue}>{highScore}</div>
              <div style={s.finalStatLabel}>Best Streak</div>
            </div>
          </div>

          {accuracy >= 80 && (
            <div style={s.amazing}>Amazing! 🌟</div>
          )}

          <button onClick={() => setGameState('menu')} style={s.playAgainBtn}>
            Play Again
          </button>
          <button onClick={onBack} style={s.backBtnMenu}>
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  // Playing Screen
  return (
    <div style={s.container}>
      <div style={s.bg} />

      {EMBERS.map((e, i) => (
        <span key={i} style={{
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
        }} />
      ))}

      {/* Header */}
      <div style={s.header}>
        <button onClick={() => setGameState('menu')} style={s.backBtnSmall}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div style={s.roundInfo}>Round {currentRound}/{TOTAL_ROUNDS}</div>
        <div style={s.streakBadge}>Streak: {streak}</div>
      </div>

      {/* Timer Bar */}
      {gameState === 'playing' && (
        <div style={s.timerContainer}>
          <div style={{
            ...s.timerBar,
            width: `${(countdown / COUNTDOWN_SECONDS) * 100}%`,
            background: countdown <= 2 ? '#ef4444' : countdown <= 3 ? '#fbbf24' : '#22c55e',
          }} />
        </div>
      )}

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
            <div style={s.statValue}>{currentPlayer?.[selectedStat] || 0}</div>
            <div style={s.statLabelSmall}>{statLabel}</div>
          </div>
        </div>

        {/* VS */}
        <div style={s.vs}>VS</div>

        {/* Next Player */}
        <div style={s.playerCard}>
          <div style={s.cardLabel}>Next Player</div>
          <div style={s.playerNameHidden}>???</div>
          <div style={s.playerDetailsHidden}>Who could it be?</div>

          {gameState === 'playing' && !hasAnswered && (
            <div style={s.guessButtons}>
              <div style={s.guessLabel}>Has {statLabel}:</div>
              <div style={s.buttonRow}>
                <button
                  onClick={() => handleGuess('higher')}
                  style={{ ...s.guessBtn, background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                >
                  Higher ↑
                </button>
                <button
                  onClick={() => handleGuess('lower')}
                  style={{ ...s.guessBtn, background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                >
                  Lower ↓
                </button>
              </div>
            </div>
          )}

          {gameState === 'result' && result && (
            <div style={s.reveal}>
              <div style={s.revealedName}>{result.next_player.name}</div>
              <div style={s.revealValue}>{result.next_value}</div>
              <div style={s.revealLabel}>{statLabel}</div>

              {result.correct ? (
                <div style={s.correctMsg}>Correct! ✓</div>
              ) : (
                <div style={s.wrongMsg}>Wrong! ✗</div>
              )}

              <button onClick={nextRound} style={s.continueBtn}>
                {currentRound >= TOTAL_ROUNDS ? 'See Results' : 'Continue →'}
              </button>
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
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    fontFamily: "'Montserrat', system-ui, sans-serif",
  },
  highScoreBadge: {
    fontSize: '14px',
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.15)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(251,191,36,0.3)',
  },
  menuContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
  },
  statCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    backdropFilter: 'blur(12px)',
  },
  statTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
    textAlign: 'center',
    marginBottom: '24px',
  },
  statOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  statBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    borderRadius: 12,
    border: '2px solid',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  statIcon: {
    fontSize: '24px',
  },
  statLabel: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  gameInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(168,85,247,0.1)',
    borderRadius: 12,
  },
  infoItem: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)',
  },
  startBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '20px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  howToPlay: {
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: 16,
    padding: '24px',
    width: '100%',
  },
  howToPlayTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#a855f7',
    marginBottom: '12px',
    textTransform: 'uppercase',
  },
  howToPlayList: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    lineHeight: 1.8,
    margin: 0,
    paddingLeft: '20px',
  },
  timerContainer: {
    width: '100%',
    maxWidth: '600px',
    margin: '0 auto 20px',
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  timerBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 1s linear, background 0.3s',
  },
  roundInfo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  streakBadge: {
    fontSize: '14px',
    color: '#fff',
    background: 'rgba(168,85,247,0.3)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(168,85,247,0.5)',
  },
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
  },
  playerCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '28px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  cardLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginBottom: '8px',
  },
  playerName: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '4px',
  },
  playerDetails: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '16px',
  },
  statDisplay: {
    background: 'rgba(168,85,247,0.15)',
    borderRadius: 12,
    padding: '16px',
  },
  statValue: {
    fontSize: '42px',
    fontWeight: 800,
    color: '#a855f7',
  },
  statLabelSmall: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  vs: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#fbbf24',
    textShadow: '0 0 20px rgba(251,191,36,0.5)',
  },
  playerNameHidden: {
    fontSize: '22px',
    fontWeight: 800,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '4px',
  },
  playerDetailsHidden: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '16px',
  },
  guessButtons: {
    marginTop: '16px',
  },
  guessLabel: {
    fontSize: '13px',
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
    padding: '14px 28px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    flex: 1,
  },
  reveal: {
    marginTop: '16px',
  },
  revealedName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '4px',
  },
  revealValue: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#a855f7',
  },
  revealLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '12px',
  },
  correctMsg: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#22c55e',
    marginBottom: '12px',
  },
  wrongMsg: {
    fontSize: '22px',
    fontWeight: 800,
    color: '#ef4444',
    marginBottom: '12px',
  },
  continueBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '14px 36px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  gameOverContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
  },
  gameOverTitle: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#fff',
  },
  finalStats: {
    display: 'flex',
    gap: '32px',
    marginBottom: '16px',
  },
  finalStat: {
    textAlign: 'center',
  },
  finalStatValue: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#a855f7',
  },
  finalStatLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
  },
  amazing: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#fbbf24',
  },
  playAgainBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '20px 48px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '20px',
  },
  backBtnMenu: {
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 12,
    padding: '16px 32px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
