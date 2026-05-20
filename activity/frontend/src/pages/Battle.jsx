import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'

const STAT_LABEL = { attack: '⚔️ Attack', defense: '🛡️ Defense', speed: '💨 Speed' }
const STAT_COLOR = { attack: '#e74c3c', defense: '#3498db', speed: '#2ecc71' }
const COUNTER_LABEL = { attack: 'Defense', defense: 'Attack', speed: 'Speed' }

export default function Battle({ token }) {
  const [screen, setScreen] = useState('lobby')
  const [decks, setDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState(null)

  // Game state
  const [picksStatThisRound, setPicksStatThisRound] = useState(false)
  const [round, setRound] = useState(null)
  const [hand, setHand] = useState([])
  const [score, setScore] = useState({ you: 0, opponent: 0 })
  const [opponentName, setOpponentName] = useState('')
  const [opponentCardCount, setOpponentCardCount] = useState(0)

  // Round state
  const [myStat, setMyStat] = useState(null)
  const [oppStat, setOppStat] = useState(null)
  const [pickedCard, setPickedCard] = useState(null)
  const [opponentPicked, setOpponentPicked] = useState(false)
  const [roundResult, setRoundResult] = useState(null)
  const [gameResult, setGameResult] = useState(null)

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
          setRoomId(msg.room_id)
          setScreen('waiting')
          break

        case 'round_start':
          setPicksStatThisRound(msg.picks_stat)
          setRound(msg.round)
          setHand(msg.your_hand)
          setOpponentName(msg.opponent_name)
          setOpponentCardCount(msg.opponent_card_count)
          setScore(msg.score)
          setMyStat(null)
          setOppStat(null)
          setPickedCard(null)
          setOpponentPicked(false)
          setRoundResult(null)
          setScreen(msg.picks_stat ? 'stat_selection' : 'waiting_for_stat')
          break

        case 'stat_chosen':
          setMyStat(msg.your_stat)
          setOppStat(msg.opponent_stat)
          setScreen('picking')
          break

        case 'opponent_picked':
          setOpponentPicked(true)
          break

        case 'round_result':
          setRoundResult(msg)
          setScore(msg.score)
          setScreen('round_result')
          break

        case 'game_over':
          setGameResult(msg)
          setScreen('game_over')
          break

        case 'opponent_disconnected':
          setError('Opponent disconnected.')
          resetToLobby()
          break

        case 'error':
          setError(msg.message)
          setScreen('lobby')
          break
      }
    }

    ws.onerror = () => { setError('Connection error.'); setScreen('lobby') }
  }

  function createRoom() {
    if (!selectedDeck) return setError('Select a deck first')
    setError(null)
    const id = Math.random().toString(36).substring(2, 8).toUpperCase()
    setRoomId(id)
    connectWs(id)
  }

  function joinRoom() {
    if (!selectedDeck) return setError('Select a deck first')
    if (!joinCode.trim()) return setError('Enter a room code')
    setError(null)
    connectWs(joinCode.trim().toUpperCase())
  }

  function chooseStat(stat) {
    wsRef.current?.send(JSON.stringify({ type: 'pick_stat', stat }))
  }

  function pickCard(card) {
    if (pickedCard) return
    setPickedCard(card)
    wsRef.current?.send(JSON.stringify({ type: 'pick_card', card_id: card.card_id }))
  }

  function resetToLobby() {
    wsRef.current?.close()
    wsRef.current = null
    setScreen('lobby')
    setRoundResult(null)
    setGameResult(null)
    setPickedCard(null)
    setMyStat(null)
    setOppStat(null)
    setScore({ you: 0, opponent: 0 })
    setRound(null)
    setPicksStatThisRound(false)
    setError(null)
  }

  // --- SCREENS ---

  if (screen === 'lobby') return (
    <div style={s.root}>
      <h2 style={s.heading}>⚔️ Battle</h2>
      {error && <div style={s.error}>{error}</div>}
      <label style={s.label}>Select your deck</label>
      <select style={s.select} value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)}>
        <option value="">— choose a deck —</option>
        {decks.map(d => <option key={d.deck_name} value={d.deck_name}>{d.deck_name}</option>)}
      </select>
      <button style={s.primaryBtn} onClick={createRoom}>Create Room</button>
      <div style={s.divider}>or join a friend's room</div>
      <div style={s.joinRow}>
        <input
          style={s.codeInput}
          placeholder="Room code"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button style={s.joinBtn} onClick={joinRoom}>Join</button>
      </div>
    </div>
  )

  if (screen === 'waiting') return (
    <div style={s.centered}>
      {roomId && <>
        <div style={s.roomCodeLabel}>Share this code with your opponent</div>
        <div style={s.roomCode}>{roomId}</div>
      </>}
      <div style={s.waitingText}>Waiting for opponent…</div>
      <button style={s.ghostBtn} onClick={resetToLobby}>Cancel</button>
    </div>
  )

  if (screen === 'stat_selection') return (
    <div style={s.root}>
      <BattleHeader round={round} score={score} opponentName={opponentName} />
      <div style={s.statSelHeading}>You are the host — choose your stat for Round {round}</div>
      <div style={s.statSelGrid}>
        {['attack', 'defense', 'speed'].map(stat => (
          <button key={stat} style={{ ...s.statSelBtn, borderColor: STAT_COLOR[stat] }} onClick={() => chooseStat(stat)}>
            <div style={{ ...s.statSelIcon, color: STAT_COLOR[stat] }}>{STAT_LABEL[stat]}</div>
            <div style={s.statSelCounter}>opponent counters with {COUNTER_LABEL[stat]}</div>
          </button>
        ))}
      </div>
    </div>
  )

  if (screen === 'waiting_for_stat') return (
    <div style={s.root}>
      <BattleHeader round={round} score={score} opponentName={opponentName} />
      <div style={s.waitingBanner}>⏳ {opponentName} is choosing their stat…</div>
      <div style={s.handLabel}>Your hand</div>
      <div style={s.handGrid}>
        {hand.map((card, i) => <HandCard key={i} card={card} stat={null} disabled />)}
      </div>
    </div>
  )

  if (screen === 'picking') return (
    <div style={s.root}>
      <BattleHeader round={round} score={score} opponentName={opponentName} />
      <div style={s.statRow}>
        <div style={{ ...s.statPill, background: STAT_COLOR[myStat] }}>Your stat: {STAT_LABEL[myStat]}</div>
        <div style={{ ...s.statPill, background: '#333' }}>Their stat: {STAT_LABEL[oppStat]}</div>
      </div>
      {opponentPicked && !pickedCard && (
        <div style={s.opponentPickedBanner}>Opponent has picked — your turn!</div>
      )}
      {pickedCard && (
        <div style={s.waitingBanner}>Waiting for {opponentName}…</div>
      )}
      <div style={s.handLabel}>Tap a card to play it</div>
      <div style={s.handGrid}>
        {hand.map((card, i) => (
          <HandCard
            key={i}
            card={card}
            stat={myStat}
            picked={pickedCard?.card_id === card.card_id}
            onClick={() => pickCard(card)}
          />
        ))}
      </div>
    </div>
  )

  if (screen === 'round_result' && roundResult) return (
    <div style={s.root}>
      <BattleHeader round={`${roundResult.round} Result`} score={roundResult.score} opponentName={opponentName} />
      <div style={s.resultCards}>
        <ResultCard
          card={roundResult.your_card}
          label="You"
          stat={roundResult.your_stat}
          winner={roundResult.round_winner === 'you'}
          loser={roundResult.round_winner === 'opponent'}
        />
        <div style={s.vsMiddle}>VS</div>
        <ResultCard
          card={roundResult.opponent_card}
          label={opponentName}
          stat={roundResult.opponent_stat}
          winner={roundResult.round_winner === 'opponent'}
          loser={roundResult.round_winner === 'you'}
        />
      </div>
      <div style={s.roundOutcome}>
        {roundResult.round_winner === 'you' && <span style={{ color: '#4caf50' }}>You won this round!</span>}
        {roundResult.round_winner === 'opponent' && <span style={{ color: '#e74c3c' }}>{opponentName} won this round</span>}
        {roundResult.round_winner === 'draw' && <span style={{ color: '#ffd700' }}>Draw!</span>}
      </div>
      <div style={s.nextHint}>Next round starting…</div>
    </div>
  )

  if (screen === 'game_over' && gameResult) return (
    <div style={s.centered}>
      {gameResult.winner === 'you' && <div style={s.winText}>🏆 You Win!</div>}
      {gameResult.winner === 'opponent' && <div style={s.loseText}>💀 You Lost</div>}
      {gameResult.winner === 'draw' && <div style={s.drawText}>🤝 Draw</div>}
      <div style={s.finalScore}>
        <ScoreBlock label="You" value={gameResult.final_score.you} />
        <div style={s.scoreDash}>—</div>
        <ScoreBlock label={opponentName} value={gameResult.final_score.opponent} />
      </div>
      <button style={s.primaryBtn} onClick={resetToLobby}>Play Again</button>
    </div>
  )

  return null
}

function BattleHeader({ round, score, opponentName }) {
  return (
    <div style={s.battleHeader}>
      <div style={s.roundBadge}>Round {round}/5</div>
      <div style={s.scoreBadge}>{score.you} — {score.opponent}</div>
      <div style={s.oppBadge}>vs {opponentName}</div>
    </div>
  )
}

function HandCard({ card, stat, picked, disabled, onClick }) {
  return (
    <div
      style={{ ...s.handCard, ...(picked ? s.handCardPicked : {}), ...(disabled ? s.handCardDisabled : {}) }}
      onClick={disabled ? undefined : onClick}
    >
      {card.image_url
        ? <img src={card.image_url} style={s.handImg} loading="lazy" />
        : <div style={s.handImgPlaceholder}>{card.position?.[0]}</div>
      }
      <div style={s.handName}>{card.name.split(' ').pop()}</div>
      {stat && <div style={{ ...s.handStat, color: STAT_COLOR[stat] }}>{card[stat]}</div>}
      <div style={s.handOvr}>{card.overall} OVR</div>
    </div>
  )
}

function ResultCard({ card, label, stat, winner, loser }) {
  return (
    <div style={{ ...s.resultCard, ...(winner ? s.resultCardWin : loser ? s.resultCardLose : {}) }}>
      <div style={s.resultLabel}>{label}</div>
      {card.image_url
        ? <img src={card.image_url} style={s.resultImg} loading="lazy" />
        : <div style={s.handImgPlaceholder}>{card.position?.[0]}</div>
      }
      <div style={s.resultName}>{card.name}</div>
      <div style={{ ...s.resultStatVal, color: STAT_COLOR[stat] }}>{card[stat]}</div>
      <div style={s.resultStatLabel}>{STAT_LABEL[stat]}</div>
    </div>
  )
}

function ScoreBlock({ label, value }) {
  return (
    <div style={s.scoreBlock}>
      <div style={s.scoreBig}>{value}</div>
      <div style={s.scoreSmall}>{label}</div>
    </div>
  )
}

const s = {
  root: { padding: '16px 16px 80px', color: '#fff', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a1a2e' },
  centered: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: 24, color: '#fff', fontFamily: 'sans-serif', background: '#1a1a2e', gap: 16 },
  heading: { margin: '0 0 20px', fontSize: 22 },
  error: { background: '#3d1515', color: '#f88', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 },
  label: { display: 'block', color: '#888', fontSize: 13, marginBottom: 6 },
  select: { width: '100%', background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 14, marginBottom: 14 },
  primaryBtn: { width: '100%', background: '#5865f2', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 8 },
  ghostBtn: { background: 'transparent', border: '1px solid #444', borderRadius: 10, color: '#aaa', padding: '10px 24px', fontSize: 14, cursor: 'pointer' },
  divider: { color: '#555', fontSize: 13, textAlign: 'center', margin: '12px 0' },
  joinRow: { display: 'flex', gap: 8 },
  codeInput: { flex: 1, background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#fff', padding: '10px 12px', fontSize: 16, letterSpacing: 4, textTransform: 'uppercase' },
  joinBtn: { background: '#5865f2', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 16px', fontSize: 14, cursor: 'pointer' },
  roomCodeLabel: { color: '#888', fontSize: 14 },
  roomCode: { fontSize: 48, fontWeight: 900, letterSpacing: 8, color: '#ffd700', background: '#16213e', padding: '16px 32px', borderRadius: 12 },
  waitingText: { color: '#888', fontSize: 14 },
  battleHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: '#16213e', borderRadius: 8, padding: '8px 12px' },
  roundBadge: { fontSize: 13, color: '#aaa' },
  scoreBadge: { fontWeight: 700, fontSize: 18, marginLeft: 'auto' },
  oppBadge: { fontSize: 12, color: '#888' },
  statSelHeading: { color: '#aaa', fontSize: 14, marginBottom: 14 },
  statSelGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  statSelBtn: { background: '#16213e', border: '2px solid', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' },
  statSelIcon: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  statSelCounter: { fontSize: 12, color: '#888' },
  statRow: { display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  statPill: { borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600, color: '#fff' },
  opponentPickedBanner: { background: '#1a3a1a', border: '1px solid #4caf50', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#4caf50' },
  waitingBanner: { background: '#1a1a3a', border: '1px solid #5865f2', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#5865f2' },
  handLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
  handGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8 },
  handCard: { background: '#16213e', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent' },
  handCardPicked: { border: '2px solid #5865f2', opacity: 0.6 },
  handCardDisabled: { opacity: 0.5, cursor: 'default' },
  handImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  handImgPlaceholder: { width: '100%', aspectRatio: '1', background: '#2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#555' },
  handName: { fontSize: 11, padding: '4px 6px 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  handStat: { fontSize: 16, fontWeight: 900, padding: '2px 6px' },
  handOvr: { fontSize: 10, color: '#888', padding: '0 6px 6px' },
  resultCards: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, margin: '12px 0' },
  resultCard: { background: '#16213e', borderRadius: 10, overflow: 'hidden', border: '2px solid #2a2a4a', flex: 1, textAlign: 'center' },
  resultCardWin: { border: '2px solid #4caf50' },
  resultCardLose: { border: '2px solid #e74c3c', opacity: 0.7 },
  resultLabel: { fontSize: 11, color: '#888', padding: '6px 0 2px' },
  resultImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  resultName: { fontSize: 11, padding: '4px 6px 0', fontWeight: 600 },
  resultStatVal: { fontSize: 24, fontWeight: 900, padding: '2px 0' },
  resultStatLabel: { fontSize: 10, color: '#888', paddingBottom: 8 },
  roundOutcome: { textAlign: 'center', fontSize: 18, fontWeight: 700, margin: '8px 0' },
  nextHint: { textAlign: 'center', color: '#555', fontSize: 12, marginTop: 8 },
  finalScore: { display: 'flex', alignItems: 'center', gap: 24, background: '#16213e', borderRadius: 12, padding: 24 },
  scoreBlock: { textAlign: 'center' },
  scoreBig: { fontSize: 40, fontWeight: 900 },
  scoreSmall: { fontSize: 12, color: '#888' },
  scoreDash: { fontSize: 28, color: '#555' },
  winText: { fontSize: 40, fontWeight: 900, color: '#ffd700' },
  loseText: { fontSize: 40, fontWeight: 900, color: '#e74c3c' },
  drawText: { fontSize: 40, fontWeight: 900, color: '#aaa' },
  vsMiddle: { color: '#555', fontWeight: 700, fontSize: 18, padding: '0 4px' },
}
