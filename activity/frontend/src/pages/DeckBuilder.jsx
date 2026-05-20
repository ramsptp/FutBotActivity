import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const DECK_SIZE = 5
const POSITIONS = ['All', 'Forward', 'Midfielder', 'Defender']
const RARITIES = ['All', 'Common', 'Uncommon', 'Rare']

export default function DeckBuilder({ token }) {
  const [decks, setDecks] = useState([])
  const [activeDeck, setActiveDeck] = useState(null) // {deck_name, cards[]}
  const [deckName, setDeckName] = useState('')
  const [inventory, setInventory] = useState([])
  const [filters, setFilters] = useState({ position: 'All', rarity: 'All' })
  const [view, setView] = useState('list') // 'list' | 'editor'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchDecks() }, [])
  useEffect(() => { if (view === 'editor') fetchInventory() }, [view, filters])

  async function fetchDecks() {
    const data = await apiFetch('/api/decks', token)
    setDecks(data)
  }

  async function fetchInventory() {
    const params = new URLSearchParams()
    if (filters.position !== 'All') params.set('position', filters.position)
    if (filters.rarity !== 'All') params.set('rarity', filters.rarity)
    const data = await apiFetch(`/api/collection?${params}`, token)
    setInventory(data)
  }

  function openNew() {
    setActiveDeck({ deck_name: '', cards: [] })
    setDeckName('')
    setView('editor')
  }

  function openEdit(deck) {
    setActiveDeck({ ...deck })
    setDeckName(deck.deck_name)
    setView('editor')
  }

  function addCard(card) {
    if (activeDeck.cards.length >= DECK_SIZE) return
    if (activeDeck.cards.find(c => c.card_id === card.card_id)) return
    setActiveDeck(d => ({ ...d, cards: [...d.cards, card] }))
  }

  function removeCard(cardId) {
    setActiveDeck(d => ({ ...d, cards: d.cards.filter(c => c.card_id !== cardId) }))
  }

  async function saveDeck() {
    if (!deckName.trim()) return setError('Enter a deck name')
    if (activeDeck.cards.length !== DECK_SIZE) return setError(`Pick exactly ${DECK_SIZE} cards`)
    setSaving(true)
    setError(null)
    try {
      const body = { deck_name: deckName.trim(), card_ids: activeDeck.cards.map(c => c.card_id) }
      const isEdit = decks.find(d => d.deck_name === activeDeck.deck_name)
      if (isEdit) {
        await apiFetch(`/api/decks/${activeDeck.deck_name}`, token, { method: 'PUT', body: JSON.stringify(body) })
      } else {
        await apiFetch('/api/decks', token, { method: 'POST', body: JSON.stringify(body) })
      }
      await fetchDecks()
      setView('list')
    } catch (e) {
      setError(e.message)
    }
    setSaving(false)
  }

  async function deleteDeck(deckName) {
    await apiFetch(`/api/decks/${deckName}`, token, { method: 'DELETE' })
    await fetchDecks()
    setView('list')
  }

  if (view === 'list') return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h2 style={styles.heading}>My Decks</h2>
        <button style={styles.newBtn} onClick={openNew}>+ New Deck</button>
      </div>
      {decks.length === 0
        ? <p style={{ color: '#888' }}>No decks yet. Create one to start battling.</p>
        : decks.map(deck => (
          <div key={deck.deck_name} style={styles.deckRow} onClick={() => openEdit(deck)}>
            <div>
              <div style={styles.deckName}>{deck.deck_name}</div>
              <div style={styles.deckMeta}>{deck.cards.length} cards · {deck.cards.map(c => c.name).join(', ').slice(0, 60)}…</div>
            </div>
            <div style={styles.deckArrow}>›</div>
          </div>
        ))
      }
    </div>
  )

  // Editor view
  const inDeck = activeDeck?.cards || []
  const filtered = inventory.filter(c => !inDeck.find(d => d.card_id === c.card_id))

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => setView('list')}>‹ Back</button>
        <input
          style={styles.nameInput}
          placeholder="Deck name"
          value={deckName}
          onChange={e => setDeckName(e.target.value)}
        />
      </div>

      {/* Deck slots */}
      <div style={styles.slotsRow}>
        {Array.from({ length: DECK_SIZE }).map((_, i) => {
          const card = inDeck[i]
          return (
            <div key={i} style={{ ...styles.slot, ...(card ? styles.slotFilled : styles.slotEmpty) }}
              onClick={() => card && removeCard(card.card_id)}>
              {card
                ? <>{card.image_url && <img src={card.image_url} style={styles.slotImg} loading="lazy" />}
                    <div style={styles.slotName}>{card.name.split(' ').pop()}</div></>
                : <div style={styles.slotPlus}>+</div>
              }
            </div>
          )
        })}
      </div>
      <div style={styles.slotHint}>{inDeck.length}/{DECK_SIZE} — tap a slot to remove</div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.filterRow}>
        {POSITIONS.map(p => (
          <button key={p} style={{ ...styles.filterBtn, ...(filters.position === p ? styles.filterBtnActive : {}) }}
            onClick={() => setFilters(f => ({ ...f, position: p }))}>{p}</button>
        ))}
      </div>
      <div style={styles.filterRow}>
        {RARITIES.map(r => (
          <button key={r} style={{ ...styles.filterBtn, ...(filters.rarity === r ? styles.filterBtnActive : {}) }}
            onClick={() => setFilters(f => ({ ...f, rarity: r }))}>{r}</button>
        ))}
      </div>

      <div style={styles.invGrid}>
        {filtered.map((card, i) => (
          <div key={i} style={styles.invTile}
            onClick={() => addCard(card)}>
            {card.image_url
              ? <img src={card.image_url} style={styles.invImg} loading="lazy" />
              : <div style={styles.invImgPlaceholder}>{card.position?.[0]}</div>
            }
            <div style={styles.invName}>{card.name.split(' ').pop()}</div>
            <div style={styles.invOvr}>{card.overall}</div>
          </div>
        ))}
      </div>

      <div style={styles.saveRow}>
        {activeDeck.deck_name && (
          <button style={styles.deleteBtn} onClick={() => deleteDeck(activeDeck.deck_name)}>Delete</button>
        )}
        <button style={styles.saveBtn} onClick={saveDeck} disabled={saving}>
          {saving ? 'Saving…' : 'Save Deck'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  root: { padding: '16px 16px 100px', color: '#fff', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a1a2e' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heading: { margin: 0, fontSize: 20 },
  newBtn: { background: '#5865f2', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 14px', cursor: 'pointer', fontSize: 13 },
  backBtn: { background: 'transparent', border: 'none', color: '#5865f2', fontSize: 18, cursor: 'pointer', padding: '0 8px 0 0' },
  nameInput: { flex: 1, background: '#16213e', border: '1px solid #2a2a4a', borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 14 },
  deckRow: { background: '#16213e', borderRadius: 10, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  deckName: { fontWeight: 600, marginBottom: 4 },
  deckMeta: { fontSize: 12, color: '#888' },
  deckArrow: { color: '#555', fontSize: 20 },
  slotsRow: { display: 'flex', gap: 6, marginBottom: 6 },
  slot: { flex: 1, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', textAlign: 'center', minHeight: 72 },
  slotFilled: { background: '#16213e', border: '1px solid #5865f2' },
  slotEmpty: { background: '#16213e', border: '1px dashed #333', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  slotImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  slotName: { fontSize: 9, padding: '2px 2px', color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  slotPlus: { color: '#333', fontSize: 20 },
  slotHint: { fontSize: 11, color: '#555', marginBottom: 12, textAlign: 'center' },
  error: { background: '#3d1515', color: '#f88', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  filterBtn: { padding: '3px 10px', borderRadius: 12, border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: 11 },
  filterBtnActive: { background: '#5865f2', borderColor: '#5865f2', color: '#fff' },
  invGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6, marginBottom: 16 },
  invTile: { background: '#16213e', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', textAlign: 'center' },
  invImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  invImgPlaceholder: { width: '100%', aspectRatio: '1', background: '#2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' },
  invName: { fontSize: 9, padding: '2px 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  invOvr: { fontSize: 11, fontWeight: 700, color: '#ffd700', paddingBottom: 3 },
  saveRow: { position: 'fixed', bottom: 56, left: 0, right: 0, display: 'flex', gap: 10, padding: '10px 16px', background: '#0d0d1a', borderTop: '1px solid #2a2a4a' },
  saveBtn: { flex: 1, background: '#5865f2', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  deleteBtn: { background: '#c0392b', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 16px', cursor: 'pointer', fontSize: 14 },
}
