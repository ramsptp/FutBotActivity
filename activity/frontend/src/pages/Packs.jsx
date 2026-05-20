import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'

const PACK_META = {
  rare_player_pack: { label: 'Rare Player Pack', icon: '🌟', desc: '1 Rare or Special card (85+ OVR)' },
  icon_pack:        { label: 'Icon Pack',         icon: '👑', desc: '1 guaranteed Icon card' },
  hero_pack:        { label: 'Hero Pack',          icon: '🦸', desc: '1 guaranteed Hero card' },
  tester_pack:      { label: 'Tester Pack',        icon: '💎', desc: '1 Icon + 4 high-rated cards' },
}

export default function Packs({ token }) {
  const [packs, setPacks]         = useState(null)
  const [screen, setScreen]       = useState('list')
  const [openingPack, setOpeningPack] = useState(null)
  const [revealedCards, setRevealedCards] = useState([])
  const [revealIndex, setRevealIndex]     = useState(0)
  const [flipped, setFlipped]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => { fetchPacks() }, [])

  async function fetchPacks() {
    const data = await apiFetch('/api/packs', token)
    setPacks(data)
  }

  async function openPack(packType) {
    setLoading(true); setError(null)
    try {
      const cards = await apiFetch(`/api/packs/open/${packType}`, token, { method: 'POST' })
      setRevealedCards(cards); setRevealIndex(0); setFlipped(false)
      setOpeningPack(packType); setScreen('opening')
      await fetchPacks()
      // Brief delay then flip
      setTimeout(() => setFlipped(true), 400)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  function nextCard() {
    if (revealIndex < revealedCards.length - 1) {
      setFlipped(false)
      setTimeout(() => { setRevealIndex(i => i + 1); setFlipped(true) }, 350)
    } else {
      setScreen('result')
    }
  }

  /* ── CARD FLIP REVEAL ── */
  if (screen === 'opening') {
    const card = revealedCards[revealIndex]
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '90svh', justifyContent: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{PACK_META[openingPack]?.icon} {PACK_META[openingPack]?.label}</span>
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>{revealIndex + 1} / {revealedCards.length}</span>
        </div>

        {/* Flip container */}
        <div style={{ width: '70%', maxWidth: 220, perspective: 800 }}>
          <div style={{
            width: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.4,0,0.2,1)',
            transform: flipped ? 'rotateY(0deg)' : 'rotateY(180deg)',
            position: 'relative',
          }}>
            {/* Front — card */}
            <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
              <FutCard card={card} />
            </div>
            {/* Back — card back design */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: 'linear-gradient(135deg, #1e3a5f, #0f1f3d)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 36 }}>⚽</div>
            </div>
          </div>
        </div>

        {/* Card info — only shown after flip */}
        {flipped && (
          <div className="anim-fadeUp" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{card.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 10px' }}>{card.card_rarity} · {card.card_type}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              {[['OVR','overall','#f0c040'],['ATK','attack','#ef4444'],['DEF','defense','#3b82f6'],['SPD','speed','#22c55e']].map(([l,k,c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{card[k]}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {flipped && (
          <button className="btn-primary anim-fadeUp" onClick={nextCard} style={{ maxWidth: 280 }}>
            {revealIndex < revealedCards.length - 1 ? 'Next Card →' : 'See All'}
          </button>
        )}
      </div>
    )
  }

  /* ── RESULT ── */
  if (screen === 'result') return (
    <div className="page">
      <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 14 }}>Cards Received</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {revealedCards.map((card, i) => (
          <div key={i} className="anim-fadeUp" style={{ animationDelay: `${i * 0.07}s` }}>
            <FutCard card={card} />
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={() => setScreen('list')}>Back to Packs</button>
    </div>
  )

  /* ── PACK LIST ── */
  return (
    <div className="page">
      <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 16 }}>📦 Packs</h2>
      {error && <div style={{ background: '#3d1515', color: '#f87171', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 }}>{error}</div>}
      {!packs ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>
      ) : Object.entries(PACK_META).map(([key, meta]) => {
        const count = packs[key] ?? 0
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
            <div style={{ fontSize: 32 }}>{meta.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{meta.desc}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>×{count}</div>
              <button
                disabled={count === 0 || loading}
                onClick={() => openPack(key)}
                style={{ background: count > 0 ? 'var(--accent)' : '#333', border: 'none', borderRadius: 8, color: count > 0 ? '#fff' : '#666', padding: '6px 14px', cursor: count > 0 ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}
              >Open</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
