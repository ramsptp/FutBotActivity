import { useEffect, useRef, useState } from 'react'
import * as sfx from '../lib/sounds'
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
  const [lobbyPickingMode, setLobbyPickingMode] = useState(null) // participant for mode picker

  // Draft state
  const [draftRound, setDraftRound]     = useState(0)
  const [draftCards, setDraftCards]     = useState([])
  const [draftClaimed, setDraftClaimed] = useState({})  // position -> 'you'|'opponent'
  const [draftMyPick, setDraftMyPick]   = useState(null)
  const [draftResult, setDraftResult]   = useState(null)
  const [draftMyDeck, setDraftMyDeck]   = useState([])
  const [draftOppDeck, setDraftOppDeck] = useState([])
  const [draftPhase, setDraftPhase]     = useState('reveal')  // reveal | pick | result
  const [draftTimer, setDraftTimer]     = useState(20)
  const [draftComplete, setDraftComplete] = useState(null)
  const draftTimerRef = useRef(null)

  // Game state
  const [picksStatThisRound, setPicksStatThisRound] = useState(false)
  const [round, setRound]     = useState(null)
  const [hand, setHand]       = useState([])
  const [score, setScore]     = useState({ you: 0, opponent: 0 })
  const [roundHistory, setRoundHistory] = useState([])
  const [opponentName, setOpponentName] = useState('')
  const [opponentCardCount, setOpponentCardCount] = useState(0)
  const [myStat, setMyStat]   = useState(null)
  const [oppStat, setOppStat] = useState(null)
  const [pickedCard, setPickedCard] = useState(null)
  const [opponentPicked, setOpponentPicked] = useState(false)
  const [roundResult, setRoundResult] = useState(null)
  const [gameResult, setGameResult]   = useState(null)
  const [showVS, setShowVS]   = useState(false)
  const [clashPhase, setClashPhase] = useState('entering') // entering | clash | result
  const [opponentDeckReady, setOpponentDeckReady] = useState(false)
  const [opponentNameForDeck, setOpponentNameForDeck] = useState('')

  const wsRef = useRef(null)

  useEffect(() => {
    apiFetch('/api/decks', token).then(setDecks).catch(() => {})
    return () => wsRef.current?.close()
  }, [])

  function connectWs(id, mode = 'deck') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/battle/${id}?token=${encodeURIComponent(token)}&mode=${mode}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'draft_round_start':
          setDraftRound(msg.round); setDraftCards(msg.cards)
          if (msg.round === 1) { setDraftMyDeck([]); setDraftOppDeck([]) }
          setDraftClaimed({}); setDraftMyPick(null); setDraftResult(null)
          setDraftPhase('reveal'); setScreen('draft')
          preloadImages(msg.cards.map(c => c.image_url).filter(Boolean))
          setTimeout(() => setDraftPhase('pick'), 6500)
          break

        case 'draft_position_claimed':
          setDraftClaimed(prev => ({ ...prev, [msg.position]: msg.by }))
          if (msg.by === 'you') setDraftMyPick(msg.position)
          break

        case 'draft_round_result':
          setDraftResult(msg); setDraftMyDeck(msg.your_deck_so_far); setDraftPhase('result')
          break

        case 'draft_complete':
          setDraftComplete(msg); setDraftMyDeck(msg.your_cards); setDraftOppDeck(msg.opponent_cards)
          setScreen('draft_complete')
          break

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
          if (msg.round === 1) setRoundHistory([])
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
          setRoundResult(msg); setScore(msg.score)
          setRoundHistory(h => [...h, msg.round_winner])
          setClashPhase('entering')
          setTimeout(() => setClashPhase('clash'), 450)
          setTimeout(() => setClashPhase('result'), 800)
          setScreen('round_result')
          if(msg.round_winner==='you') sfx.roundWin(); else if(msg.round_winner==='opponent') sfx.roundLose()
          break

        case 'game_over':
          setGameResult(msg)
          setRematchRequested(false); setOpponentRequestedRematch(false)
          setScreen('game_over'); if(msg.winner==='you') sfx.matchWin(); else if(msg.winner==='opponent') sfx.matchLose(); break

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

  async function challengePlayer(toUserId, mode = 'deck') {
    setError(null)
    const id = generateId()
    await apiFetch('/api/challenges', token, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId, room_id: id, mode }) })
    setRoomId(id); connectWs(id, mode)
  }

  function draftPick(position) {
    if (draftClaimed[position] || draftMyPick !== null) return
    wsRef.current?.send(JSON.stringify({ type: 'draft_pick', position }))
  }

  useEffect(() => {
    if (screen !== 'draft') return
    clearInterval(draftTimerRef.current)
    const duration = draftPhase === 'reveal' ? 6 : 20
    setDraftTimer(duration)
    let t = duration
    draftTimerRef.current = setInterval(() => {
      t -= 1
      setDraftTimer(t)
      if (t <= 0) {
        clearInterval(draftTimerRef.current)
        if (draftPhase === 'pick') {
          const unclaimed = [0, 1, 2].filter(p => !draftClaimed[p])
          if (unclaimed.length > 0 && draftMyPick === null) {
            draftPick(unclaimed[Math.floor(Math.random() * unclaimed.length)])
          }
        }
      }
    }, 1000)
    return () => clearInterval(draftTimerRef.current)
  }, [draftPhase, screen])

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
    setScore({ you: 0, opponent: 0 }); setRound(null); setRoundHistory([])
    setRematchRequested(false); setOpponentRequestedRematch(false); setError(null)
    setDraftRound(0); setDraftCards([]); setDraftClaimed({}); setDraftMyPick(null)
    setDraftResult(null); setDraftMyDeck([]); setDraftOppDeck([]); setDraftComplete(null)
    clearInterval(draftTimerRef.current)
  }

  /* ── HOW TO PLAY MODAL ── */
  const howToPlayModal = showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} battleFocus />

  /* ── FANTASY DRAFT SCREENS ── */
  const RARITY_COL = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }

  if (screen === 'draft') {
    if (draftPhase === 'reveal' || draftPhase === 'pick') {
      const maxTime = draftPhase === 'reveal' ? 6 : 20
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '24px 16px' }}>
          <style>{`
            @keyframes draftPulse {
              0%,100% { box-shadow: 0 0 8px 2px rgba(168,85,247,0.4); }
              50%      { box-shadow: 0 0 20px 4px rgba(168,85,247,0.8); }
            }
          `}</style>

          {/* Forfeit button */}
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            {!surrenderConfirm ? (
              <button onClick={() => setSurrenderConfirm(true)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#ef4444', padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Forfeit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={surrender} style={{ background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
                <button onClick={() => setSurrenderConfirm(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#aaa', padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>

          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>Fantasy Draft</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif", marginTop: 4 }}>
              Round {draftRound} / 5
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
              {draftPhase === 'reveal'
                ? `Memorise these cards! · ${draftTimer}s`
                : draftMyPick !== null ? 'Waiting for opponent…' : `Pick one · ${draftTimer}s`}
            </div>
          </div>

          {/* Timer bar */}
          <div style={{ width: '100%', maxWidth: 420, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{ height: '100%', borderRadius: 2, transition: 'width 1s linear, background 0.3s',
              background: draftTimer > maxTime * 0.6 ? '#a855f7' : draftTimer > maxTime * 0.25 ? '#f0c040' : '#ef4444',
              width: `${(draftTimer / maxTime) * 100}%` }} />
          </div>

          {/* Cards */}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            {draftCards.map((card, i) => {
              const claimed = draftClaimed[i]
              const isMine = claimed === 'you'
              const isOpp  = claimed === 'opponent'
              return (
                <div key={i} onClick={() => draftPhase === 'pick' && !claimed && draftMyPick === null && draftPick(i)}
                  style={{ width: 150, cursor: draftPhase === 'pick' && !claimed && draftMyPick === null ? 'pointer' : 'default', opacity: isOpp ? 0.45 : 1, transition: 'opacity 0.3s, transform 0.15s', transform: !claimed && draftPhase === 'pick' && draftMyPick === null ? 'scale(1.02)' : 'scale(1)' }}>
                  {draftPhase === 'reveal' ? (
                    <>
                      <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(168,85,247,0.4)', boxShadow: '0 0 12px rgba(168,85,247,0.25)' }}>
                        {card.image_url
                          ? <img src={card.image_url} alt={card.name} style={{ width: '100%', display: 'block' }} />
                          : <div style={{ width: '100%', paddingBottom: '140%', background: '#1a2236', position: 'relative' }}>
                              <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 32 }}>⚽</span>
                            </div>
                        }
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{card.name}</div>
                        <div style={{ fontSize: 11, color: RARITY_COL[card.card_rarity] || '#fff' }}>{card.overall} OVR</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(135deg,#1e3a5f,#0f1f3d)', aspectRatio: '300/420', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${isMine ? '#22c55e' : isOpp ? '#ef4444' : 'rgba(168,85,247,0.5)'}`,
                        boxShadow: isMine ? '0 0 20px rgba(34,197,94,0.5)' : isOpp ? '0 0 16px rgba(239,68,68,0.35)' : 'none',
                        animation: !claimed && draftMyPick === null ? 'draftPulse 1.6s ease infinite' : 'none',
                      }}>
                        {isMine ? <span style={{ fontSize: 40 }}>✓</span> : isOpp ? <span style={{ fontSize: 36 }}>✕</span> : <span style={{ fontSize: 44 }}>⚽</span>}
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 12, fontWeight: 700, color: isMine ? '#22c55e' : isOpp ? '#ef4444' : 'rgba(255,255,255,0.45)' }}>
                        {isMine ? '✓ Yours' : isOpp ? 'Taken' : `Card ${i + 1}`}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Accumulated deck */}
          {draftMyDeck.length > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#475569', letterSpacing: 2, marginBottom: 6 }}>YOUR PICKS SO FAR</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                {draftMyDeck.map((c, i) => (
                  <div key={i} style={{ width: 44, borderRadius: 6, overflow: 'hidden' }}>
                    {c.image_url ? <img src={c.image_url} style={{ width: '100%', display: 'block' }} /> : <div style={{ width: '100%', paddingBottom: '140%', background: '#1a2236' }} />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (draftPhase === 'result' && draftResult) {
      const card = draftResult.your_card
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '24px 16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>Round {draftResult.round} — You got</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 160, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '2px solid #22c55e', boxShadow: '0 0 30px rgba(34,197,94,0.4)' }}>
              {card.image_url ? <img src={card.image_url} style={{ width: '100%', display: 'block' }} /> : <div style={{ width: '100%', paddingBottom: '140%', background: '#1a2236' }} />}
            </div>
            <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: '#fff' }}>{card.name}</div>
            <div style={{ fontSize: 13, color: RARITY_COL[card.card_rarity] || '#fff', marginTop: 2 }}>{card.card_rarity} · {card.overall} OVR</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
              {[['ATK', card.attack, '#ef4444'], ['DEF', card.defense, '#3b82f6'], ['SPD', card.speed, '#22c55e']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            {draftResult.round < 5 ? `Round ${draftResult.round + 1} coming…` : 'Draft complete!'}
          </div>
        </div>
      )
    }
  }

  if (screen === 'draft_complete' && draftComplete) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '24px 16px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' }}>Draft Complete</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif", marginTop: 4 }}>Your Squad! 🏟️</div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 420 }}>
          {draftComplete.your_cards.map((card, i) => (
            <div key={i} className="anim-fadeUp" style={{ animationDelay: `${i * 0.1}s`, width: 100 }}>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${RARITY_COL[card.card_rarity] || '#fff'}44`, boxShadow: `0 0 12px ${RARITY_COL[card.card_rarity] || '#f0c040'}44` }}>
                {card.image_url ? <img src={card.image_url} style={{ width: '100%', display: 'block' }} /> : <div style={{ width: '100%', paddingBottom: '140%', background: '#1a2236' }} />}
              </div>
              <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: '#fff', fontWeight: 700 }}>{card.overall}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Battle starting…</div>
      </div>
    )
  }

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
            {decks.map(d => (
              <option key={d.deck_name} value={d.deck_name} disabled={!d.complete}>
                {d.deck_name}{!d.complete ? ' (incomplete)' : ''}
              </option>
            ))}
          </select>
          {decks.some(d => !d.complete) && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>
              ⚠ Incomplete decks contain cards you no longer own and cannot be used.
            </div>
          )}
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
              <button onClick={() => { challengePlayer(autoChallenge.user_id, autoChallenge.mode || 'deck'); setAutoChallenge?.(null) }} style={{ ...L.challengeBtn, padding: '8px 16px', fontSize: 13 }}>
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
                  <div key={p.user_id}>
                    <div className="challenge-row" style={{ ...L.opponentRow, animationDelay: `${i * 0.08}s` }}>
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
                      <button className="challenge-btn" onClick={() => setLobbyPickingMode(lobbyPickingMode?.user_id === p.user_id ? null : p)} style={{ ...L.challengeBtn, background: lobbyPickingMode?.user_id === p.user_id ? 'rgba(240,192,64,0.25)' : 'rgba(240,192,64,0.1)' }}>
                        ⚔ CHALLENGE
                      </button>
                    </div>
                    {lobbyPickingMode?.user_id === p.user_id && (
                      <div className="anim-fadeUp" style={{ margin: '0 0 8px 60px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Choose mode:</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { challengePlayer(p.user_id, 'draft'); setLobbyPickingMode(null) }} style={{ flex: 1, background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, color: '#c4b5fd', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            🎲 Fantasy Draft
                          </button>
                          <button onClick={() => { challengePlayer(p.user_id, 'deck'); setLobbyPickingMode(null) }} style={{ flex: 1, background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.25)', borderRadius: 8, color: '#ffca45', padding: '8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            🃏 Use My Deck
                          </button>
                        </div>
                      </div>
                    )}
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
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} roundHistory={roundHistory} />
      <div style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16, textAlign: 'center', fontWeight: 600 }}>
        Choose the battle stat for Round {round}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['attack','defense','speed'].map(stat => {
          const best = hand.length ? Math.max(...hand.map(c => c[stat] || 0)) : 0
          return (
            <button key={stat} onClick={() => chooseStat(stat)} style={{
              flex: 1, background: 'rgba(255,255,255,0.03)',
              border: `2px solid ${STAT_COLOR[stat]}33`,
              borderRadius: 16, padding: '14px 6px', cursor: 'pointer', textAlign: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${STAT_COLOR[stat]}14`; e.currentTarget.style.borderColor = STAT_COLOR[stat]; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = `${STAT_COLOR[stat]}33`; e.currentTarget.style.transform = '' }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{STAT_ICON[stat]}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: STAT_COLOR[stat], fontFamily: "'Montserrat',sans-serif" }}>{STAT_LABEL[stat]}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 10 }}>beats {COUNTER_OF[stat]}</div>
              <div style={{
                background: `${STAT_COLOR[stat]}14`, border: `1px solid ${STAT_COLOR[stat]}33`,
                borderRadius: 8, padding: '6px 4px',
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: STAT_COLOR[stat], lineHeight: 1 }}>{best}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, letterSpacing: 1 }}>YOUR BEST</div>
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: '#334155', letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>YOUR HAND</div>
      <HandGrid hand={hand} stat={null} disabled />
    </div>
  )

  /* ── WAITING FOR STAT (guest) ── */
  if (screen === 'waiting_for_stat') return (
    <div className="page">
      {howToPlayModal}
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} roundHistory={roundHistory} />
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
      <BattleBar round={round} score={score} opponent={opponentName} onSurrender={{ start: surrender, confirm: surrender, cancel: () => setSurrenderConfirm(false), confirming: surrenderConfirm }} onHowToPlay={() => setShowHowToPlay(true)} roundHistory={roundHistory} />

      {/* Active stat display */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', gap: 10, background: 'var(--surface)', borderRadius: 40, padding: '8px 16px', border: '1px solid var(--border)' }}>
          <span style={{ color: STAT_COLOR[myStat], fontWeight: 700, fontSize: 14 }}>{STAT_ICON[myStat]} Your {STAT_LABEL[myStat]}</span>
          <span style={{ color: 'var(--muted)' }}>vs</span>
          <span style={{ color: STAT_COLOR[oppStat], fontWeight: 700, fontSize: 14 }}>{STAT_ICON[oppStat]} Their {STAT_LABEL[oppStat]}</span>
        </div>
      </div>

      {/* Opponent face-down hand */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: '#334155', letterSpacing: 2, marginBottom: 8, textAlign: 'center', fontWeight: 700 }}>
          {opponentName.toUpperCase()}'S HAND
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {Array.from({ length: opponentCardCount }, (_, i) => {
            const isChosen = opponentPicked && i === 0
            return (
              <div key={i} style={{
                width: 58, aspectRatio: '3/4', borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(145deg, #0d1a2e 0%, #162035 50%, #0d1a2e 100%)',
                border: `1.5px solid ${isChosen ? 'rgba(168,85,247,0.7)' : 'rgba(255,255,255,0.07)'}`,
                boxShadow: isChosen ? '0 0 14px rgba(168,85,247,0.45)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.35s',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.015) 6px, rgba(255,255,255,0.015) 7px)',
                }} />
                <span style={{ fontSize: 18, opacity: isChosen ? 0.8 : 0.25, transition: 'opacity 0.3s' }}>⚽</span>
              </div>
            )
          })}
        </div>
        {opponentPicked && (
          <div style={{ textAlign: 'center', marginTop: 7, fontSize: 12, color: '#a855f7', fontWeight: 700 }}>
            ✓ {opponentName} has played a card!
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)', marginBottom: 14 }} />

      {!pickedCard && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, textAlign: 'center' }}>Tap a card to play it</div>
      )}
      {pickedCard && (
        <div style={{ background: 'rgba(88,101,242,0.1)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: 'var(--accent)', textAlign: 'center' }}>
          ✓ Card played — Waiting for {opponentName}…
        </div>
      )}

      <HandGrid hand={hand} stat={myStat} pickedId={pickedCard?.card_id} onPick={pickCard} />
    </div>
  )

  /* ── ROUND RESULT (cinematic clash) ── */
  if (screen === 'round_result' && roundResult) {
    const won  = roundResult.round_winner === 'you'
    const lost = roundResult.round_winner === 'opponent'
    const yourVal = roundResult.your_card[roundResult.your_stat]
    const oppVal  = roundResult.opponent_card[roundResult.opponent_stat]
    const maxVal  = Math.max(yourVal, oppVal, 1)
    const resultColor = won ? '#22c55e' : lost ? '#ef4444' : '#f0c040'
    return (
      <div className="page" style={{ overflow: 'hidden', position: 'relative' }}>
        <style>{`
          @keyframes clashFromLeft  { 0%{transform:translateX(-110%) scale(0.82);opacity:0} 65%{transform:translateX(6%) scale(1.05);opacity:1} 100%{transform:none;opacity:1} }
          @keyframes clashFromRight { 0%{transform:translateX(110%) scale(0.82);opacity:0} 65%{transform:translateX(-6%) scale(1.05);opacity:1} 100%{transform:none;opacity:1} }
          @keyframes impactBurst { 0%{opacity:0;transform:scale(0.3)} 45%{opacity:1;transform:scale(1.5)} 100%{opacity:0;transform:scale(2.5)} }
          @keyframes statReveal { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
          @keyframes resultIn { 0%{opacity:0;transform:scale(1.4)} 100%{opacity:1;transform:none} }
          @keyframes barFill { from{width:0} }
        `}</style>

        {/* Impact flash */}
        {clashPhase === 'clash' && (
          <div style={{ position:'absolute',inset:0,zIndex:10,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center' }}>
            <div style={{
              width:140,height:140,borderRadius:'50%',
              background:`radial-gradient(circle, ${resultColor}99 0%, transparent 70%)`,
              animation:'impactBurst 0.38s ease-out forwards',
            }} />
          </div>
        )}

        <BattleBar round={`${roundResult.round} Result`} score={roundResult.score} opponent={opponentName} roundHistory={roundHistory} />

        {/* Result label */}
        {clashPhase === 'result' && (
          <div style={{ textAlign:'center', marginBottom:12, animation:'resultIn 0.3s ease-out' }}>
            <span style={{ fontSize:14, fontWeight:900, color:resultColor, letterSpacing:3, textTransform:'uppercase', fontFamily:"'Montserrat',sans-serif" }}>
              {won ? '🏆 YOU WIN' : lost ? '💀 DEFEAT' : '🤝 DRAW'}
            </span>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'flex-start', gap:12, justifyContent:'center', marginBottom:16 }}>
          {/* Your card */}
          <div style={{ width:148, flexShrink:0, animation:'clashFromLeft 0.5s cubic-bezier(0.2,0.8,0.4,1) both' }}>
            <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', marginBottom:6 }}>You</div>
            <FutCard card={roundResult.your_card} highlight={clashPhase==='result' ? (won?'win':lost?'lose':undefined) : undefined} />
            {clashPhase === 'result' && (
              <div style={{ textAlign:'center', marginTop:8, animation:'statReveal 0.3s ease 0.1s both' }}>
                <div style={{ fontSize:22, fontWeight:900, color:STAT_COLOR[roundResult.your_stat] }}>{yourVal}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{STAT_ICON[roundResult.your_stat]} {STAT_LABEL[roundResult.your_stat]}</div>
                <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, marginTop:7, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:won?'#22c55e':lost?'#ef4444':'#f0c040', width:`${(yourVal/maxVal)*100}%`, animation:'barFill 0.5s ease 0.25s both' }} />
                </div>
              </div>
            )}
          </div>

          {/* VS */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', paddingTop:55, flexShrink:0, minWidth:36 }}>
            <div style={{ fontSize:12, fontWeight:800, color:clashPhase==='result'?resultColor:'var(--muted)', transition:'color 0.4s', fontFamily:"'Montserrat',sans-serif" }}>VS</div>
          </div>

          {/* Opponent card */}
          <div style={{ width:148, flexShrink:0, animation:'clashFromRight 0.5s cubic-bezier(0.2,0.8,0.4,1) both' }}>
            <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', marginBottom:6 }}>{opponentName}</div>
            <FutCard card={roundResult.opponent_card} highlight={clashPhase==='result' ? (lost?'win':won?'lose':undefined) : undefined} />
            {clashPhase === 'result' && (
              <div style={{ textAlign:'center', marginTop:8, animation:'statReveal 0.3s ease 0.1s both' }}>
                <div style={{ fontSize:22, fontWeight:900, color:STAT_COLOR[roundResult.opponent_stat] }}>{oppVal}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{STAT_ICON[roundResult.opponent_stat]} {STAT_LABEL[roundResult.opponent_stat]}</div>
                <div style={{ height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, marginTop:7, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:lost?'#22c55e':won?'#ef4444':'#f0c040', width:`${(oppVal/maxVal)*100}%`, animation:'barFill 0.5s ease 0.25s both' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {clashPhase === 'result' && (
          <div style={{ textAlign:'center', color:'var(--muted)', fontSize:12, animation:'statReveal 0.3s ease 0.4s both' }}>Next round starting…</div>
        )}
      </div>
    )
  }

  /* ── GAME OVER ── */
  if (screen === 'game_over' && gameResult) {
    const isWin  = gameResult.winner === 'you'
    const isLoss = gameResult.winner === 'opponent'
    const resultColor = isWin ? '#ffca45' : isLoss ? '#ef4444' : '#94a3b8'
    const bgAccent = isWin ? 'rgba(255,202,69,0.06)' : isLoss ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)'
    return (
      <div style={{
        position:'fixed', inset:0,
        background: `linear-gradient(160deg, #050914 0%, ${isWin?'#0d1a07':isLoss?'#170a0a':'#0d0d0d'} 55%, #050914 100%)`,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        gap:22, padding:'24px 24px 48px',
      }}>
        {isWin && <Firecrackers />}
        <style>{`
          @keyframes glowText { 0%,100%{text-shadow:0 0 30px currentColor} 50%{text-shadow:0 0 80px currentColor,0 0 120px currentColor} }
          @keyframes rematchPulse { 0%,100%{box-shadow:0 4px 20px rgba(255,202,69,0.3)} 50%{box-shadow:0 4px 50px rgba(255,202,69,0.7),0 0 100px rgba(255,202,69,0.2)} }
          @keyframes popIn { 0%{opacity:0;transform:scale(0.5)} 70%{transform:scale(1.08)} 100%{opacity:1;transform:none} }
        `}</style>

        {/* Result */}
        <div className="anim-fadeUp" style={{ textAlign:'center' }}>
          <div style={{ fontSize:68, marginBottom:8, filter:`drop-shadow(0 0 24px ${resultColor}88)`, animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            {isWin ? '🏆' : isLoss ? '💀' : '🤝'}
          </div>
          <div style={{
            fontSize:38, fontWeight:900, letterSpacing:'0.08em', fontFamily:"'Montserrat',sans-serif",
            color:resultColor, animation:'glowText 2s ease infinite',
          }}>
            {isWin ? 'VICTORY' : isLoss ? 'DEFEATED' : 'DRAW'}
          </div>
          <div style={{ fontSize:13, color:'var(--muted)', marginTop:5 }}>vs {opponentName}</div>
        </div>

        {/* Score */}
        <div className="anim-fadeUp" style={{
          display:'flex', alignItems:'center', gap:32,
          background:bgAccent, border:`1px solid ${resultColor}22`,
          borderRadius:20, padding:'20px 40px', animationDelay:'0.15s',
        }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:56, fontWeight:900, lineHeight:1, color:isWin?'#22c55e':'#fff', animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both' }}>
              {gameResult.final_score.you}
            </div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>You</div>
          </div>
          <div style={{ fontSize:22, color:'rgba(255,255,255,0.12)', fontWeight:300 }}>—</div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:56, fontWeight:900, lineHeight:1, color:isLoss?'#22c55e':'#fff', animation:'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both' }}>
              {gameResult.final_score.opponent}
            </div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{opponentName}</div>
          </div>
        </div>

        {/* Rematch */}
        <div className="anim-fadeUp" style={{ width:'100%', maxWidth:300, display:'flex', flexDirection:'column', gap:10, animationDelay:'0.25s' }}>
          {opponentRequestedRematch && !rematchRequested && (
            <div style={{ textAlign:'center', fontSize:13, color:'#4ade80', fontWeight:700, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:10, padding:'8px' }}>
              ⚡ {opponentName} wants a rematch!
            </div>
          )}
          {rematchRequested && !opponentRequestedRematch && (
            <div style={{ textAlign:'center', fontSize:13, color:'var(--muted)' }}>Waiting for {opponentName}…</div>
          )}
          {!rematchRequested && (
            <button onClick={requestRematch} style={{
              width:'100%', padding:'15px 0',
              background:'linear-gradient(135deg, #d97706, #ffca45)',
              border:'none', borderRadius:14, color:'#0a0500',
              fontFamily:"'Montserrat',sans-serif", fontWeight:900, fontSize:16,
              cursor:'pointer', letterSpacing:'0.1em', textTransform:'uppercase',
              animation:'rematchPulse 1.6s ease infinite',
            }}
            onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
            onMouseLeave={e => e.currentTarget.style.transform=''}
            >
              ⚡ {opponentRequestedRematch ? 'ACCEPT REMATCH' : 'REMATCH'}
            </button>
          )}
          <button onClick={resetToLobby} style={{
            width:'100%', padding:'11px 0', background:'transparent',
            border:'1px solid rgba(255,255,255,0.1)', borderRadius:12,
            color:'rgba(255,255,255,0.35)', fontFamily:"'Montserrat',sans-serif",
            fontWeight:700, fontSize:13, cursor:'pointer', letterSpacing:'0.05em',
          }}>
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

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

function Firecrackers() {
  const [cycle, setCycle] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setCycle(c => c + 1), 8500)
    return () => clearInterval(t)
  }, [])
  return <FirecrackerSet key={cycle} />
}

function FirecrackerSet() {
  const COLORS = ['#ffca45', '#a855f7', '#22c55e', '#ef4444', '#60a5fa', '#f97316', '#fff', '#fb923c']
  const TRAVEL = 0.55

  const SHOTS = [
    { x: 22, toY: 22, delay: 0.1,  color: '#ffca45' },
    { x: 76, toY: 18, delay: 0.9,  color: '#a855f7' },
    { x: 46, toY: 14, delay: 1.7,  color: '#22c55e' },
    { x: 12, toY: 42, delay: 2.5,  color: '#ef4444' },
    { x: 88, toY: 35, delay: 3.3,  color: '#60a5fa' },
    { x: 57, toY: 20, delay: 4.1,  color: '#f97316' },
    { x: 32, toY: 30, delay: 4.9,  color: '#ffca45' },
    { x: 70, toY: 17, delay: 5.7,  color: '#a855f7' },
  ]

  const particles = []
  SHOTS.forEach((shot, si) => {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * 360
      const dist = 36 + (i % 4) * 14
      const rad = angle * Math.PI / 180
      particles.push({
        id: `${si}-${i}`,
        x: shot.x, y: shot.toY,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        color: COLORS[(si * 3 + i) % COLORS.length],
        delay: shot.delay + TRAVEL,
        size: 5 + (i % 3) * 2,
        isRect: i % 3 === 1,
      })
    }
  })

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'hidden' }}>
      <style>{`
        @keyframes rocketUp {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
          85%  { opacity: 1; }
          100% { opacity: 0; transform: translateX(-50%) translateY(var(--travel)); }
        }
        @keyframes crackerBurst {
          0%   { transform: translate(-50%,-50%) scale(1.4); opacity: 1; }
          70%  { opacity: 1; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0); opacity: 0; }
        }
      `}</style>

      {/* Rockets launch from bottom */}
      {SHOTS.map((shot, si) => (
        <div key={`r-${si}`} style={{
          position: 'absolute',
          left: `${shot.x}%`, top: '95%',
          width: 3, height: 14,
          borderRadius: 2,
          background: `linear-gradient(to bottom, transparent, ${shot.color})`,
          boxShadow: `0 0 8px ${shot.color}, 0 -6px 14px ${shot.color}88`,
          '--travel': `${shot.toY - 95}vh`,
          animation: `rocketUp ${TRAVEL}s ease-in ${shot.delay}s both`,
        }} />
      ))}

      {/* Burst particles at peak */}
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.isRect ? p.size * 0.45 : p.size,
          height: p.size,
          borderRadius: p.isRect ? 2 : '50%',
          background: p.color,
          boxShadow: `0 0 ${p.size + 3}px ${p.color}cc`,
          opacity: 0,
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          animation: `crackerBurst 1.0s cubic-bezier(0.1,0.8,0.3,1) ${p.delay}s forwards`,
        }} />
      ))}
    </div>
  )
}

function BattleBar({ round, score, opponent, onSurrender, onHowToPlay, roundHistory = [] }) {
  const MONT = "'Montserrat',sans-serif"

  // Build sequential dot lists — fills left to right in order of wins/draws
  const yourDots = []
  const theirDots = []
  roundHistory.forEach(r => {
    if (r === 'you')           yourDots.push('green')
    else if (r === 'draw')   { yourDots.push('yellow'); theirDots.push('yellow') }
    else if (r === 'opponent') theirDots.push('green')
  })

  function dotStyle(color) {
    if (color === 'green')  return { bg: '#22c55e', shadow: '0 0 7px rgba(34,197,94,0.8)',  border: 'none' }
    if (color === 'yellow') return { bg: '#eab308', shadow: '0 0 7px rgba(234,179,8,0.9)',  border: 'none' }
    return { bg: 'rgba(255,255,255,0.1)', shadow: 'none', border: '1px solid rgba(255,255,255,0.2)' }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', marginBottom:14, gap:6 }}>
      <span style={{ fontSize:11, color:'var(--muted)', fontFamily:MONT, fontWeight:700, letterSpacing:'0.04em', flexShrink:0 }}>
        R{typeof round === 'number' ? round : round}/5
      </span>
      {onHowToPlay && <button onClick={onHowToPlay} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'50%', width:20, height:20, color:'rgba(255,255,255,0.5)', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0, padding:0 }}>?</button>}

      {/* 3v3 dots */}
      <div style={{ display:'flex', alignItems:'center', flex:1, justifyContent:'center', gap:10 }}>
        {/* Your dots — fill left to right */}
        <div style={{ display:'flex', gap:5 }}>
          {Array.from({ length: 3 }, (_, i) => {
            const { bg, shadow, border } = dotStyle(yourDots[i])
            return <div key={i} style={{ width:10, height:10, borderRadius:'50%', transition:'all 0.3s', background:bg, border, boxShadow:shadow }} />
          })}
        </div>
        {/* Score */}
        <div style={{ fontSize:17, fontWeight:900, color:'#fff', letterSpacing:2, fontFamily:MONT, minWidth:48, textAlign:'center' }}>
          {score.you}<span style={{ color:'var(--muted)', fontWeight:300, fontSize:12 }}>—</span>{score.opponent}
        </div>
        {/* Opp dots — fill left to right */}
        <div style={{ display:'flex', gap:5 }}>
          {Array.from({ length: 3 }, (_, i) => {
            const { bg, shadow, border } = dotStyle(theirDots[i])
            return <div key={i} style={{ width:10, height:10, borderRadius:'50%', transition:'all 0.3s', background:bg, border, boxShadow:shadow }} />
          })}
        </div>
      </div>

      <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0, maxWidth:72, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>vs {opponent}</span>

      {onSurrender && (
        onSurrender.confirming
          ? <div style={{ display:'flex', gap:4, marginLeft:4 }}>
              <span style={{ fontSize:11, color:'#ef4444', alignSelf:'center' }}>Sure?</span>
              <button onClick={onSurrender.confirm} style={{ background:'#ef4444', border:'none', borderRadius:6, color:'#fff', fontSize:11, padding:'3px 8px', cursor:'pointer', fontWeight:700 }}>Yes</button>
              <button onClick={onSurrender.cancel} style={{ background:'transparent', border:'1px solid #444', borderRadius:6, color:'#aaa', fontSize:11, padding:'3px 6px', cursor:'pointer' }}>No</button>
            </div>
          : <button onClick={onSurrender.start} style={{ marginLeft:4, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:6, color:'#ef4444', fontSize:11, padding:'3px 8px', cursor:'pointer', fontWeight:600 }}>
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
        <div key={i} style={{ width: 130, opacity: disabled ? 0.5 : 1, flexShrink: 0 }}>
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
