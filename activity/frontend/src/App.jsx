import { useEffect, useRef, useState } from 'react'
import { discordSdk } from './lib/discord'
import { apiFetch } from './lib/api'
import Nav from './components/Nav'
import Home from './pages/Home'
import Collection from './pages/Collection'
import DeckBuilder from './pages/DeckBuilder'
import Battle from './pages/Battle'
import Packs from './pages/Packs'
import Shop from './pages/Shop'
import Market from './pages/Market'
import LoadingScreen from './components/LoadingScreen'
import ChallengeNotification from './components/ChallengeNotification'
import TutorialOverlay from './components/TutorialOverlay'

function App() {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState('home')
  const [starterCards, setStarterCards] = useState(null)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [battleMode, setBattleMode] = useState('match') // 'match' | 'friend'
  const [autoChallenge, setAutoChallenge] = useState(null) // participant to auto-challenge
  const [participants, setParticipants] = useState([])
  const [incomingChallenge, setIncomingChallenge] = useState(null)
  const authing = useRef(false)
  const pollRef = useRef(null)

  useEffect(() => {
    if (authing.current) return
    authing.current = true
    setup()
  }, [])

  async function setup() {
    try {
      await discordSdk.ready()

      const { code } = await discordSdk.commands.authorize({
        client_id: import.meta.env.VITE_CLIENT_ID,
        response_type: 'code',
        state: '',
        prompt: 'none',
        scope: ['identify'],
      })

      const resp = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const { access_token } = await resp.json()

      const result = await discordSdk.commands.authenticate({ access_token })
      setAuth({ ...result, access_token })
      startLobby(access_token)
      // Load tutorial step
      const me = await fetch('/api/me', { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.json()).catch(() => null)
      if (me?.player?.tutorial_step != null) setTutorialStep(me.player.tutorial_step)
    } catch (e) {
      setError(e.message)
    }
  }

  function startLobby(token) {
    const channelId = discordSdk.channelId
    if (!channelId) return

    const register = () => apiFetch('/api/lobby/register', token, {
      method: 'POST',
      body: JSON.stringify({ channel_id: channelId }),
    }).catch(() => {})

    const fetchParticipants = async () => {
      const parts = await apiFetch(`/api/lobby/participants?channel_id=${channelId}`, token).catch(() => [])
      setParticipants(parts || [])
      const challenge = await apiFetch('/api/challenges/incoming', token).catch(() => null)
      setIncomingChallenge(prev => challenge || prev)
    }

    register()
    fetchParticipants()
    pollRef.current = setInterval(() => { register(); fetchParticipants() }, 5000)
  }

  async function advanceTutorial(nextStep) {
    setTutorialStep(nextStep)
    apiFetch('/api/tutorial', auth?.access_token, { method: 'PUT', body: JSON.stringify({ step: nextStep }) }).catch(() => {})
  }

  function skipTutorial() { advanceTutorial(99) }

  if (error) return <LoadingScreen message={error} error />
  if (!auth) return <LoadingScreen />

  const token = auth.access_token
  const user = auth.user

  const withBg = page !== 'battle' && page !== 'home'

  return (
    <div style={withBg ? {
      minHeight: '100svh',
      background: "url('/background.png') center center / cover no-repeat fixed",
    } : undefined}>
      {page === 'home' && <Home token={token} user={user} setPage={setPage} participants={participants} setBattleMode={setBattleMode} onStarterClaim={cards => { setStarterCards(cards); setTutorialStep(1); setPage('packs') }} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} onTutorialSkip={skipTutorial} setAutoChallenge={setAutoChallenge} />}
      {page === 'collection' && <Collection token={token} />}
      {page === 'decks' && <DeckBuilder token={token} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} />}
      {page === 'packs' && <Packs token={token} starterCards={starterCards} onStarterDone={() => { setStarterCards(null); setPage('decks') }} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} />}
      {page === 'shop'   && <Shop token={token} />}
      {page === 'market' && <Market token={token} />}
      {page === 'battle' && (
        <Battle
          token={token}
          participants={participants}
          incomingChallenge={incomingChallenge}
          setIncomingChallenge={setIncomingChallenge}
          initialMode={battleMode}
          autoChallenge={autoChallenge}
          setAutoChallenge={setAutoChallenge}
        />
      )}
      {page !== 'home' && <Nav page={page} setPage={setPage} participants={participants} user={user} token={token} setBattleMode={setBattleMode} setAutoChallenge={setAutoChallenge} />}

      {/* Watermark */}
      <div style={{
        position: 'fixed', bottom: 10, left: 14, zIndex: 40,
        display: 'flex', alignItems: 'center', gap: 5,
        opacity: 0.25, pointerEvents: 'none', userSelect: 'none',
      }}>
        <span style={{ fontSize: 13, fontFamily: "'Montserrat', system-ui, sans-serif", fontWeight: 900, color: '#fff', letterSpacing: 1 }}>
          FUT<span style={{ color: '#a855f7' }}>BOT</span>
        </span>
      </div>

      {/* Tutorial overlay — steps 1-6 */}
      {tutorialStep > 0 && tutorialStep <= 2 && (
        <TutorialOverlay
          step={tutorialStep}
          onNext={() => advanceTutorial(tutorialStep + 1)}
          onSkip={skipTutorial}
        />
      )}

      {/* Global challenge notification — shows on any page */}
      <ChallengeNotification
        challenge={page !== 'battle' ? incomingChallenge : null}
        onAccept={() => {
          setBattleMode('accepting')
          setPage('battle')
        }}
        onDecline={async () => {
          setIncomingChallenge(null)
          try {
            await fetch('/api/challenges/decline', {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            })
          } catch {}
        }}
      />
    </div>
  )
}

export default App
