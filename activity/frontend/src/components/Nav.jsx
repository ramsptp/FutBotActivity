const TABS = [
  { id: 'home', label: '🏠 Home' },
  { id: 'collection', label: '📦 Collection' },
  { id: 'decks', label: '🃏 Decks' },
  { id: 'battle', label: '⚔️ Battle' },
]

export default function Nav({ page, setPage }) {
  return (
    <nav style={styles.nav}>
      {TABS.map(t => (
        <button
          key={t.id}
          style={{ ...styles.tab, ...(page === t.id ? styles.tabActive : {}) }}
          onClick={() => setPage(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    display: 'flex', background: '#0d0d1a',
    borderTop: '1px solid #2a2a4a', zIndex: 50,
  },
  tab: {
    flex: 1, padding: '10px 0', background: 'transparent',
    border: 'none', color: '#666', cursor: 'pointer', fontSize: 12,
  },
  tabActive: { color: '#5865f2', borderTop: '2px solid #5865f2' },
}
