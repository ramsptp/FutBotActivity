import { useEffect, useRef, useState } from 'react'
import { apiFetch, preloadImages } from '../lib/api'
import FutCard from '../components/FutCard'
import HowToPlayModal from '../components/HowToPlayModal'
import PageTip from '../components/PageTip'
import PageHelp from '../components/PageHelp'

const STAT_LABEL = { attack: 'Attack', defense: 'Defense', speed: 'Speed' }
const STAT_ICON  = { attack: '⚔️', defense: '🛡️', speed: '💨' }
const STAT_COLOR = { attack: '#ef4444', defense: '#3b82f6', speed: '#22c55e' }
const COUNTER_OF = { attack: 'Defense', defense: 'Attack', speed: 'Speed' }

export default function Battle({ token, participants = [], incomingChallenge, setIncomingChallenge, initialMode = 'match', autoChallenge = null, setAutoChallenge }) {
  const [screen, setScreen]   = useState('lobby')
  const [decks, setDecks]     = useState([])
  const [selectedDeck, setSelectedDeck] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [roomId, setRoomId]   = useState('')
  const [error, setError]     = useState(null)

  const [rematchRequested, setRematchRequested]         = useState(false)
  const [opponentRequestedRematch, setOpponentRequestedRematch] = useState(false)
  const [surrenderConfirm, setSurrenderConfirm] = useState(false)
  const [showAcceptScreen, setShowAcceptScreen] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)

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
  const [opponentDeckReady, setOpponentDeckReady] = useState(false)
  const [opponentNameForDeck, setOpponentNameForDeck] = useState('')

  const wsRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/decks', token).then(setDecks).catch(() => {})
    return () => wsRef.current?.close()
  }, [])

  function connectWs(id) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/battle/${id}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'waiting':
          setRoomId(msg.room_id); setScreen('waiting'); break

        case 'select_deck':
          setOpponentNameForDeck(msg.opponent_name)
          setOpponentDeckReady(false)
          setSelectedDeck('')
          setScreen('deck_selection')
          break

        case 'opponent_deck_ready':
          setOpponentDeckReady(true)
          break

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

        case 'challenge_declined':
          setError(`${msg.by} declined your challenge.`); resetToLobby(); break

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
    setError(null)
    const id = generateId(); setRoomId(id); connectWs(id)
  }

  function joinRoom() {
    if (!joinCode.trim()) return setError('Enter a room code')
    setError(null); connectWs(joinCode.trim().toUpperCase())
  }

  async function challengePlayer(toUserId) {
    setError(null)
    const id = generateId()
    await apiFetch('/api/challenges', token, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId, room_id: id }) })
    setRoomId(id); connectWs(id)
  }

  function sendReady() {
    if (!selectedDeck) return setError('Select a deck first')
    setError(null)
    wsRef.current?.send(JSON.stringify({ type: 'ready', deck_name: selectedDeck }))
    setScreen('deck_ready_waiting')
  }

  async function acceptChallenge() {
    const c = incomingChallenge
    setIncomingChallenge(null)
    setShowAcceptScreen(false)
    await apiFetch('/api/challenges/decline?silent=true', token, { method: 'DELETE' })
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

  function surrender() {
    if (!surrenderConfirm) { setSurrenderConfirm(true); return }
    setSurrenderConfirm(false)
    wsRef.current?.send(JSON.stringify({ type: 'surrender' }))
  }

  function resetToLobby() {
    wsRef.current?.close(); wsRef.current = null
    setScreen('lobby'); setRoundResult(null); setGameResult(null)
    setPickedCard(null); setMyStat(null); setOppStat(null)
    setScore({ you: 0, opponent: 0 }); setRound(null)
    setRematchRequested(false); setOpponentRequestedRematch(false); setError(null)
  }

  /* ── HOW TO PLAY MODAL ── */
  const howToPlayModal = showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} battleFocus />

  /* ── VS SPLASH — must be first so it overlays any screen ── */
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

  /* ── IN-ARENA DECK SELECTION ── */
  if (screen === 'deck_selection') return (
    <div style={L.root}>
      <style>{`.deck-select option{background:#0d1117}`}</style>
      <div style={L.vignette} />
      <div style={L.diagLine} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 420, margin: '0 auto', width: '100%', gap: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: MONTSERRAT, fontWeight: 700, color: '#ffca45', letterSpacing: '0.25em', marginBottom: 6 }}>VS {opponentNameForDeck.toUpperCase()}</div>
          <div style={{ fontSize: 28, fontFamily: MONTSERRAT, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Select Your Squad</div>
          <div style={{ marginTop: 8, height: 2, width: 50, background: 'linear-gradient(to right, #ffca45, transparent)' }} />
        </div>
        {opponentDeckReady && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
            ✓ {opponentNameForDeck} is ready — pick your deck!
          </div>
        )}
        <div>
          <div style={L.deckLabel}>CHOOSE YOUR LINEUP</div>
          <select value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)} className="deck-select" style={L.deckSelect}>
            <option value="">— select a deck —</option>
            {decks.map(d => <option key={d.deck_name} value={d.deck_name}>{d.deck_name}</option>)}
          </select>
        </div>
        {error && <div style={L.error}>{error}</div>}
        <button onClick={sendReady} style={L.goldBtn}>⚔ READY FOR BATTLE</button>
      </div>
    </div>
  )

  /* ── WAITING FOR OPPONENT DECK ── */
  if (screen === 'deck_ready_waiting') return (
    <div style={{ ...L.root, justifyContent: 'center', alignItems: 'center', gap: 20, textAlign: 'center' }}>
      <div style={L.vignette} />
      <div style={{ fontSize: 11, fontFamily: MONTSERRAT, fontWeight: 700, color: '#ffca45', letterSpacing: '0.25em' }}>READY</div>
      <div style={{ fontSize: 24, fontFamily: MONTSERRAT, fontWeight: 900, color: '#fff' }}>Waiting for {opponentNameForDeck}…</div>
      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(240,192,64,0.2)', borderTop: '3px solid #ffca45', animation: 'spin 0.9s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  /* ── ACCEPT CHALLENGE ── */
  if (screen === 'lobby' && (initialMode === 'accepting' || showAcceptScreen) && incomingChallenge) return (
    <div style={{ ...L.root, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={L.vignette} />
      <div style={L.diagLine} />

      <div className="anim-fadeUp" style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        {/* Challenger info */}
        <div style={{ fontSize: 44 }}>⚔️</div>
        <div>
          <div style={{ fontSize: 11, fontFamily: MONTSERRAT, fontWeight: 700, color: '#ffca45', letterSpacing: '0.25em', marginBottom: 6 }}>INCOMING CHALLENGE</div>
          <div style={{ fontSize: 26, fontFamily: MONTSERRAT, fontWeight: 900, color: '#fff' }}>{incomingChallenge.from_name}</div>
          <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>wants to battle you</div>
        </div>

        <div style={{ width: '100%', height: 1, background: 'linear-gradient(to right, transparent, rgba(255,202,69,0.3), transparent)' }} />

        <button
          onClick={async () => {
            setError(null)
            const c = incomingChallenge
            setIncomingChallenge(null)
            setShowAcceptScreen(false)
            await apiFetch('/api/challenges/decline?silent=true', token, { method: 'DELETE' })
            connectWs(c.room_id)
          }}
          style={{ ...L.goldBtn, width: '100%', fontSize: 16, padding: '15px 0' }}
        >
          ⚔ ENTER THE ARENA
        </button>

        <button
          onClick={async () => {
            await apiFetch('/api/challenges/decline', token, { method: 'DELETE' }).catch(() => {})
            setIncomingChallenge(null)
            setShowAcceptScreen(false)
            resetToLobby()
          }}
          className="btn-ghost"
          style={{ fontSize: 13 }}
        >
          Decline
        </button>
      </div>

      <style>{`
        @keyframes tunnelGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .deck-select option { background: #0d1117; }
      `}</style>
    </div>
  )

  /* ── LOBBY ── */
  if (screen === 'lobby') return (
    <div style={L.root}>
      <PageTip page="battle" />
      <PageHelp page="battle" />
      <style>{`
        @keyframes tunnelGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes slideRow { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        .challenge-row:hover { background: rgba(240,192,64,0.06) !important; }
        .challenge-btn:hover { box-shadow: 0 0 20px rgba(240,192,64,0.4) !important; transform: scale(1.04); }
        .deck-select option { background: #0d1117; }
      `}</style>

      {/* Atmospheric vignette */}
      <div style={L.vignette} />

      {/* Diagonal accent line */}
      <div style={L.diagLine} />

      {/* Incoming challenge */}
      {incomingChallenge && (
        <div style={L.challengeBanner}>
          <span style={{ fontSize: 20 }}>⚔️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#ffca45', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Incoming Challenge</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{incomingChallenge.from_name}</div>
          </div>
          <button onClick={() => setShowAcceptScreen(true)} style={L.acceptBtn}>Accept</button>
          <button onClick={declineChallenge} style={L.declineBtn}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={L.header}>
        <div style={L.headerLabel}>{initialMode === 'match' ? 'PRE-MATCH' : 'INVITE A FRIEND'}</div>
        <div style={L.headerTitle}>{initialMode === 'match' ? 'FIND YOUR OPPONENT' : 'PLAY WITH FRIEND'}</div>
        <div style={L.headerLine} />
      </div>

      {error && <div style={L.error}>{error}</div>}

      {initialMode === 'match' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Auto-challenge target from online panel */}
          {autoChallenge && (
            <div style={{ background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 11, color: '#ffca45', fontWeight: 700, letterSpacing: '0.15em', flex: 1 }}>
                CHALLENGING — {autoChallenge.name}
              </div>
              <button onClick={() => { challengePlayer(autoChallenge.user_id); setAutoChallenge?.(null) }} style={{ ...L.challengeBtn, padding: '8px 16px', fontSize: 13 }}>
                ⚔ SEND CHALLENGE
              </button>
              <button onClick={() => setAutoChallenge?.(null)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
            </div>
          )}
          {participants.length > 0 ? (
            <>
              <div style={L.sectionLabel}>OPPONENTS IN SESSION</div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {participants.map((p, i) => (
                  <div key={p.user_id} className="challenge-row" style={{ ...L.opponentRow, animationDelay: `${i * 0.08}s` }}>
                    <div style={L.opponentAvatar}>
                      <img
                        src={p.avatar ? `https://cdn.discordapp.com/avatars/${p.user_id}/${p.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/0.png`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        onError={e => { e.target.src = 'https://cdn.discordapp.com/embed/avatars/0.png' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, letterSpacing: 0.5 }}>● ONLINE</div>
                    </div>
                    <button className="challenge-btn" onClick={() => challengePlayer(p.user_id)} style={L.challengeBtn}>
                      ⚔ CHALLENGE
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={L.emptyState}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🏟️</div>
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>
                No opponents in this session yet.<br />
                <span style={{ color: '#94a3b8' }}>Create a room or use Play with Friend.</span>
              </div>
            </div>
          )}
          <div style={L.orDivider}><span style={L.orText}>OR</span></div>
          <button onClick={createRoom} style={L.goldBtn}>CREATE ROOM TO WAIT</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={createRoom} style={L.goldBtn}>CREATE ROOM & SHARE CODE</button>
          <div style={L.orDivider}><span style={L.orText}>JOIN WITH CODE</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="A1B2C3"
              style={L.codeInput}
            />
            <button onClick={joinRoom} style={L.joinBtn}>JOIN</button>
          </div>
        </div>
      )}
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
      {howToPlayModal}
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} />
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
      {howToPlayModal}
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} />
      <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginBottom: 20, padding: '12px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
        ⏳ {opponentName} is choosing their stat…
      </div>
      <HandGrid hand={hand} stat={null} disabled />
    </div>
  )

  /* ── PICKING ── */
  if (screen === 'picking') return (
    <div className="page">
      {howToPlayModal}
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} />

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

/* ── Lobby styles ── */
const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const L = {
  root: {
    position: 'relative', minHeight: '100svh', display: 'flex', flexDirection: 'column',
    padding: '20px 20px 90px',
    background: `linear-gradient(to bottom, rgba(5,9,20,0.88) 0%, rgba(5,9,20,0.96) 100%), url('/background.png') center/cover no-repeat`,
    overflow: 'hidden',
  },
  vignette: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    background: 'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(5,9,20,0.8) 100%)',
  },
  diagLine: {
    position: 'absolute', top: 0, right: '15%', width: 2, height: '35%',
    background: 'linear-gradient(to bottom, transparent, rgba(240,192,64,0.3), transparent)',
    transform: 'skewX(-20deg)', pointerEvents: 'none',
  },
  challengeBanner: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.4)',
    borderRadius: 12, padding: '10px 14px', marginBottom: 16,
  },
  acceptBtn: {
    background: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'none',
    borderRadius: 8, color: '#fff', padding: '7px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  declineBtn: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, color: '#ef4444', padding: '7px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  header: { marginBottom: 20, position: 'relative' },
  headerLabel: {
    fontSize: 11, fontFamily: MONTSERRAT, fontWeight: 700, color: '#ffca45',
    letterSpacing: '0.25em', marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28, fontFamily: MONTSERRAT, fontWeight: 900, color: '#fff',
    letterSpacing: '0.08em', lineHeight: 1.1, textTransform: 'uppercase',
  },
  headerLine: {
    marginTop: 10, height: 2, width: 60,
    background: 'linear-gradient(to right, #ffca45, transparent)',
  },
  deckWrap: { marginBottom: 16 },
  deckLabel: {
    fontSize: 10, fontFamily: MONTSERRAT, fontWeight: 700, color: '#64748b',
    letterSpacing: '0.2em', marginBottom: 6,
  },
  deckSelect: {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: '#fff', padding: '11px 14px', fontSize: 14,
    fontFamily: MONTSERRAT, fontWeight: 600, cursor: 'pointer',
    outline: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ffca45' stroke-width='1.5' fill='none'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
  },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, color: '#f87171', padding: '8px 12px', marginBottom: 12, fontSize: 13,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: MONTSERRAT, fontWeight: 700, color: '#64748b',
    letterSpacing: '0.2em', marginBottom: 10,
  },
  opponentRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '12px 14px', marginBottom: 8,
    animation: 'slideRow 0.3s ease both', transition: 'background 0.2s',
    cursor: 'default',
  },
  opponentAvatar: {
    width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
    border: '2px solid rgba(255,255,255,0.1)',
  },
  challengeBtn: {
    background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.4)',
    borderRadius: 8, color: '#ffca45', padding: '7px 14px',
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 12, cursor: 'pointer',
    letterSpacing: '0.08em', transition: 'all 0.15s',
  },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', textAlign: 'center', padding: '32px 16px',
  },
  orDivider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0',
  },
  orText: {
    fontSize: 10, fontFamily: MONTSERRAT, fontWeight: 700, color: '#334155',
    letterSpacing: '0.2em', whiteSpace: 'nowrap',
  },
  goldBtn: {
    width: '100%', background: 'linear-gradient(135deg, #d97706, #ffca45)',
    border: 'none', borderRadius: 12, color: '#0a0500',
    padding: '13px 0', fontFamily: MONTSERRAT, fontWeight: 900, fontSize: 14,
    cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase',
    boxShadow: '0 4px 20px rgba(255,202,69,0.25)',
  },
  codeInput: {
    flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#fff', padding: '12px 14px',
    fontSize: 22, letterSpacing: '0.3em', fontFamily: MONTSERRAT, fontWeight: 700,
    textAlign: 'center', outline: 'none',
  },
  joinBtn: {
    background: 'var(--accent)', border: 'none', borderRadius: 10,
    color: '#fff', padding: '12px 22px', cursor: 'pointer',
    fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 14, letterSpacing: '0.1em',
  },
}

/* ── Sub-components ── */

function BattleBar({ round, score, opponent, onSurrender, onHowToPlay }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', marginBottom: 14, gap: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Round {round}/5</span>
      {onHowToPlay && <button onClick={onHowToPlay} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50%', width: 22, height: 22, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: 0 }}>?</button>}
      <div style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>
        {score.you} <span style={{ color: 'var(--muted)', fontWeight: 300 }}>—</span> {score.opponent}
      </div>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>vs {opponent}</span>
      {onSurrender && (
        onSurrender.confirming
          ? <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              <span style={{ fontSize: 11, color: '#ef4444', alignSelf: 'center' }}>Sure?</span>
              <button onClick={onSurrender.confirm} style={{ background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>Yes</button>
              <button onClick={onSurrender.cancel} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 6, color: '#aaa', fontSize: 11, padding: '3px 6px', cursor: 'pointer' }}>No</button>
            </div>
          : <button onClick={onSurrender.start} style={{ marginLeft: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#ef4444', fontSize: 11, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
              Surrender
            </button>
      )}
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
