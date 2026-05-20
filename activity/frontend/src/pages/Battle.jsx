import { useEffect, useRef, useState } from 'react'
import { apiFetch, preloadImages } from '../lib/api'
import FutCard from '../components/FutCard'

const STAT_LABEL = { attack: 'Attack', defense: 'Defense', speed: 'Speed' }
const STAT_ICON  = { attack: '⚔️', defense: '🛡️', speed: '💨' }
const STAT_COLOR = { attack: '#ef4444', defense: '#3b82f6', speed: '#22c55e' }
const COUNTER_OF = { attack: 'Defense', defense: 'Attack', speed: 'Speed' }

export default function Battle({ token, participants = [], incomingChallenge, setIncomingChallenge }) {
  const [screen, setScreen]   = useState('lobby')
  const [decks, setDecks]     = useState([])
  const [selectedDeck, setSelectedDeck] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomId, setRoomId]   = useState('')
  const [error, setError]     = useState(null)

  const [rematchRequested, setRematchRequested]         = useState(false)
  const [opponentRequestedRematch, setOpponentRequestedRematch] = useState(false)

  // Game state
  const [picksStatThisRound, setPicksStatThisRound] = useState(false)
  const [round, setRound]     = useState(null)
  const [hand, setHand]       = useState([])
  const [score, setScore]     = useState({ you: 0, opponent: 0 })
  const [opponentName, setOpponentName] = useState('')
  const [opponentCardCount, setOpponentCardCount] = useState(0)
  const [myStat, setMyStat]   = useState(null)
  const [oppStat, setOppStat] = useState(null)
  const [pickedCard, setPickedCard] = useState(null)
  const [opponentPicked, setOpponentPicked] = useState(false)
  const [roundResult, setRoundResult] = useState(null)
  const [gameResult, setGameResult]   = useState(null)
  const [showVS, setShowVS]   = useState(false)

  const wsRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/decks', token).then(setDecks).catch(() => {})
    return () => wsRef.current?.close()
  }, [])

  function connectWs(id) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/battle/${id}?token=${encodeURIComponent(token)}&deck_name=${encodeURIComponent(selectedDeck)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'waiting':
          setRoomId(msg.room_id); setScreen('waiting'); break

        case 'round_start':
          preloadImages(msg.your_hand.map(c => c.image_url))
          setPicksStatThisRound(msg.picks_stat)
          setRound(msg.round)
          setHand(msg.your_hand)
          setOpponentName(msg.opponent_name)
          setOpponentCardCount(msg.opponent_card_count)
          setScore(msg.score)
          setMyStat(null); setOppStat(null)
          setPickedCard(null); setOpponentPicked(false); setRoundResult(null)
          if (msg.round === 1) {
            setShowVS(true)
            setTimeout(() => {
              setShowVS(false)
              setScreen(msg.picks_stat ? 'stat_selection' : 'waiting_for_stat')
            }, 2200)
          } else {
            setScreen(msg.picks_stat ? 'stat_selection' : 'waiting_for_stat')
          }
          break

        case 'stat_chosen':
          setMyStat(msg.your_stat); setOppStat(msg.opponent_stat); setScreen('picking'); break

        case 'opponent_picked':
          setOpponentPicked(true); break

        case 'round_result':
          preloadImages([msg.your_card?.image_url, msg.opponent_card?.image_url])
          setRoundResult(msg); setScore(msg.score); setScreen('round_result'); break

        case 'game_over':
          setGameResult(msg)
          setRematchRequested(false); setOpponentRequestedRematch(false)
          setScreen('game_over'); break

        case 'rematch_requested':
          setOpponentRequestedRematch(true); break

        case 'opponent_disconnected':
          setError('Opponent disconnected.'); resetToLobby(); break

        case 'error':
          setError(msg.message); setScreen('lobby'); break
      }
    }
    ws.onerror = () => { setError('Connection error.'); setScreen('lobby') }
  }

  function generateId() { return Math.random().toString(36).substring(2, 8).toUpperCase() }

  function createRoom() {
    if (!selectedDeck) return setError('Select a deck first')
    setError(null)
    const id = generateId(); setRoomId(id); connectWs(id)
  }

  function joinRoom() {
    if (!selectedDeck) return setError('Select a deck first')
    if (!joinCode.trim()) return setError('Enter a room code')
    setError(null); connectWs(joinCode.trim().toUpperCase())
  }

  async function challengePlayer(toUserId) {
    if (!selectedDeck) return setError('Select a deck first')
    setError(null)
    const id = generateId()
    await apiFetch('/api/challenges', token, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId, room_id: id, deck_name: selectedDeck }) })
    setRoomId(id); connectWs(id)
  }

  async function acceptChallenge() {
    if (!selectedDeck) return setError('Select a deck first')
    const c = incomingChallenge
    setIncomingChallenge(null)
    await apiFetch('/api/challenges/decline', token, { method: 'DELETE' })
    connectWs(c.room_id)
  }

  async function declineChallenge() {
    await apiFetch('/api/challenges/decline', token, { method: 'DELETE' })
    setIncomingChallenge(null)
  }

  function chooseStat(stat) { wsRef.current?.send(JSON.stringify({ type: 'pick_stat', stat })) }

  function pickCard(card) {
    if (pickedCard) return
    setPickedCard(card)
    wsRef.current?.send(JSON.stringify({ type: 'pick_card', card_id: card.card_id }))
  }

  function requestRematch() {
    setRematchRequested(true)
    wsRef.current?.send(JSON.stringify({ type: 'rematch_request' }))
  }

  function resetToLobby() {
    wsRef.current?.close(); wsRef.current = null
    setScreen('lobby'); setRoundResult(null); setGameResult(null)
    setPickedCard(null); setMyStat(null); setOppStat(null)
    setScore({ you: 0, opponent: 0 }); setRound(null)
    setRematchRequested(false); setOpponentRequestedRematch(false); setError(null)
  }

  /* ── VS SPLASH ── */
  if (showVS) return (
    <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg,#0a0e1a,#1a0a2e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div className="anim-slideL" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>You</div>
        </div>
        <div className="anim-fadeUp" style={{ fontSize: 36, fontWeight: 900, color: 'var(--gold)', letterSpacing: 4, padding: '0 8px' }}>VS</div>
        <div className="anim-slideR" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{opponentName}</div>
        </div>
      </div>
      <div className="anim-fadeUp" style={{ marginTop: 20, color: 'var(--muted)', fontSize: 14, letterSpacing: 2, animationDelay: '0.4s' }}>BATTLE BEGINS</div>
    </div>
  )

  /* ── LOBBY ── */
  if (screen === 'lobby') return (
    <div className="page">
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 16 }}>⚔️ Battle</h2>
      {error && <div style={{ background: '#3d1515', color: '#f87171', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {incomingChallenge && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 14, marginBottom: 10 }}>⚔️ <strong>{incomingChallenge.from_name}</strong> challenged you!</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={acceptChallenge} style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 8, color: '#fff', padding: 8, cursor: 'pointer', fontWeight: 600 }}>Accept</button>
            <button onClick={declineChallenge} style={{ flex: 1, background: 'var(--red)', border: 'none', borderRadius: 8, color: '#fff', padding: 8, cursor: 'pointer' }}>Decline</button>
          </div>
        </div>
      )}

      <label style={{ display: 'block', color: 'var(--muted)', fontSize: 13, marginBottom: 6 }}>Select your deck</label>
      <select value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)} style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, marginBottom: 14 }}>
        <option value="">— choose a deck —</option>
        {decks.map(d => <option key={d.deck_name} value={d.deck_name}>{d.deck_name}</option>)}
      </select>

      {participants.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>In this session</div>
          {participants.map(p => (
            <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>👤 {p.name}</span>
              <button onClick={() => challengePlayer(p.user_id)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Challenge</button>
            </div>
          ))}
        </div>
      )}

      <button className="btn-primary" onClick={createRoom}>Create Room</button>
      <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', margin: '10px 0' }}>or join with a code</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} maxLength={6} placeholder="Room code"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 16, letterSpacing: 4 }} />
        <button onClick={joinRoom} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 18px', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Join</button>
      </div>
    </div>
  )

  /* ── WAITING FOR OPPONENT ── */
  if (screen === 'waiting') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80svh', gap: 16, padding: 24 }}>
      {roomId && <>
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Share this code</div>
        <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: 10, color: 'var(--gold)', background: 'var(--surface)', padding: '14px 28px', borderRadius: 14, border: '1px solid var(--border)' }}>{roomId}</div>
      </>}
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Waiting for opponent…</div>
      <button className="btn-ghost" onClick={resetToLobby}>Cancel</button>
    </div>
  )

  /* ── STAT SELECTION (host) ── */
  if (screen === 'stat_selection') return (
    <div className="page">
      <BattleBar round={round} score={score} opponent={opponentName} />
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
        Round {round} — choose your stat
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['attack','defense','speed'].map(stat => (
          <button key={stat} onClick={() => chooseStat(stat)} style={{
            flex: 1, background: 'var(--surface)', border: `2px solid ${STAT_COLOR[stat]}`,
            borderRadius: 14, padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
            transition: 'transform 0.15s',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{STAT_ICON[stat]}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: STAT_COLOR[stat] }}>{STAT_LABEL[stat]}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>counters: {COUNTER_OF[stat]}</div>
          </button>
        ))}
      </div>
      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 8 }}>Your hand</div>
      <HandGrid hand={hand} stat={null} disabled />
    </div>
  )

  /* ── WAITING FOR STAT (guest) ── */
  if (screen === 'waiting_for_stat') return (
    <div className="page">
      <BattleBar round={round} score={score} opponent={opponentName} />
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginBottom: 20, padding: '12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        ⏳ {opponentName} is choosing their stat…
      </div>
      <HandGrid hand={hand} stat={null} disabled />
    </div>
  )

  /* ── PICKING ── */
  if (screen === 'picking') return (
    <div className="page">
      <BattleBar round={round} score={score} opponent={opponentName} />

      {/* Active stat display */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', gap: 10, background: 'var(--surface)', borderRadius: 40, padding: '8px 16px', border: '1px solid var(--border)' }}>
          <span style={{ color: STAT_COLOR[myStat], fontWeight: 700, fontSize: 15 }}>{STAT_ICON[myStat]} Your {STAT_LABEL[myStat]}</span>
          <span style={{ color: 'var(--muted)' }}>vs</span>
          <span style={{ color: STAT_COLOR[oppStat], fontWeight: 700, fontSize: 15 }}>{STAT_ICON[oppStat]} Their {STAT_LABEL[oppStat]}</span>
        </div>
      </div>

      {opponentPicked && !pickedCard && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--green)', textAlign: 'center' }}>
          {opponentName} has picked — your turn!
        </div>
      )}
      {pickedCard && (
        <div style={{ background: 'rgba(88,101,242,0.1)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>
          Waiting for {opponentName}…
        </div>
      )}

      <div style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 10 }}>Tap a card to play it</div>
      <HandGrid hand={hand} stat={myStat} pickedId={pickedCard?.card_id} onPick={pickCard} />
    </div>
  )

  /* ── ROUND RESULT (cinematic) ── */
  if (screen === 'round_result' && roundResult) {
    const won  = roundResult.round_winner === 'you'
    const lost = roundResult.round_winner === 'opponent'
    return (
      <div className="page">
        <BattleBar round={`${roundResult.round} Result`} score={roundResult.score} opponent={opponentName} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14, justifyContent: 'center' }}>
          {/* Your card */}
          <div className="anim-slideL" style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 6 }}>You</div>
            <FutCard card={roundResult.your_card} highlight={won ? 'win' : lost ? 'lose' : undefined} />
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: STAT_COLOR[roundResult.your_stat] }}>
                {roundResult.your_card[roundResult.your_stat]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{STAT_ICON[roundResult.your_stat]} {STAT_LABEL[roundResult.your_stat]}</div>
            </div>
          </div>

          {/* Middle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--muted)' }}>VS</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: won ? 'var(--green)' : lost ? 'var(--red)' : 'var(--gold)', textAlign: 'center' }}>
              {won ? '🏆 Win' : lost ? '💀 Loss' : '🤝 Draw'}
            </div>
          </div>

          {/* Opponent card */}
          <div className="anim-slideR" style={{ width: 160, flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 6 }}>{opponentName}</div>
            <FutCard card={roundResult.opponent_card} highlight={lost ? 'win' : won ? 'lose' : undefined} />
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: STAT_COLOR[roundResult.opponent_stat] }}>
                {roundResult.opponent_card[roundResult.opponent_stat]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{STAT_ICON[roundResult.opponent_stat]} {STAT_LABEL[roundResult.opponent_stat]}</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>Next round starting…</div>
      </div>
    )
  }

  /* ── GAME OVER ── */
  if (screen === 'game_over' && gameResult) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80svh', gap: 14, padding: 24 }}>
      <div className="anim-fadeUp" style={{ fontSize: 32, fontWeight: 900,
        color: gameResult.winner === 'you' ? 'var(--gold)' : gameResult.winner === 'opponent' ? 'var(--red)' : 'var(--muted)' }}>
        {gameResult.winner === 'you' ? '🏆 Victory' : gameResult.winner === 'opponent' ? '💀 Defeated' : '🤝 Draw'}
      </div>

      <div className="anim-fadeUp glass" style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '16px 28px', animationDelay: '0.15s' }}>
        <ScoreBlock label="You" value={gameResult.final_score.you} />
        <div style={{ fontSize: 24, color: 'var(--muted)', fontWeight: 300 }}>—</div>
        <ScoreBlock label={opponentName} value={gameResult.final_score.opponent} />
      </div>

      {opponentRequestedRematch && !rematchRequested && (
        <div style={{ color: 'var(--green)', fontSize: 14 }}>{opponentName} wants a rematch!</div>
      )}
      {rematchRequested && !opponentRequestedRematch && (
        <div style={{ color: 'var(--muted)', fontSize: 14 }}>Waiting for {opponentName}…</div>
      )}
      {!rematchRequested && (
        <button className="btn-primary" onClick={requestRematch} style={{ maxWidth: 260 }}>
          {opponentRequestedRematch ? 'Accept Rematch' : 'Rematch'}
        </button>
      )}
      <button className="btn-ghost" onClick={resetToLobby}>Back to Lobby</button>
    </div>
  )

  return null
}

/* ── Sub-components ── */

function BattleBar({ round, score, opponent }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', marginBottom: 14, gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Round {round}/5</span>
      <div style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>
        {score.you} <span style={{ color: 'var(--muted)', fontWeight: 300 }}>—</span> {score.opponent}
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>vs {opponent}</span>
    </div>
  )
}

function HandGrid({ hand, stat, pickedId, onPick, disabled }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {hand.map((card, i) => (
        <div key={i} style={{ width: 100, opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
          <FutCard
            card={card}
            selected={pickedId === card.card_id}
            dimmed={!!(pickedId && pickedId !== card.card_id)}
            onClick={disabled ? undefined : () => onPick?.(card)}
          />
          {stat && (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: STAT_COLOR[stat] }}>{card[stat]}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{card.overall} OVR</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ScoreBlock({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}
