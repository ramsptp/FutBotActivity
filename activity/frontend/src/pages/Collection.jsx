import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const RARITIES = ['All', 'Common', 'Uncommon', 'Rare']
const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender']
const TYPES = ['All', 'Standard', 'Icon', 'Hero', 'Euro TOTT', 'Copa America TOTT']

const RARITY_COLOR = {
  Common: '#aaa',
  Uncommon: '#4caf50',
  Rare: '#ffd700',
}

export default function Collection({ token }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({ rarity: 'All', position: 'All', card_type: 'All' })

  useEffect(() => {
    fetchCards()
  }, [filters])

  async function fetchCards() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.rarity !== 'All') params.set('rarity', filters.rarity)
    if (filters.position !== 'All') params.set('position', filters.position)
    if (filters.card_type !== 'All') params.set('card_type', filters.card_type)
    const data = await apiFetch(`/api/collection?${params}`, token)
    setCards(data)
    setLoading(false)
  }

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
    setSelected(null)
  }

  return (
    <div style={styles.root}>
      <h2 style={styles.heading}>My Collection <span style={styles.count}>({cards.length})</span></h2>

      <div style={styles.filters}>
        <FilterBar label="Rarity" options={RARITIES} value={filters.rarity} onChange={v => setFilter('rarity', v)} />
        <FilterBar label="Position" options={POSITIONS} value={filters.position} onChange={v => setFilter('position', v)} />
        <FilterBar label="Type" options={TYPES} value={filters.card_type} onChange={v => setFilter('card_type', v)} />
      </div>

      {loading ? (
        <p style={{ color: '#888', padding: 24 }}>Loading...</p>
      ) : cards.length === 0 ? (
        <p style={{ color: '#888', padding: 24 }}>No cards found.</p>
      ) : (
        <div style={styles.grid}>
          {cards.map((card, i) => (
            <CardTile key={i} card={card} onClick={() => setSelected(card)} />
          ))}
        </div>
      )}

      {selected && <CardModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function FilterBar({ label, options, value, onChange }) {
  return (
    <div style={styles.filterBar}>
      <span style={styles.filterLabel}>{label}:</span>
      {options.map(o => (
        <button key={o} style={{ ...styles.filterBtn, ...(value === o ? styles.filterBtnActive : {}) }} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

function CardTile({ card, onClick }) {
  return (
    <div style={styles.tile} onClick={onClick}>
      {card.image_url
        ? <img src={card.image_url} alt={card.name} style={styles.tileImg} loading="lazy" />
        : <div style={styles.tileImgPlaceholder}>{card.position?.[0]}</div>
      }
      <div style={styles.tileInfo}>
        <div style={styles.tileName}>{card.name}</div>
        <div style={styles.tileOverall}>{card.overall}</div>
        <div style={{ ...styles.tileRarity, color: RARITY_COLOR[card.card_rarity] || '#fff' }}>
          {card.card_rarity}
        </div>
      </div>
    </div>
  )
}

function CardModal({ card, onClose }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {card.image_url
          ? <img src={card.image_url} alt={card.name} style={styles.modalImg} />
          : <div style={{ ...styles.tileImgPlaceholder, width: 120, height: 120, fontSize: 48 }}>{card.position?.[0]}</div>
        }
        <h2 style={{ margin: '12px 0 4px' }}>{card.name}</h2>
        <div style={{ color: RARITY_COLOR[card.card_rarity], marginBottom: 12 }}>
          {card.card_rarity} · {card.card_type}
        </div>
        <div style={styles.stats}>
          <Stat label="OVR" value={card.overall} />
          <Stat label="ATK" value={card.attack} />
          <Stat label="DEF" value={card.defense} />
          <Stat label="SPD" value={card.speed} />
        </div>
        <div style={styles.meta}>
          <span>{card.position}</span>
          <span>{card.club}</span>
          <span>{card.nation}</span>
          <span>{card.league}</span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <div style={styles.statVal}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

const styles = {
  root: { padding: '16px 16px 80px', color: '#fff', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a1a2e' },
  heading: { margin: '0 0 12px', fontSize: 20 },
  count: { color: '#888', fontWeight: 'normal', fontSize: 16 },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterBar: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filterLabel: { color: '#888', fontSize: 13, marginRight: 2 },
  filterBtn: { padding: '4px 10px', borderRadius: 12, border: '1px solid #444', background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 12 },
  filterBtnActive: { background: '#5865f2', borderColor: '#5865f2', color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 },
  tile: { background: '#16213e', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.1s', ':hover': { transform: 'scale(1.03)' } },
  tileImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  tileImgPlaceholder: { width: '100%', aspectRatio: '1', background: '#2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#555' },
  tileInfo: { padding: '6px 8px' },
  tileName: { fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tileOverall: { fontSize: 13, fontWeight: 700, color: '#ffd700' },
  tileRarity: { fontSize: 10 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#16213e', borderRadius: 12, padding: 24, maxWidth: 320, width: '90%', textAlign: 'center', color: '#fff' },
  modalImg: { width: 140, height: 140, objectFit: 'cover', borderRadius: 8 },
  stats: { display: 'flex', justifyContent: 'center', gap: 16, margin: '12px 0' },
  stat: { textAlign: 'center' },
  statVal: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 11, color: '#888' },
  meta: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, fontSize: 12, color: '#aaa', marginBottom: 16 },
  closeBtn: { padding: '8px 24px', background: '#5865f2', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14 },
}
