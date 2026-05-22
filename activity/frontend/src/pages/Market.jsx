import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import FutCard from '../components/FutCard'
import PageHelp from '../components/PageHelp'

const RARITY_COLOR = { Common: '#94a3b8', Uncommon: '#22c55e', Rare: '#f0c040' }
const DURATIONS = ['1h', '3h', '6h', '12h', '24h', '48h']

function secsLeft(expiresAt) {
  try {
    const diff = new Date(String(expiresAt).replace(' ', 'T') + 'Z') - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  } catch { return 0 }
}

function fmtTime(s) {
  if (s <= 0) return 'Expired'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function urgency(s) {
  if (s <= 3600)  return { color: '#ef4444', pulse: true }
  if (s <= 10800) return { color: '#f97316', pulse: false }
  return { color: '#4ade80', pulse: false }
}

function calcMinPrice(card) {
  const t = (card.card_type || '').toLowerCase()
  let v = t.includes('icon') ? 250 : t.includes('hero') ? 175 : 100
  if (card.overall >= 70) v += 50 + (card.overall - 70) * 5
  return v
}

// ── LISTING CARD (browse grid) ───────────────────────────────────────────────

function ListingCard({ listing, onBuy, buying, onSelect }) {
  const [secs, setSecs] = useState(() => listing.seconds_left)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const rc   = RARITY_COLOR[listing.card_rarity] || '#f0c040'
  const urg  = urgency(secs)
  const pct  = Math.min(100, (secs / (48 * 3600)) * 100)
  const dead = secs <= 0

  return (
    <div onClick={onSelect} style={{
      background: 'linear-gradient(160deg, #0d1524 0%, #0a1020 100%)',
      border: `1px solid ${rc}2a`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: `0 4px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)`,
      animation: 'mktIn 0.35s cubic-bezier(0.34,1.3,0.64,1) both',
      cursor: 'pointer',
    }}>
      {/* Rarity accent */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${rc}cc 0%, ${rc}22 100%)` }} />

      <div style={{ padding: '11px 11px 10px', display: 'flex', gap: 9 }}>
        {/* Card image */}
        <div style={{ width: 68, flexShrink: 0, filter: dead ? 'grayscale(0.6) opacity(0.5)' : 'none' }}>
          <FutCard card={listing} />
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#e2e8f0', fontFamily: "'Montserrat',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {listing.name}
          </div>
          <div style={{ fontSize: 10, color: rc, fontWeight: 600, letterSpacing: 0.3 }}>
            {listing.card_rarity} · Ed #{listing.edition ?? '?'}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>
            {listing.seller_name}
          </div>

          {/* Price row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#f0c040', fontFamily: "'Montserrat',sans-serif", letterSpacing: -0.5 }}>
              🪙{listing.price.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: urg.color, animation: urg.pulse ? 'urgPulse 0.9s ease infinite' : 'none', letterSpacing: 0.3 }}>
              {fmtTime(secs)}
            </div>
          </div>

          {/* Timer bar */}
          <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: urg.color, borderRadius: 1, transition: 'width 1s linear, background 1s' }} />
          </div>

          {/* Action */}
          {listing.is_mine ? (
            <div style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,0.22)', fontWeight: 700, letterSpacing: 1.5, paddingTop: 4, textTransform: 'uppercase' }}>
              Your Listing
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); !dead && onBuy(listing) }}
              disabled={buying === listing.listing_id || dead}
              style={{
                marginTop: 2, width: '100%',
                background: dead ? '#111827' : buying === listing.listing_id ? 'rgba(168,85,247,0.4)' : 'linear-gradient(135deg,#6d28d9,#a855f7)',
                border: 'none', borderRadius: 7, color: dead ? '#374151' : '#fff',
                padding: '6px 0', fontSize: 11, fontWeight: 800, cursor: dead ? 'default' : 'pointer',
                fontFamily: "'Montserrat',sans-serif", letterSpacing: 0.5,
                boxShadow: dead ? 'none' : '0 2px 10px rgba(168,85,247,0.3)',
                transition: 'all 0.15s',
              }}>
              {buying === listing.listing_id ? '…' : dead ? 'Expired' : 'Buy Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── LISTING DETAIL MODAL ──────────────────────────────────────────────────────

function ListingDetailModal({ listing, onClose, onBuy, buying }) {
  const [secs, setSecs] = useState(() => listing.seconds_left)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const rc = RARITY_COLOR[listing.card_rarity] || '#f0c040'
  const urg = urgency(secs)
  const glowColor = rc === '#f0c040'
    ? 'rgba(240,192,64,0.55)'
    : rc === '#22c55e'
    ? 'rgba(34,197,94,0.55)'
    : 'rgba(148,163,184,0.45)'

  const metaRows = [
    listing.position && ['Position', listing.position],
    listing.club     && ['Club',     listing.club],
    listing.league   && ['League',   listing.league],
    listing.nation   && ['Nation',   listing.nation],
  ].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '0 16px' }}>
      <div className="anim-fadeUp" style={{
        background: '#0a1020', border: `1px solid ${rc}33`,
        borderRadius: 20, padding: '22px 18px',
        width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Card image with glow */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ width: 170, filter: `drop-shadow(0 0 22px ${glowColor}) drop-shadow(0 0 50px ${glowColor.replace('0.55', '0.25')})` }}>
            <FutCard card={listing} />
          </div>
        </div>

        {/* Name + rarity */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif", letterSpacing: -0.3 }}>{listing.name}</div>
          <div style={{ fontSize: 12, color: rc, marginTop: 3, fontWeight: 600 }}>{listing.card_rarity} · {listing.card_type}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 2 }}>Ed #{listing.edition ?? '?'} · {listing.copies ?? '?'} copies</div>
        </div>

        {/* Stats row: OVR big + ATK DEF SPD */}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginBottom: 14 }}>
          {[
            { label: 'OVR', value: listing.overall, big: true },
            { label: 'ATK', value: listing.attack },
            { label: 'DEF', value: listing.defense },
            { label: 'SPD', value: listing.speed },
          ].map(s => (
            <div key={s.label} style={{
              textAlign: 'center', background: '#0d1524', borderRadius: 10,
              padding: s.big ? '8px 18px' : '8px 12px',
              border: `1px solid ${s.big ? rc + '55' : 'rgba(255,255,255,0.07)'}`,
              minWidth: s.big ? 56 : 44,
            }}>
              <div style={{ fontSize: s.big ? 22 : 16, fontWeight: 900, color: s.big ? rc : '#e2e8f0', fontFamily: "'Montserrat',sans-serif", lineHeight: 1 }}>{s.value ?? '–'}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Meta (position/club/league/nation) */}
        {metaRows.length > 0 && (
          <div style={{ background: '#0d1524', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
            {metaRows.map(([label, value], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 14px', borderBottom: i < metaRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Seller / price / time */}
        <div style={{ background: '#0d1524', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
          {[
            ['Seller', listing.seller_name, '#e2e8f0'],
            ['Price',  `🪙 ${listing.price.toLocaleString()}`, '#f0c040'],
            ['Time Left', fmtTime(secs), urg.color],
          ].map(([label, value, color], i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{label}</span>
              <span style={{ fontSize: label === 'Price' ? 15 : 12, fontWeight: 700, color, fontFamily: label === 'Price' ? "'Montserrat',sans-serif" : undefined }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', padding: '13px', fontSize: 14, cursor: 'pointer' }}>
            Close
          </button>
          {listing.is_mine ? (
            <div style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Your Listing
            </div>
          ) : (
            <button
              onClick={() => onBuy(listing)}
              disabled={buying === listing.listing_id || secs <= 0}
              style={{
                flex: 2, border: 'none', borderRadius: 12, color: secs <= 0 ? '#374151' : '#fff',
                padding: '13px', fontSize: 13, fontWeight: 800, cursor: secs <= 0 ? 'default' : 'pointer',
                background: secs <= 0 ? '#111827' : buying === listing.listing_id ? 'rgba(168,85,247,0.4)' : 'linear-gradient(135deg,#6d28d9,#a855f7)',
                boxShadow: secs <= 0 ? 'none' : '0 4px 24px rgba(168,85,247,0.4)',
                fontFamily: "'Montserrat',sans-serif",
              }}>
              {buying === listing.listing_id ? '…' : secs <= 0 ? 'Expired' : `Buy — 🪙${listing.price.toLocaleString()}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── BROWSE TAB ────────────────────────────────────────────────────────────────

function BrowseTab({ token, coins, onCoinsChange, showToast }) {
  const [search, setSearch]               = useState('')
  const [page, setPage]                   = useState(0)
  const [data, setData]                   = useState(null)
  const [loading, setLoading]             = useState(true)
  const [buying, setBuying]               = useState(null)
  const [purchased, setPurchased]         = useState(null)
  const [selectedListing, setSelectedListing] = useState(null)

  useEffect(() => { load() }, [page])

  async function load() {
    setLoading(true)
    const p = new URLSearchParams({ page })
    if (search) p.set('search', search)
    const res = await apiFetch(`/api/market?${p}`, token)
    setData(res)
    setLoading(false)
  }

  async function handleBuy(listing) {
    setBuying(listing.listing_id)
    try {
      const res = await apiFetch(`/api/market/buy/${listing.listing_id}`, token, { method: 'POST' })
      onCoinsChange?.(res.coins)
      setData(d => d ? { ...d, listings: d.listings.filter(l => l.listing_id !== listing.listing_id) } : d)
      setSelectedListing(null)
      setPurchased(res.card ?? listing)
    } catch (e) {
      showToast(e.message || 'Purchase failed', false)
    }
    setBuying(null)
  }

  return (
    <div>
      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, pointerEvents: 'none' }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { setPage(0); load() } }}
          placeholder="Search players…"
          style={{
            width: '100%', background: '#0d1524', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 10, color: '#e2e8f0', padding: '10px 36px',
            fontSize: 13, outline: 'none', boxSizing: 'border-box',
            fontFamily: "'Montserrat',sans-serif",
          }}
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(0); setTimeout(load, 50) }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 50, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading market…</div>
      ) : !data?.listings?.length ? (
        <div style={{ textAlign: 'center', paddingTop: 56 }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>🏪</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>No listings found</div>
          {search && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>Try a different search</div>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
            {data.total} listing{data.total !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 16 }}>
            {data.listings.map((l, i) => (
              <div key={l.listing_id} style={{ animationDelay: `${i * 0.04}s` }}>
                <ListingCard listing={l} onBuy={handleBuy} buying={buying} onSelect={() => setSelectedListing(l)} />
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: page > 0 ? 'rgba(168,85,247,0.12)' : 'transparent', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: page > 0 ? '#a855f7' : '#2d3748', padding: '6px 16px', cursor: page > 0 ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}>← Prev</button>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{page + 1} / {data.pages}</span>
              <button disabled={page >= data.pages - 1} onClick={() => setPage(p => p + 1)} style={{ background: page < data.pages - 1 ? 'rgba(168,85,247,0.12)' : 'transparent', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 8, color: page < data.pages - 1 ? '#a855f7' : '#2d3748', padding: '6px 16px', cursor: page < data.pages - 1 ? 'pointer' : 'default', fontSize: 12, fontWeight: 600 }}>Next →</button>
            </div>
          )}
        </>
      )}

      {/* Listing detail modal */}
      {selectedListing && (
        <ListingDetailModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onBuy={handleBuy}
          buying={buying}
        />
      )}

      {/* Purchased card reveal */}
      {purchased && <PurchasedCard card={purchased} onClose={() => setPurchased(null)} />}
    </div>
  )
}

function PurchasedCard({ card, onClose }) {
  const rc = RARITY_COLOR[card.card_rarity] || '#f0c040'
  const glowColor = rc === '#f0c040'
    ? 'rgba(240,192,64,0.85)'
    : rc === '#22c55e'
    ? 'rgba(34,197,94,0.85)'
    : 'rgba(148,163,184,0.7)'
  const glow = `drop-shadow(0 0 22px ${glowColor}) drop-shadow(0 0 55px ${glowColor.replace('0.85', '0.35')})`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, zIndex: 300, padding: 24 }}>
      <style>{`
        @keyframes buyReveal {
          0%   { opacity:0; transform:scale(0.7) translateY(30px); }
          65%  { opacity:1; transform:scale(1.07) translateY(-6px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes buyGlowPulse {
          0%,100% { filter:${glow}; }
          50%     { filter:${glow.replace(/0\.85/g,'1').replace(/0\.35/g,'0.6')}; }
        }
      `}</style>

      <div style={{ fontSize: 11, fontWeight: 700, color: rc, letterSpacing: 3, textTransform: 'uppercase' }}>✓ Card Purchased</div>

      <div style={{ width: 200, animation: 'buyReveal 0.55s cubic-bezier(0.34,1.3,0.64,1) both' }}>
        <div style={{ animation: 'buyGlowPulse 2.4s ease 0.55s infinite', filter: glow }}>
          <FutCard card={card} />
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 3, fontFamily: "'Montserrat',sans-serif" }}>{card.name}</div>
        <div style={{ fontSize: 13, color: rc, fontWeight: 600, marginBottom: 4 }}>{card.card_rarity} · {card.card_type}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{card.overall} OVR</div>
      </div>

      <button onClick={onClose} style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 12, color: '#fff', padding: '12px 40px', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(168,85,247,0.4)', fontFamily: "'Montserrat',sans-serif" }}>
        Nice! 🎉
      </button>
    </div>
  )
}

// ── MY LISTINGS TAB ───────────────────────────────────────────────────────────

function MyListingRow({ listing, onCancel, cancelling }) {
  const [secs, setSecs] = useState(() => listing.seconds_left)
  useEffect(() => {
    const t = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  const rc  = RARITY_COLOR[listing.card_rarity] || '#f0c040'
  const urg = urgency(secs)

  return (
    <div style={{ background: 'linear-gradient(160deg,#0d1524,#0a1020)', border: `1px solid ${rc}2a`, borderRadius: 14, overflow: 'hidden', animation: 'mktIn 0.35s ease both' }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, ${rc}cc, ${rc}22)` }} />
      <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ width: 58, flexShrink: 0 }}><FutCard card={listing} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', marginBottom: 2, fontFamily: "'Montserrat',sans-serif" }}>{listing.name}</div>
          <div style={{ fontSize: 11, color: rc, marginBottom: 6 }}>Ed #{listing.edition ?? '?'} · {listing.card_rarity} · {listing.overall} OVR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#f0c040', fontFamily: "'Montserrat',sans-serif" }}>🪙{listing.price.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: urg.color, fontWeight: 700, animation: urg.pulse ? 'urgPulse 0.9s ease infinite' : 'none' }}>⏱ {fmtTime(secs)}</span>
          </div>
        </div>
        <button
          onClick={() => onCancel(listing)}
          disabled={cancelling === listing.listing_id}
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>
          {cancelling === listing.listing_id ? '…' : 'Cancel'}
        </button>
      </div>
    </div>
  )
}

function MyListingsTab({ token, showToast }) {
  const [listings, setListings]   = useState(null)
  const [cancelling, setCancelling] = useState(null)

  useEffect(() => { apiFetch('/api/market/mine', token).then(setListings) }, [])

  async function handleCancel(listing) {
    setCancelling(listing.listing_id)
    try {
      await apiFetch(`/api/market/listings/${listing.listing_id}`, token, { method: 'DELETE' })
      setListings(l => l.filter(x => x.listing_id !== listing.listing_id))
      showToast(`${listing.name} returned to your collection`)
    } catch (e) {
      showToast(e.message || 'Could not cancel', false)
    }
    setCancelling(null)
  }

  if (!listings) return <div style={{ textAlign: 'center', paddingTop: 50, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading…</div>

  if (!listings.length) return (
    <div style={{ textAlign: 'center', paddingTop: 56 }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📋</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>No active listings</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 6 }}>List a card to start selling</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {listings.map(l => <MyListingRow key={l.listing_id} listing={l} onCancel={handleCancel} cancelling={cancelling} />)}
    </div>
  )
}

// ── LIST A CARD TAB ───────────────────────────────────────────────────────────

function ListCardTab({ token, showToast, onListed }) {
  const [collection, setCollection] = useState(null)
  const [selected, setSelected]     = useState(null)   // null = pick grid
  const [confirming, setConfirming] = useState(false)
  const [price, setPrice]           = useState('')
  const [duration, setDuration]     = useState('24h')
  const [listing, setListing]       = useState(false)

  const topRef = useRef(null)

  useEffect(() => { apiFetch('/api/collection', token).then(setCollection) }, [])

  useEffect(() => {
    try {
      const page = topRef.current?.closest?.('.page')
      if (page) page.scrollTop = 0
    } catch (_) {}
  }, [selected, confirming])

  const minPrice = selected ? calcMinPrice(selected) : 0
  const priceNum = parseInt(price) || 0
  const priceOk  = priceNum >= minPrice && minPrice > 0

  function pickCard(card) {
    setSelected(card)
    setPrice(calcMinPrice(card).toString())
    setConfirming(false)
  }

  async function doList() {
    setListing(true)
    try {
      await apiFetch('/api/market/list', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: selected.card_id, edition: selected.edition ?? null, price: priceNum, duration }),
      })
      showToast(`${selected.name} listed for 🪙 ${priceNum.toLocaleString()}!`)
      onListed()
    } catch (e) {
      showToast(e.message || 'Listing failed', false)
      setListing(false)
    }
  }

  const rc = selected ? (RARITY_COLOR[selected.card_rarity] || '#f0c040') : '#f0c040'

  // ── Pick grid (always rendered) ──
  // Details + Confirm float above as fixed overlays so scroll position never matters
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Select a card to list</div>
      {!collection ? (
        <div style={{ textAlign: 'center', paddingTop: 50, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>Loading collection…</div>
      ) : !collection.length ? (
        <div style={{ textAlign: 'center', paddingTop: 50, color: 'rgba(255,255,255,0.3)' }}>No cards in collection</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
          {collection.map((card, i) => (
            <div key={`${card.card_id}-${card.edition ?? i}`} onClick={() => pickCard(card)} style={{ cursor: 'pointer' }}>
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
                <FutCard card={card} />
                <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.78)', borderRadius: 5, padding: '2px 5px', fontSize: 9, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
                  #{(card.edition ?? 0) + 1}<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/{card.copies ?? '?'}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 3, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{card.overall} OVR</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Details overlay ── */}
      {selected && !confirming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 16px' }}>
          <div className="anim-fadeUp"
            style={{ background: '#0a1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#0d1524', border: `1px solid ${rc}33`, borderRadius: 12, padding: '12px 14px', marginBottom: 18 }}>
              <div style={{ width: 120, flexShrink: 0 }}><FutCard card={selected} /></div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', fontFamily: "'Montserrat',sans-serif", marginBottom: 4 }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: rc, marginBottom: 2 }}>Ed #{(selected.edition ?? 0) + 1} · {selected.card_rarity}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{selected.overall} OVR · {selected.card_type}</div>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Price (coins)</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🪙</span>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder={minPrice.toString()}
                  style={{ width: '100%', background: '#0d1524', border: `1.5px solid ${priceNum > 0 && !priceOk ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, color: '#fff', padding: '11px 14px 11px 38px', fontSize: 16, fontWeight: 800, outline: 'none', boxSizing: 'border-box', fontFamily: "'Montserrat',sans-serif" }} />
              </div>
              <div style={{ fontSize: 11, marginTop: 6, color: priceNum > 0 && !priceOk ? '#ef4444' : '#4ade80' }}>
                {priceNum > 0 && !priceOk ? `❌ Min: 🪙 ${minPrice.toLocaleString()}` : `✓ Minimum: 🪙 ${minPrice.toLocaleString()}`}
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>Duration</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{ padding: '8px 16px', borderRadius: 20, border: `1.5px solid ${duration === d ? '#a855f7' : 'rgba(255,255,255,0.09)'}`, background: duration === d ? 'rgba(168,85,247,0.15)' : 'transparent', color: duration === d ? '#c084fc' : 'rgba(255,255,255,0.35)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{d}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelected(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', padding: '13px', fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => setConfirming(true)} disabled={!priceOk}
                style={{ flex: 2, background: priceOk ? 'linear-gradient(135deg,#6d28d9,#a855f7)' : '#111827', border: 'none', borderRadius: 12, color: priceOk ? '#fff' : '#374151', padding: '13px', fontSize: 14, fontWeight: 800, cursor: priceOk ? 'pointer' : 'default', boxShadow: priceOk ? '0 4px 24px rgba(168,85,247,0.4)' : 'none' }}>
                Review Listing →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm overlay ── */}
      {selected && confirming && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 16px' }}>
          <div className="anim-fadeUp"
            style={{ background: '#0a1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 480 }}>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>Confirm Listing</div>
              <div style={{ width: 130, margin: '0 auto 12px' }}><FutCard card={selected} /></div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', fontFamily: "'Montserrat',sans-serif", marginBottom: 2 }}>{selected.name}</div>
              <div style={{ fontSize: 12, color: rc }}>Edition #{(selected.edition ?? 0) + 1} · {selected.card_rarity}</div>
            </div>
            <div style={{ background: '#0d1524', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
              {[['Price', `🪙 ${priceNum.toLocaleString()}`], ['Duration', duration], ['Card status', 'Held in escrow']].map(([l, v], i, arr) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: l === 'Price' ? '#f0c040' : '#e2e8f0' }}>{v}</span>
                </div>
              ))}
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8, textAlign: 'center' }}>Card removed from collection until sold or expired</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirming(false)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'rgba(255,255,255,0.4)', padding: '13px', fontSize: 14, cursor: 'pointer' }}>
                ← Back
              </button>
              <button onClick={doList} disabled={listing}
                style={{ flex: 2, background: 'linear-gradient(135deg,#6d28d9,#a855f7)', border: 'none', borderRadius: 12, color: '#fff', padding: '13px', fontSize: 14, fontWeight: 800, cursor: listing ? 'default' : 'pointer', opacity: listing ? 0.7 : 1, boxShadow: '0 4px 24px rgba(168,85,247,0.4)' }}>
                {listing ? 'Listing…' : 'Confirm — List Card →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function Market({ token }) {
  const [tab, setTab]         = useState('browse')
  const [coins, setCoins]     = useState(null)
  const [stats, setStats]     = useState(null)
  const [showStats, setShowStats] = useState(false)
  const [toast, setToast]     = useState(null)

  useEffect(() => {
    apiFetch('/api/shop/packs', token).then(d => setCoins(d.coins)).catch(() => {})
    apiFetch('/api/market/stats', token).then(setStats).catch(() => {})
  }, [])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="page">
      <style>{`
        @keyframes mktIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes urgPulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>

      {toast && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: toast.ok ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, zIndex: 300, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} className="anim-fadeUp">
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif", letterSpacing: -0.5 }}>
              Transfer Market
            </div>
            <PageHelp page="market" />
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, letterSpacing: 0.5 }}>
            Global · Fixed price · Coins only
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowStats(true)} style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#a855f7', cursor: 'pointer', fontFamily: "'Montserrat',sans-serif" }}>
            📊 History
          </button>
          <div style={{ background: 'rgba(240,192,64,0.08)', border: '1px solid rgba(240,192,64,0.25)', borderRadius: 20, padding: '6px 14px', fontSize: 14, fontWeight: 900, color: '#f0c040', fontFamily: "'Montserrat',sans-serif" }}>
            🪙 {(coins ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* History modal */}
      {showStats && stats && (
        <div onClick={() => setShowStats(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '0 16px' }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: '#0a1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '24px 20px', width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat',sans-serif" }}>📊 Market History</div>
              <button onClick={() => setShowStats(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Listings</div>
            <div style={{ background: '#0d1524', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
              {[
                ['Total Listed',  stats.total_listed, '#e2e8f0'],
                ['Active Now',    stats.active,       '#a855f7'],
                ['Sold',          stats.sold,         '#22c55e'],
                ['Sell-through',  `${stats.sell_rate}%`, stats.sell_rate >= 50 ? '#22c55e' : '#f97316'],
                ['Cancelled',     stats.cancelled,    '#94a3b8'],
                ['Expired',       stats.expired,      '#94a3b8'],
                ['Cards Bought',  stats.bought,       '#60a5fa'],
              ].map(([l, v, c], i, arr) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Coins</div>
            <div style={{ background: '#0d1524', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                ['Revenue', stats.revenue, '#22c55e', false],
                ['Spent',   stats.spend,   '#ef4444', false],
                ['Profit',  stats.profit,  stats.profit >= 0 ? '#22c55e' : '#ef4444', true],
              ].map(([l, v, c, showSign], i, arr) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{l}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: c, fontFamily: "'Montserrat',sans-serif" }}>
                    {showSign ? (v >= 0 ? '+ ' : '- ') : ''}🪙{Math.abs(v).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'rgba(13,21,36,0.9)', borderRadius: 12, padding: 3, border: '1px solid rgba(255,255,255,0.07)' }}>
        {[['browse','🔍 Browse'], ['mine','📋 My Listings'], ['list','＋ List Card']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '9px 4px', border: 'none', borderRadius: 10, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, fontFamily: "'Montserrat',sans-serif", letterSpacing: 0.3,
            background: tab === key ? 'linear-gradient(135deg,#6d28d9,#a855f7)' : 'transparent',
            color: tab === key ? '#fff' : 'rgba(255,255,255,0.35)',
            transition: 'all 0.2s',
            boxShadow: tab === key ? '0 2px 12px rgba(168,85,247,0.4)' : 'none',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'browse' && <BrowseTab token={token} coins={coins} onCoinsChange={setCoins} showToast={showToast} />}
      {tab === 'mine'   && <MyListingsTab token={token} showToast={showToast} />}
      {tab === 'list'   && <ListCardTab token={token} showToast={showToast} onListed={() => setTab('mine')} />}
    </div>
  )
}
