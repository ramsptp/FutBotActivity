import { useState } from 'react'

const RARITY_COLOR = { Common: '#aaa', Uncommon: '#4caf50', Rare: '#ffd700' }

export default function StarterPackModal({ cards, onClose }) {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(false)

  const card = cards[index]

  function next() {
    if (index < cards.length - 1) setIndex(i => i + 1)
    else setDone(true)
  }

  if (done) return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.title}>🎁 Welcome to FutBot!</div>
        <p style={s.sub}>Your {cards.length} starter cards:</p>
        <div style={s.grid}>
          {cards.map((c, i) => (
            <div key={i} style={s.tile}>
              {c.image_url
                ? <img src={c.image_url} style={{ width: '100%', height: 'auto', display: 'block' }} loading="lazy" />
                : <div style={{ padding: '20px 0', color: '#555', fontSize: 18 }}>{c.position?.[0]}</div>
              }
              <div style={{ fontSize: 9, padding: '2px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name.split(' ').pop()}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ffd700', paddingBottom: 3 }}>{c.overall}</div>
            </div>
          ))}
        </div>
        <button style={s.btn} onClick={onClose}>Let's Go!</button>
      </div>
    </div>
  )

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.title}>🎁 Starter Pack!</div>
        <div style={s.counter}>{index + 1} / {cards.length}</div>

        {/* Fixed-width card so it never overflows */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 140 }}>
            {card.image_url
              ? <img src={card.image_url} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }} />
              : <div style={{ width: 140, height: 196, background: '#1a2236', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, color: '#555' }}>{card.position?.[0]}</div>
            }
          </div>
        </div>

        <div style={s.cardName}>{card.name}</div>
        <div style={{ color: RARITY_COLOR[card.card_rarity] || '#fff', fontSize: 12, marginBottom: 10 }}>
          {card.card_rarity} · {card.card_type}
        </div>
        <div style={s.stats}>
          <span style={{ color: '#ffd700', fontWeight: 700 }}>{card.overall} OVR</span>
          <span>⚔️ {card.attack}</span>
          <span>🛡️ {card.defense}</span>
          <span>💨 {card.speed}</span>
        </div>

        <button style={s.btn} onClick={next}>
          {index < cards.length - 1 ? 'Next →' : 'See All'}
        </button>
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 20,
  },
  modal: {
    background: '#16213e', borderRadius: 16, padding: '20px 20px 16px',
    width: '100%', maxWidth: 320, maxHeight: '90svh', overflowY: 'auto',
    color: '#fff', fontFamily: 'sans-serif', textAlign: 'center',
  },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#888', fontSize: 13, margin: '0 0 10px' },
  counter: { color: '#888', fontSize: 13, marginBottom: 12 },
  cardName: { fontSize: 16, fontWeight: 700, marginBottom: 3 },
  stats: { display: 'flex', justifyContent: 'center', gap: 10, fontSize: 13, marginBottom: 14 },
  btn: { width: '100%', background: '#5865f2', border: 'none', borderRadius: 10, color: '#fff', padding: 11, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 14 },
  tile: { background: '#0d0d1a', borderRadius: 6, overflow: 'hidden', textAlign: 'center' },
}
