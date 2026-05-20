import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import StarterPackModal from '../components/StarterPackModal'

export default function Home({ token, user, setPage }) {
  const [player, setPlayer] = useState(null)
  const [starterCards, setStarterCards] = useState(null)

  useEffect(() => {
    apiFetch('/api/me', token).then(async data => {
      setPlayer(data.player)
      if (!data.player.has_claimed_starter_pack) {
        try {
          const cards = await apiFetch('/api/packs/starter', token, { method: 'POST' })
          setStarterCards(cards)
        } catch {}
      }
    }).catch(() => {})
  }, [])

  const winRate = player && player.battles_played > 0
    ? Math.round((player.battles_won / player.battles_played) * 100)
    : null

  return (
    <div style={styles.root}>
      {starterCards && (
        <StarterPackModal cards={starterCards} onClose={() => setStarterCards(null)} />
      )}
      <div style={styles.profile}>
        <img
          src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=80`}
          alt={user.username}
          style={styles.avatar}
          onError={e => { e.target.style.display = 'none' }}
        />
        <div>
          <div style={styles.username}>{user.username}</div>
          {player?.display_title && <div style={styles.title}>{player.display_title}</div>}
          {player && <div style={styles.coins}>🪙 {player.coins.toLocaleString()} coins</div>}
        </div>
      </div>

      {player && (
        <div style={styles.statsRow}>
          <StatBox label="Battles" value={player.battles_played} />
          <StatBox label="Won" value={player.battles_won} color="#4caf50" />
          <StatBox label="Lost" value={player.battles_lost} color="#f44336" />
          <StatBox label="Win Rate" value={winRate != null ? `${winRate}%` : '—'} color="#ffd700" />
        </div>
      )}

      <div style={styles.actions}>
        <ActionCard icon="📦" label="Collection" sub="Browse your cards" onClick={() => setPage('collection')} />
        <ActionCard icon="🃏" label="Decks" sub="Build your lineup" onClick={() => setPage('decks')} />
        <ActionCard icon="⚔️" label="Battle" sub="Challenge someone" onClick={() => setPage('battle')} />
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statVal, color: color || '#fff' }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  )
}

function ActionCard({ icon, label, sub, onClick }) {
  return (
    <div style={styles.actionCard} onClick={onClick}>
      <div style={styles.actionIcon}>{icon}</div>
      <div style={styles.actionLabel}>{label}</div>
      <div style={styles.actionSub}>{sub}</div>
    </div>
  )
}

const styles = {
  root: { padding: '20px 16px 80px', color: '#fff', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a1a2e' },
  profile: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: '#16213e', borderRadius: 12, padding: 16 },
  avatar: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' },
  username: { fontSize: 20, fontWeight: 700 },
  title: { color: '#ffd700', fontSize: 13, margin: '2px 0' },
  coins: { color: '#aaa', fontSize: 14 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 },
  statBox: { background: '#16213e', borderRadius: 10, padding: '12px 8px', textAlign: 'center' },
  statVal: { fontSize: 20, fontWeight: 700 },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  actions: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 },
  actionCard: { background: '#16213e', borderRadius: 12, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', transition: 'background 0.15s' },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionLabel: { fontSize: 14, fontWeight: 600 },
  actionSub: { fontSize: 11, color: '#888', marginTop: 4 },
}
