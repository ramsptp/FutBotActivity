import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'
import PageHelp from '../components/PageHelp'
import PageTip from '../components/PageTip'

const TABS = ['Buy Packs', 'Sell Cards']

export default function Shop({ token }) {
  const [tab, setTab]       = useState('Buy Packs')
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
    setTimeout(() => setToast(null), 2500)
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
      {/* Toast */}
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

      {/* Coin balance */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>🛒 Shop</h2>
          <PageHelp page="shop" />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
          🪙 {coins?.toLocaleString() ?? '…'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 18, background: 'var(--surface)', borderRadius: 10, padding: 4, border: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: tab === t ? 'var(--accent)' : 'transparent',
            color: tab === t ? '#fff' : 'var(--muted)',
            transition: 'all 0.15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'Buy Packs' && (
        <BuyPacksTab packs={packs} coins={coins} onBuy={buyPack} loading={loading} />
      )}
      {tab === 'Sell Cards' && (
        <SellCardsTab collection={collection} onSell={sellCard} />
      )}
    </div>
  )
}

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
              {/* Fixed-height image container so all packs are uniform */}
              <div style={{ width: '100%', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {img
                  ? <img src={img} alt={info.display_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', opacity: canAfford ? 1 : 0.45 }} />
                  : <div style={{ fontSize: 64, opacity: 0.4 }}>💎</div>
                }
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{info.display_name}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: canAfford ? 'var(--gold)' : 'var(--red)' }}>🪙 {info.cost.toLocaleString()} coins</div>
              </div>
              <button
                disabled={!canAfford || loading}
                onClick={() => onBuy(key)}
                style={{
                  width: '100%',
                  background: canAfford ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : '#2a2a2a',
                  border: 'none', borderRadius: 10, color: canAfford ? '#fff' : '#555',
                  padding: '12px 0', cursor: canAfford ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 800, letterSpacing: '0.05em',
                  boxShadow: canAfford ? '0 4px 20px rgba(168,85,247,0.35)' : 'none',
                }}
              >
                BUY
            </button>
          </div>
        )
      })}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--muted)', textAlign: 'center', marginTop: 4 }}>
        Earn coins by winning battles (+200) or losing (+100)
      </div>
    </div>
  )
}

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
              <div style={{ textAlign: 'center', marginTop: 4, fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                🪙 {value}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: '0 16px 80px',
        }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{
            background: 'var(--surface)', borderRadius: 16, padding: 20,
            width: '100%', maxWidth: 400, border: '1px solid var(--border)',
            display: 'flex', gap: 16, alignItems: 'center',
          }}>
            <div style={{ width: 80, flexShrink: 0 }}>
              <FutCard card={selected} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                {selected.card_rarity} · {selected.card_type} · {selected.overall} OVR
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>
                Sell for 🪙 {calcValue(selected).toLocaleString()} coins
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { onSell(selected); setSelected(null) }}
                  style={{ flex: 1, background: 'var(--green)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
                >
                  Confirm Sale
                </button>
                <button
                  onClick={() => setSelected(null)}
                  style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', padding: '10px', cursor: 'pointer', fontSize: 14 }}
                >
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
