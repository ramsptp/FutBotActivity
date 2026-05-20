import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

const PACK_META = {
  rare_player_pack: { label: 'Rare Player Pack', icon: '🌟', desc: '1 Rare or Special card (85+ OVR)' },
  icon_pack:        { label: 'Icon Pack',         icon: '👑', desc: '1 guaranteed Icon card' },
  hero_pack:        { label: 'Hero Pack',          icon: '🦸', desc: '1 guaranteed Hero card' },
  tester_pack:      { label: 'Tester Pack',        icon: '💎', desc: '1 Icon + 4 high-rated cards' },
}

const RARITY_COLOR = { Common: '#aaa', Uncommon: '#4caf50', Rare: '#ffd700' }

export default function Packs({ token }) {
  const [packs, setPacks] = useState(null)
  const [screen, setScreen] = useState('list') // list | opening | result
  const [openingPack, setOpeningPack] = useState(null)
  const [revealedCards, setRevealedCards] = useState([])
  const [revealIndex, setRevealIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchPacks() }, [])

  async function fetchPacks() {
    const data = await apiFetch('/api/packs', token)
    setPacks(data)
  }

  async function openPack(packType) {
    setLoading(true)
    setError(null)
    try {
      const cards = await apiFetch(`/api/packs/open/${packType}`, token, { method: 'POST' })
      setRevealedCards(cards)
      setRevealIndex(0)
      setOpeningPack(packType)
      setScreen('opening')
      await fetchPacks()
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function revealNext() {
    if (revealIndex < revealedCards.length - 1) {
      setRevealIndex(i => i + 1)
    } else {
      setScreen('result')
    }
  }

  if (screen === 'opening') {
    const card = revealedCards[revealIndex]
    return (
      <div style={s.root}>
        <div style={s.openingHeader}>
          {PACK_META[openingPack]?.icon} {PACK_META[openingPack]?.label}
          <span style={s.revealCount}>{revealIndex + 1} / {revealedCards.length}</span>
        </div>
        <div style={s.cardReveal} key={revealIndex}>
          {card.image_url
            ? <img src={card.image_url} style={s.revealImg} />
            : <div style={s.revealImgPlaceholder}>{card.position?.[0]}</div>
          }
          <div style={s.revealName}>{card.name}</div>
          <div style={{ ...s.revealRarity, color: RARITY_COLOR[card.card_rarity] || '#fff' }}>
            {card.card_rarity} · {card.card_type}
          </div>
          <div style={s.revealStats}>
            <span style={s.revealOvr}>{card.overall} OVR</span>
            <span style={s.revealStat}>⚔️ {card.attack}</span>
            <span style={s.revealStat}>🛡️ {card.defense}</span>
            <span style={s.revealStat}>💨 {card.speed}</span>
          </div>
          <div style={s.revealMeta}>{card.club} · {card.nation}</div>
        </div>
        <button style={s.nextBtn} onClick={revealNext}>
          {revealIndex < revealedCards.length - 1 ? 'Next Card →' : 'See All Cards'}
        </button>
      </div>
    )
  }

  if (screen === 'result') return (
    <div style={s.root}>
      <h2 style={s.heading}>Cards Received</h2>
      <div style={s.resultGrid}>
        {revealedCards.map((card, i) => (
          <div key={i} style={s.resultTile}>
            {card.image_url
              ? <img src={card.image_url} style={s.resultImg} loading="lazy" />
              : <div style={s.revealImgPlaceholder}>{card.position?.[0]}</div>
            }
            <div style={s.resultName}>{card.name}</div>
            <div style={{ ...s.resultRarity, color: RARITY_COLOR[card.card_rarity] || '#fff' }}>{card.card_rarity}</div>
            <div style={s.resultOvr}>{card.overall}</div>
          </div>
        ))}
      </div>
      <button style={s.primaryBtn} onClick={() => setScreen('list')}>Back to Packs</button>
    </div>
  )

  return (
    <div style={s.root}>
      <h2 style={s.heading}>📦 Packs</h2>
      {error && <div style={s.error}>{error}</div>}
      {!packs ? (
        <p style={{ color: '#888' }}>Loading…</p>
      ) : (
        Object.entries(PACK_META).map(([key, meta]) => {
          const count = packs[key] ?? 0
          return (
            <div key={key} style={s.packRow}>
              <div style={s.packIcon}>{meta.icon}</div>
              <div style={s.packInfo}>
                <div style={s.packLabel}>{meta.label}</div>
                <div style={s.packDesc}>{meta.desc}</div>
              </div>
              <div style={s.packRight}>
                <div style={s.packCount}>×{count}</div>
                <button
                  style={{ ...s.openBtn, ...(count === 0 ? s.openBtnDisabled : {}) }}
                  disabled={count === 0 || loading}
                  onClick={() => openPack(key)}
                >
                  Open
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

const s = {
  root: { padding: '16px 16px 80px', color: '#fff', fontFamily: 'sans-serif', minHeight: '100vh', background: '#1a1a2e' },
  heading: { margin: '0 0 16px', fontSize: 22 },
  error: { background: '#3d1515', color: '#f88', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 13 },
  packRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#16213e', borderRadius: 12, padding: '14px 16px', marginBottom: 10 },
  packIcon: { fontSize: 32 },
  packInfo: { flex: 1 },
  packLabel: { fontWeight: 600, fontSize: 15 },
  packDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  packRight: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  packCount: { fontSize: 16, fontWeight: 700, color: '#ffd700' },
  openBtn: { background: '#5865f2', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  openBtnDisabled: { background: '#333', color: '#666', cursor: 'not-allowed' },
  openingHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 16, fontWeight: 600, marginBottom: 16 },
  revealCount: { color: '#888', fontSize: 13 },
  cardReveal: { background: '#16213e', borderRadius: 16, overflow: 'hidden', marginBottom: 20, textAlign: 'center', animation: 'fadeIn 0.4s ease' },
  revealImg: { width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' },
  revealImgPlaceholder: { height: 200, background: '#2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#555' },
  revealName: { fontSize: 20, fontWeight: 700, padding: '12px 16px 4px' },
  revealRarity: { fontSize: 13, paddingBottom: 8 },
  revealStats: { display: 'flex', justifyContent: 'center', gap: 12, padding: '8px 16px', background: '#0d0d1a' },
  revealOvr: { fontWeight: 700, color: '#ffd700' },
  revealStat: { fontSize: 14 },
  revealMeta: { fontSize: 12, color: '#888', padding: '6px 0 12px' },
  nextBtn: { width: '100%', background: '#5865f2', border: 'none', borderRadius: 10, color: '#fff', padding: 14, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 16 },
  resultTile: { background: '#16213e', borderRadius: 8, overflow: 'hidden', textAlign: 'center' },
  resultImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' },
  resultName: { fontSize: 10, padding: '4px 4px 0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultRarity: { fontSize: 10 },
  resultOvr: { fontSize: 12, fontWeight: 700, color: '#ffd700', paddingBottom: 4 },
  primaryBtn: { width: '100%', background: '#5865f2', border: 'none', borderRadius: 10, color: '#fff', padding: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
}
