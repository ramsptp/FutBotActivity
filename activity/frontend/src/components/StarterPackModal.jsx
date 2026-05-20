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
        <p style={s.sub}>Here are your {cards.length} starter cards:</p>
        <div style={s.grid}>
          {cards.map((c, i) => (
            <div key={i} style={s.tile}>
              {c.image_url ? <img src={c.image_url} style={s.tileImg} loading="lazy" /> : null}
              <div style={s.tileName}>{c.name.split(' ').pop()}</div>
              <div style={{ color: RARITY_COLOR[c.card_rarity], fontSize: 10 }}>{c.card_rarity}</div>
              <div style={s.tileOvr}>{c.overall}</div>
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
        <div style={s.cardBox}>
          {card.image_url
            ? <img src={card.image_url} style={s.cardImg} />
            : <div style={s.cardImgPlaceholder}>{card.position?.[0]}</div>
          }
          <div style={s.cardName}>{card.name}</div>
          <div style={{ color: RARITY_COLOR[card.card_rarity], fontSize: 13, marginBottom: 6 }}>
            {card.card_rarity} · {card.card_type}
          </div>
          <div style={s.stats}>
            <span style={{ color: '#ffd700', fontWeight: 700 }}>{card.overall} OVR</span>
            <span>⚔️ {card.attack}</span>
            <span>🛡️ {card.defense}</span>
            <span>💨 {card.speed}</span>
          </div>
        </div>
        <button style={s.btn} onClick={next}>
          {index < cards.length - 1 ? 'Next →' : 'See All'}
        </button>
      </div>
    </div>
  )
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: '#16213e', borderRadius: 16, padding: 24, width: '90%', maxWidth: 360, color: '#fff', fontFamily: 'sans-serif', textAlign: 'center' },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub: { color: '#888', fontSize: 13, margin: '0 0 12px' },
  counter: { color: '#888', fontSize: 13, marginBottom: 12 },
  cardBox: { background: '#0d0d1a', borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  cardImg: { width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' },
  cardImgPlaceholder: { height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#555' },
  cardName: { fontSize: 18, fontWeight: 700, padding: '10px 16px 4px' },
  stats: { display: 'flex', justifyContent: 'center', gap: 12, padding: '8px 16px 12px', fontSize: 14 },
  btn: { width: '100%', background: '#5865f2', border: 'none', borderRadius: 10, color: '#fff', padding: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 16 },
  tile: { background: '#0d0d1a', borderRadius: 6, overflow: 'hidden', textAlign: 'center' },
  tileImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  tileName: { fontSize: 8, padding: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  tileOvr: { fontSize: 11, fontWeight: 700, color: '#ffd700', paddingBottom: 2 },
}
