import { useEffect, useRef, useState } from 'react'
import { discordSdk } from './lib/discord'
import { apiFetch } from './lib/api'
import Nav from './components/Nav'
import ModeSelector from './components/ModeSelector'
import Home from './pages/Home'
import Collection from './pages/Collection'
import DeckBuilder from './pages/DeckBuilder'
import Battle from './pages/Battle'
import Packs from './pages/Packs'
import Shop from './pages/Shop'
import Market from './pages/Market'
import TradeScreen from './pages/TradeScreen'
import LoadingScreen from './components/LoadingScreen'
import ChallengeNotification from './components/ChallengeNotification'
import TutorialOverlay from './components/TutorialOverlay'
import SocialHome from './pages/social/SocialHome'
import GuessThePlayer from './pages/social/GuessThePlayer'
import HigherOrLower from './pages/social/HigherOrLower'
import FootballSurvivor from './pages/social/FootballSurvivor'

function App() {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState(null) // null | 'arena' | 'social'
  const [socialGame, setSocialGame] = useState(null) // null | 'guess-player' | 'higher-lower' | 'football-survivor'
  const [page, setPage] = useState('home')
  const [starterCards, setStarterCards] = useState(null)
  const [tutorialStep, setTutorialStep] = useState(0)
  const [battleMode, setBattleMode] = useState('match') // 'match' | 'friend'
  const [autoChallenge, setAutoChallenge] = useState(null) // participant to auto-challenge
  const [participants, setParticipants] = useState([])
  const [incomingChallenge, setIncomingChallenge] = useState(null)
  const [incomingTrade, setIncomingTrade]         = useState(null)
  const [tradeRoomId, setTradeRoomId]             = useState(null)
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
    const guildId   = discordSdk.guildId
    if (!channelId) return

    const register = () => apiFetch('/api/lobby/register', token, {
      method: 'POST',
      body: JSON.stringify({ channel_id: channelId, guild_id: guildId || null }),
    }).catch(() => {})

    const fetchParticipants = async () => {
      const parts = await apiFetch(`/api/lobby/participants?channel_id=${channelId}`, token).catch(() => [])
      setParticipants(parts || [])
      const challenge = await apiFetch('/api/challenges/incoming', token).catch(() => null)
      setIncomingChallenge(prev => challenge || prev)
      const trade = await apiFetch('/api/trades/incoming', token).catch(() => null)
      setIncomingTrade(prev => trade || prev)
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

  // Show mode selector if no mode selected yet
  if (!mode) {
    return <ModeSelector onSelectMode={setMode} />
  }

  // SOCIAL MODE
  if (mode === 'social') {
    // Game routing
    if (socialGame === 'guess-player') {
      return <GuessThePlayer token={token} onBack={() => setSocialGame(null)} />
    }
    if (socialGame === 'higher-lower') {
      return <HigherOrLower token={token} user={user} onBack={() => setSocialGame(null)} />
    }
    if (socialGame === 'football-survivor') {
      return <FootballSurvivor token={token} user={user} onBack={() => setSocialGame(null)} />
    }

    // Social home
    return (
      <SocialHome
        token={token}
        user={user}
        onBackToMenu={() => setMode(null)}
        onSelectGame={setSocialGame}
      />
    )
  }

  // ARENA MODE
  const withBg = page !== 'battle' && page !== 'home'

  return (
    <div style={withBg ? {
      minHeight: '100svh',
      background: "url('/background.png') center center / cover no-repeat fixed",
    } : undefined}>
      {page === 'home' && <Home token={token} user={user} setPage={setPage} participants={participants} setBattleMode={setBattleMode} onStarterClaim={cards => { setStarterCards(cards); setTutorialStep(1); setPage('packs') }} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} onTutorialSkip={skipTutorial} setAutoChallenge={setAutoChallenge}
        channelId={discordSdk.channelId}
        guildId={discordSdk.guildId}
        onTrade={async (toUserId) => {
          const res = await apiFetch('/api/trades/invite', token, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId }) })
          if (res?.room_id) setTradeRoomId(res.room_id)
        }}
      />}
      {page === 'collection' && <Collection token={token} />}
      {page === 'decks' && <DeckBuilder token={token} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} />}
      {page === 'packs' && <Packs token={token} starterCards={starterCards} onStarterDone={() => { setStarterCards(null); setPage('decks') }} tutorialStep={tutorialStep} onTutorialAdvance={advanceTutorial} />}
      {page === 'shop'   && <Shop token={token} />}
      {page === 'market' && <Market token={token} />}
      {tradeRoomId && <TradeScreen token={token} roomId={tradeRoomId} myUserId={user?.id ? parseInt(user.id) : null} myUsername={user?.username} onClose={() => setTradeRoomId(null)} />}
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
      {page !== 'home' && <Nav page={page} setPage={setPage} participants={participants} user={user} token={token} setBattleMode={setBattleMode} setAutoChallenge={setAutoChallenge}
        onTrade={async (toUserId) => {
          const res = await apiFetch('/api/trades/invite', token, { method: 'POST', body: JSON.stringify({ to_user_id: toUserId }) })
          if (res?.room_id) setTradeRoomId(res.room_id)
        }}
      />}

      {/* Back to menu button */}
      <button
        onClick={() => setMode(null)}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 50,
          background: 'rgba(15,23,41,0.8)',
          border: '1px solid rgba(168,85,247,0.3)',
          borderRadius: 10,
          padding: '8px 14px',
          color: '#fff',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
        Menu
      </button>

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

      {/* Global challenge notification */}
      <ChallengeNotification
        challenge={page !== 'battle' ? incomingChallenge : null}
        onAccept={() => { setBattleMode('accepting'); setPage('battle') }}
        onDecline={async () => {
          setIncomingChallenge(null)
          try { await fetch('/api/challenges/decline', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }) } catch {}
        }}
      />

      {/* Trade invite notification */}
      {incomingTrade && !tradeRoomId && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: '#0f1729', border: '1px solid rgba(168,85,247,0.6)', borderRadius: 14, padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', gap: 14, minWidth: 280 }} className="anim-fadeUp">
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🤝 Trade offer</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{incomingTrade.from_name} wants to trade</div>
          </div>
          <button onClick={() => { setTradeRoomId(incomingTrade.room_id); setIncomingTrade(null) }}
            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Accept
          </button>
          <button onClick={async () => { setIncomingTrade(null); try { await apiFetch('/api/trades/decline', token, { method: 'DELETE' }) } catch {} }}
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

export default App
