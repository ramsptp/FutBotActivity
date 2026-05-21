import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'
import PageHelp from '../components/PageHelp'
import PageTip from '../components/PageTip'

const RARITIES  = ['All', 'Common', 'Uncommon', 'Rare']
const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender']
const TYPES     = ['All', 'Standard', 'Icon', 'Hero', 'Euro TOTT', 'Copa America TOTT']

const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }

export default function Collection({ token }) {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({ rarity: 'All', position: 'All', card_type: 'All' })

  useEffect(() => { fetchCards() }, [filters])

  async function fetchCards() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.rarity    !== 'All') params.set('rarity',    filters.rarity)
    if (filters.position  !== 'All') params.set('position',  filters.position)
    if (filters.card_type !== 'All') params.set('card_type', filters.card_type)
    const data = await apiFetch(`/api/collection?${params}`, token)
    setCards(data)
    setLoading(false)
  }

  function setFilter(key, val) { setFilters(f => ({ ...f, [key]: val })); setSelected(null) }

  return (
    <div className="page">
      <PageTip page="collection" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>My Collection</h2>
        <PageHelp page="collection" />
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{cards.length} cards</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, background: 'rgba(10,14,26,0.6)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '10px 12px' }}>
        <FilterRow label="Rarity"   opts={RARITIES}  val={filters.rarity}    set={v => setFilter('rarity', v)} />
        <FilterRow label="Position" opts={POSITIONS} val={filters.position}  set={v => setFilter('position', v)} />
        <FilterRow label="Type"     opts={TYPES}     val={filters.card_type} set={v => setFilter('card_type', v)} />
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>
      ) : cards.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No cards found.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
          {cards.map((card, i) => (
            <div key={i} className="anim-fadeUp" style={{ animationDelay: `${Math.min(i * 0.03, 0.5)}s` }}>
              <div style={{ contain: 'content' }}>
                <FutCard card={card} onClick={() => setSelected(card)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function FilterRow({ label, opts, val, set }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: 'var(--muted)', fontSize: 12, minWidth: 52 }}>{label}</span>
      {opts.map(o => (
        <button key={o} onClick={() => set(o)} style={{
          padding: '3px 10px', borderRadius: 20,
          border: `1px solid ${val === o ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
          background: val === o ? 'var(--accent)' : 'rgba(10,14,26,0.75)',
          color: val === o ? '#fff' : '#cbd5e1',
          fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
          backdropFilter: 'blur(6px)',
        }}>{o}</button>
      ))}
    </div>
  )
}

function CardModal({ card, onClose }) {
  const rarityColor = RARITY_COLOR[card.card_rarity] || '#fff'
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{
        background: 'var(--surface)', borderRadius: 16, padding: 20,
        width: '100%', maxWidth: 320, border: '1px solid var(--border)',
      }}>
        <div style={{ width: '60%', margin: '0 auto 16px' }}>
          <FutCard card={card} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{card.name}</div>
          <div style={{ color: rarityColor, fontSize: 13, marginBottom: 12 }}>
            {card.card_rarity} · {card.card_type}
          </div>

          <div style={{ fontSize: 32, fontWeight: 900, color: '#f0c040' }}>{card.overall}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>OVR</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 20 }}>
            {[['ATK', card.attack, '#ef4444'], ['DEF', card.defense, '#3b82f6'], ['SPD', card.speed, '#22c55e']].map(([l, v, c]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l}</div>
              </div>
            ))}
          </div>

          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
