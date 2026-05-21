import { useEffect, useState } from 'react'
import { apiFetch, preloadImages } from '../lib/api'
import FutCard from '../components/FutCard'

const PACK_META = {
  rare_player_pack: { label: 'Rare Player Pack', img: '/rarepack.png', desc: '1 Rare or Special card (85+ OVR)' },
  icon_pack:        { label: 'Icon Pack',         img: '/iconpack.png', desc: '1 guaranteed Icon card' },
  hero_pack:        { label: 'Hero Pack',          img: '/heropack.png', desc: '1 guaranteed Hero card' },
  tester_pack:      { label: 'Tester Pack',        img: null,            desc: '1 Icon + 4 high-rated cards' },
}

function getCardColor(card) {
  const r = card?.card_rarity, t = card?.card_type
  if (r === 'Common')   return { flash: 'rgba(180,180,200,0.45)', glow: '0 0 24px rgba(180,180,200,0.5)' }
  if (r === 'Uncommon') return { flash: 'rgba(180,150,0,0.4)',    glow: '0 0 30px rgba(180,150,0,0.6)' }
  if (r === 'Rare') {
    if (t === 'Icon')              return { flash: 'rgba(255,255,255,0.6)',    glow: '0 0 50px rgba(255,255,255,0.9), 0 0 100px rgba(255,255,255,0.4)' }
    if (t === 'Hero')              return { flash: 'rgba(255,80,200,0.5)',     glow: '0 0 50px rgba(255,80,200,0.8), 0 0 100px rgba(255,80,200,0.35)' }
    if (t === 'Copa America TOTT') return { flash: 'rgba(0,120,255,0.45)',    glow: '0 0 50px rgba(0,120,255,0.8), 0 0 100px rgba(0,120,255,0.35)' }
    if (t === 'Euro TOTT')         return { flash: 'rgba(255,110,0,0.5)',     glow: '0 0 50px rgba(255,110,0,0.8), 0 0 100px rgba(255,110,0,0.35)' }
    return { flash: 'rgba(240,192,64,0.55)', glow: '0 0 50px rgba(240,192,64,0.9), 0 0 100px rgba(240,192,64,0.45)' }
  }
  return { flash: 'rgba(240,192,64,0.45)', glow: '0 0 30px rgba(240,192,64,0.5)' }
}

function calcValue(card) {
  const type = (card.card_type || '').toLowerCase()
  let value = type.includes('icon') ? 250 : type.includes('hero') ? 175 : 100
  if (card.overall >= 70) value += 50 + (card.overall - 70) * 5
  return value
}

export default function Packs({ token }) {
  const [packs, setPacks]         = useState(null)
  const [screen, setScreen]       = useState('list')
  const [openingPack, setOpeningPack] = useState(null)
  const [revealedCards, setRevealedCards] = useState([])
  const [revealIndex, setRevealIndex]     = useState(0)
  const [phase, setPhase]         = useState('shake') // shake | flash | reveal
  const [flipped, setFlipped]     = useState(false)
  const [shineActive, setShineActive] = useState(false)
  const [flippedCards, setFlippedCards] = useState([])
  const [lastFlipped, setLastFlipped]   = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => { fetchPacks() }, [])

  // Restart animation sequence whenever a new card is shown
  useEffect(() => {
    if (screen !== 'opening') return
    setPhase('shake')
    setFlipped(false)
    setShineActive(false)
    const t1 = setTimeout(() => setPhase('flash'), 900)     // shake ends → rarity flash
    const t2 = setTimeout(() => setPhase('reveal'), 1200)   // flash done → reveal card back
    const t3 = setTimeout(() => setFlipped(true), 2200)     // pause on back before flip
    const t4 = setTimeout(() => setShineActive(true), 2850)
    const t5 = setTimeout(() => setShineActive(false), 3550)
    return () => [t1,t2,t3,t4,t5].forEach(clearTimeout)
  }, [screen, revealIndex])

  async function fetchPacks() {
    const data = await apiFetch('/api/packs', token)
    setPacks(data)
  }

  async function openPack(packType) {
    setLoading(true); setError(null)
    try {
      const cards = await apiFetch(`/api/packs/open/${packType}`, token, { method: 'POST' })
      await preloadImages(cards.map(c => c.image_url))
      setRevealedCards(cards)
      setOpeningPack(packType)
      if (cards.length > 1) {
        setFlippedCards([])
        setLastFlipped(null)
        setScreen('fan')
      } else {
        setRevealIndex(0)
        setScreen('opening')
      }
      fetchPacks()
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  function flipCard(index) {
    setFlippedCards(prev => [...prev, index])
    setLastFlipped(index)
    setTimeout(() => setLastFlipped(p => p === index ? null : p), 750)
  }

  function nextCard() {
    if (revealIndex < revealedCards.length - 1) {
      setRevealIndex(i => i + 1) // useEffect handles the animation reset
    } else {
      setScreen('result')
    }
  }

  /* ── FAN REVEAL (multi-card packs) ── */
  if (screen === 'fan') {
    const total = revealedCards.length
    const flippedCount = flippedCards.length
    const allFlipped = flippedCount === total
    const packLabel = PACK_META[openingPack]?.label
    const ROTS = [-5, 4, -3, 5, -2, 4, -4, 2, -5, 3, 3, -2]

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden', padding: '20px 12px' }}>
        <style>{`
          @keyframes dealIn {
            from { transform: translateY(80px) scale(0.72); opacity: 0; }
            to   { transform: none; opacity: 1; }
          }
          @keyframes shineSweep {
            0%   { left: -60%; opacity: 0; }
            10%  { opacity: 0.7; }
            90%  { opacity: 0.7; }
            100% { left: 130%; opacity: 0; }
          }
        `}</style>

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textAlign: 'center' }}>
          {packLabel} &nbsp;·&nbsp; {allFlipped ? 'All revealed!' : `Tap a card to reveal · ${flippedCount} / ${total}`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 480 }}>
          {revealedCards.map((card, i) => {
            const isFlipped = flippedCards.includes(i)
            const isLast = lastFlipped === i
            const rot = ROTS[i % ROTS.length]
            const { glow } = getCardColor(card)
            const ds = glow.split(', ').map(s => {
              const m = s.match(/rgba?\([^)]+\)/)
              const parts = s.trim().split(/\s+/)
              return `drop-shadow(0 0 ${parts[2] || '20px'} ${m?.[0] || 'gold'})`
            }).join(' ')

            return (
              <div
                key={i}
                onClick={() => !isFlipped && flipCard(i)}
                style={{ animation: `dealIn 0.45s cubic-bezier(0.34,1.3,0.64,1) ${i * 0.09}s both`, cursor: isFlipped ? 'default' : 'pointer' }}
              >
                <div style={{ perspective: 700 }}>
                  <div style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
                    transform: isFlipped ? 'rotate(0deg) rotateY(0deg)' : `rotate(${rot}deg) rotateY(180deg)`,
                    position: 'relative', borderRadius: 10,
                  }}>
                    {/* Card front */}
                    <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 10, overflow: 'hidden', position: 'relative', filter: isFlipped ? ds : 'none', transition: 'filter 0.4s ease' }}>
                      <FutCard card={card} />
                      {isLast && (
                        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '45%', background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)', transform: 'skewX(-12deg)', animation: 'shineSweep 0.65s ease forwards', pointerEvents: 'none' }} />
                      )}
                    </div>
                    {/* Card back */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: 'linear-gradient(135deg,#1e3a5f,#0f1f3d)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 28 }}>⚽</span>
                    </div>
                  </div>
                </div>
                {isFlipped && (
                  <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }[card.card_rarity] || '#aaa', fontWeight: 600 }}>
                    {card.card_rarity}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {allFlipped && (
          <button className="btn-primary anim-fadeUp" onClick={() => setScreen('result')}>
            See All Cards
          </button>
        )}
      </div>
    )
  }

  /* ── PACK OPENING ANIMATION ── */
  if (screen === 'opening') {
    const card = revealedCards[revealIndex]
    const { glow, flash: flashColor } = getCardColor(card)
    const rgbBase = flashColor.match(/rgba?\((\d+,\s*\d+,\s*\d+)/)?.[1] || '88,101,242'
    // Convert box-shadow glow to drop-shadow filter (follows card shape, not rectangle)
    const dropShadow = glow.split(', ').map(s => {
      const m = s.match(/rgba?\([^)]+\)/)
      const parts = s.trim().split(/\s+/)
      const color = m?.[0] || 'gold'
      return `drop-shadow(0 0 ${parts[2] || '20px'} ${color})`
    }).join(' ')
    const packImg = PACK_META[openingPack]?.img
    const packLabel = PACK_META[openingPack]?.label

    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden' }}>
        <style>{`
          @keyframes packShake {
            0%  { transform: translateY(0) rotate(0deg) scale(1); }
            15% { transform: translateY(-6px) rotate(-2deg) scale(1.02); }
            30% { transform: translateY(0) rotate(2deg) scale(1); }
            45% { transform: translateY(-6px) rotate(-1.5deg) scale(1.03); }
            60% { transform: translateY(0) rotate(1.5deg) scale(1); }
            75% { transform: translateY(-10px) rotate(0deg) scale(1.05); }
            90% { transform: translateY(-30px) scale(1.08); opacity: 0.6; }
            100%{ transform: translateY(-80px) scale(0.7); opacity: 0; }
          }
          @keyframes flashBurst {
            0%   { opacity: 0; }
            25%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes shineSweep {
            0%   { left: -60%; opacity: 0; }
            10%  { opacity: 0.7; }
            90%  { opacity: 0.7; }
            100% { left: 130%; opacity: 0; }
          }
          @keyframes cardEntrance {
            from { transform: translateY(40px) scale(0.9); opacity: 0; }
            to   { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes backPulse {
            0%,100% { box-shadow: 0 0 20px rgba(${rgbBase},0.4); }
            50%      { box-shadow: 0 0 50px rgba(${rgbBase},0.9), 0 0 80px rgba(${rgbBase},0.3); }
          }
        `}</style>

        {/* Rarity flash overlay */}
        {phase === 'flash' && (
          <div style={{ position: 'fixed', inset: 0, background: flashColor, animation: 'flashBurst 0.3s ease forwards', pointerEvents: 'none', zIndex: 10 }} />
        )}

        {/* Counter */}
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, position: 'absolute', top: 24 }}>
          {packLabel} &nbsp;·&nbsp; {revealIndex + 1} / {revealedCards.length}
        </div>

        {/* SHAKE PHASE — pack image */}
        {phase === 'shake' && (
          <div style={{ width: 200, animation: 'packShake 0.9s ease forwards' }}>
            {packImg
              ? <img src={packImg} style={{ width: '100%', height: 'auto', display: 'block' }} />
              : <div style={{ fontSize: 80, textAlign: 'center' }}>📦</div>
            }
          </div>
        )}

        {/* REVEAL PHASE — card with flip + glow + shine */}
        {(phase === 'reveal' || phase === 'flash') && (
          <>
            <div style={{ width: 220, perspective: 900, animation: phase === 'reveal' ? 'cardEntrance 0.4s ease both' : 'none' }}>
              <div style={{
                width: '100%', transformStyle: 'preserve-3d', position: 'relative',
                transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
                transform: flipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
                borderRadius: 10,
                animation: !flipped && phase === 'reveal' ? 'backPulse 0.8s ease infinite' : 'none',
              }}>
                {/* Card front */}
                <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', borderRadius: 10, overflow: 'hidden', position: 'relative', filter: flipped ? dropShadow : 'none', transition: 'filter 0.4s ease' }}>
                  <FutCard card={card} />
                  {/* Shine sweep */}
                  {shineActive && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: '45%',
                      background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)',
                      transform: 'skewX(-12deg)', animation: 'shineSweep 0.65s ease forwards',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
                {/* Card back */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)', background: 'linear-gradient(135deg,#1e3a5f,#0f1f3d)',
                  borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 40 }}>⚽</span>
                </div>
              </div>
            </div>

            {/* Card info */}
            {flipped && (
              <div className="anim-fadeUp" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{card.name}</div>
                <div style={{ fontSize: 13, margin: '4px 0 12px', color: { Common:'#94a3b8', Uncommon:'#22c55e', Rare:'#f0c040' }[card.card_rarity] || '#fff', fontWeight: 600 }}>
                  {card.card_rarity} · {card.card_type}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                  {[['OVR','overall','#f0c040'],['ATK','attack','#ef4444'],['DEF','defense','#3b82f6'],['SPD','speed','#22c55e']].map(([l,k,c]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{card[k]}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {flipped && (
              <button className="btn-primary anim-fadeUp" onClick={nextCard} style={{ maxWidth: 260 }}>
                {revealIndex < revealedCards.length - 1 ? 'Next Card →' : 'See All'}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  /* ── RESULT ── */
  if (screen === 'result') return (
    <ResultScreen
      cards={revealedCards}
      token={token}
      onBack={() => setScreen('list')}
    />
  )

  /* ── PACK LIST ── */
  return (
    <div className="page">
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 16 }}>📦 My Packs</h2>
      {error && <div style={{ background: '#3d1515', color: '#f87171', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {!packs ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>
      ) : (() => {
          const owned = Object.entries(PACK_META).filter(([key]) => (packs[key] ?? 0) > 0)
          if (owned.length === 0) return (
            <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>
              No packs to open. Buy some from the Shop!
            </p>
          )
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
              {owned.map(([key, meta]) => {
                const count = packs[key]
                return (
                  <div key={key} className="anim-fadeUp" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
                    background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '24px 16px 16px',
                    border: '1px solid rgba(168,85,247,0.25)', position: 'relative',
                  }}>
                    {/* Count badge */}
                    <div style={{ position: 'absolute', top: 12, right: 12, background: '#a855f7', color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, boxShadow: '0 2px 10px rgba(168,85,247,0.5)', zIndex: 1 }}>
                      {count}
                    </div>
                    {/* Fixed-height image container */}
                    <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {meta.img
                        ? <img src={meta.img} alt={meta.label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
                        : <div style={{ fontSize: 64, opacity: 0.4 }}>💎</div>
                      }
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{meta.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{meta.desc}</div>
                    </div>
                    <button
                      disabled={loading}
                      onClick={() => openPack(key)}
                      style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px 0', cursor: 'pointer', fontSize: 14, fontWeight: 800, letterSpacing: '0.05em', boxShadow: '0 4px 20px rgba(168,85,247,0.35)' }}
                    >
                      OPEN
                    </button>
                  </div>
                )
              })}
            </div>
          )
        })()}
    </div>
  )
}

function ResultScreen({ cards, token, onBack }) {
  const [sold, setSold]         = useState({})
  const [confirming, setConfirming] = useState(null) // card_id being confirmed
  const [toast, setToast]       = useState(null)

  async function sellCard(card) {
    setConfirming(null)
    try {
      const res = await apiFetch(`/api/shop/sell/${card.card_id}`, token, { method: 'POST' })
      setSold(s => ({ ...s, [card.card_id]: res.coins_earned }))
      setToast(`Sold ${card.name} for 🪙 ${res.coins_earned}`)
      setTimeout(() => setToast(null), 2500)
    } catch (e) {
      setToast('Could not sell card')
      setTimeout(() => setToast(null), 2000)
    }
  }

  return (
    <div className="page">
      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, zIndex: 300, whiteSpace: 'nowrap' }} className="anim-fadeUp">
          {toast}
        </div>
      )}
      <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 16 }}>Cards Received</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 16 }}>
        {cards.map((card, i) => {
          const isSold = !!sold[card.card_id]
          const sellValue = calcValue(card)
          return (
            <div key={i} className="anim-fadeUp" style={{ animationDelay: `${i * 0.06}s`, opacity: isSold ? 0.4 : 1, transition: 'opacity 0.3s' }}>
              <FutCard card={card} />
              <div style={{ marginTop: 6, textAlign: 'center' }}>
                {isSold ? (
                  <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>✓ Sold for 🪙{sold[card.card_id]}</div>
                ) : confirming === card.card_id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => sellCard(card)} style={{ flex: 1, background: '#ef4444', border: 'none', borderRadius: 7, color: '#fff', padding: '5px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
                    <button onClick={() => setConfirming(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, color: '#aaa', padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(card.card_id)}
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%' }}
                  >
                    Sell 🪙{sellValue}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <button className="btn-primary" onClick={onBack}>Back to Packs</button>
    </div>
  )
}
