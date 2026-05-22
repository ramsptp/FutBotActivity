import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'
import PageHelp from '../components/PageHelp'
import PageTip from '../components/PageTip'

const TABS = ['Daily', 'Buy Packs', 'Sell Cards']

export default function Shop({ token }) {
  const [tab, setTab]       = useState('Daily')
  const [coins, setCoins]   = useState(null)
  const [packs, setPacks]   = useState({})
  const [collection, setCollection] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast]   = useState(null)

  useEffect(() => { fetchShop() }, [])
  useEffect(() => { if (tab === 'Sell Cards' && collection.length === 0) fetchCollection() }, [tab])

  async function fetchShop() {
    const data = await apiFetch('/api/shop/packs', token)
    setCoins(data.coins)
    setPacks(data.packs)
  }

  async function fetchCollection() {
    const data = await apiFetch('/api/collection', token)
    setCollection(data)
  }

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  async function buyPack(packType) {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/shop/buy/${packType}`, token, { method: 'POST' })
      setCoins(res.coins)
      showToast(`Pack purchased! ${res.coins.toLocaleString()} coins remaining`)
    } catch (e) {
      showToast(e.message || 'Not enough coins', false)
    }
    setLoading(false)
  }

  async function sellCard(card) {
    try {
      const res = await apiFetch(`/api/shop/sell/${card.card_id}`, token, { method: 'POST' })
      setCoins(res.coins)
      setCollection(c => c.filter(x => x.card_id !== card.card_id))
      showToast(`Sold ${card.name} for ${res.coins_earned.toLocaleString()} coins`)
    } catch (e) {
      showToast(e.message || 'Could not sell card', false)
    }
  }

  return (
    <div className="page">
      <PageTip page="shop" />
      {toast && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: toast.ok ? 'var(--green)' : 'var(--red)',
          color: '#fff', borderRadius: 10, padding: '10px 20px',
          fontSize: 14, fontWeight: 600, zIndex: 300, whiteSpace: 'nowrap',
        }} className="anim-fadeUp">
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>🛒 Shop</h2>
          <PageHelp page="shop" />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
          🪙 {coins?.toLocaleString() ?? '…'}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 18, background: 'var(--surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--muted)',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Daily'      && <DailyTab token={token} onCoinsUpdate={c => setCoins(c)} showToast={showToast} />}
      {tab === 'Buy Packs'  && <BuyPacksTab packs={packs} coins={coins} onBuy={buyPack} loading={loading} />}
      {tab === 'Sell Cards' && <SellCardsTab collection={collection} onSell={sellCard} />}
    </div>
  )
}

// ── DAILY TAB ─────────────────────────────────────────────────────────────────

const TIER_ROWS = [
  { days: '1 – 3',  coins: 100, pack: false, color: '#cd7f32' },
  { days: '4 – 6',  coins: 150, pack: false, color: '#94a3b8' },
  { days: '7',      coins: 200, pack: true,  color: '#60a5fa' },
  { days: '8 – 13', coins: 200, pack: false, color: '#60a5fa' },
  { days: '14',     coins: 300, pack: true,  color: '#f0c040' },
  { days: '15+',    coins: 300, pack: false, color: '#f0c040' },
]

function tierFor(s) {
  if (s <= 3)  return { label: 'Bronze',    color: '#cd7f32' }
  if (s <= 6)  return { label: 'Silver',    color: '#94a3b8' }
  if (s <= 13) return { label: 'Diamond',   color: '#60a5fa' }
  return            { label: 'Legendary',  color: '#f0c040' }
}

function isCurrentRow(row, next) {
  if (row.days === '1 – 3'  && next >= 1  && next <= 3)  return true
  if (row.days === '4 – 6'  && next >= 4  && next <= 6)  return true
  if (row.days === '7'      && next === 7)                return true
  if (row.days === '8 – 13' && next >= 8  && next <= 13) return true
  if (row.days === '14'     && next === 14)               return true
  if (row.days === '15+'    && next >= 15)                return true
  return false
}

function DailyTab({ token, onCoinsUpdate, showToast }) {
  const [daily, setDaily]       = useState(null)
  const [claiming, setClaiming] = useState(false)
  const [picking, setPicking]   = useState(false)
  const [secs, setSecs]         = useState(0)
  const timerRef                = useRef(null)

  useEffect(() => {
    loadDaily()
    return () => clearInterval(timerRef.current)
  }, [])

  async function loadDaily() {
    const data = await apiFetch('/api/shop/daily', token)
    setDaily(data)
    setSecs(data.seconds_until_reset)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
  }

  async function handleClaim() {
    setClaiming(true)
    try {
      const res = await apiFetch('/api/shop/daily', token, { method: 'POST' })
      onCoinsUpdate?.(res.coins)
      setDaily(d => ({
        ...d, claimed: true, streak: res.streak, next_streak: res.streak, coins: res.coins,
        pending: res.card1 ? { card1: res.card1, card2: res.card2 } : null,
      }))
      if (res.pack_awarded) {
        showToast(`🔥 Day ${res.streak}! +${res.coins_earned} coins + Free Rare Pack!`)
      } else {
        showToast(`🔥 Day ${res.streak}! +${res.coins_earned} coins`)
      }
    } catch (e) {
      showToast(e.message || 'Could not claim', false)
    }
    setClaiming(false)
  }

  async function handlePick(cardId, cardName) {
    setPicking(true)
    try {
      await apiFetch(`/api/shop/daily/pick/${cardId}`, token, { method: 'POST' })
      setDaily(d => ({ ...d, pending: null }))
      showToast(`${cardName} added to your collection!`)
    } catch (e) {
      showToast(e.message || 'Could not pick card', false)
    }
    setPicking(false)
  }

  if (!daily) return <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Loading…</p>

  const { streak, next_streak, claimed, coins_reward, pack_reward, pending } = daily
  const tier = tierFor(next_streak)
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0')
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0')
  const ss = String(secs % 60).padStart(2, '0')

  // Card pick screen
  if (claimed && pending) {
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Pick a card to keep</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>The other is discarded</div>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          {[pending.card1, pending.card2].map(card => (
            <div key={card.card_id} style={{ width: 190, cursor: picking ? 'default' : 'pointer' }}
              onClick={() => !picking && handlePick(card.card_id, card.name)}>
              <div style={{
                borderRadius: 10, overflow: 'hidden',
                border: '2px solid rgba(168,85,247,0.4)',
                boxShadow: '0 0 16px rgba(168,85,247,0.15)',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}>
                <FutCard card={card} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{card.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{card.card_rarity} · {card.overall} OVR</div>
                <div style={{ fontSize: 11, color: '#a855f7', marginTop: 4, fontWeight: 600 }}>Tap to keep →</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Streak display */}
      <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
        <div style={{ fontSize: 52, lineHeight: 1 }}>🔥</div>
        <div style={{ fontSize: 56, fontWeight: 900, color: tier.color, lineHeight: 1.1 }}>{streak}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Day Streak</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: tier.color, marginTop: 4, letterSpacing: 2, textTransform: 'uppercase' }}>{tier.label}</div>
      </div>

      {/* Reward preview */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${tier.color}33`, borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
          {claimed ? `Day ${streak} reward claimed` : "Today's reward"}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <RewardRow label="🪙 Coins" value={`+${coins_reward}`} valueColor="var(--gold)" />
          <RewardRow label="🎴 Card drop" value="Pick 1 of 2" valueColor="#a855f7" />
          {pack_reward && <RewardRow label="🌟 Milestone bonus" value="Free Rare Pack!" valueColor="#22c55e" />}
        </div>
      </div>

      {/* Claim or timer */}
      {claimed ? (
        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 16px', marginBottom: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>✓ Claimed today — resets in</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>{hh}:{mm}:{ss}</div>
        </div>
      ) : (
        <button onClick={handleClaim} disabled={claiming} style={{
          width: '100%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
          border: 'none', borderRadius: 12, color: '#fff',
          padding: '14px 0', cursor: claiming ? 'default' : 'pointer',
          fontSize: 15, fontWeight: 800, letterSpacing: '0.05em',
          boxShadow: '0 4px 24px rgba(168,85,247,0.4)', marginBottom: 14,
          opacity: claiming ? 0.7 : 1,
        }}>
          {claiming ? 'Claiming…' : '🔥 Claim Daily Drop'}
        </button>
      )}

      {/* Tier table */}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Streak rewards</div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TIER_ROWS.map((row, i) => {
          const active = isCurrentRow(row, next_streak)
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 14px',
              borderBottom: i < TIER_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              background: active ? `${row.color}18` : 'transparent',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: row.color, fontWeight: 700, minWidth: 44 }}>Day {row.days}</span>
                {row.pack && <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.12)', borderRadius: 6, padding: '1px 6px', fontWeight: 600 }}>+ Free Pack</span>}
                {active && <span style={{ fontSize: 10, color: row.color, background: `${row.color}22`, borderRadius: 6, padding: '1px 6px', fontWeight: 700 }}>YOU ARE HERE</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)' }}>🪙 {row.coins}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RewardRow({ label, value, valueColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  )
}

// ── BUY PACKS TAB ─────────────────────────────────────────────────────────────

const PACK_IMAGES = {
  rare_player_pack: '/rarepack.png',
  icon_pack: '/iconpack.png',
  hero_pack: '/heropack.png',
}

function BuyPacksTab({ packs, coins, onBuy, loading }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 16 }}>
        {Object.entries(packs).map(([key, info]) => {
          const canAfford = coins >= info.cost
          const img = PACK_IMAGES[key]
          return (
            <div key={key} className="anim-fadeUp" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
              background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '24px 16px 16px',
              border: `1px solid ${canAfford ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.06)'}`,
            }}>
              <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {img
                  ? <img src={img} alt={info.display_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', opacity: canAfford ? 1 : 0.45 }} />
                  : <div style={{ fontSize: 64, opacity: 0.4 }}>💎</div>
                }
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{info.display_name}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: canAfford ? 'var(--gold)' : 'var(--red)' }}>🪙 {info.cost.toLocaleString()}</div>
              </div>
              <button disabled={!canAfford || loading} onClick={() => onBuy(key)} style={{
                width: '100%',
                background: canAfford ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#2a2a2a',
                border: 'none', borderRadius: 10, color: canAfford ? '#fff' : '#555',
                padding: '12px 0', cursor: canAfford ? 'pointer' : 'not-allowed',
                fontSize: 14, fontWeight: 800,
                boxShadow: canAfford ? '0 4px 20px rgba(168,85,247,0.35)' : 'none',
              }}>BUY</button>
            </div>
          )
        })}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
        Earn coins by winning battles (+200) or losing (+100)
      </div>
    </div>
  )
}

// ── SELL CARDS TAB ────────────────────────────────────────────────────────────

function SellCardsTab({ collection, onSell }) {
  const [selected, setSelected] = useState(null)

  if (collection.length === 0) return (
    <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No cards to sell.</p>
  )

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
        {collection.map((card, i) => {
          const value = calcValue(card)
          return (
            <div key={i} onClick={() => setSelected(card)} style={{ cursor: 'pointer' }}>
              <FutCard card={card} selected={selected?.card_id === card.card_id} />
              <div style={{ textAlign: 'center', marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>🪙 {value}</div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
        }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{
            background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '20px 20px 40px',
            width: '100%', maxWidth: 480, border: '1px solid var(--border)',
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ width: 80, flexShrink: 0 }}><FutCard card={selected} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                {selected.card_rarity} · {selected.card_type} · {selected.overall} OVR
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>
                Sell for 🪙 {calcValue(selected).toLocaleString()} coins
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { onSell(selected); setSelected(null) }}
                  style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                  Confirm Sale
                </button>
                <button onClick={() => setSelected(null)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '10px', cursor: 'pointer', fontSize: 14 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function calcValue(card) {
  const type = (card.card_type || '').toLowerCase()
  let value = type.includes('icon') ? 250 : type.includes('hero') ? 175 : 100
  if (card.overall >= 70) value += 50 + (card.overall - 70) * 5
  return value
}
