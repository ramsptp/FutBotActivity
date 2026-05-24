import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'

const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }
function tradeWsUrl(roomId, token, userId, username) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/trade/${roomId}?user_id=${userId ?? ''}&username=${encodeURIComponent(username ?? '')}&token=${encodeURIComponent(token)}`
}

// ── OFFER COLUMN ──────────────────────────────────────────────────────────────

function OfferColumn({ label, offer, isMine, locked, confirmed, onRemove, onAddCard, onSetCoins, onLock, onConfirm, bothLocked, disabled }) {
  const [editingCoins, setEditingCoins] = useState(false)
  const [coinInput, setCoinInput]       = useState('')

  function submitCoins() {
    setEditingCoins(false)
    const n = parseInt(coinInput)
    if (!isNaN(n) && n >= 0) onSetCoins(n)
    setCoinInput('')
  }

  const lockColor = locked ? '#22c55e' : 'rgba(255,255,255,0.25)'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isMine ? '#a855f7' : 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {locked && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>🔒 Locked</span>}
          {confirmed && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>✓ Confirmed</span>}
        </div>
      </div>

      {/* Cards */}
      <div style={{ background: '#0d1524', border: `1px solid ${locked ? '#22c55e44' : 'rgba(255,255,255,0.07)'}`, borderRadius: 12, padding: 10, minHeight: 120, flex: 1, transition: 'border-color 0.2s' }}>
        {offer.cards.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.18)', fontSize: 12, paddingTop: 20 }}>No cards</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {offer.cards.map(card => (
              <div key={`${card.card_id}-${card.edition}`} style={{ position: 'relative' }}>
                <FutCard card={card} />
                {isMine && !locked && !disabled && (
                  <button
                    onClick={() => onRemove(card.card_id, card.edition)}
                    style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.85)', border: 'none', borderRadius: '50%', width: 18, height: 18, color: '#fff', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
                    ✕
                  </button>
                )}
                <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {card.overall} OVR
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coins */}
      <div style={{ background: '#0d1524', border: `1px solid ${offer.coins > 0 ? 'rgba(240,192,64,0.3)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14 }}>🪙</span>
        {isMine && editingCoins ? (
          <input
            autoFocus
            type="number" value={coinInput}
            onChange={e => setCoinInput(e.target.value)}
            onBlur={submitCoins}
            onKeyDown={e => e.key === 'Enter' && submitCoins()}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#f0c040', fontSize: 14, fontWeight: 800, width: '100%' }}
            placeholder="0"
          />
        ) : (
          <span
            onClick={() => isMine && !locked && !disabled && (setEditingCoins(true), setCoinInput(offer.coins > 0 ? String(offer.coins) : ''))}
            style={{ flex: 1, fontSize: 14, fontWeight: 800, color: offer.coins > 0 ? '#f0c040' : 'rgba(255,255,255,0.2)', cursor: isMine && !locked ? 'text' : 'default' }}>
            {offer.coins > 0 ? offer.coins.toLocaleString() : (isMine && !locked ? 'Tap to add coins' : '0')}
          </span>
        )}
        {isMine && offer.coins > 0 && !locked && !disabled && (
          <button onClick={() => onSetCoins(0)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 13, padding: 0 }}>✕</button>
        )}
      </div>

      {/* My actions */}
      {isMine && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!locked && !disabled && (
            <button onClick={onAddCard} style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 10, color: '#a855f7', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Add Card
            </button>
          )}
          {!disabled && (
            <button onClick={onLock} style={{ background: locked ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${locked ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 10, color: locked ? '#ef4444' : '#22c55e', padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {locked ? '🔓 Unlock' : '🔒 Lock Offer'}
            </button>
          )}
          {bothLocked && !confirmed && (
            <button onClick={onConfirm} style={{ background: 'linear-gradient(135deg,#16a34a,#22c55e)', border: 'none', borderRadius: 10, color: '#fff', padding: '9px', fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.35)' }}>
              ✓ Confirm Trade
            </button>
          )}
          {bothLocked && confirmed && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#22c55e', fontWeight: 700, padding: '8px 0' }}>Waiting for partner…</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CARD PICKER MODAL ─────────────────────────────────────────────────────────

function CardPicker({ token, onPick, onClose }) {
  const [collection, setCollection] = useState(null)
  const [search, setSearch]         = useState('')
  const [deckCardIds, setDeckCardIds] = useState(new Set())

  useEffect(() => {
    apiFetch('/api/collection', token).then(setCollection)
    apiFetch('/api/decks', token).then(decks => {
      const ids = new Set()
      decks.forEach(deck => deck.cards.forEach(card => {
        ids.add(card.edition != null ? `${card.card_id}:${card.edition}` : `${card.card_id}:*`)
      }))
      setDeckCardIds(ids)
    }).catch(() => {})
  }, [])

  const filtered = collection
    ? (search.trim()
        ? collection.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase()))
        : collection)
    : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050914', zIndex: 300, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '6px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>← Back</button>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none' }}>🔍</span>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            style={{ width: '100%', background: '#0d1524', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', padding: '9px 12px 9px 32px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
          {filtered ? `${filtered.length} cards` : ''}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 20px' }}>
        {!filtered ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: 60 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingTop: 60 }}>No cards found</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
            {filtered.map((card, i) => (
              <div key={`${card.card_id}-${card.edition ?? i}`} onClick={() => { onPick(card); onClose() }} style={{ cursor: 'pointer' }}>
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
                  <FutCard card={card} />
                  {card.edition != null && (
                    <div style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.78)', borderRadius: 4, padding: '2px 5px', fontSize: 8, color: '#fff', fontWeight: 700 }}>
                      #{card.edition + 1}
                    </div>
                  )}
                  {(deckCardIds.has(card.edition != null ? `${card.card_id}:${card.edition}` : `${card.card_id}:*`) || deckCardIds.has(`${card.card_id}:*`)) && (
                    <div style={{ position: 'absolute', top: 3, left: 3, zIndex: 2, background: 'rgba(168,85,247,0.9)', borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>
                      DECK
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{card.overall} OVR</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN SCREEN ───────────────────────────────────────────────────────────────

export default function TradeScreen({ token, roomId, myUserId, myUsername, onClose }) {
  const [tradeState, setTradeState] = useState(null)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [joinedToast, setJoinedToast] = useState(null)
  const wsRef = useRef(null)
  const prevStatusRef = useRef(null)

  useEffect(() => {
    const wsUrl = tradeWsUrl(roomId, token, myUserId, myUsername)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen  = () => setError(null)
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'state') {
        setTradeState(prev => {
          if (prevStatusRef.current === 'waiting' && msg.status === 'negotiating') {
            const partnerName = msg.my_side === 'p1' ? msg.p2?.name : msg.p1?.name
            setJoinedToast(partnerName || 'Your partner')
            setTimeout(() => setJoinedToast(null), 3000)
          }
          prevStatusRef.current = msg.status
          return msg
        })
        setError(null)
      }
      if (msg.type === 'complete')  setResult(msg)
      if (msg.type === 'cancelled') {
        setError(msg.by ? `${msg.by} cancelled the trade` : 'Trade cancelled')
        setTimeout(() => onClose(), 2500)
      }
      if (msg.type === 'timeout')   setError('Trade session timed out')
      if (msg.type === 'error')     setError(msg.message)
    }
    ws.onerror = () => { if (wsRef.current === ws) setError('Connection lost') }

    return () => ws.close()
  }, [roomId])

  function send(msg) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  if (result) {
    const myReceived = myUserId === tradeState?.p1?.id ? result.p1_received : result.p2_received
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 200, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', letterSpacing: 3, textTransform: 'uppercase' }}>✅ Trade Complete!</div>
        <div style={{ background: '#0d1524', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 16, padding: '20px 24px', width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 12, textAlign: 'center' }}>You received</div>
          {myReceived.coins > 0 && (
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f0c040', textAlign: 'center', marginBottom: 8 }}>🪙 {myReceived.coins.toLocaleString()}</div>
          )}
          {myReceived.cards.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {myReceived.cards.map((name, i) => (
                <div key={i} style={{ fontSize: 14, fontWeight: 700, color: '#fff', textAlign: 'center' }}>🃏 {name}</div>
              ))}
            </div>
          )}
          {myReceived.coins === 0 && myReceived.cards.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Nothing (gifted your items)</div>
          )}
        </div>
        <button onClick={onClose} className="btn-primary" style={{ maxWidth: 280 }}>Back to Game</button>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 200, padding: 20 }}>
        <div style={{ fontSize: 32 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center' }}>{error}</div>
        <button onClick={onClose} className="btn-primary" style={{ maxWidth: 280 }}>Close</button>
      </div>
    )
  }

  if (!tradeState) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 200 }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Connecting to trade session…</div>
        {tradeState?.status === 'waiting' && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>Waiting for other player to join</div>
        )}
        <button onClick={() => { send({ type: 'cancel' }); onClose() }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '8px 20px', cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
          Cancel
        </button>
      </div>
    )
  }

  const mySide   = tradeState.my_side
  const them     = mySide === 'p1' ? tradeState.p2 : tradeState.p1
  const me       = mySide === 'p1' ? tradeState.p1 : tradeState.p2
  const bothLock = tradeState.p1.locked && tradeState.p2.locked
  const isWaiting = tradeState.status === 'waiting'

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050914', zIndex: 200, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`@keyframes tradeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }`}</style>

      {/* Partner joined toast */}
      {joinedToast && (
        <div className="anim-fadeUp" style={{
          position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(22,163,74,0.95))',
          color: '#fff', borderRadius: 10, padding: '10px 20px', zIndex: 10,
          fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
          fontFamily: "'Montserrat',sans-serif", letterSpacing: '0.05em',
        }}>
          ✓ {joinedToast} joined the trade
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif" }}>🤝 Trade</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
            {isWaiting ? 'Waiting for partner…' : `with ${them.name}`}
          </div>
        </div>
        <button onClick={() => { send({ type: 'cancel' }); onClose() }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Cancel
        </button>
      </div>

      {/* Offers */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 12px', display: 'flex', gap: 12 }}>
        <OfferColumn
          label={`${me.name} (You)`}
          offer={me.offer}
          isMine={true}
          locked={me.locked}
          confirmed={me.confirmed}
          bothLocked={bothLock}
          disabled={isWaiting}
          onRemove={(cid, ed) => send({ type: 'remove_card', card_id: cid, edition: ed })}
          onAddCard={() => setShowPicker(true)}
          onSetCoins={n => send({ type: 'set_coins', amount: n })}
          onLock={() => send({ type: 'lock' })}
          onConfirm={() => send({ type: 'confirm' })}
        />

        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        <OfferColumn
          label={them.name}
          offer={them.offer}
          isMine={false}
          locked={them.locked}
          confirmed={them.confirmed}
          bothLocked={bothLock}
          disabled={false}
        />
      </div>

      {/* Status bar */}
      {bothLock && (
        <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.08)', borderTop: '1px solid rgba(34,197,94,0.2)', textAlign: 'center', fontSize: 12, color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>
          Both locked! Confirm the trade to execute.
        </div>
      )}

      {showPicker && (
        <CardPicker token={token} onClose={() => setShowPicker(false)}
          onPick={card => send({ type: 'add_card', card_id: card.card_id, edition: card.edition ?? null })} />
      )}
    </div>
  )
}
