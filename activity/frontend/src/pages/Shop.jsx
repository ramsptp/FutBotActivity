import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'
import PageHelp from '../components/PageHelp'
import PageTip from '../components/PageTip'
import { QuickRevealInner } from './Packs'

const TABS = ['Daily', 'Trade Up', 'Buy Packs', 'Sell Cards']

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

  async function batchSell(cards) {
    try {
      const items = cards.map(c => ({ card_id: c.card_id, edition: c.edition ?? null }))
      const res = await apiFetch('/api/shop/sell/batch', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      setCoins(res.coins)
      const soldKeys = new Set(cards.map(c => `${c.card_id}-${c.edition ?? 'null'}`))
      setCollection(col => col.filter(c => !soldKeys.has(`${c.card_id}-${c.edition ?? 'null'}`)))
      showToast(`Sold ${res.count} card${res.count !== 1 ? 's' : ''} for 🪙 ${res.coins_earned.toLocaleString()} coins`)
    } catch (e) {
      showToast(e.message || 'Could not sell cards', false)
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
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Shop</h2>
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
      {tab === 'Trade Up'   && <TradeUpTab token={token} showToast={showToast} />}
      {tab === 'Buy Packs'  && <BuyPacksTab packs={packs} coins={coins} onBuy={buyPack} loading={loading} />}
      {tab === 'Sell Cards' && <SellCardsTab collection={collection} onBatchSell={batchSell} token={token} />}
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

// ── TRADE UP TAB ──────────────────────────────────────────────────────────────

const TIER_META = {
  common:   { label: 'Common',        reward: 'Uncommon',         color: '#94a3b8', emoji: '⚪', gradient: 'linear-gradient(135deg, #94a3b8, #c8a840)' },
  uncommon: { label: 'Uncommon',      reward: 'Rare',             color: '#f0c040', emoji: '🟡', gradient: 'linear-gradient(135deg, #7a5c00, #f0c040)' },
  rare:     { label: 'Rare Standard', reward: 'Hero / Icon ≤93', color: '#ffd700', emoji: '✨', gradient: 'linear-gradient(135deg, #f0c040, #fff8e0, #ffb6d9)' },
}

const ODDS_ROWS = [
  ['Rare Standard 86–89 OVR', '~67%', '#94a3b8'],
  ['Rare Standard 90+ OVR',   '~24%', '#f0c040'],
  ['Hero (any OVR)',            '~6%', '#a78bfa'],
  ['Icon (any OVR)',            '~2%', '#fbbf24'],
]

function TradeUpTab({ token, showToast }) {
  const [tier, setTier]         = useState(null)
  const [eligible, setEligible] = useState([])
  const [selected, setSelected] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [confirming, setConfirming]     = useState(false)
  const [trading, setTrading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [animDone, setAnimDone] = useState(false)

  async function pickTier(t) {
    setTier(t); setSelected([]); setResult(null); setAnimDone(false); setLoadingCards(true)
    const data = await apiFetch(`/api/shop/tradeup/${t}`, token)
    setEligible(data); setLoadingCards(false)
  }

  function toggleCard(card) {
    const match = s => s.inv_id === card.inv_id
    if (selected.some(match)) {
      setSelected(s => s.filter(x => !match(x)))
    } else {
      if (selected.length >= 5) return
      setSelected(s => [...s, { inv_id: card.inv_id, card_id: card.card_id }])
    }
  }

  async function doTradeUp() {
    setConfirming(false); setTrading(true)
    try {
      const res = await apiFetch('/api/shop/tradeup', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, selections: selected.map(s => ({ inv_id: s.inv_id })) }),
      })
      setResult(res.card)
      // Remove sacrificed cards from eligible list
      const sacrificed = selected.slice()
      setEligible(e => e.filter(c => !sacrificed.some(s => s.card_id === c.card_id && s.edition === c.edition)))
      setSelected([])
    } catch (e) {
      showToast(e.message || 'Trade up failed', false)
    }
    setTrading(false)
  }

  // ── Full animation for 86+ OVR result ──
  if (result && result.overall >= 86 && !animDone) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#050914', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, overflow: 'hidden', zIndex: 200 }}>
        <button onClick={() => setAnimDone(true)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, color: 'rgba(255,255,255,0.5)', padding: '5px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer', zIndex: 50 }}>
          Skip →
        </button>
        <QuickRevealInner card={result} packImg={null} packLabel="Trade Up" onDone={() => setAnimDone(true)} openingPack="tradeup" onStarterDone={null} tutorialStep={0} onTutorialAdvance={null} />
      </div>
    )
  }

  // ── Result summary screen ──
  if (result) {
    const rarityColor = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }[result.card_rarity] || '#fff'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', letterSpacing: 3, textTransform: 'uppercase' }}>✨ Trade Up Complete!</div>
        <div style={{ width: 200, position: 'relative' }} className="anim-fadeUp">
          <FutCard card={result} />
          {result.already_owned && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)', color: '#94a3b8', fontSize: 9, fontWeight: 700, textAlign: 'center', padding: '4px 0 3px', letterSpacing: 1.5, textTransform: 'uppercase', borderRadius: '0 0 10px 10px', pointerEvents: 'none' }}>
              Already Owned
            </div>
          )}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 1 }}>{result.name}</div>
          <div style={{ fontSize: 12, color: rarityColor, fontWeight: 600, marginBottom: 2 }}>{result.card_rarity} · {result.card_type}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Edition #{(result.edition ?? 0) + 1}</div>
        </div>
        {/* OVR big + PAC ATT DEF in one compact row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#f0c040', lineHeight: 1, filter: 'drop-shadow(0 0 12px rgba(240,192,64,0.55))' }}>{result.overall}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 3 }}>OVR</div>
          </div>
          <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
          {[['PAC', result.speed, '#22c55e'], ['ATT', result.attack, '#ef4444'], ['DEF', result.defense, '#3b82f6']].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: c }}>{v}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 4 }}>
          <button onClick={() => pickTier(tier)} className="btn-primary" style={{ flex: 1 }}>Trade Again</button>
          <button onClick={() => { setResult(null); setTier(null) }}
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', padding: '12px', cursor: 'pointer', fontSize: 14 }}>
            Done
          </button>
        </div>
      </div>
    )
  }

  // ── Tier picker ──
  if (!tier) {
    return (
      <div>
        <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Select trade tier</div>
        <style>{`
          @keyframes tierShine {
            0%   { transform: translateX(-120%) skewX(-20deg); }
            100% { transform: translateX(350%)  skewX(-20deg); }
          }
          .tier-card { position: relative; cursor: pointer; }
          .tier-card:hover .tier-shine { animation: tierShine 0.75s ease forwards; }
          .tier-card:active { transform: scale(0.98); }
        `}</style>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {[
            {
              key: 'common',
              border: 'linear-gradient(120deg, #8ca0b4 0%, #bdc8d4 30%, #c9a84c 70%, #e2c97e 100%)',
              bg:    'linear-gradient(120deg, #0b1520 0%, #0f1c2e 60%, #111a26 100%)',
              glow:  'rgba(180,155,80,0.28)',
              c1: '#9cb0c4', c2: '#d4a840',
              aura: 'rgba(180,155,80,0.12)',
              label: 'Common', reward: 'Uncommon',
              desc: 'Random Uncommon card',
              pip: '◆◆◇◇◇',
            },
            {
              key: 'uncommon',
              border: 'linear-gradient(120deg, #6b4a00 0%, #b07c10 35%, #f0c040 75%, #ffe080 100%)',
              bg:    'linear-gradient(120deg, #0e1100 0%, #141500 50%, #191600 100%)',
              glow:  'rgba(240,192,64,0.35)',
              c1: '#b07c10', c2: '#f0c040',
              aura: 'rgba(240,192,64,0.1)',
              label: 'Uncommon', reward: 'Rare',
              desc: 'Weighted: Rare 80% · Hero 10% · Icon 6%',
              pip: '◆◆◆◆◇',
            },
            {
              key: 'rare',
              border: 'linear-gradient(120deg, #d4a020 0%, #f8e060 25%, #ffffff 55%, #ffc8dc 80%, #ffaacc 100%)',
              bg:    'linear-gradient(120deg, #150f00 0%, #1a1510 40%, #1a0f18 100%)',
              glow:  'rgba(255,200,220,0.4)',
              c1: '#f0c040', c2: '#ffb6d4',
              aura: 'rgba(255,200,220,0.1)',
              label: 'Rare Standard', reward: 'Hero / Icon',
              desc: 'Hero or Icon — OVR ≤ 93 only',
              pip: '◆◆◆◆◆',
            },
          ].map((t, idx) => (
            <div
              key={t.key}
              className="tier-card"
              onClick={() => pickTier(t.key)}
              style={{
                background: t.border,
                borderRadius: 18,
                padding: '1.5px',
                boxShadow: `0 6px 28px ${t.glow}, 0 1px 0 rgba(255,255,255,0.04) inset`,
                animation: `dealIn 0.4s cubic-bezier(0.34,1.3,0.64,1) ${idx * 0.08}s both`,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
            >
              <div style={{
                background: t.bg,
                borderRadius: 16.5,
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Ambient aura right side */}
                <div style={{ position:'absolute', top:0, right:0, bottom:0, width:'45%', background:`linear-gradient(to left, ${t.aura}, transparent)`, pointerEvents:'none' }} />
                {/* Diagonal shine element */}
                <div className="tier-shine" style={{ position:'absolute', top:'-50%', left:'-60%', width:'35%', height:'200%', background:`linear-gradient(to right, transparent, rgba(255,255,255,0.14), transparent)`, transform:'translateX(-120%) skewX(-20deg)', pointerEvents:'none' }} />

                {/* Exchange numerals */}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, minWidth:72 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:30, fontWeight:900, lineHeight:1, fontFamily:"'Montserrat',sans-serif", background:`linear-gradient(180deg,${t.c1},${t.c1}88)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>5</div>
                    <div style={{ fontSize:8, color:`${t.c1}88`, letterSpacing:1.5, textTransform:'uppercase', marginTop:2 }}>cards</div>
                  </div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.2)', fontWeight:300 }}>→</div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:30, fontWeight:900, lineHeight:1, fontFamily:"'Montserrat',sans-serif", background:`linear-gradient(180deg,${t.c2},${t.c2}88)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>1</div>
                    <div style={{ fontSize:8, color:`${t.c2}88`, letterSpacing:1.5, textTransform:'uppercase', marginTop:2 }}>card</div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width:1, height:44, background:'rgba(255,255,255,0.07)', flexShrink:0 }} />

                {/* Text */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#fff', fontFamily:"'Montserrat',sans-serif", marginBottom:5, letterSpacing:0.2 }}>
                    {t.label} <span style={{ color:'rgba(255,255,255,0.25)', fontWeight:300 }}>→</span> {t.reward}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.38)', lineHeight:1.4 }}>{t.desc}</div>
                  <div style={{ marginTop:7, letterSpacing:3, fontSize:9, background:`linear-gradient(90deg,${t.c1},${t.c2})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>{t.pip}</div>
                </div>

                <div style={{ color:'rgba(255,255,255,0.18)', fontSize:18, flexShrink:0 }}>›</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Uncommon trade-up odds</div>
        <div style={{ background: '#0f1729', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          {ODDS_ROWS.map(([label, pct, color], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < ODDS_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontSize: 13, color: '#cbd5e1' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Card selection ──
  const meta = TIER_META[tier]
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => { setTier(null); setSelected([]) }} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, color: 'var(--muted)', padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{meta.label} Trade Up</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>5 {meta.label} → 1 {meta.reward}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: selected.length === 5 ? '#22c55e' : '#fff' }}>
          {selected.length} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>/ 5</span>
        </div>
      </div>

      {loadingCards ? (
        <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 20 }}>Loading…</p>
      ) : eligible.length < 5 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>😞</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Not enough cards</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>You need 5 {meta.label} cards. You have {eligible.length}.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, paddingBottom: 80 }}>
          {eligible.map(card => {
            const isSelected = selected.some(s => s.inv_id === card.inv_id)
            const isDisabled = !isSelected && selected.length >= 5
            return (
              <div key={card.inv_id}
                onClick={() => !isDisabled && toggleCard(card)}
                style={{ cursor: isDisabled ? 'default' : 'pointer', opacity: isDisabled ? 0.3 : 1, transition: 'opacity 0.15s' }}
              >
                <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `2px solid ${isSelected ? '#22c55e' : 'transparent'}`, transition: 'border-color 0.15s' }}>
                  <FutCard card={card} />
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 4, right: 4, background: '#22c55e', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff' }}>✓</div>
                  )}
                </div>
                <div style={{ textAlign: 'center', marginTop: 3, fontSize: 10, color: 'var(--muted)' }}>
                  #{card.edition} · {card.overall} OVR
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected.length === 5 && !confirming && (
        <div style={{ position: 'fixed', bottom: 70, left: 0, right: 0, padding: '12px 16px', background: 'linear-gradient(to top, rgba(5,9,20,1) 60%, transparent)', zIndex: 10 }}>
          <button onClick={() => setConfirming(true)} style={{ width: '100%', background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 12, color: '#fff', padding: '14px 0', cursor: 'pointer', fontSize: 15, fontWeight: 800, boxShadow: '0 4px 24px rgba(168,85,247,0.4)' }}>
            Trade Up →
          </button>
        </div>
      )}

      {confirming && (
        <div onClick={() => setConfirming(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Confirm Trade Up</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Sacrifice these 5 cards for a random {meta.reward}? This cannot be undone.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {selected.map(s => {
                const card = eligible.find(c => c.inv_id === s.inv_id)
                if (!card) return null
                return (
                  <div key={s.inv_id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ width: 36, flexShrink: 0 }}><FutCard card={card} /></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{card.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Edition #{card.edition} · {card.overall} OVR</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doTradeUp} disabled={trading} style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                {trading ? 'Trading…' : 'Confirm'}
              </button>
              <button onClick={() => setConfirming(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', padding: '12px', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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

function SellCardsTab({ collection, onBatchSell, token }) {
  const [selected, setSelected]     = useState([])
  const [confirming, setConfirming] = useState(false)
  const [deckCardIds, setDeckCardIds] = useState(new Set())
  const [dupeOnly, setDupeOnly]     = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const page = containerRef.current?.closest?.('.page')
    if (page) page.scrollTop = 0
  }, [dupeOnly])

  useEffect(() => {
    apiFetch('/api/decks', token).then(decks => {
      const ids = new Set()
      decks.forEach(deck => deck.cards.forEach(card => {
        ids.add(card.edition != null ? `${card.card_id}:${card.edition}` : `${card.card_id}:*`)
      }))
      setDeckCardIds(ids)
    }).catch(() => {})
  }, [])

  const cardKey = c => `${c.card_id}-${c.edition ?? 'null'}`

  const toggle = card => {
    const key = cardKey(card)
    if (selected.some(c => cardKey(c) === key)) {
      setSelected(s => s.filter(c => cardKey(c) !== key))
    } else {
      setSelected(s => [...s, card])
    }
  }

  // Build duplicate list: for each card_id group, exclude the lowest edition (original)
  const dupeCards = (() => {
    const groups = {}
    collection.forEach(c => { (groups[c.card_id] = groups[c.card_id] || []).push(c) })
    const extras = []
    Object.values(groups).forEach(group => {
      if (group.length < 2) return
      const sorted = [...group].sort((a, b) => (a.edition ?? 0) - (b.edition ?? 0))
      extras.push(...sorted.slice(1))
    })
    return extras
  })()

  const displayCards = dupeOnly ? dupeCards : [...collection].sort((a, b) => (b.overall || 0) - (a.overall || 0))
  const dupeCount = dupeCards.length

  const totalValue = selected.reduce((sum, c) => sum + calcValue(c), 0)
  const isSelected = card => selected.some(c => cardKey(c) === cardKey(card))

  function selectAllDupes() {
    setSelected(dupeCards)
  }

  if (collection.length === 0) return (
    <p style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>No cards to sell.</p>
  )

  return (
    <div ref={containerRef}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase' }}>
          {dupeOnly ? `${dupeCount} duplicate${dupeCount !== 1 ? 's' : ''}` : `${collection.length} cards`}
        </div>
        {dupeCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dupeOnly && dupeCount > 0 && selected.length < dupeCount && (
              <button onClick={selectAllDupes} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 20, padding: '5px 10px', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: '#ef4444' }}>
                Select All
              </button>
            )}
            <button onClick={() => { setDupeOnly(d => !d); setSelected([]) }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: dupeOnly ? 'rgba(240,192,64,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${dupeOnly ? 'rgba(240,192,64,0.5)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              color: dupeOnly ? '#f0c040' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 10 }}>⚡</span>
              Dupes only
              <span style={{
                background: dupeOnly ? '#f0c040' : 'rgba(255,255,255,0.12)',
                color: dupeOnly ? '#000' : 'rgba(255,255,255,0.5)',
                borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800,
              }}>{dupeCount}</span>
            </button>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a0f1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{selected.length} card{selected.length !== 1 ? 's' : ''} selected</span>
            <span style={{ fontSize: 13, color: 'var(--gold)', fontWeight: 700, marginLeft: 10 }}>🪙 {totalValue.toLocaleString()}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected([])} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--muted)', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>Clear</button>
            <button onClick={() => setConfirming(true)} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Sell All</button>
          </div>
        </div>
      )}

      {dupeOnly && dupeCards.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 50 }}>
          <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>✨</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>No duplicate cards</div>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, paddingBottom: 20 }}>
        {displayCards.map((card, i) => {
          const sel = isSelected(card)
          const value = calcValue(card)
          const inDeck = deckCardIds.has(card.edition != null ? `${card.card_id}:${card.edition}` : `${card.card_id}:*`) || deckCardIds.has(`${card.card_id}:*`)
          return (
            <div key={`${card.card_id}-${card.edition ?? i}`} onClick={() => toggle(card)} style={{ cursor: 'pointer' }}>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `2px solid ${sel ? '#ef4444' : 'transparent'}`, transition: 'border-color 0.15s' }}>
                <FutCard card={card} />
                {/* Edition badge — top right */}
                <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', borderRadius: 6, padding: '2px 5px', fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: 0.5, lineHeight: 1.4 }}>
                  {card.edition != null ? `#${card.edition}` : '—'}<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/{card.copies ?? '?'}</span>
                </div>
                {/* Selected checkmark or DECK badge — top left */}
                {sel ? (
                  <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: '#ef4444', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#fff' }}>✓</div>
                ) : inDeck ? (
                  <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 2, background: 'rgba(168,85,247,0.9)', borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: 0.5, lineHeight: 1.3 }}>DECK</div>
                ) : null}
              </div>
              <div style={{ textAlign: 'center', marginTop: 3, fontSize: 11, color: sel ? 'var(--gold)' : 'var(--muted)', fontWeight: sel ? 700 : 400 }}>🪙 {value}</div>
            </div>
          )
        })}
      </div>
      )}

      {confirming && (
        <div onClick={() => setConfirming(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 44px', width: '100%', maxWidth: 480, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Sell {selected.length} card{selected.length !== 1 ? 's' : ''}?</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>You'll receive <span style={{ color: 'var(--gold)', fontWeight: 700 }}>🪙 {totalValue.toLocaleString()} coins</span>. This cannot be undone.</div>
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {selected.map((card, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '7px 12px' }}>
                  <div style={{ width: 32, flexShrink: 0 }}><FutCard card={card} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{card.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{card.card_rarity} · {card.overall} OVR{card.edition != null ? ` · Ed #${card.edition}` : ''}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>🪙 {calcValue(card)}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { onBatchSell(selected); setConfirming(false); setSelected([]) }}
                style={{ flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: 10, color: '#fff', padding: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                Confirm Sale
              </button>
              <button onClick={() => setConfirming(false)}
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', padding: '12px', cursor: 'pointer', fontSize: 14 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function calcValue(card) {
  const type = (card.card_type || '').toLowerCase()
  let value = type.includes('icon') ? 250 : type.includes('hero') ? 175 : 100
  if (card.overall >= 70) value += 50 + (card.overall - 70) * 5
  return value
}
