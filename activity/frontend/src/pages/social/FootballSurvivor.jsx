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

const VOTE_DURATION = 10 // seconds

export default function FootballSurvivor({ token, user, onBack }) {
  const [gameState, setGameState] = useState('menu') // menu, create, join, lobby, voting, results, finished
  const [roomId, setRoomId] = useState('')
  const [room, setRoom] = useState(null)
  const [inputRoomId, setInputRoomId] = useState('')
  const [vote, setVote] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(VOTE_DURATION)
  const [hasVoted, setHasVoted] = useState(false)

  const timerRef = useRef(null)
  const pollRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const createRoom = async () => {
    try {
      const data = await apiFetch('/api/social/games/survivor/create2', token, {
        method: 'POST',
        body: JSON.stringify({
          host_id: user.id,
          host_name: user.username
        })
      })
      setRoomId(data.room_id)
      setRoom({ ...data, players: [{ id: user.id, name: user.username, alive: true }] })
      setGameState('lobby')
      startPolling(data.room_id)
    } catch (err) {
      setError('Failed to create room')
    }
  }

  const joinRoom = async () => {
    if (!inputRoomId.trim()) return

    try {
      const data = await apiFetch('/api/social/games/survivor/join2', token, {
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
      setError(err.message || 'Room not found or full')
    }
  }

  const startRound = async () => {
    try {
      const data = await apiFetch('/api/social/games/survivor/start-round2', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId })
      })
      setRoom(data.room)
      setGameState('voting')
      setVote(null)
      setHasVoted(false)
      setResults(null)
      startCountdown()
    } catch (err) {
      setError('Failed to start round')
    }
  }

  const submitVote = async (option) => {
    if (hasVoted) return

    try {
      await apiFetch('/api/social/games/survivor/vote2', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id,
          vote: option
        })
      })
      setVote(option)
      setHasVoted(true)
    } catch (err) {
      setError('Failed to submit vote')
    }
  }

  const revealResults = async () => {
    try {
      const data = await apiFetch('/api/social/games/survivor/reveal2', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId })
      })
      setResults(data.results)
      setRoom(data.room)

      if (timerRef.current) clearInterval(timerRef.current)

      if (data.room.status === 'finished') {
        setGameState('finished')
      } else {
        setGameState('results')
      }
    } catch (err) {
      setError('Failed to reveal results')
    }
  }

  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current)

    let timeLeft = VOTE_DURATION
    setCountdown(timeLeft)

    timerRef.current = setInterval(() => {
      timeLeft -= 1
      setCountdown(timeLeft)

      if (timeLeft <= 0) {
        clearInterval(timerRef.current)
        // Auto-reveal when time runs out (host only)
        if (room?.host_id === user.id) {
          revealResults()
        }
      }
    }, 1000)
  }

  const startPolling = useCallback((rid) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/social/games/survivor/room/${rid}`, token)
        setRoom(prev => {
          if (!prev) return data
          // Only update if status changed or votes updated
          if (data.status !== prev.status || JSON.stringify(data.votes) !== JSON.stringify(prev.votes)) {
            return data
          }
          return prev
        })

        // Auto-transition based on room status
        if (data.status === 'voting' && gameState === 'lobby') {
          setGameState('voting')
          setVote(null)
          setHasVoted(false)
          startCountdown()
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 1000)
  }, [token, gameState])

  const isAlive = room?.players?.find(p => p.id === user.id)?.alive ?? true
  const alivePlayers = room?.players?.filter(p => p.alive) || []

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
            <div style={s.playerCount}>4-10 players recommended</div>
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
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button onClick={joinRoom} style={s.menuBtn}>Join Room</button>
          </div>
        </div>

        <div style={s.howToPlay}>
          <div style={s.howToPlayTitle}>How to Play</div>
          <ul style={s.howToPlayList}>
            <li>4-10 players join a room</li>
            <li>Vote on football questions (10 seconds!)</li>
            <li>Majority survives, minority is eliminated</li>
            <li>Last player standing wins!</li>
          </ul>
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
    const canStart = room?.players?.length >= 4 && room?.host_id === user.id

    return (
      <div style={s.container}>
        <div style={s.bg} />

        <div style={s.header}>
          <button onClick={() => setGameState('menu')} style={s.backBtnSmall}>
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

          <div style={s.lobbyInfo}>
            {room?.players?.length < 4 && (
              <div style={s.waitingText}>Need at least 4 players to start</div>
            )}
          </div>

          {room?.host_id === user.id && (
            <button
              onClick={startRound}
              disabled={!canStart}
              style={{
                ...s.startBtn,
                opacity: canStart ? 1 : 0.5,
                cursor: canStart ? 'pointer' : 'not-allowed',
              }}
            >
              {canStart ? 'Start Game' : `Need ${4 - (room?.players?.length || 0)} more players`}
            </button>
          )}

          {room?.host_id !== user.id && (
            <div style={s.waiting}>Waiting for host to start...</div>
          )}
        </div>
      </div>
    )
  }

  // Voting Screen
  if (gameState === 'voting' && room?.question) {
    const amAlive = isAlive
    const voted = hasVoted

    return (
      <div style={s.container}>
        <div style={s.bg} />

        {/* Header */}
        <div style={s.votingHeader}>
          <div style={s.roundBadge}>Round {room.round}</div>
          <div style={s.aliveBadge}>{alivePlayers.length} alive</div>
        </div>

        {/* Timer */}
        <div style={s.timerContainer}>
          <div style={{
            ...s.timerBar,
            width: `${(countdown / VOTE_DURATION) * 100}%`,
            background: countdown <= 3 ? '#ef4444' : countdown <= 6 ? '#fbbf24' : '#22c55e',
          }} />
        </div>

        <div style={s.votingContainer}>
          <div style={s.question}>{room.question.text}</div>

          <div style={s.options}>
            {/* Option A */}
            <button
              onClick={() => amAlive && !voted && submitVote('option_a')}
              disabled={!amAlive || voted}
              style={{
                ...s.optionBtn,
                opacity: !amAlive || voted ? 0.6 : 1,
                borderColor: vote === 'option_a' ? '#22c55e' : 'rgba(168,85,247,0.3)',
                background: vote === 'option_a' ? 'rgba(34,197,94,0.15)' : 'rgba(15,23,41,0.95)',
              }}
            >
              <div style={s.optionPlayer}>
                <div style={s.optionName}>{room.question.option_a.name}</div>
                <div style={s.optionDetails}>{room.question.option_a.position} • {room.question.option_a.club}</div>
              </div>
              {vote === 'option_a' && <div style={s.votedCheck}>✓</div>}
            </button>

            <div style={s.vsSmall}>VS</div>

            {/* Option B */}
            <button
              onClick={() => amAlive && !voted && submitVote('option_b')}
              disabled={!amAlive || voted}
              style={{
                ...s.optionBtn,
                opacity: !amAlive || voted ? 0.6 : 1,
                borderColor: vote === 'option_b' ? '#22c55e' : 'rgba(168,85,247,0.3)',
                background: vote === 'option_b' ? 'rgba(34,197,94,0.15)' : 'rgba(15,23,41,0.95)',
              }}
            >
              <div style={s.optionPlayer}>
                <div style={s.optionName}>{room.question.option_b.name}</div>
                <div style={s.optionDetails}>{room.question.option_b.position} • {room.question.option_b.club}</div>
              </div>
              {vote === 'option_b' && <div style={s.votedCheck}>✓</div>}
            </button>
          </div>

          {!amAlive && (
            <div style={s.eliminatedMsg}>☠️ You have been eliminated</div>
          )}

          {amAlive && voted && (
            <div style={s.waitingVotes}>Waiting for others...</div>
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
    const wasEliminated = results.eliminated.includes(user.username)
    const myVote = vote
    const wasCorrect = (myVote === results.winning_option)

    return (
      <div style={s.container}>
        <div style={s.bg} />

        <div style={s.resultsContainer}>
          <div style={s.resultTitle}>Results</div>

          {/* Vote counts */}
          <div style={s.voteCounts}>
            <div style={s.voteCount}>
              <div style={s.voteCountNum}>{results.votes_a}</div>
              <div style={s.voteCountLabel}>voted A</div>
            </div>
            <div style={s.vsSmall}>VS</div>
            <div style={s.voteCount}>
              <div style={s.voteCountNum}>{results.votes_b}</div>
              <div style={s.voteCountLabel}>voted B</div>
            </div>
          </div>

          {/* Winner */}
          {results.winning_option && (
            <div style={s.majorityWins}>
              Majority wins! {results.winning_option === 'option_a' ? room.question.option_a.name : room.question.option_b.name}
            </div>
          )}
          {!results.winning_option && results.votes_a === results.votes_b && (
            <div style={s.tieMessage}>It's a tie! Everyone survives!</div>
          )}

          {/* Eliminated */}
          {results.eliminated.length > 0 && (
            <div style={s.eliminatedBox}>
              <div style={s.eliminatedTitle}>☠️ Eliminated</div>
              {results.eliminated.map((name, idx) => (
                <div key={idx} style={s.eliminatedName}>{name}</div>
              ))}
            </div>
          )}

          {/* Personal result */}
          {wasEliminated ? (
            <div style={s.youEliminated}>You were eliminated!</div>
          ) : (
            <div style={s.youSurvived}>✓ You survived!</div>
          )}

          {room.host_id === user.id && results.remaining > 1 && (
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
    const winner = room?.players?.find(p => p.alive)
    const iWon = winner?.id === user.id

    return (
      <div style={s.container}>
        <div style={s.bg} />

        <div style={s.finishedContainer}>
          <div style={s.winnerTitle}>🏆 Winner! 🏆</div>

          {winner ? (
            <>
              <div style={s.winnerName}>{winner.name}</div>
              {iWon && <div style={s.youWon}>You won!</div>}
            </>
          ) : (
            <div style={s.winnerName}>No winner</div>
          )}

          <div style={s.finalStandings}>
            <div style={s.standingsTitle}>Final Standings</div>
            {room?.players?.map((p, idx) => (
              <div key={idx} style={{
                ...s.standingRow,
                background: p.alive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
              }}>
                <span>{p.name}</span>
                {p.alive ? <span style={s.winnerTag}>WINNER</span> : <span style={s.elimTag}>ELIMINATED</span>}
              </div>
            ))}
          </div>

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
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    fontFamily: "'Montserrat', system-ui, sans-serif",
  },
  spacer: {
    width: '40px',
  },
  menuContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    maxWidth: '400px',
    margin: '0 auto',
    width: '100%',
    flex: 1,
    justifyContent: 'center',
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
    marginBottom: '8px',
  },
  playerCount: {
    fontSize: '12px',
    color: '#a855f7',
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
  howToPlay: {
    background: 'rgba(15,23,41,0.8)',
    border: '1px solid rgba(168,85,247,0.2)',
    borderRadius: 16,
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
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
  error: {
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'center',
    marginTop: '16px',
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
  lobbyInfo: {
    textAlign: 'center',
  },
  waitingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  startBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '20px 48px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  waiting: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '16px',
  },
  votingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    marginBottom: '10px',
  },
  roundBadge: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
  },
  aliveBadge: {
    fontSize: '14px',
    color: '#22c55e',
    background: 'rgba(34,197,94,0.15)',
    padding: '8px 16px',
    borderRadius: 20,
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
  votingContainer: {
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderRadius: 16,
    border: '2px solid',
    cursor: 'pointer',
    backdropFilter: 'blur(12px)',
    transition: 'all 0.2s',
  },
  optionPlayer: {
    textAlign: 'left',
  },
  optionName: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff',
  },
  optionDetails: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '4px',
  },
  votedCheck: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#fff',
  },
  vsSmall: {
    fontSize: '20px',
    fontWeight: 900,
    color: '#fbbf24',
    textAlign: 'center',
  },
  eliminatedMsg: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#ef4444',
  },
  waitingVotes: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.6)',
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
    gap: '20px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%',
  },
  resultTitle: {
    fontSize: '36px',
    fontWeight: 800,
    color: '#fff',
  },
  voteCounts: {
    display: 'flex',
    alignItems: 'center',
    gap: '32px',
  },
  voteCount: {
    textAlign: 'center',
  },
  voteCountNum: {
    fontSize: '48px',
    fontWeight: 800,
    color: '#a855f7',
  },
  voteCountLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)',
  },
  majorityWins: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#22c55e',
    background: 'rgba(34,197,94,0.15)',
    padding: '16px 32px',
    borderRadius: 12,
    textAlign: 'center',
  },
  tieMessage: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.15)',
    padding: '16px 32px',
    borderRadius: 12,
  },
  eliminatedBox: {
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 12,
    padding: '20px',
    textAlign: 'center',
    width: '100%',
  },
  eliminatedTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#ef4444',
    marginBottom: '12px',
  },
  eliminatedName: {
    color: '#fff',
    fontSize: '16px',
    marginBottom: '4px',
  },
  youEliminated: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#ef4444',
  },
  youSurvived: {
    fontSize: '24px',
    fontWeight: 800,
    color: '#22c55e',
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
    marginTop: '20px',
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
  youWon: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#22c55e',
  },
  finalStandings: {
    background: 'rgba(15,23,41,0.95)',
    border: '2px solid rgba(168,85,247,0.3)',
    borderRadius: 16,
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
  },
  standingsTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '16px',
    textAlign: 'center',
  },
  standingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderRadius: 10,
    marginBottom: '8px',
    color: '#fff',
  },
  winnerTag: {
    fontSize: '11px',
    background: '#22c55e',
    color: '#000',
    padding: '4px 10px',
    borderRadius: 4,
    fontWeight: 700,
  },
  elimTag: {
    fontSize: '11px',
    background: '#ef4444',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: 4,
    fontWeight: 700,
  },
  playAgainBtn: {
    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
    border: 'none',
    borderRadius: 12,
    padding: '20px 48px',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '20px',
  },
}
