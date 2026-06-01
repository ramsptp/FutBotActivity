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

export default function FootballSurvivor({ token, user, onBack }) {
  const [gameState, setGameState] = useState('menu') // menu, create, join, lobby, voting, results
  const [roomId, setRoomId] = useState('')
  const [room, setRoom] = useState(null)
  const [inputRoomId, setInputRoomId] = useState('')
  const [vote, setVote] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const createRoom = async () => {
    try {
      const data = await apiFetch('/api/social/games/survivor/create', token, {
        method: 'POST',
        body: JSON.stringify({
          host_id: user.id,
          host_name: user.username
        })
      })
      setRoomId(data.room_id)
      setRoom(data)
      setGameState('lobby')
      startPolling(data.room_id)
    } catch (err) {
      setError('Failed to create room')
    }
  }

  const joinRoom = async () => {
    if (!inputRoomId.trim()) return
    
    try {
      const data = await apiFetch('/api/social/games/survivor/join', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: inputRoomId.toUpperCase(),
          player_id: user.id,
          player_name: user.username
        })
      })
      setRoomId(inputRoomId.toUpperCase())
      setRoom(data.room)
      setGameState('lobby')
      startPolling(inputRoomId.toUpperCase())
    } catch (err) {
      setError('Room not found')
    }
  }

  const startRound = async () => {
    try {
      const data = await apiFetch(`/api/social/games/survivor/start-round?room_id=${roomId}`, token)
      setRoom(data.room)
      setGameState('voting')
      setVote(null)
      setResults(null)
    } catch (err) {
      setError('Failed to start round')
    }
  }

  const submitVote = async (option) => {
    try {
      await apiFetch('/api/social/games/survivor/vote', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id,
          vote: option
        })
      })
      setVote(option)
    } catch (err) {
      setError('Failed to submit vote')
    }
  }

  const revealResults = async () => {
    try {
      const data = await apiFetch(`/api/social/games/survivor/reveal?room_id=${roomId}`, token, {
        method: 'POST'
      })
      setResults(data.results)
      setRoom(data.room)
      setGameState(data.room.status === 'finished' ? 'finished' : 'results')
    } catch (err) {
      setError('Failed to reveal results')
    }
  }

  const startPolling = useCallback((rid) => {
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/social/games/survivor/room/${rid}`, token)
        setRoom(data)
        
        // Auto-transition based on room status
        if (data.status === 'voting' && gameState === 'lobby') {
          setGameState('voting')
          setVote(null)
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [token, gameState])

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
          <div style={s.title}>Football Survivor</div>
          <div style={s.spacer} />
        </div>

        <div style={s.menuContainer}>
          <div style={s.menuCard}>
            <div style={s.menuTitle}>Create Game</div>
            <div style={s.menuDesc}>Start a new game and invite friends</div>
            <button onClick={createRoom} style={s.menuBtn}>Create Room</button>
          </div>

          <div style={s.or}>OR</div>

          <div style={s.menuCard}>
            <div style={s.menuTitle}>Join Game</div>
            <div style={s.menuDesc}>Enter room code to join</div>
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              style={s.roomInput}
              maxLength={8}
            />
            <button onClick={joinRoom} style={s.menuBtn}>Join Room</button>
          </div>
        </div>

        {error && <div style={s.error}>{error}</div>}

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

  // Lobby Screen
  if (gameState === 'lobby') {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        
        <div style={s.header}>
          <button onClick={onBack} style={s.backBtnSmall}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div style={s.title}>Room: {roomId}</div>
          <div style={s.spacer} />
        </div>

        <div style={s.lobbyContainer}>
          <div style={s.playersList}>
            <div style={s.sectionTitle}>Players ({room?.players?.length || 0})</div>
            {room?.players?.map((p, idx) => (
              <div key={idx} style={s.playerItem}>
                <span>{p.name}</span>
                {p.id === room?.host_id && <span style={s.hostBadge}>HOST</span>}
              </div>
            ))}
          </div>

          {room?.host_id === user.id && (
            <button onClick={startRound} style={s.startBtn}>
              Start Round
            </button>
          )}

          {room?.host_id !== user.id && (
            <div style={s.waiting}>Waiting for host...</div>
          )}
        </div>
      </div>
    )
  }

  // Voting Screen
  if (gameState === 'voting' && room?.question) {
    const isAlive = room.players.find(p => p.id === user.id)?.alive
    const hasVoted = vote !== null

    return (
      <div style={s.container}>
        <div style={s.bg} />
        
        <div style={s.header}>
          <div style={s.roundInfo}>Round {room.round}</div>
          <div style={s.aliveCount}>{room.players.filter(p => p.alive).length} players alive</div>
        </div>

        <div style={s.votingContainer}>
          <div style={s.question}>{room.question.text}</div>

          <div style={s.options}>
            <button 
              onClick={() => !hasVoted && isAlive && submitVote('option_a')}
              disabled={hasVoted || !isAlive}
              style={{
                ...s.optionBtn,
                opacity: hasVoted || !isAlive ? 0.5 : 1,
                borderColor: vote === 'option_a' ? '#22c55e' : 'rgba(168,85,247,0.3)',
              }}
            >
              <div style={s.optionName}>{room.question.option_a.name}</div>
              {hasVoted && vote === 'option_a' && <div style={s.votedBadge}>✓</div>}
            </button>

            <div style={s.vsSmall}>VS</div>

            <button 
              onClick={() => !hasVoted && isAlive && submitVote('option_b')}
              disabled={hasVoted || !isAlive}
              style={{
                ...s.optionBtn,
                opacity: hasVoted || !isAlive ? 0.5 : 1,
                borderColor: vote === 'option_b' ? '#22c55e' : 'rgba(168,85,247,0.3)',
              }}
            >
              <div style={s.optionName}>{room.question.option_b.name}</div>
              {hasVoted && vote === 'option_b' && <div style={s.votedBadge}>✓</div>}
            </button>
          </div>

          {!isAlive && (
            <div style={s.eliminated}>You have been eliminated</div>
          )}

          {room.host_id === user.id && (
            <button onClick={revealResults} style={s.revealBtn}>
              Reveal Results
            </button>
          )}
        </div>
      </div>
    )
  }

  // Results Screen
  if (gameState === 'results' && results) {
    return (
      <div style={s.container}>
        <div style={s.bg} />
        
        <div style={s.resultsContainer}>
          <div style={s.resultTitle}>Results</div>
          
          <div style={s.resultStats}>
            <div style={s.resultOption}>
              <div style={s.resultName}>{room.question.option_a.name}</div>
              <div style={s.resultValue}>{results.option_a_value} {room.question.stat}</div>
              <div style={s.voteCount}>{results.votes_a} votes</div>
            </div>

            <div style={s.vsSmall}>VS</div>

            <div style={s.resultOption}>
              <div style={s.resultName}>{room.question.option_b.name}</div>
              <div style={s.resultValue}>{results.option_b_value} {room.question.stat}</div>
              <div style={s.voteCount}>{results.votes_b} votes</div>
            </div>
          </div>

          <div style={s.correctAnswer}>
            Correct: {results.correct_option === 'option_a' ? room.question.option_a.name : room.question.option_b.name}
          </div>

          {results.eliminated.length > 0 && (
            <div style={s.eliminatedList}>
              <div style={s.eliminatedTitle}>Eliminated:</div>
              {results.eliminated.map((name, idx) => (
                <div key={idx} style={s.eliminatedName}>{name}</div>
              ))}
            </div>
          )}

          {room.host_id === user.id && (
            <button onClick={startRound} style={s.nextRoundBtn}>
              Next Round
            </button>
          )}
        </div>
      </div>
    )
  }

  // Finished Screen
  if (gameState === 'finished') {
    const winner = room.players.find(p => p.alive)
    
    return (
      <div style={s.container}>
        <div style={s.bg} />
        
        <div style={s.finishedContainer}>
          <div style={s.winnerTitle}>🏆 Winner! 🏆</div>
          {winner ? (
            <div style={s.winnerName}>{winner.name}</div>
          ) : (
            <div style={s.winnerName}>No winner</div>
          )}
          
          <button onClick={() => setGameState('menu')} style={s.playAgainBtn}>
            Play Again
          </button>
        </div>
      </div>
    )
  }

  return null
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
  spacer: {
    width: '40px',
  },
  menuContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    maxWidth: '400px',
    margin: '0 auto',
    width: '100%',
  },
  menuCard: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '32px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  menuTitle: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '8px',
  },
  menuDesc: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '20px',
  },
  menuBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 32px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  or: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
  },
  roomInput: {
    background: 'rgba(15,23,41,0.8)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 12,
    padding: '16px',
    color: '#fff',
    fontSize: '18px',
    textAlign: 'center',
    width: '100%',
    marginBottom: '16px',
    outline: 'none',
    textTransform: 'uppercase',
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
  },
  lobbyContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
  },
  playersList: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 20,
    padding: '24px',
    width: '100%',
    backdropFilter: 'blur(12px)',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '16px',
    textAlign: 'center',
  },
  playerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'rgba(168,85,247,0.1)',
    borderRadius: 10,
    marginBottom: '8px',
    color: '#fff',
  },
  hostBadge: {
    fontSize: '10px',
    background: '#fbbf24',
    color: '#000',
    padding: '4px 8px',
    borderRadius: 4,
    fontWeight: 700,
  },
  startBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '20px 48px',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  waiting: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '16px',
  },
  roundInfo: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  aliveCount: {
    fontSize: '14px',
    color: '#22c55e',
    background: 'rgba(34,197,94,0.15)',
    padding: '8px 16px',
    borderRadius: 20,
  },
  votingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '32px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%',
  },
  question: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },
  optionBtn: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid',
    borderRadius: 16,
    padding: '24px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backdropFilter: 'blur(12px)',
  },
  optionName: {
    fontSize: '20px',
    fontWeight: 700,
  },
  votedBadge: {
    background: '#22c55e',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  vsSmall: {
    fontSize: '20px',
    fontWeight: 900,
    color: '#fbbf24',
    textAlign: 'center',
  },
  eliminated: {
    color: '#ef4444',
    fontSize: '18px',
    fontWeight: 700,
  },
  revealBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 40px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  resultsContainer: {
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
  resultTitle: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#fff',
  },
  resultStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    width: '100%',
  },
  resultOption: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 16,
    padding: '20px',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  resultName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '8px',
  },
  resultValue: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#a855f7',
  },
  voteCount: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  correctAnswer: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#22c55e',
    background: 'rgba(34,197,94,0.15)',
    padding: '16px 32px',
    borderRadius: 12,
  },
  eliminatedList: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 12,
    padding: '16px',
    textAlign: 'center',
  },
  eliminatedTitle: {
    fontSize: '14px',
    color: '#ef4444',
    marginBottom: '8px',
  },
  eliminatedName: {
    color: '#fff',
    fontSize: '16px',
    marginBottom: '4px',
  },
  nextRoundBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '16px 40px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  finishedContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
  },
  winnerTitle: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#fbbf24',
  },
  winnerName: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#fff',
  },
  playAgainBtn: {
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    border: 'none',
    borderRadius: 12,
    padding: '20px 48px',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '32px',
  },
}
