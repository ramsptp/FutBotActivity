import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from './FutCard'

const RARITIES  = ['All', 'Common', 'Uncommon', 'Rare']
const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender']

export default function ShowcasePicker({ token, onSelect, onClose }) {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ rarity: 'All', position: 'All' })

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.rarity   !== 'All') params.set('rarity',   filters.rarity)
    if (filters.position !== 'All') params.set('position', filters.position)
    apiFetch(`/api/collection?${params}`, token).then(d => { setCards(d); setLoading(false) }).catch(() => setLoading(false))
  }, [filters])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
          Pick Showcase Card
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 12, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {[{ key: 'rarity', opts: RARITIES }, { key: 'position', opts: POSITIONS }].map(({ key, opts }) => (
          <div key={key} style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {opts.map(o => (
              <button key={o} onClick={() => setFilters(f => ({ ...f, [key]: o }))} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${filters[key] === o ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                background: filters[key] === o ? 'var(--accent)' : 'transparent',
                color: filters[key] === o ? '#fff' : 'var(--muted)',
              }}>{o}</button>
            ))}
          </div>
        ))}
      </div>

      {/* Card grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 80px' }}>
        {loading ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>
        ) : cards.length === 0 ? (
          <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No cards found.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
            {cards.map((card, i) => (
              <div
                key={i}
                onClick={() => { onSelect(card); onClose() }}
                style={{ cursor: 'pointer', borderRadius: 10, overflow: 'hidden', transition: 'transform 0.15s', ':hover': { transform: 'scale(1.04)' } }}
              >
                <FutCard card={card} />
                <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                  {card.overall} OVR
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
