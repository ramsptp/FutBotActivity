import { useState } from 'react'

const HELP = {
  collection: {
    title: 'Your Collection',
    sections: [
      { heading: 'Browsing', points: ['All your cards sorted by overall rating', 'Tap a card to see full stats — ATK, DEF, SPD, OVR'] },
      { heading: 'Filtering', points: ['Filter by position: Forward, Midfielder, Defender', 'Filter by rarity: Common, Uncommon, Rare', 'Combine filters to find exactly what you need'] },
      { heading: 'Selling', points: ['Head to the Shop to sell cards you no longer need', 'Higher-rated and rarer cards are worth more coins'] },
    ],
  },
  shop: {
    title: 'Shop',
    sections: [
      { heading: 'Buy Packs', points: ['Rare Player Pack — 1,000 coins (85+ OVR card)', 'Hero Pack — 1,750 coins (guaranteed Hero)', 'Icon Pack — 2,500 coins (guaranteed Icon)', 'Coins are earned by playing battles'] },
      { heading: 'Sell Cards', points: ['Tap any card to see its sell value', 'Sell value = base + 50 + (OVR − 70) × 5', 'Icon base: 250 coins | Hero: 175 | Standard: 100', 'Sold cards are permanently removed from your collection'] },
    ],
  },
  packs: {
    title: 'Opening Packs',
    sections: [
      { heading: 'Fan Reveal', points: ['All cards dealt face-down — tap each one to flip it', 'The highest-rated special card gets a full animated reveal', 'Tap Reveal All to flip all cards at once'] },
      { heading: 'Single Card Packs', points: ['Stats are revealed one by one — ATK, DEF, SPD, then OVR', 'Card flips after the full reveal', 'Tap Skip to jump straight to the card'] },
      { heading: 'After Opening', points: ['Tap See All Cards to view all your new players', 'You can quick-sell cards you don\'t want straight from the results screen'] },
    ],
  },
  decks: {
    title: 'Deck Builder',
    sections: [
      { heading: 'Building a Deck', points: ['A deck needs exactly 5 players', 'Tap a card in the grid to add it to a slot', 'Tap a filled slot to remove that card', 'Give your deck a name and tap Save Deck'] },
      { heading: 'Strategy', points: ['Balance ATK, DEF, and SPD across your 5 cards', 'You pick the stat on odd rounds — stack ATK for attacking', 'Your opponent picks on even rounds — don\'t neglect DEF', 'You can have multiple decks and switch before each match'] },
    ],
  },
  market: {
    title: 'Transfer Market',
    sections: [
      { heading: 'Browsing', points: ['All active listings from every player', 'Search by player name to find specific cards', 'Click any listing to see full card stats — OVR, ATK, DEF, SPD, club, nation, and more'] },
      { heading: 'Buying', points: ['Tap a listing card to view full details, then hit Buy', 'Coins are deducted instantly — the card goes straight to your collection', 'You cannot buy your own listings'] },
      { heading: 'Listing a Card', points: ['Go to List Card, pick from your collection, set a price, choose a duration', 'Minimum price depends on card rarity and overall rating', 'Card is held in escrow — removed from collection until sold or expired', 'If unsold, the card is automatically returned when the listing expires'] },
      { heading: 'My Listings', points: ['View and cancel your active listings at any time', 'Cancelling a listing immediately returns the card to your collection', 'Sold listings earn you the full listing price — no fees'] },
    ],
  },
  battle: {
    title: 'Battle',
    sections: [
      { heading: 'Finding a Match', points: ['Find Match: challenge players in your voice channel', 'Play with Friend: share a room code with anyone', 'You must select a deck before the match starts'] },
      { heading: 'How Rounds Work', points: ['5 rounds per match — first to 3 round wins takes it', 'Odd rounds (1, 3, 5): you choose the stat to compare', 'Even rounds (2, 4): your opponent chooses the stat', 'ATK vs DEF — attacker\'s ATK vs defender\'s DEF', 'SPD vs SPD — direct speed comparison', 'Tiebreaker: higher overall wins; if still equal → draw'] },
      { heading: 'Rewards', points: ['Win: +200 coins | Lose: +100 coins | Draw: +150 coins each', 'Coins are shared in your wallet and carry over between sessions'] },
    ],
  },
}

export default function PageHelp({ page }) {
  const [open, setOpen] = useState(false)
  const help = HELP[page]
  if (!help) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '50%', width: 26, height: 26, flexShrink: 0,
          color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >?</button>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '80svh', overflowY: 'auto', padding: '24px 20px 40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat', sans-serif", letterSpacing: 0.5 }}>
                {help.title}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {help.sections.map(section => (
                <div key={section.heading} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(168,85,247,0.9)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>{section.heading}</div>
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {section.points.map((p, i) => (
                      <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#c4cdd8', lineHeight: 1.45 }}>
                        <span style={{ color: 'rgba(168,85,247,0.7)', flexShrink: 0, marginTop: 1 }}>·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button onClick={() => setOpen(false)} style={{ width: '100%', marginTop: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
