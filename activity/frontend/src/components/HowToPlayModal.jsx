export default function HowToPlayModal({ onClose, battleFocus = false }) {
  const sections = [
    {
      title: '⚔️ How Battles Work',
      color: '#f0c040',
      items: [
        '5 rounds per match — first to win 3 rounds wins',
        'Odd rounds: you pick the stat to compare',
        'Even rounds: your opponent picks the stat',
        'Tiebreaker: higher overall wins; if tied → round draw',
      ],
    },
    {
      title: '📊 Stats Explained',
      color: '#a855f7',
      items: [
        "ATK vs DEF — attacker's ATK vs defender's DEF",
        'SPD vs SPD — both compared directly',
        'OVR — used only as tiebreaker',
        'Pick the stat where your card has the edge!',
      ],
    },
    {
      title: '🪙 Earning Coins',
      color: '#22c55e',
      items: [
        'Win a match → +200 coins',
        'Lose a match → +100 coins',
        'Draw → +150 coins each',
        'Use coins in the Shop to buy packs',
      ],
    },
    {
      title: '📦 Packs & Decks',
      color: '#3b82f6',
      items: [
        'Open packs to collect new players',
        'Build a deck of exactly 5 players before battling',
        'Rare, Icon & Hero cards have the best stats',
        'Sell unwanted cards in the Shop for coins',
      ],
    },
  ]

  const focused = battleFocus ? sections.slice(0, 2) : sections

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0' }}>
      <div onClick={e => e.stopPropagation()} className="anim-fadeUp" style={{ background: '#0f1729', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '85svh', overflowY: 'auto', padding: '24px 20px 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: "'Montserrat', sans-serif" }}>
            HOW TO PLAY
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {focused.map(section => (
            <div key={section.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: section.color, marginBottom: 10, letterSpacing: 0.5 }}>{section.title}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#c4cdd8', lineHeight: 1.4 }}>
                    <span style={{ color: section.color, flexShrink: 0 }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ width: '100%', marginTop: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Got it
        </button>
      </div>
    </div>
  )
}
