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
  const winPct = (w, p) => p > 0 ? Math.round(w / p * 100) : 0
  const isFirstOwner = (card.trade_count ?? 0) === 0

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{
        background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px',
        width: '100%', maxWidth: 480, border: '1px solid var(--border)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header: card image + name + stats */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
          <div style={{ width: '38%', flexShrink: 0 }}>
            <FutCard card={card} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 3 }}>{card.name}</div>
            <div style={{ fontSize: 12, color: rarityColor, fontWeight: 700, marginBottom: 14 }}>{card.card_rarity} · {card.card_type}</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[['OVR', card.overall, '#f0c040'], ['ATK', card.attack, '#ef4444'], ['DEF', card.defense, '#3b82f6'], ['SPD', card.speed, '#22c55e']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card Info */}
        <InfoSection title="ℹ️  Card Info">
          <InfoRow icon="🎯" label="Position" value={card.position} />
          <InfoRow icon="🏟️" label="Club"     value={card.club} />
          <InfoRow icon="🏆" label="League"   value={card.league} />
          <InfoRow icon="🌍" label="Nation"   value={card.nation} />
          <InfoRow icon="🆔" label="Card ID"  value={`#${card.card_id}`} />
        </InfoSection>

        {/* Inventory */}
        <InfoSection title="📋  Inventory">
          <InfoRow
            icon="#️⃣" label="Edition"
            value={card.edition ? `#${card.edition} of ${card.copies ?? '?'} copies` : '—'}
          />
          <InfoRow
            icon="👤" label="Ownership"
            value={isFirstOwner ? 'First Owner ✨' : 'Traded In'}
            valueColor={isFirstOwner ? '#22c55e' : 'var(--muted)'}
          />
        </InfoSection>

        {/* This copy battle record */}
        <InfoSection title="⚔️  Battle Record (This Copy)">
          <InfoRow
            icon="🏅" label="Battles"
            value={`${card.copy_battles_won ?? 0} / ${card.copy_battles_played ?? 0}  (${winPct(card.copy_battles_won, card.copy_battles_played)}%)`}
          />
          <InfoRow
            icon="🔄" label="Rounds"
            value={`${card.copy_rounds_won ?? 0} / ${card.copy_rounds_played ?? 0}`}
          />
        </InfoSection>

        {/* Global stats */}
        <InfoSection title="🌍  Global Stats">
          <InfoRow icon="❤️" label="Wishlists" value={card.wishlist_count ?? 0} valueColor="#ef4444" />
          <InfoRow
            icon="⚔️" label="Battles"
            value={`${card.total_battles_won ?? 0} / ${card.total_battles_played ?? 0}  (${winPct(card.total_battles_won, card.total_battles_played)}%)`}
          />
          <InfoRow
            icon="🔄" label="Rounds"
            value={`${card.total_rounds_won ?? 0} / ${card.total_rounds_played ?? 0}`}
          />
        </InfoSection>

        <button className="btn-primary" onClick={onClose} style={{ width: '100%', marginTop: 4 }}>Close</button>
      </div>
    </div>
  )
}

function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {children}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, valueColor = '#e2e8f0' }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span>{icon}</span><span>{label}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: valueColor }}>{value}</div>
    </div>
  )
}
