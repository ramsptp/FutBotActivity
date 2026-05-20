import { useEffect, useRef, useState } from 'react'
import { DiscordSDK } from '@discord/embedded-app-sdk'
import Nav from './components/Nav'
import Home from './pages/Home'
import Collection from './pages/Collection'
import DeckBuilder from './pages/DeckBuilder'

const discordSdk = new DiscordSDK(import.meta.env.VITE_CLIENT_ID)

function App() {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState(null)
  const [page, setPage] = useState('home')
  const authing = useRef(false)

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
    } catch (e) {
      setError(e.message)
    }
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
      {page === 'battle' && <div style={{ padding: 24, color: '#fff' }}>Battle coming soon…</div>}
      <Nav page={page} setPage={setPage} />
    </>
  )
}

export default App
