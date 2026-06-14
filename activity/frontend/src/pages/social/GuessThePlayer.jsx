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

const CLUE_POINTS = [10, 8, 6, 4, 2]

export default function GuessThePlayer({ token, onBack }) {
  const [gameState, setGameState] = useState('menu') // menu, playing, result
  const [difficulty, setDifficulty] = useState('medium')
  const [currentRound, setCurrentRound] = useState(1)
  const [maxRounds] = useState(10)
  const [roundData, setRoundData] = useState(null)
  const [cluesRevealed, setCluesRevealed] = useState(0)
  const [guess, setGuess] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [result, setResult] = useState(null)
  const [scores, setScores] = useState({ player: 0, total: 0 })
  const [gameOver, setGameOver] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  
  const inputRef = useRef(null)
  const suggestionsRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Search for players with debounce
  const searchPlayers = useCallback(async (query) => {
    if (!query.trim() || query.length < 1) {
      setSuggestions([])
      return
    }
    
    try {
      const data = await apiFetch(`/api/social/games/guess-player/search?query=${encodeURIComponent(query)}&limit=5`, token)
      setSuggestions(data.results || [])
      setHighlightedIndex(-1)
    } catch (err) {
      console.error('Search error:', err)
      setSuggestions([])
    }
  }, [token])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (guess.trim()) {
        searchPlayers(guess)
      } else {
        setSuggestions([])
      }
    }, 100) // 100ms debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [guess, searchPlayers])

  const startGame = () => {
    setGameState('playing')
    setCurrentRound(1)
    setScores({ player: 0, total: 0 })
    setGameOver(false)
    startRound()
  }

  const startRound = async () => {
    setResult(null)
    setGuess('')
    setSuggestions([])
    setCluesRevealed(1) // Start with 1 clue
    
    try {
      const data = await apiFetch('/api/social/games/guess-player/random', token)
      // Reorder clues based on difficulty
      const shuffled = [...data.clues].sort(() => Math.random() - 0.5)
      setRoundData({ ...data, clues: shuffled })
    } catch (err) {
      console.error('Failed to load round:', err)
    }
  }

  const handleGuess = async (playerName) => {
    if (!playerName.trim() || isChecking) return
    
    if (!roundData?.player_id) {
      setErrorMsg('Error: No player selected. Please refresh.')
      return
    }
    
    setIsChecking(true)
    setErrorMsg(null)
    
    const requestBody = {
      guess: playerName.trim(),
      player_id: Number(roundData.player_id)
    }
    
    try {
      const data = await apiFetch('/api/social/games/guess-player/check2', token, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })
      
      if (data.correct) {
        // Correct! Award points based on clues revealed
        const points = CLUE_POINTS[Math.min(cluesRevealed - 1, CLUE_POINTS.length - 1)]
        setScores(prev => ({ 
          player: prev.player + points, 
          total: prev.total + 10 
        }))
        setResult({ ...data, status: 'correct' })
        setSuggestions([])
      } else {
        // Wrong! Reveal next clue immediately
        setErrorMsg(`❌ Wrong! "${playerName}" is not the answer.`)
        setGuess('')
        // Auto-reveal next clue immediately
        if (cluesRevealed < (roundData?.clues?.length || 0)) {
          setCluesRevealed(prev => prev + 1)
        }
      }
    } catch (err) {
      console.error('Failed to check guess:', err)
      setErrorMsg(`Failed: ${err.message}`)
    } finally {
      setIsChecking(false)
    }
  }

  const revealNextClue = () => {
    if (cluesRevealed < (roundData?.clues?.length || 0)) {
      setCluesRevealed(prev => prev + 1)
      setErrorMsg(null)
    }
  }

  const skipToAnswer = () => {
    // Reveal all clues and mark as wrong
    setCluesRevealed(roundData?.clues?.length || 0)
    setScores(prev => ({ ...prev, total: prev.total + 10 }))
    setResult({
      correct: false,
      status: 'gave_up',
      player: { name: roundData?.player_name || 'Unknown' },
      your_guess: 'Gave up'
    })
  }

  const nextRound = () => {
    if (currentRound >= maxRounds) {
      setGameOver(true)
    } else {
      setCurrentRound(prev => prev + 1)
      startRound()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        setGuess(suggestions[highlightedIndex].name)
        setSuggestions([])
        handleGuess(suggestions[highlightedIndex].name)
      } else if (guess.trim()) {
        handleGuess(guess)
      }
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

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
          <div style={s.title}>Guess The Player</div>
          <div style={s.spacer} />
        </div>

        <div style={s.menuContainer}>
          <div style={s.difficultyCard}>
            <div style={s.difficultyTitle}>Select Difficulty</div>
            
            <div style={s.difficultyOptions}>
              {['easy', 'medium', 'hard'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  style={{
                    ...s.difficultyBtn,
                    background: difficulty === diff 
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)' 
                      : 'rgba(15,23,41,0.8)',
                    borderColor: difficulty === diff ? '#a855f7' : 'rgba(168,85,247,0.3)',
                  }}
                >
                  <div style={s.diffName}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</div>
                  <div style={s.diffDesc}>
                    {diff === 'easy' && '3 clues, generous scoring'}
                    {diff === 'medium' && '2 clues, standard scoring'}
                    {diff === 'hard' && '1 clue, expert mode'}
                  </div>
                </button>
              ))}
            </div>

            <button onClick={startGame} style={s.startBtn}>
              Start Game ({maxRounds} Rounds)
            </button>
          </div>

          <div style={s.howToPlay}>
            <div style={s.howToPlayTitle}>How to Play</div>
            <ul style={s.howToPlayList}>
              <li>Guess the hidden footballer from clues</li>
              <li>Type a name and select from suggestions</li>
              <li>Faster guesses = more points</li>
              <li>10 rounds to get the highest score!</li>
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
  if (gameOver) {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        
        <div style={s.gameOverContainer}>
          <div style={s.gameOverTitle}>Game Over!</div>
          <div style={s.finalScore}>
            {scores.player} / {scores.total} points
          </div>
          <div style={s.accuracy}>
            {Math.round((scores.player / scores.total) * 100)}% accuracy
          </div>
          
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
        <div style={s.roundInfo}>Round {currentRound}/{maxRounds}</div>
        <div style={s.score}>Score: {scores.player}/{scores.total}</div>
      </div>

      {/* Game Area */}
      <div style={s.gameArea}>
        {!result ? (
          <>
            {/* Clues */}
            <div style={s.cluesContainer}>
              {roundData?.clues?.slice(0, cluesRevealed).map((clue, idx) => (
                <div key={idx} style={s.clue}>
                  <span style={s.clueType}>{clue.type}:</span>
                  <span style={s.clueValue}>{clue.value}</span>
                  <span style={s.pointsBadge}>+{CLUE_POINTS[idx]} pts</span>
                </div>
              ))}
            </div>

            {/* Reveal Next Clue Button */}
            {cluesRevealed < (roundData?.clues?.length || 0) && (
              <button onClick={revealNextClue} style={s.revealBtn}>
                Reveal Next Clue (-{CLUE_POINTS[cluesRevealed]} pts)
              </button>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div style={s.errorMsg}>{errorMsg}</div>
            )}

            {/* Search Input with Autocomplete */}
            <div style={s.searchContainer} ref={suggestionsRef}>
              <input
                ref={inputRef}
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isChecking ? 'Checking...' : 'Type player name...'}
                style={{
                  ...s.searchInput,
                  opacity: isChecking ? 0.6 : 1,
                }}
                autoFocus
                autoComplete="off"
                disabled={isChecking}
              />
              
              {/* Autocomplete Dropdown */}
              {suggestions.length > 0 && !isChecking && (
                <div style={s.suggestionsDropdown}>
                  {suggestions.map((suggestion, idx) => (
                    <div
                      key={suggestion.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setGuess(suggestion.name)
                        setSuggestions([])
                        setTimeout(() => handleGuess(suggestion.name), 10)
                      }}
                      style={{
                        ...s.suggestionItem,
                        background: idx === highlightedIndex 
                          ? 'rgba(168,85,247,0.3)' 
                          : 'transparent',
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                    >
                      {suggestion.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Submit Button (backup) */}
            <button
              onClick={() => guess.trim() && handleGuess(guess)}
              disabled={!guess.trim() || isChecking}
              style={{
                ...s.submitBtn,
                opacity: !guess.trim() || isChecking ? 0.5 : 1,
                cursor: !guess.trim() || isChecking ? 'not-allowed' : 'pointer',
              }}
            >
              {isChecking ? 'Checking...' : 'Submit Guess'}
            </button>

            {/* I Give Up Button */}
            <button onClick={skipToAnswer} style={s.giveUpBtn}>
              I Give Up 🤷
            </button>

            <div style={s.keyboardHint}>
              Press ↑↓ to navigate, Enter to select
            </div>
          </>
        ) : (
          /* Result - only shown when correct or gave up */
          <div style={s.resultContainer}>
            {result.status === 'correct' ? (
              <div style={s.correct}>Correct! +{CLUE_POINTS[Math.min(cluesRevealed - 1, CLUE_POINTS.length - 1)]} pts 🎉</div>
            ) : (
              <div style={s.wrong}>The answer was...</div>
            )}
            
            <div style={s.playerCard}>
              <div style={s.playerName}>{result.player.name}</div>
              <div style={s.playerDetails}>
                {result.player.position} • {result.player.nationality} • {result.player.club}
              </div>
              <div style={s.playerStats}>
                <div style={s.stat}>
                  <div style={s.statValue}>{result.player.goals || 0}</div>
                  <div style={s.statLabel}>Goals</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statValue}>{result.player.assists || 0}</div>
                  <div style={s.statLabel}>Assists</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statValue}>{result.player.appearances || 0}</div>
                  <div style={s.statLabel}>Apps</div>
                </div>
              </div>
            </div>

            {result.status === 'gave_up' && (
              <div style={s.yourGuess}>You gave up after {cluesRevealed} clues</div>
            )}

            <button onClick={nextRound} style={s.nextBtn}>
              {currentRound >= maxRounds ? 'See Results' : 'Next Round →'}
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
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    fontFamily: "'Montserrat', system-ui, sans-serif",
  },
  spacer: {
    width: '40px',
  },
  roundInfo: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  score: {
    fontSize: '14px',
    color: '#fff',
    background: 'rgba(168,85,247,0.3)',
    padding: '8px 16px',
    borderRadius: 20,
    border: '1px solid rgba(168,85,247,0.5)',
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
  difficultyCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    backdropFilter: 'blur(12px)',
  },
  difficultyTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
    textAlign: 'center',
    marginBottom: '24px',
  },
  difficultyOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  difficultyBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '16px 20px',
    borderRadius: 12,
    border: '2px solid',
    cursor: 'pointer',
    background: 'rgba(15,23,41,0.8)',
    transition: 'all 0.2s',
  },
  diffName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    textTransform: 'capitalize',
  },
  diffDesc: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
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
  gameArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
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
    alignItems: 'center',
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
    fontSize: '18px',
    fontWeight: 600,
    flex: 1,
  },
  pointsBadge: {
    fontSize: '12px',
    color: '#fbbf24',
    fontWeight: 700,
    background: 'rgba(251,191,36,0.15)',
    padding: '4px 10px',
    borderRadius: 10,
  },
  revealBtn: {
    background: 'rgba(168,85,247,0.2)',
    border: '1px solid rgba(168,85,247,0.4)',
    borderRadius: 10,
    padding: '12px 24px',
    color: '#a855f7',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  searchContainer: {
    position: 'relative',
    width: '100%',
  },
  searchInput: {
    width: '100%',
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.5)',
    borderRadius: 12,
    padding: '20px 24px',
    color: '#fff',
    fontSize: '18px',
    outline: 'none',
    backdropFilter: 'blur(8px)',
    boxSizing: 'border-box',
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: 'rgba(15,23,41,0.98)',
    border: '2px solid rgba(168,85,247,0.5)',
    borderTop: 'none',
    borderRadius: '0 0 12px 12px',
    marginTop: '-2px',
    zIndex: 100,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: '16px 24px',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    borderBottom: '1px solid rgba(168,85,247,0.1)',
    transition: 'background 0.1s',
  },
  keyboardHint: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  errorMsg: {
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
    padding: '8px 16px',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.3)',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 32px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '12px',
  },
  giveUpBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: '12px 24px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
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
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
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
  gameOverContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '20px',
  },
  gameOverTitle: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#fff',
  },
  finalScore: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#a855f7',
  },
  accuracy: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.6)',
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
