import { useEffect, useState } from 'react'

const TIPS = {
  collection: { title: 'Your Collection', body: 'Browse all your cards here. Filter by position, rarity, or type. Tap a card to see full stats.' },
  shop:       { title: 'Shop', body: 'Buy packs with coins you earn from battles, or sell cards you no longer need.' },
  packs:      { title: 'Packs', body: 'Open your packs here to reveal new players. Rarer packs drop better cards.' },
  decks:      { title: 'Deck Builder', body: 'Build squads of 5 players to use in battle. You can have multiple decks and switch between them.' },
  battle:     { title: 'Battle', body: 'Challenge friends in your voice channel or find a random match. Each match earns you coins — win more, earn more.' },
}

const STORAGE_KEY = 'futbot-visited-pages'

function getVisited() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export default function PageTip({ page }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const visited = getVisited()
    if (!visited.includes(page) && TIPS[page]) {
      setShow(true)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited, page]))
    }
  }, [page])

  if (!show) return null
  const tip = TIPS[page]
  if (!tip) return null

  return (
    <div className="anim-fadeUp" style={{
      position: 'fixed', bottom: 76, left: '50%', transform: 'translateX(-50%)',
      zIndex: 90, background: 'linear-gradient(135deg,#1a1240,#12102b)',
      border: '1px solid rgba(168,85,247,0.4)', borderRadius: 14,
      padding: '14px 18px', maxWidth: 320, width: 'calc(100% - 32px)',
      boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(168,85,247,0.9)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
        {tip.title}
      </div>
      <p style={{ color: '#c4cdd8', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
        {tip.body}
      </p>
      <button onClick={() => setShow(false)} style={{ width: '100%', background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', borderRadius: 8, color: '#a855f7', padding: '7px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        Got it
      </button>
    </div>
  )
}
