const TABS = [
  { id: 'home',       label: '🏠',  text: 'Home' },
  { id: 'collection', label: '📦',  text: 'Cards' },
  { id: 'shop',       label: '🛒',  text: 'Shop' },
  { id: 'packs',      label: '🎁',  text: 'Packs' },
  { id: 'decks',      label: '🃏',  text: 'Decks' },
  { id: 'battle',     label: '⚔️', text: 'Battle' },
]

export default function Nav({ page, setPage }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      display: 'flex', background: 'rgba(10,14,26,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(255,255,255,0.07)', zIndex: 50,
    }}>
      {TABS.map(t => {
        const active = page === t.id
        return (
          <button key={t.id} onClick={() => setPage(t.id)} style={{
            flex: 1, padding: '8px 0 6px', background: 'transparent',
            border: 'none', borderTop: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
            color: active ? 'var(--accent)' : '#475569', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 16 }}>{t.label}</span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.text}</span>
          </button>
        )
      })}
    </nav>
  )
}
