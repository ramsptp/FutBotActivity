import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../lib/api'

export default function FootballImpostor({ token, user, onBack, channelId }) {
  const [gameState, setGameState] = useState('loading') 
  const [roomId, setRoomId] = useState(channelId || 'LOCAL_DEV_ROOM')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  
  // Game inputs
  const [clueInput, setClueInput] = useState('')
  const [guessInput, setGuessInput] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const [votedFor, setVotedFor] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)

  // Settings
  const [clueTime, setClueTime] = useState(30)
  const [votingTime, setVotingTime] = useState(60)

  const pollRef = useRef(null)
  const timerRef = useRef(null)

  const autoJoin = useCallback(async () => {
    try {
      const data = await apiFetch('/api/social/games/impostor/auto-join', token, {
        method: 'POST',
        body: JSON.stringify({ 
          channel_id: roomId,
          player_id: user.id, 
          player_name: user.username 
        })
      })
      setRoom(data.room)
      setGameState(data.room.status)
      if (data.room.settings) {
        setClueTime(data.room.settings.clue_time)
        setVotingTime(data.room.settings.voting_time)
      }
      startPolling()
    } catch (err) {
      console.error(err)
      setError('Failed to join lobby')
    }
  }, [roomId, token, user])

  useEffect(() => {
    autoJoin()
    return () => {
      // Unmount: leave the room
      apiFetch('/api/social/games/impostor/leave', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId, player_id: user.id })
      }).catch(() => {})

      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoJoin, roomId, token, user.id])

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/social/games/impostor/room/${roomId}`, token)
        setRoom(prev => {
          if (!prev) return data

          if (data.status !== prev.status) {
            setGameState(data.status)
            if (data.status === 'clues') {
              setClueInput('')
            } else if (data.status === 'voting') {
              setHasVoted(false)
              setVotedFor(null)
            } else if (data.status === 'guess') {
              setGuessInput('')
            }
          }
          
          if (data.settings && data.status === 'waiting') {
            setClueTime(data.settings.clue_time)
            setVotingTime(data.settings.voting_time)
          }

          return data
        })
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 1000)
  }, [roomId, token])

  // Timer logic
  useEffect(() => {
    if (!room) return
    let targetTime = 0
    if (room.status === 'clues' && room.clue_end_time) targetTime = room.clue_end_time * 1000
    if (room.status === 'voting' && room.vote_end_time) targetTime = room.vote_end_time * 1000
    if (room.status === 'guess' && room.guess_end_time) targetTime = room.guess_end_time * 1000

    if (targetTime > 0) {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        const now = Date.now()
        const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000))
        setTimeLeft(remaining)

        if (remaining <= 0) {
          clearInterval(timerRef.current)
          handleTimeUp(room.status)
        }
      }, 250)
    } else {
      setTimeLeft(0)
    }
  }, [room?.status, room?.clue_end_time, room?.vote_end_time, room?.guess_end_time])

  const handleTimeUp = (status) => {
    const isMyTurn = room?.players?.[room?.turn_index]?.id === user.id
    if (status === 'clues' && isMyTurn) {
      submitClue('[SKIPPED]')
    } else if (status === 'voting' && !hasVoted) {
      submitVote(user.id) // Vote for self if timed out
    } else if (status === 'guess' && room?.impostor_id === user.id) {
      submitGuess('[SKIPPED]')
    }
  }

  const updateSettings = async (updates) => {
    const newSettings = { clue_time: clueTime, voting_time: votingTime, ...updates }
    try {
      await apiFetch('/api/social/games/impostor/settings', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id,
          settings: newSettings
        })
      })
      if (updates.clue_time) setClueTime(updates.clue_time)
      if (updates.voting_time) setVotingTime(updates.voting_time)
    } catch (err) {}
  }

  const startGame = async () => {
    try {
      await apiFetch('/api/social/games/impostor/start2', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId })
      })
    } catch (err) {
      setError('Need at least 3 active players.')
    }
  }

  const submitClue = async (overrideClue = null) => {
    const finalClue = overrideClue || clueInput.trim()
    if (!finalClue) return
    try {
      await apiFetch('/api/social/games/impostor/clue2', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id,
          clue: finalClue
        })
      })
      setClueInput('')
    } catch (err) {}
  }

  const submitVote = async (targetId) => {
    if (hasVoted) return
    try {
      await apiFetch('/api/social/games/impostor/vote2', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id,
          target_id: targetId
        })
      })
      setVotedFor(targetId)
      setHasVoted(true)
    } catch (err) {}
  }

  const submitGuess = async (overrideGuess = null) => {
    const finalGuess = overrideGuess || guessInput.trim()
    if (!finalGuess) return
    try {
      await apiFetch('/api/social/games/impostor/guess2', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          guess: finalGuess
        })
      })
      setGuessInput('')
    } catch (err) {}
  }

  const resetGame = async () => {
    try {
      await apiFetch('/api/social/games/impostor/reset', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id
        })
      })
    } catch (err) {}
  }

  const isHost = room?.host_id === user.id
  const isImpostor = room?.impostor_id === user.id
  const myTurn = room && room.status === 'clues' && room.players[room.turn_index]?.id === user.id
  const currentPlayer = room?.players[room?.turn_index]

  if (gameState === 'loading') {
    return <div style={s.loadingContainer}><div style={s.spinner} /></div>
  }

  return (
    <div style={s.container}>
      <div style={s.bg} />
      <div style={s.overlay} />
      <div style={s.noise} />

      <div style={{position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column'}}>
        {/* HEADER */}
        <div style={s.header}>
          <button onClick={onBack} style={s.backBtn}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div style={s.headerTitle}>IMPOSTOR</div>
          <div style={s.headerSubtitle}>Lobby: {roomId}</div>
        </div>

      {/* LOBBY PHASE */}
      {gameState === 'waiting' && (
        <div style={s.contentWrapper}>
          <div style={s.lobbyPanel}>
            <div style={s.panelHeader}>ROSTER ({room?.players?.length || 0}/10)</div>
            <div style={s.rosterList}>
              {room?.players?.map((p, i) => (
                <div key={i} style={s.rosterItem}>
                  <div style={s.rosterName}>{p.name}</div>
                  {p.id === room?.host_id && <div style={s.rosterBadge}>HOST</div>}
                </div>
              ))}
            </div>
            
            {error && <div style={s.errorBadge}>{error}</div>}
            
            {isHost ? (
              <button 
                onClick={startGame} 
                style={{...s.actionBtn, opacity: room?.players?.length >= 3 ? 1 : 0.5}}
                disabled={room?.players?.length < 3}
              >
                START MATCH
              </button>
            ) : (
              <div style={s.waitingStatus}>WAITING FOR HOST...</div>
            )}
          </div>

          <div style={s.settingsPanel}>
            <div style={s.panelHeader}>MATCH SETTINGS</div>
            <div style={s.settingRow}>
              <div style={s.settingLabel}>CLUE TIME (SEC)</div>
              <div style={s.settingOpts}>
                {[15, 30, 45].map(t => (
                  <button 
                    key={t}
                    disabled={!isHost}
                    onClick={() => updateSettings({ clue_time: t })}
                    style={clueTime === t ? s.optBtnActive : s.optBtn}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div style={s.settingRow}>
              <div style={s.settingLabel}>VOTING TIME (SEC)</div>
              <div style={s.settingOpts}>
                {[30, 60, 90].map(t => (
                  <button 
                    key={t}
                    disabled={!isHost}
                    onClick={() => updateSettings({ voting_time: t })}
                    style={votingTime === t ? s.optBtnActive : s.optBtn}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLUES PHASE */}
      {gameState === 'clues' && (
        <div style={s.contentWrapper}>
          <div style={isImpostor ? s.bannerImpostor : s.bannerCrew}>
            <div style={s.bannerLabel}>YOUR ROLE</div>
            {isImpostor ? (
              <div style={s.bannerValue}>THE IMPOSTOR <span style={{fontSize:18, opacity:0.8}}>(Category: {room?.category})</span></div>
            ) : (
              <div style={s.bannerValue}>{room?.secret_word} <span style={{fontSize:18, opacity:0.8}}>(Category: {room?.category})</span></div>
            )}
          </div>

          <div style={s.cluesLayout}>
            <div style={s.cluesMain}>
              <div style={s.panelHeader}>CLUE LOG</div>
              <div style={s.clueHistory}>
                {room?.clues?.map((c, i) => (
                  <div key={i} style={s.clueEntry}>
                    <span style={s.clueEntryName}>{c.player_name}:</span>
                    <span style={s.clueEntryWord}>{c.clue}</span>
                  </div>
                ))}
                {room?.clues?.length === 0 && <div style={{opacity: 0.5}}>No clues yet...</div>}
              </div>

              {myTurn ? (
                <div style={s.activeInputArea}>
                  <div style={s.activeInputHeader}>
                    <div style={s.pulseDot} />
                    YOUR TURN ({timeLeft}s)
                  </div>
                  <input
                    style={s.clueInputBox}
                    value={clueInput}
                    onChange={e => setClueInput(e.target.value)}
                    placeholder="ENTER 1-WORD CLUE..."
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && submitClue()}
                  />
                  <button onClick={() => submitClue()} style={s.actionBtnSmall}>SUBMIT</button>
                </div>
              ) : (
                <div style={s.waitingInputArea}>
                  <div style={s.spinnerSmall} />
                  WAITING FOR {currentPlayer?.name?.toUpperCase()} ({timeLeft}s)
                </div>
              )}
            </div>

            <div style={s.playersSidePanel}>
              <div style={s.panelHeader}>ORDER</div>
              {room?.players?.map((p, i) => (
                <div key={i} style={room?.turn_index === i ? s.playerTurnActive : s.playerTurnInactive}>
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VOTING PHASE */}
      {gameState === 'voting' && (
        <div style={s.contentWrapper}>
          <div style={s.voteHeaderBox}>
            <div style={s.voteHeaderTitle}>VOTING PHASE</div>
            <div style={timeLeft <= 10 ? s.voteTimerUrgent : s.voteTimer}>{timeLeft}s</div>
          </div>

          <div style={s.cluesLayout}>
            <div style={s.cluesMain}>
              <div style={s.panelHeader}>REVIEW CLUES</div>
              <div style={s.clueHistory}>
                {room?.clues?.map((c, i) => (
                  <div key={i} style={s.clueEntry}>
                    <span style={s.clueEntryName}>{c.player_name}:</span>
                    <span style={s.clueEntryWord}>{c.clue}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={s.playersSidePanel}>
              <div style={s.panelHeader}>CAST VOTE</div>
              {room?.players?.map((p, i) => (
                <button
                  key={i}
                  disabled={hasVoted || p.id === user.id}
                  onClick={() => submitVote(p.id)}
                  style={{
                    ...s.voteBtn,
                    borderColor: votedFor === p.id ? '#ef4444' : 'rgba(255,255,255,0.1)',
                    background: votedFor === p.id ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.4)',
                    opacity: (hasVoted && votedFor !== p.id) || p.id === user.id ? 0.3 : 1
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GUESS PHASE */}
      {gameState === 'guess' && (
        <div style={s.centerScreen}>
          <div style={s.alertBanner}>IMPOSTOR CAUGHT!</div>
          
          {isImpostor ? (
            <div style={s.guessPanel}>
              <div style={s.guessLabel}>YOU HAVE {timeLeft}s TO STEAL THE WIN</div>
              <div style={s.guessCategory}>CATEGORY: {room?.category}</div>
              <input
                style={s.clueInputBox}
                value={guessInput}
                onChange={e => setGuessInput(e.target.value)}
                placeholder="GUESS THE WORD..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && submitGuess()}
              />
              <button onClick={() => submitGuess()} style={s.actionBtn}>FINAL GUESS</button>
            </div>
          ) : (
            <div style={s.guessPanel}>
              <div style={s.spinner} />
              <div style={{marginTop: 20, fontSize: 18, fontWeight: 800}}>
                WAITING FOR IMPOSTOR TO GUESS...
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTS PHASE */}
      {gameState === 'results' && (
        <div style={s.centerScreen}>
          <div style={room?.winner === 'impostor' ? s.resultBannerImpostor : s.resultBannerCrew}>
            {room?.winner === 'impostor' ? 'IMPOSTOR WINS' : 'CREW WINS'}
          </div>
          
          <div style={s.resultReason}>{room?.results_reason}</div>
          
          <div style={s.revealPanel}>
            <div style={s.revealRow}>
              <div style={s.revealLabel}>SECRET WORD</div>
              <div style={s.revealValue}>{room?.secret_word}</div>
            </div>
            <div style={s.revealRow}>
              <div style={s.revealLabel}>THE IMPOSTOR</div>
              <div style={s.revealValueImpostor}>
                {room?.players?.find(p => p.id === room?.impostor_id)?.name}
              </div>
            </div>
          </div>
          
          <div style={{display: 'flex', gap: 20, width: '100%'}}>
            {isHost && (
              <button onClick={resetGame} style={s.actionBtn}>PLAY AGAIN</button>
            )}
            <button onClick={onBack} style={{...s.actionBtn, background: 'rgba(255,255,255,0.1)'}}>
              RETURN TO MENU
            </button>
          </div>
        </div>
      )}
      </div>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

const s = {
  loadingContainer: { minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c12' },
  spinner: { width: 50, height: 50, border: '4px solid rgba(168,85,247,0.2)', borderTopColor: '#c084fc', borderRadius: '50%', animation: 'spin 0.8s linear infinite', filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.5))' },
  spinnerSmall: { width: 20, height: 20, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  container: { minHeight: '100svh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', color: '#fff', fontFamily: "'Montserrat', system-ui, sans-serif" },
  
  bg: { position: 'absolute', inset: 0, background: 'url("/imposterbg.png") center center / cover no-repeat', zIndex: 1 },
  overlay: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(168,85,247,0.3), transparent 60%), radial-gradient(circle at bottom left, rgba(239,68,68,0.2), transparent 60%), rgba(10,12,18,0.4)', zIndex: 2, backdropFilter: 'blur(4px)' },
  noise: { position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")', opacity: 0.15, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 3 },
  
  header: { display: 'flex', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 100%)' },
  backBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(0,0,0,0.5)' },
  headerTitle: { fontSize: 26, fontWeight: 900, letterSpacing: 6, margin: '0 20px', color: '#fff', textShadow: '0 0 20px rgba(168,85,247,0.5)' },
  headerSubtitle: { fontSize: 11, fontWeight: 800, color: '#e9d5ff', letterSpacing: 2, padding: '6px 16px', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 4 },
  
  contentWrapper: { flex: 1, display: 'flex', gap: 40, padding: 40, maxWidth: 1400, margin: '0 auto', width: '100%', animation: 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' },
  
  lobbyPanel: { flex: 2, background: 'rgba(15,18,25,0.7)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 16, padding: 40, display: 'flex', flexDirection: 'column', boxShadow: 'inset 0 0 60px rgba(168,85,247,0.05), 0 20px 40px rgba(0,0,0,0.4)' },
  settingsPanel: { flex: 1, background: 'rgba(15,18,25,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 40, display: 'flex', flexDirection: 'column', gap: 30, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' },
  panelHeader: { fontSize: 13, fontWeight: 900, color: '#a855f7', letterSpacing: 4, marginBottom: 25, display: 'flex', alignItems: 'center', gap: 10 },
  
  rosterList: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 10 },
  rosterItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', borderRadius: 8, borderLeft: '4px solid #a855f7', borderTop: '1px solid rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.02)' },
  rosterName: { fontSize: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2 },
  rosterBadge: { fontSize: 10, fontWeight: 900, color: '#fff', background: '#c084fc', padding: '4px 10px', borderRadius: 4, letterSpacing: 2, boxShadow: '0 0 15px rgba(168,85,247,0.5)' },
  
  actionBtn: { width: '100%', marginTop: 30, padding: '24px', background: 'transparent', border: '2px solid #a855f7', borderRadius: 8, color: '#e9d5ff', fontSize: 18, fontWeight: 900, letterSpacing: 4, cursor: 'pointer', boxShadow: 'inset 0 0 20px rgba(168,85,247,0.2), 0 0 20px rgba(168,85,247,0.2)', transition: 'all 0.2s', textTransform: 'uppercase' },
  waitingStatus: { width: '100%', marginTop: 30, padding: '24px', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(168,85,247,0.3)', borderRadius: 8, color: 'rgba(168,85,247,0.6)', fontSize: 14, fontWeight: 900, letterSpacing: 4, textAlign: 'center', animation: 'pulse 2s infinite' },
  
  settingRow: { display: 'flex', flexDirection: 'column', gap: 12 },
  settingLabel: { fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  settingOpts: { display: 'flex', gap: 10 },
  optBtn: { flex: 1, padding: '14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' },
  optBtnActive: { flex: 1, padding: '14px', background: 'rgba(168,85,247,0.1)', border: '1px solid #c084fc', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer', boxShadow: '0 0 15px rgba(168,85,247,0.3)' },
  errorBadge: { marginTop: 15, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px', borderRadius: 8, textAlign: 'center', fontWeight: 800, letterSpacing: 1 },
  
  bannerCrew: { width: '100%', background: 'linear-gradient(90deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 12, padding: '30px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40, position: 'relative', overflow: 'hidden' },
  bannerImpostor: { width: '100%', background: 'linear-gradient(90deg, rgba(239,68,68,0.15) 0%, rgba(239,68,68,0.05) 100%)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12, padding: '30px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40, position: 'relative', overflow: 'hidden' },
  bannerLabel: { fontSize: 11, fontWeight: 900, letterSpacing: 6, opacity: 0.6, marginBottom: 15 },
  bannerValue: { fontSize: 42, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', textShadow: '0 4px 30px rgba(0,0,0,0.8)' },
  
  cluesLayout: { display: 'flex', gap: 40, width: '100%' },
  cluesMain: { flex: 2, display: 'flex', flexDirection: 'column', gap: 20 },
  playersSidePanel: { flex: 1, background: 'rgba(15,18,25,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 30, display: 'flex', flexDirection: 'column', gap: 12 },
  clueHistory: { display: 'flex', flexDirection: 'column', gap: 12 },
  clueEntry: { padding: '18px 24px', background: 'rgba(0,0,0,0.3)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 20 },
  clueEntryName: { fontSize: 13, fontWeight: 800, color: '#a855f7', letterSpacing: 2 },
  clueEntryWord: { fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase' },
  
  activeInputArea: { marginTop: 30, padding: 40, background: 'linear-gradient(180deg, rgba(168,85,247,0.05) 0%, rgba(168,85,247,0.02) 100%)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 16, boxShadow: '0 0 40px rgba(168,85,247,0.1), inset 0 0 20px rgba(168,85,247,0.05)', display: 'flex', flexDirection: 'column', gap: 20 },
  activeInputHeader: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 900, color: '#e9d5ff', letterSpacing: 4 },
  pulseDot: { width: 8, height: 8, background: '#c084fc', borderRadius: '50%', animation: 'pulse 1s infinite', boxShadow: '0 0 10px #c084fc' },
  clueInputBox: { width: '100%', padding: '24px', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase', outline: 'none', transition: 'border-color 0.2s' },
  actionBtnSmall: { padding: '20px 40px', background: 'rgba(168,85,247,0.1)', border: '1px solid #c084fc', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: 3, cursor: 'pointer', transition: 'all 0.2s' },
  
  waitingInputArea: { marginTop: 30, padding: 40, background: 'rgba(0,0,0,0.3)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 900, letterSpacing: 4 },
  
  playerTurnActive: { padding: '16px 20px', background: 'linear-gradient(90deg, rgba(168,85,247,0.15) 0%, rgba(168,85,247,0) 100%)', borderLeft: '3px solid #c084fc', borderRadius: '0 8px 8px 0', fontSize: 14, fontWeight: 900, letterSpacing: 2, color: '#fff' },
  playerTurnInactive: { padding: '16px 20px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid transparent', borderRadius: '0 8px 8px 0', fontSize: 14, fontWeight: 800, letterSpacing: 2, opacity: 0.4 },
  
  voteHeaderBox: { width: '100%', padding: '30px 40px', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.02) 100%)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  voteHeaderTitle: { fontSize: 24, fontWeight: 900, color: '#fca5a5', letterSpacing: 6 },
  voteTimer: { fontSize: 42, fontWeight: 900, color: '#fff' },
  voteTimerUrgent: { fontSize: 42, fontWeight: 900, color: '#ef4444', animation: 'pulse 0.4s infinite', textShadow: '0 0 20px rgba(239,68,68,0.5)' },
  voteBtn: { padding: '20px 24px', border: '1px solid', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', textTransform: 'uppercase' },
  
  centerScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, animation: 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)', maxWidth: 800, margin: '0 auto', width: '100%' },
  alertBanner: { fontSize: 42, fontWeight: 900, color: '#ef4444', letterSpacing: 8, marginBottom: 50, textShadow: '0 0 40px rgba(239,68,68,0.6)' },
  guessPanel: { width: '100%', background: 'rgba(15,18,25,0.8)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(239,68,68,0.1)' },
  guessLabel: { fontSize: 13, fontWeight: 900, color: '#fca5a5', letterSpacing: 4 },
  guessCategory: { fontSize: 24, fontWeight: 900, letterSpacing: 4, color: '#fff' },
  
  resultBannerImpostor: { fontSize: 56, fontWeight: 900, color: '#ef4444', letterSpacing: 8, textShadow: '0 0 60px rgba(239,68,68,0.6)', textAlign: 'center', marginBottom: 20 },
  resultBannerCrew: { fontSize: 56, fontWeight: 900, color: '#22c55e', letterSpacing: 8, textShadow: '0 0 60px rgba(34,197,94,0.6)', textAlign: 'center', marginBottom: 20 },
  resultReason: { fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginBottom: 50, textAlign: 'center', maxWidth: 600, lineHeight: 1.6 },
  revealPanel: { width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 50, display: 'flex', flexDirection: 'column', gap: 40, marginBottom: 50 },
  revealRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15 },
  revealLabel: { fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 6 },
  revealValue: { fontSize: 36, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase' },
  revealValueImpostor: { fontSize: 36, fontWeight: 900, color: '#ef4444', letterSpacing: 4, textTransform: 'uppercase', textShadow: '0 0 20px rgba(239,68,68,0.4)' },
}
