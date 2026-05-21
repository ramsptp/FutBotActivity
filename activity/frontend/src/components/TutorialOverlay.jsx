import { useEffect, useState } from 'react'

const STEPS = [
  { id: 'tutorial-see-all',   message: "Tap here to see all your starter cards!" },
  { id: 'tutorial-new-deck', message: "Tap + New to create your first deck and get ready to battle!" },
]

export default function TutorialOverlay({ step, onNext, onSkip }) {
  const [rect, setRect] = useState(null)
  const stepData = STEPS[step - 1]

  useEffect(() => {
    if (!stepData) return
    setRect(null)
    const tryFind = () => {
      const el = document.getElementById(stepData.id)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
        return true
      }
      return false
    }
    if (!tryFind()) {
      // Poll every 600ms until element appears (element may take minutes to show e.g. after reveal all)
      const interval = setInterval(() => { if (tryFind()) clearInterval(interval) }, 600)
      const safety = setTimeout(() => clearInterval(interval), 10 * 60 * 1000)
      return () => { clearInterval(interval); clearTimeout(safety) }
    }
  }, [step])

  if (!stepData || !rect) return null

  const PAD = 10
  const spotTop    = rect.top - PAD
  const spotLeft   = rect.left - PAD
  const spotWidth  = rect.width + PAD * 2
  const spotHeight = rect.height + PAD * 2
  const isLast     = step === STEPS.length

  // Position tooltip: prefer above, clamp to safe bounds
  const SAFE_TOP    = 60
  const SAFE_BOTTOM = 110
  const belowTop    = spotTop + spotHeight + 12
  const aboveBottom = window.innerHeight - spotTop + 12

  const tooltipStyle = {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1001,
    background: 'linear-gradient(135deg, #1a1240, #12102b)',
    border: '1px solid rgba(168,85,247,0.5)',
    borderRadius: 16,
    padding: '16px 20px',
    maxWidth: 300,
    width: 'calc(100% - 48px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
  }

  // Put tooltip below the spotlight, but if that would go off-screen put it above
  if (belowTop + 130 < window.innerHeight - SAFE_BOTTOM) {
    tooltipStyle.top = Math.max(belowTop, SAFE_TOP)
  } else {
    tooltipStyle.bottom = Math.min(aboveBottom, window.innerHeight - SAFE_TOP - 130)
  }

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, borderRadius: 12, boxShadow: '0 0 0 9999px rgba(0,0,0,0.75)' }} />
        <div style={{ position: 'absolute', top: spotTop, left: spotLeft, width: spotWidth, height: spotHeight, borderRadius: 12, border: '2px solid rgba(168,85,247,0.9)', animation: 'tutorialRing 1.4s ease infinite' }} />
      </div>

      <div style={tooltipStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(168,85,247,0.9)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
          Tutorial · {step} / {STEPS.length}
        </div>
        <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.55, margin: '0 0 14px', fontWeight: 500 }}>
          {stepData.message}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onSkip} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '9px', fontSize: 12, cursor: 'pointer' }}>
            Skip
          </button>
          <button onClick={onNext} style={{ flex: 2, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', animation: 'tutorialPulse 2s ease infinite' }}>
            {isLast ? 'Done! 🏆' : 'Got it →'}
          </button>
        </div>
      </div>
    </>
  )
}
