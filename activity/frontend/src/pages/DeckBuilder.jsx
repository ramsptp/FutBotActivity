import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'

const DECK_SIZE = 5
const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender']
const RARITIES  = ['All', 'Common', 'Uncommon', 'Rare']

export default function DeckBuilder({ token }) {
  const [decks, setDecks]         = useState([])
  const [activeDeck, setActiveDeck] = useState(null)
  const [deckName, setDeckName]   = useState('')
  const [inventory, setInventory] = useState([])
  const [filters, setFilters]     = useState({ position: 'All', rarity: 'All' })
  const [view, setView]           = useState('list')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => { fetchDecks() }, [])
  useEffect(() => { if (view === 'editor') fetchInventory() }, [view, filters])

  async function fetchDecks() {
    const data = await apiFetch('/api/decks', token)
    setDecks(data)
  }

  async function fetchInventory() {
    const params = new URLSearchParams()
    if (filters.position !== 'All') params.set('position', filters.position)
    if (filters.rarity   !== 'All') params.set('rarity',   filters.rarity)
    const data = await apiFetch(`/api/collection?${params}`, token)
    setInventory(data)
  }

  function openNew()    { setActiveDeck({ deck_name: '', cards: [] }); setDeckName(''); setView('editor') }
  function openEdit(d)  { setActiveDeck({ ...d }); setDeckName(d.deck_name); setView('editor') }

  function addCard(card) {
    if (activeDeck.cards.length >= DECK_SIZE) return
    if (activeDeck.cards.find(c => c.card_id === card.card_id)) return
    setActiveDeck(d => ({ ...d, cards: [...d.cards, card] }))
  }
  function removeCard(id) { setActiveDeck(d => ({ ...d, cards: d.cards.filter(c => c.card_id !== id) })) }

  async function saveDeck() {
    if (!deckName.trim()) return setError('Enter a deck name')
    if (activeDeck.cards.length !== DECK_SIZE) return setError(`Pick exactly ${DECK_SIZE} cards`)
    setSaving(true); setError(null)
    try {
      const body = { deck_name: deckName.trim(), card_ids: activeDeck.cards.map(c => c.card_id) }
      const isEdit = decks.find(d => d.deck_name === activeDeck.deck_name)
      if (isEdit) await apiFetch(`/api/decks/${activeDeck.deck_name}`, token, { method: 'PUT',  body: JSON.stringify(body) })
      else        await apiFetch('/api/decks',                          token, { method: 'POST', body: JSON.stringify(body) })
      await fetchDecks(); setView('list')
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  async function deleteDeck(name) {
    await apiFetch(`/api/decks/${name}`, token, { method: 'DELETE' })
    await fetchDecks(); setView('list')
  }

  /* ── LIST VIEW ── */
  if (view === 'list') return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>My Decks</h2>
        <button onClick={openNew} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New</button>
      </div>
      {decks.length === 0 ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No decks yet. Create one to battle!</p>
      ) : decks.map(deck => (
        <div key={deck.deck_name} onClick={() => openEdit(deck)} style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 16px', marginBottom: 10, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{deck.deck_name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{deck.cards.length} cards</div>
          </div>
          {/* Mini card strip */}
          <div style={{ display: 'flex', gap: 3 }}>
            {deck.cards.slice(0, 4).map((c, i) => (
              <div key={i} style={{ width: 28, borderRadius: 4, overflow: 'hidden' }}>
                <FutCard card={c} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  /* ── EDITOR VIEW ── */
  const inDeck  = activeDeck?.cards || []
  const filtered = inventory.filter(c => !inDeck.find(d => d.card_id === c.card_id))

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => setView('list')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 20, cursor: 'pointer', padding: 0 }}>‹</button>
        <input value={deckName} onChange={e => setDeckName(e.target.value)} placeholder="Deck name"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 14 }} />
      </div>

      {/* Deck slots */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, justifyContent: 'center' }}>
        {Array.from({ length: DECK_SIZE }).map((_, i) => {
          const card = inDeck[i]
          return (
            <div key={i} onClick={() => card && removeCard(card.card_id)} style={{
              width: 125, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
              cursor: card ? 'pointer' : 'default',
              border: `2px dashed ${card ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
              aspectRatio: '300 / 420',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {card
                ? <img src={card.image_url} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
                : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 22 }}>+</span>
              }
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 12 }}>
        {inDeck.length}/{DECK_SIZE} · tap slot to remove
      </div>

      {error && <div style={{ background: '#3d1515', color: '#f87171', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13 }}>{error}</div>}

      {/* Filters */}
      {[{ key: 'position', opts: POSITIONS }, { key: 'rarity', opts: RARITIES }].map(({ key, opts }) => (
        <div key={key} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
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

      {/* Inventory grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 70 }}>
        {filtered.map((card, i) => <FutCard key={i} card={card} onClick={() => addCard(card)} />)}
      </div>

      {/* Save bar */}
      <div style={{ position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, display: 'flex', gap: 8, padding: '10px 16px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        {activeDeck.deck_name && (
          <button onClick={() => deleteDeck(activeDeck.deck_name)} style={{ background: '#7f1d1d', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 14px', cursor: 'pointer', fontSize: 13 }}>Delete</button>
        )}
        <button className="btn-primary" onClick={saveDeck} disabled={saving} style={{ flex: 1 }}>
          {saving ? 'Saving…' : 'Save Deck'}
        </button>
      </div>
    </div>
  )
}
