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

function App() {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState('home')
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

  if (error) return <div style={{ color: 'red', padding: 24 }}>Error: {error}</div>
  if (!auth) return <div style={{ padding: 24 }}>Authenticating...</div>

  const token = auth.access_token
  const user = auth.user

  return (
    <>
      {page === 'home' && <Home token={token} user={user} setPage={setPage} />}
      {page === 'collection' && <Collection token={token} />}
      {page === 'decks' && <DeckBuilder token={token} />}
      {page === 'packs' && <Packs token={token} />}
      {page === 'shop' && <Shop token={token} />}
      {page === 'battle' && (
        <Battle
          token={token}
          participants={participants}
          incomingChallenge={incomingChallenge}
          setIncomingChallenge={setIncomingChallenge}
        />
      )}
      {page !== 'home' && <Nav page={page} setPage={setPage} />}
    </>
  )
}

export default App
