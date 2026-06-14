import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from '../../lib/api'

export default function FootballImpostor({ token, user, onBack, channelId }) {
  const [gameState, setGameState] = useState('loading') 
  const [roomId, setRoomId] = useState(channelId || 'LOCAL_DEV_ROOM')
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  const [isStarting, setIsStarting] = useState(false)
  
  // Game inputs
  const [clueInput, setClueInput] = useState('')
  const [guessInput, setGuessInput] = useState('')
  const [hasVoted, setHasVoted] = useState(false)
  const [votedFor, setVotedFor] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [showHelp, setShowHelp] = useState(false)

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
          player_name: user.username,
          avatar: user.avatar
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
        if (err.message && err.message.includes('404')) {
          // Room not found, likely server restart. Re-join automatically.
          autoJoin()
        }
      }
    }, 1000)
  }, [roomId, token, autoJoin])

  // Timer logic
  useEffect(() => {
    if (!room) return
    
    const isInfinite = (room.status === 'clues' && room.settings?.clue_time === 0) || 
                       (room.status === 'voting' && room.settings?.voting_time === 0) ||
                       (room.status === 'guess' && room.settings?.clue_time === 0);

    if (isInfinite) {
      setTimeLeft('∞')
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

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
  }, [room?.status, room?.clue_end_time, room?.vote_end_time, room?.guess_end_time, room?.settings?.clue_time, room?.settings?.voting_time])

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
    const newSettings = { clue_time: clueTime, voting_time: votingTime, show_category: room?.settings?.show_category ?? true, ...updates }
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

  const toggleReady = async () => {
    try {
      await apiFetch('/api/social/games/impostor/ready', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: room.room_id, player_id: user.id })
      })
    } catch (err) {}
  }

  const startGame = async () => {
    setIsStarting(true)
    try {
      const data = await apiFetch('/api/social/games/impostor/start2', token, {
        method: 'POST',
        body: JSON.stringify({ room_id: room.room_id, player_id: user.id })
      })
      if (data.error) {
        setError(data.error)
      } else if (data.room) {
        setRoom(data.room)
        setGameState(data.room.status)
      }
    } catch (err) {
      console.error(err)
      setError("Failed to start game. The server took too long. Please try again.")
    } finally {
      setIsStarting(false)
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

  const resetGame = useCallback(async () => {
    try {
      await apiFetch('/api/social/games/impostor/reset', token, {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          player_id: user.id
        })
      })
    } catch (err) {}
  }, [roomId, token, user.id])

  // Auto-reset back to lobby after 15 seconds on results screen
  useEffect(() => {
    if (gameState === 'results' && room?.host_id === user.id) {
      const t = setTimeout(() => {
        resetGame()
      }, 15000)
      return () => clearTimeout(t)
    }
  }, [gameState, room?.host_id, user.id, resetGame])

  const isHost = room?.host_id === user.id
  const isImpostor = room?.impostor_id === user.id
  const myTurn = room && room.status === 'clues' && room.players[room.turn_index]?.id === user.id
  const currentPlayer = room?.players[room?.turn_index]
  const clueTimeTotal = room?.settings?.clue_time || 30
  
  const activePlayers = room?.players?.filter(p => !p?.name?.includes('(Spectator)')) || []
  const otherActivePlayers = activePlayers.filter(p => p.id !== room?.host_id)
  const allOthersReady = otherActivePlayers.length > 0 && otherActivePlayers.every(p => p.is_ready)
  const canStart = activePlayers.length >= 3 && allOthersReady
  
  const getPlayerAvatar = (pid) => {
    const p = room?.players?.find(x => x.id === pid)
    return p?.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : null
  }

  if (gameState === 'loading') {
    return <div style={s.loadingContainer}><div style={s.spinner} /></div>
  }

  return (
    <div style={s.container}>
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');`}
      </style>
      <div style={s.bg} />
      <div style={s.overlay} />
      <div style={s.noise} />

      <div style={{position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column'}}>
        {/* HEADER */}
        <div style={s.header}>
          <button onClick={onBack} style={s.backBtn}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          
          <div style={s.shieldLogo}>
            <span className="material-symbols-outlined" style={{fontSize: 24, color: '#a855f7'}}>sports_soccer</span>
            <div style={s.shieldStar}>★</div>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <div style={s.headerTitle}>IMPOSTOR</div>
            <div style={s.headerSubtitle}>LOBBY ID: {roomId}</div>
          </div>
          
          <div style={s.trustNoOne}>
            <div style={s.pinRed} />
            <div style={s.tapeCorner} />
            TRUST<br/>NO ONE
            <div style={s.redString} />
          </div>
          <button onClick={() => setShowHelp(true)} style={{...s.backBtn, marginLeft: 20}}>
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>

        {/* HELP MODAL */}
        {showHelp && (
          <div style={{...s.overlay, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'}} onClick={() => setShowHelp(false)}>
            <div style={{...s.howToPlayNote, display: 'block', transform: 'rotate(0deg)', minWidth: 300, padding: 30}} onClick={e => e.stopPropagation()}>
              <button style={{position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#333'}} onClick={() => setShowHelp(false)}>×</button>
              <div style={s.pinBlue} />
              <div style={s.fingerprint} />
              <div style={s.noteTitle}>HOW TO PLAY</div>
              <ul style={s.noteList}>
                <li>One player is the Impostor.</li>
                <li>Discuss and vote.</li>
                <li>Find the Impostor before it's too late.</li>
              </ul>
            </div>
          </div>
        )}

        {/* LOBBY PHASE */}
        {gameState === 'waiting' && (
          <div className="impostor-scroll" style={s.contentWrapper}>
            <div style={s.leftCol}>
              {/* SUSPECTS PANEL */}
              <div className="impostor-scroll" style={s.panelDetective}>
                <div style={s.panelHeader}>
                  <span className="material-symbols-outlined" style={{color: '#a855f7'}}>group</span>
                  SUSPECTS ({room?.players?.length || 0}/10)
                </div>
                
                <div className="impostor-scroll" style={s.rosterList}>
                  {[...Array(10)].map((_, i) => {
                    const p = room?.players?.[i]
                    if (p) {
                      const isReady = p.is_ready || p.id === room?.host_id
                      return (
                        <div key={i} style={s.rosterItem}>
                          <div style={s.suspectId}>#{String(i + 1).padStart(3, '0')}</div>
                          <div style={s.rosterProfile}>
                            <div style={s.paperclip} />
                            {p.avatar ? (
                              <img src={`https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png`} style={s.avatarImg} />
                            ) : (
                              <span className="material-symbols-outlined" style={{fontSize: 32, opacity: 0.5}}>person</span>
                            )}
                          </div>
                          <div style={{flex: 1, minWidth: 0}}>
                            <div style={s.rosterName}>{p.name}</div>
                            <div style={{...s.rosterStatus, color: isReady ? '#22c55e' : '#a855f7'}}>
                              STATUS: {isReady ? 'READY' : 'WAITING'}
                            </div>
                          </div>
                          {p.id === room?.host_id && <div style={s.rosterBadge}>HOST</div>}
                          <div style={{...s.statusDot, background: isReady ? '#22c55e' : 'rgba(255,255,255,0.2)', boxShadow: isReady ? '0 0 10px #22c55e' : 'none'}} />
                        </div>
                      )
                    } else {
                      return (
                        <div key={i} style={s.emptyRosterItem}>
                          <div style={s.suspectIdEmpty}>#{String(i + 1).padStart(3, '0')}</div>
                          <span className="material-symbols-outlined" style={{opacity: 0.2, fontSize: 24}}>person_add</span>
                          <span style={{fontSize: 10, opacity: 0.3, fontWeight: 800, letterSpacing: 1}}>EMPTY SLOT</span>
                        </div>
                      )
                    }
                  })}
                </div>
                
                {!isHost && (
                  <div style={{marginTop: 15, flexShrink: 0}}>
                    <button 
                      onClick={toggleReady}
                      style={{
                        ...s.readyBtn,
                        background: room?.players?.find(p => p.id === user.id)?.is_ready ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                        borderColor: room?.players?.find(p => p.id === user.id)?.is_ready ? '#22c55e' : '#a855f7',
                        color: room?.players?.find(p => p.id === user.id)?.is_ready ? '#22c55e' : '#c084fc'
                      }}
                    >
                      <span className="material-symbols-outlined" style={{marginRight: 8}}>
                        {room?.players?.find(p => p.id === user.id)?.is_ready ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {room?.players?.find(p => p.id === user.id)?.is_ready ? 'READY TO START' : 'CLICK TO READY UP'}
                    </button>
                  </div>
                )}
              </div>

              {/* HOW TO PLAY NOTE (HIDDEN) */}
            </div>

            <div style={s.rightCol}>
              {/* CASE FILE SETTINGS */}
              <div className="impostor-scroll" style={s.panelDetective}>
                <div style={s.panelHeader}>
                  <span className="material-symbols-outlined" style={{color: '#a855f7'}}>folder</span>
                  CASE FILE
                </div>
                
                <div style={s.settingBlock}>
                  <div style={s.settingTitle}>
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>timer</span>
                    CLUE TIME (SEC)
                  </div>
                  <div style={s.settingGrid}>
                    {[15, 30, 45, 0].map(t => (
                      <button 
                        key={t}
                        disabled={!isHost}
                        onClick={() => updateSettings({ clue_time: t })}
                        style={clueTime === t ? s.paperBtnActive : s.paperBtn}
                      >
                        <div style={clueTime === t ? s.pinPurple : s.pinHidden} />
                        <div style={s.paperVal}>{t === 0 ? '∞' : t}</div>
                        <div style={s.paperSub}>{t === 0 ? 'INFINITE' : 'SECONDS'}</div>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div style={s.settingBlock}>
                  <div style={s.settingTitle}>
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>how_to_vote</span>
                    VOTING TIME (SEC)
                  </div>
                  <div style={s.settingGrid}>
                    {[30, 60, 90, 0].map(t => (
                      <button 
                        key={t}
                        disabled={!isHost}
                        onClick={() => updateSettings({ voting_time: t })}
                        style={votingTime === t ? s.paperBtnActive : s.paperBtn}
                      >
                        <div style={votingTime === t ? s.pinPurple : s.pinHidden} />
                        <div style={s.paperVal}>{t === 0 ? '∞' : t}</div>
                        <div style={s.paperSub}>{t === 0 ? 'INFINITE' : 'SECONDS'}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={s.settingBlock}>
                  <div style={s.settingTitle}>
                    <span className="material-symbols-outlined" style={{fontSize: 16}}>visibility</span>
                    SHOW CATEGORY TO IMPOSTOR
                  </div>
                  <div style={s.settingGrid}>
                    <button 
                      disabled={!isHost}
                      onClick={() => updateSettings({ show_category: true })}
                      style={room?.settings?.show_category !== false ? s.paperBtnActive : s.paperBtn}
                    >
                      <div style={room?.settings?.show_category !== false ? s.pinPurple : s.pinHidden} />
                      <div style={s.paperVal}>YES</div>
                    </button>
                    <button 
                      disabled={!isHost}
                      onClick={() => updateSettings({ show_category: false })}
                      style={room?.settings?.show_category === false ? s.paperBtnActive : s.paperBtn}
                    >
                      <div style={room?.settings?.show_category === false ? s.pinPurple : s.pinHidden} />
                      <div style={s.paperVal}>NO</div>
                    </button>
                  </div>
                </div>

                <div style={s.statsRow}>
                  <div style={s.statBox}>
                    <span className="material-symbols-outlined">style</span>
                    <div>
                      <div style={s.statLabel}>PLAYERS</div>
                      <div style={s.statVal}>{room?.players?.length || 0} / 10</div>
                    </div>
                  </div>
                  <div style={s.statBox}>
                    <span className="material-symbols-outlined">group_add</span>
                    <div>
                      <div style={s.statLabel}>MIN REQUIRED</div>
                      <div style={s.statVal}>3 PLAYERS</div>
                    </div>
                  </div>
                  <div style={s.statBox}>
                    <span className="material-symbols-outlined">theater_comedy</span>
                    <div>
                      <div style={s.statLabel}>MODE</div>
                      <div style={s.statVal}>SOCIAL DEDUCTION</div>
                    </div>
                  </div>
                </div>
                
                <div style={s.tipBox}>
                  <span className="material-symbols-outlined" style={{color: '#a855f7'}}>lightbulb</span>
                  <div>
                    <span style={{color: '#a855f7', fontWeight: 800}}>TIP:</span> Pay attention to every detail.<br/>The smallest mistake can expose the Impostor.
                  </div>
                </div>
              </div>

              {error && <div style={s.errorBadge}>{error}</div>}

              {/* ACTION BUTTON */}
              {isHost && (
                <div style={s.actionBtnWrapper}>
                  <div style={s.folderTab} />
                  <div style={s.paperclipLarge} />
                  <button 
                    onClick={startGame} 
                    style={{
                      ...s.actionBtnNeon, 
                      opacity: canStart ? 1 : 0.4,
                      background: canStart ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0,0,0,0.4)',
                      borderColor: canStart ? '#a855f7' : 'rgba(255,255,255,0.1)'
                    }}
                    disabled={!canStart}
                  >
                    {canStart ? 'OPEN CASE FILE' : 'WAITING FOR CREW'}
                    <div style={s.actionSub}>{canStart ? 'START THE INVESTIGATION' : 'ALL SUSPECTS MUST BE READY'}</div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLUES & VOTING & RESULTS PHASE REMAINS FUNCTIONAL WITH SAME BASE STYLE BUT IN THE DETECTIVE THEME */}
        {gameState !== 'loading' && gameState !== 'waiting' && (
          <div style={s.contentWrapperSimple}>
            <div style={s.gameContainer}>
              {/* Add game phase content here using the new s variables. For brevity, wrapped in the new neon aesthetic. */}
              {gameState === 'clues' && (
                <div style={s.cluesWrapper}>
                  {/* TOP CURRENT CLUE BANNER */}
                  <div className="responsive-banner" style={s.clueBanner}>
                    <div style={s.clueBannerContent}>
                      <span className="material-symbols-outlined" style={s.clueBannerIcon}>sports_soccer</span>
                      <div>
                        <div style={s.clueBannerLabel}>CURRENT CLUE</div>
                        <div style={s.clueBannerValue}>
                          {isImpostor ? 'THE IMPOSTOR' : room?.secret_word}
                        </div>
                        {(!isImpostor || room?.settings?.show_category !== false) && (
                          <div style={s.clueBannerCategory}>(CATEGORY: {room?.category})</div>
                        )}
                      </div>
                    </div>
                    <div style={s.timerRingWrapper}>
                      <svg width="60" height="60">
                        <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                        {clueTimeTotal > 0 && (
                          <circle 
                            cx="30" cy="30" r="26" fill="none" stroke="#c084fc" strokeWidth="4" 
                            strokeDasharray="163" 
                            strokeDashoffset={163 - (163 * (Number(timeLeft) / clueTimeTotal))} 
                            style={{ transition: 'stroke-dashoffset 1s linear', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} 
                          />
                        )}
                      </svg>
                      <div style={s.timerText}>{timeLeft}</div>
                    </div>
                  </div>

                  {/* BOTTOM PLAY AREA */}
                  <div className="responsive-clues-layout" style={s.cluesLayout}>
                    
                    {/* TURN LOG (Left) */}
                    <div className="responsive-clues-main" style={s.cluesMain}>
                      <div style={s.turnLogHeader}>
                        <span className="material-symbols-outlined" style={{color: '#c084fc'}}>forum</span>
                        TURN LOG
                        <span style={{ fontSize: 10, opacity: 0.5, marginLeft: 'auto', fontWeight: 600 }}>See what everyone has said.</span>
                      </div>
                      <div className="impostor-scroll" style={s.turnLogList}>
                        {room?.clues?.map((c, i) => (
                          <div key={i} style={s.chatEntry}>
                            <div style={s.chatAvatar}>
                              {getPlayerAvatar(c.player_id) ? (
                                <img src={getPlayerAvatar(c.player_id)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                              ) : (
                                <span className="material-symbols-outlined" style={{fontSize: 20, color: 'rgba(255,255,255,0.3)', margin: 6}}>person</span>
                              )}
                            </div>
                            <div style={s.chatContent}>
                              <div style={s.chatName}>
                                {c.player_name} 
                                {c.player_id === user.id && <span style={s.youBadge}>YOU</span>}
                                <span style={{marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600}}>
                                  1{i}:3{i%10}
                                </span>
                              </div>
                              <div style={s.chatMessage}>{c.clue}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div style={s.chatInputArea}>
                        {myTurn ? (
                          <div style={s.chatInputWrapper}>
                            <input
                              style={s.chatInput}
                              value={clueInput}
                              onChange={e => setClueInput(e.target.value)}
                              placeholder="Type your clue..."
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && submitClue()}
                            />
                            <button onClick={() => submitClue()} style={s.chatSendBtn}>
                              <span className="material-symbols-outlined">send</span>
                            </button>
                          </div>
                        ) : (
                          <div style={s.chatWaiting}>
                            <div style={s.spinnerSmall} style={{display: 'inline-block', verticalAlign: 'middle', marginRight: 10}}/>
                            WAITING FOR {currentPlayer?.name?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SUSPECT ORDER (Right) */}
                    <div className="responsive-clues-side" style={s.cluesSide}>
                      <div style={s.turnLogHeader}>
                        <span className="material-symbols-outlined" style={{color: '#c084fc'}}>policy</span>
                        SUSPECT ORDER
                      </div>
                      <div style={{ padding: '0 20px 10px', fontSize: 10, opacity: 0.5, lineHeight: 1.4 }}>
                        The order in which players will submit their clues.
                      </div>
                      <div className="impostor-scroll" style={s.suspectGrid}>
                        {room?.players?.map((p, i) => (
                          <div key={i} style={room?.turn_index === i ? s.suspectItemActive : s.suspectItem}>
                            <div style={room?.turn_index === i ? s.suspectNumActive : s.suspectNum}>{i + 1}</div>
                            {getPlayerAvatar(p.id) ? (
                              <img src={getPlayerAvatar(p.id)} style={{width: 16, height: 16, borderRadius: '50%'}} />
                            ) : (
                              <span className="material-symbols-outlined" style={{fontSize: 16, opacity: 0.5}}>person</span>
                            )}
                            <div style={s.suspectName}>
                              {p.name} 
                            </div>
                            {p.id === user.id && <span style={s.youBadgeSmall}>YOU</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {gameState === 'voting' && (
                <div style={s.cluesLayout}>
                  <div style={s.cluesMain}>
                    <div style={s.voteHeaderBox}>
                      <div style={s.voteHeaderTitle}>VOTING PHASE</div>
                      <div style={timeLeft <= 10 ? s.voteTimerUrgent : s.voteTimer}>{timeLeft}s</div>
                    </div>
                    <div style={s.panelDetective}>
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
                  </div>

                  <div style={s.playersSidePanel}>
                    <div style={s.panelHeader}>ARREST SUSPECT</div>
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
              )}

              {gameState === 'guess' && (
                <div style={s.centerScreen}>
                  <div style={s.alertBanner}>IMPOSTOR EXPOSED!</div>
                  {isImpostor ? (
                    <div style={s.guessPanel}>
                      <div style={s.guessLabel}>YOU HAVE {timeLeft === '∞' ? 'UNLIMITED TIME' : `${timeLeft}s`} TO STEAL THE WIN</div>
                      <div style={s.guessCategory}>CATEGORY: {room?.category}</div>
                      <input
                        style={s.clueInputBox}
                        value={guessInput}
                        onChange={e => setGuessInput(e.target.value)}
                        placeholder="GUESS THE SECRET WORD..."
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && submitGuess()}
                      />
                      <button onClick={() => submitGuess()} style={s.actionBtnNeon}>FINAL GUESS</button>
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

              {gameState === 'results' && (
                <div className="impostor-scroll" style={s.centerScreen}>
                  <div style={room?.winner === 'impostor' ? s.resultBannerImpostor : s.resultBannerCrew}>
                    {room?.winner === 'impostor' ? 'IMPOSTOR ESCAPED' : 'CASE CLOSED: CREW WINS'}
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
                  
                  <div style={{display: 'flex', gap: 20, width: '100%', maxWidth: 600, flexShrink: 0}}>
                    {isHost && (
                      <button onClick={resetGame} style={s.actionBtnNeon}>PLAY AGAIN</button>
                    )}
                    <button onClick={onBack} style={{...s.actionBtnNeon, background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.2)', boxShadow: 'none'}}>
                      RETURN TO MENU
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .marker-font { font-family: 'Caveat', cursive; }
        .impostor-scroll::-webkit-scrollbar { width: 6px; }
        .impostor-scroll::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
        .impostor-scroll::-webkit-scrollbar-thumb { background: rgba(168, 85, 247, 0.4); border-radius: 4px; border: 1px solid rgba(0,0,0,0.2); }
        .impostor-scroll::-webkit-scrollbar-thumb:hover { background: rgba(168, 85, 247, 0.8); }

        @media (max-width: 1000px) {
          .responsive-clues-layout {
            flex-direction: column !important;
            overflow-y: auto !important;
            display: block !important;
          }
          .responsive-clues-main {
            height: 60vh !important;
            flex: none !important;
            margin-bottom: 20px;
          }
          .responsive-clues-side {
            max-width: 100% !important;
            flex: none !important;
            height: 40vh !important;
          }
          .responsive-banner {
            width: 100% !important;
            padding: 15px 20px !important;
            gap: 15px !important;
          }
        }
      `}</style>
    </div>
  )
}

const s = {
  loadingContainer: { minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0c12' },
  spinner: { width: 50, height: 50, border: '4px solid rgba(168,85,247,0.2)', borderTopColor: '#c084fc', borderRadius: '50%', animation: 'spin 0.8s linear infinite', filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.5))' },
  spinnerSmall: { width: 20, height: 20, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  container: { height: '100svh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', color: '#fff', fontFamily: "'Montserrat', system-ui, sans-serif" },
  
  bg: { position: 'absolute', inset: 0, background: 'url("/imposterbg.png") center center / cover no-repeat', zIndex: 1 },
  overlay: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(168,85,247,0.3), transparent 60%), radial-gradient(circle at bottom left, rgba(239,68,68,0.2), transparent 60%), rgba(10,12,18,0.4)', zIndex: 2, backdropFilter: 'blur(4px)' },
  noise: { position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E")', opacity: 0.15, mixBlendMode: 'overlay', pointerEvents: 'none', zIndex: 3 },
  
  header: { display: 'flex', alignItems: 'center', padding: '10px 40px', gap: 20 },
  backBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 0 15px rgba(0,0,0,0.5)' },
  shieldLogo: { width: 36, height: 42, background: 'rgba(20,20,30,0.8)', border: '2px solid #a855f7', clipPath: 'polygon(50% 100%, 100% 80%, 100% 0, 0 0, 0 80%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', boxShadow: '0 0 20px rgba(168,85,247,0.5)' },
  shieldStar: { position: 'absolute', top: -6, color: '#a855f7', fontSize: 10 },
  headerTitle: { fontFamily: "'Caveat', cursive", fontSize: 32, fontWeight: 700, color: '#c084fc', letterSpacing: 2, margin: 0, textShadow: '0 0 15px rgba(168,85,247,0.8), 2px 2px 0px rgba(0,0,0,0.8)' },
  headerSubtitle: { fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: 2, padding: '2px 6px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, marginTop: -2 },
  trustNoOne: { marginLeft: 'auto', position: 'relative', padding: '6px 16px', background: '#e5e0d8', color: '#333', fontFamily: "'Caveat', cursive", fontSize: 18, fontWeight: 700, transform: 'rotate(4deg)', boxShadow: '4px 4px 15px rgba(0,0,0,0.6)', lineHeight: 1.1, textAlign: 'center' },
  pinRed: { position: 'absolute', top: -3, left: '50%', width: 10, height: 10, background: 'radial-gradient(circle at 30% 30%, #ef4444, #991b1b)', borderRadius: '50%', transform: 'translateX(-50%)', boxShadow: '2px 4px 6px rgba(0,0,0,0.5)' },
  tapeCorner: { position: 'absolute', top: -6, left: -10, width: 25, height: 10, background: 'rgba(255,255,255,0.4)', transform: 'rotate(-30deg)', backdropFilter: 'blur(2px)' },
  redString: { position: 'absolute', top: 5, left: -60, width: 80, height: 2, background: '#ef4444', transform: 'rotate(10deg)', zIndex: -1, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' },
  
  contentWrapper: { flex: 1, display: 'flex', gap: 20, padding: '0 40px 15px', maxWidth: 1400, margin: '0 auto', width: '100%', animation: 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)', minHeight: 0, maxHeight: 'calc(100svh - 80px)' },
  leftCol: { flex: 1.6, display: 'flex', flexDirection: 'column', gap: 15, minHeight: 0, height: '100%' },
  rightCol: { flex: 1, display: 'flex', flexDirection: 'column', gap: 15, minHeight: 0, height: '100%' },
  
  panelDetective: { background: 'rgba(20,22,30,0.85)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, padding: '15px 20px', display: 'flex', flexDirection: 'column', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.8), 0 20px 40px rgba(0,0,0,0.6)', position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' },
  panelHeader: { fontFamily: "'Caveat', cursive", fontSize: 22, color: '#e9d5ff', letterSpacing: 2, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, textShadow: '0 2px 4px rgba(0,0,0,0.8)', flexShrink: 0 },
  
  rosterList: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, overflowY: 'auto', paddingRight: 5, alignContent: 'start', flex: 1, minHeight: 0 },
  rosterItem: { position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '15px 10px', background: 'rgba(0,0,0,0.4)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', borderLeft: '4px solid rgba(168,85,247,0.5)', marginTop: 10 },
  rosterProfile: { position: 'relative', width: 36, height: 44, background: '#1a1d24', border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-2deg)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5)', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.3) contrast(1.2)' },
  paperclip: { position: 'absolute', top: -6, right: -3, width: 8, height: 16, border: '2px solid #ccc', borderRadius: 4, clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 80%)', transform: 'rotate(15deg)', zIndex: 2 },
  suspectId: { position: 'absolute', top: -10, left: 10, fontSize: 9, background: '#e5e0d8', color: '#000', padding: '1px 4px', fontWeight: 900, transform: 'rotate(-4deg)', zIndex: 5, boxShadow: '2px 2px 4px rgba(0,0,0,0.5)', border: '1px solid #999' },
  rosterName: { fontSize: 13, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, textShadow: '0 2px 4px rgba(0,0,0,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rosterStatus: { fontSize: 8, fontWeight: 800, color: '#a855f7', letterSpacing: 1 },
  rosterBadge: { fontSize: 8, fontWeight: 900, color: '#fff', background: '#a855f7', padding: '2px 6px', borderRadius: 4, letterSpacing: 1, boxShadow: '0 0 10px rgba(168,85,247,0.4)' },
  statusDot: { width: 6, height: 6, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 10px #22c55e' },
  emptyRosterItem: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '15px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)', marginTop: 10 },
  suspectIdEmpty: { position: 'absolute', top: -10, left: 10, fontSize: 9, background: '#222', color: '#888', padding: '1px 4px', fontWeight: 900, transform: 'rotate(-4deg)', zIndex: 5, border: '1px solid #444' },
  readyBtn: { width: '100%', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, letterSpacing: 2, border: '2px solid #a855f7', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'inset 0 0 20px rgba(168,85,247,0.2), 0 5px 15px rgba(0,0,0,0.5)' },
  
  howToPlayNote: { position: 'relative', padding: '15px 20px', background: '#e5e0d8', color: '#333', transform: 'rotate(-1deg)', boxShadow: '4px 4px 20px rgba(0,0,0,0.6)', backgroundImage: 'linear-gradient(#d5d0c8 1px, transparent 1px)', backgroundSize: '100% 20px', backgroundPosition: '0 15px', minHeight: 0, flexShrink: 0 },
  pinBlue: { position: 'absolute', top: 8, left: '50%', width: 10, height: 10, background: 'radial-gradient(circle at 30% 30%, #3b82f6, #1e3a8a)', borderRadius: '50%', transform: 'translateX(-50%)', boxShadow: '2px 4px 6px rgba(0,0,0,0.5)' },
  fingerprint: { position: 'absolute', bottom: 5, right: 10, width: 30, height: 45, background: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23000%22 stroke-width=%221%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z%22/%3E%3C/svg%3E") no-repeat center', opacity: 0.1 },
  noteTitle: { fontFamily: "'Caveat', cursive", fontSize: 20, fontWeight: 700, marginBottom: 5 },
  noteList: { fontFamily: "'Courier New', Courier, monospace", fontSize: 11, fontWeight: 600, paddingLeft: 15, margin: 0, lineHeight: 1.8 },
  
  caseStatusBox: { padding: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  
  settingBlock: { marginBottom: 15, flexShrink: 0 },
  settingTitle: { fontSize: 9, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
  settingGrid: { display: 'flex', gap: 8 },
  paperBtn: { flex: 1, position: 'relative', padding: '10px 5px', background: '#aba69e', border: 'none', boxShadow: '2px 4px 10px rgba(0,0,0,0.5)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, filter: 'grayscale(0.5) brightness(0.6)' },
  paperBtnActive: { flex: 1, position: 'relative', padding: '10px 5px', background: 'rgba(128,45,217,0.2)', border: '2px solid #a855f7', boxShadow: '0 0 20px rgba(168,85,247,0.3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  paperVal: { fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, color: '#fff', textShadow: '1px 1px 2px #000' },
  paperSub: { fontSize: 8, fontWeight: 900, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  pinHidden: { display: 'none' },
  pinPurple: { position: 'absolute', top: 3, left: '50%', width: 6, height: 6, background: 'radial-gradient(circle at 30% 30%, #d8b4fe, #7e22ce)', borderRadius: '50%', transform: 'translateX(-50%)', boxShadow: '2px 4px 6px rgba(0,0,0,0.8)' },
  
  statsRow: { display: 'flex', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '10px 0', gap: 10, flexShrink: 0 },
  statBox: { flex: 1, display: 'flex', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  statVal: { fontSize: 10, fontWeight: 900, letterSpacing: 1 },
  
  tipBox: { display: 'flex', gap: 8, fontSize: 10, lineHeight: 1.3, opacity: 0.8, marginTop: 10, flexShrink: 0 },
  
  actionBtnWrapper: { position: 'relative', width: '100%', marginTop: 'auto', flexShrink: 0 },
  folderTab: { position: 'absolute', top: -10, left: 15, width: 40, height: 12, background: 'rgba(168,85,247,0.2)', border: '2px solid #a855f7', borderBottom: 'none', borderRadius: '4px 4px 0 0' },
  paperclipLarge: { position: 'absolute', top: 4, right: 15, width: 12, height: 24, border: '2px solid #ccc', borderRadius: 6, clipPath: 'polygon(0 0, 100% 0, 100% 80%, 0 80%)', transform: 'rotate(15deg)', zIndex: 10 },
  actionBtnNeon: { width: '100%', padding: '15px', background: 'rgba(20,20,30,0.9)', border: '2px solid #c084fc', borderRadius: 8, color: '#e9d5ff', fontSize: 20, fontWeight: 900, letterSpacing: 3, cursor: 'pointer', boxShadow: 'inset 0 0 20px rgba(168,85,247,0.3), 0 0 20px rgba(168,85,247,0.4)', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.2s' },
  actionSub: { fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 2 },
  
  errorBadge: { marginTop: 15, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '12px', borderRadius: 8, textAlign: 'center', fontWeight: 800, letterSpacing: 1 },

  // GAME PHASE STYLES (New Premium AAA Layout)
  contentWrapperSimple: { flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 40px 40px', maxWidth: 1400, margin: '0 auto', width: '100%', animation: 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)', minHeight: 0 },
  gameContainer: { width: '100%', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  
  cluesWrapper: { display: 'flex', flexDirection: 'column', height: '100%', gap: 20, width: '100%', minHeight: 0 },
  cluesLayout: { display: 'flex', gap: 20, flex: 1, minHeight: 0, width: '100%' },
  cluesMain: { flex: 2.2, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'rgba(10,12,18,0.85)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' },
  cluesSide: { flex: 1, minWidth: 260, maxWidth: 350, display: 'flex', flexDirection: 'column', background: 'rgba(10,12,18,0.85)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12 },
  
  clueBanner: { background: 'linear-gradient(90deg, rgba(20,22,30,0.95) 0%, rgba(30,22,40,0.95) 100%)', border: '1px solid #c084fc', borderRadius: 12, padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, boxShadow: '0 0 40px rgba(168,85,247,0.2), inset 0 0 20px rgba(168,85,247,0.1)', flexShrink: 0, margin: '0 auto', minWidth: '40%' },
  clueBannerContent: { display: 'flex', alignItems: 'center', gap: 20 },
  clueBannerIcon: { fontSize: 48, color: '#c084fc', filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.8))' },
  clueBannerLabel: { fontSize: 10, fontWeight: 900, color: '#e9d5ff', letterSpacing: 4, marginBottom: 5 },
  clueBannerValue: { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: 2, textTransform: 'uppercase', textShadow: '0 2px 10px rgba(168,85,247,0.5)' },
  clueBannerCategory: { fontSize: 14, fontWeight: 700, color: '#a855f7', letterSpacing: 1, marginTop: 5, textTransform: 'uppercase' },
  
  timerRingWrapper: { position: 'relative', width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  timerText: { position: 'absolute', fontSize: 20, fontWeight: 900, color: '#fff' },
  
  turnLogHeader: { padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 900, color: '#e9d5ff', letterSpacing: 2, flexShrink: 0 },
  turnLogList: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 },
  chatEntry: { display: 'flex', gap: 15, alignItems: 'flex-start' },
  chatAvatar: { width: 32, height: 32, borderRadius: 4, background: '#111', border: '1px solid rgba(168,85,247,0.3)', overflow: 'hidden', flexShrink: 0 },
  chatContent: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, background: 'linear-gradient(90deg, rgba(168,85,247,0.05) 0%, transparent 100%)', padding: '12px 15px', borderRadius: '0 8px 8px 8px', border: '1px solid rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(168,85,247,0.4)' },
  chatName: { fontSize: 11, fontWeight: 900, color: '#c084fc', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 1 },
  youBadge: { background: 'rgba(168,85,247,0.3)', color: '#e9d5ff', fontSize: 9, padding: '2px 6px', borderRadius: 4, letterSpacing: 1 },
  chatMessage: { fontSize: 14, fontWeight: 600, color: '#e5e7eb', lineHeight: 1.4, marginTop: 2 },
  chatInputArea: { padding: '20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)', flexShrink: 0 },
  chatInputWrapper: { display: 'flex', gap: 10, width: '100%' },
  chatInput: { flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, padding: '15px 20px', color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.2s' },
  chatSendBtn: { background: '#a855f7', border: 'none', borderRadius: 8, width: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'all 0.2s' },
  chatWaiting: { padding: '15px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 900, letterSpacing: 2 },
  
  suspectGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, overflowY: 'auto', padding: '0 20px 20px', alignContent: 'start', flex: 1, minHeight: 0 },
  suspectItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.02)' },
  suspectItemActive: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', background: 'rgba(168,85,247,0.1)', borderRadius: 6, border: '1px solid rgba(168,85,247,0.5)', boxShadow: 'inset 0 0 10px rgba(168,85,247,0.2)' },
  suspectNum: { fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.3)', width: 14 },
  suspectNumActive: { fontSize: 10, fontWeight: 900, color: '#c084fc', width: 14 },
  suspectName: { fontSize: 11, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 5 },
  youBadgeSmall: { background: 'rgba(168,85,247,0.3)', color: '#c084fc', fontSize: 8, padding: '1px 3px', borderRadius: 2, marginLeft: 'auto' },
  voteHeaderBox: { width: '100%', padding: '30px 40px', background: 'linear-gradient(90deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.02) 100%)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  voteHeaderTitle: { fontSize: 24, fontWeight: 900, color: '#fca5a5', letterSpacing: 6 },
  voteTimer: { fontSize: 42, fontWeight: 900, color: '#fff' },
  voteTimerUrgent: { fontSize: 42, fontWeight: 900, color: '#ef4444', animation: 'pulse 0.4s infinite', textShadow: '0 0 20px rgba(239,68,68,0.5)' },
  voteBtn: { padding: '20px 24px', border: '1px solid', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: 2, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', textTransform: 'uppercase' },
  centerScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 40px', animation: 'slideUp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)', maxWidth: 800, margin: '0 auto', width: '100%', overflowY: 'auto', maxHeight: 'calc(100svh - 80px)' },
  alertBanner: { fontSize: 42, fontWeight: 900, color: '#ef4444', letterSpacing: 8, marginBottom: 50, textShadow: '0 0 40px rgba(239,68,68,0.6)', flexShrink: 0 },
  guessPanel: { width: '100%', background: 'rgba(20,22,30,0.85)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 16, padding: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(239,68,68,0.1)', flexShrink: 0 },
  guessLabel: { fontSize: 13, fontWeight: 900, color: '#fca5a5', letterSpacing: 4 },
  guessCategory: { fontSize: 24, fontWeight: 900, letterSpacing: 4, color: '#fff' },
  resultBannerImpostor: { fontSize: 48, fontWeight: 900, color: '#ef4444', letterSpacing: 6, textShadow: '0 0 40px rgba(239,68,68,0.6)', textAlign: 'center', marginBottom: 15, flexShrink: 0 },
  resultBannerCrew: { fontSize: 48, fontWeight: 900, color: '#22c55e', letterSpacing: 6, textShadow: '0 0 40px rgba(34,197,94,0.6)', textAlign: 'center', marginBottom: 15, flexShrink: 0 },
  resultReason: { fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, marginBottom: 30, textAlign: 'center', maxWidth: 600, lineHeight: 1.6, flexShrink: 0 },
  revealPanel: { width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 40, display: 'flex', flexDirection: 'column', gap: 30, marginBottom: 30, flexShrink: 0 },
  revealRow: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  revealLabel: { fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 6 },
  revealValue: { fontSize: 36, fontWeight: 900, letterSpacing: 4, textTransform: 'uppercase' },
  revealValueImpostor: { fontSize: 36, fontWeight: 900, color: '#ef4444', letterSpacing: 4, textTransform: 'uppercase', textShadow: '0 0 20px rgba(239,68,68,0.4)' },
}
