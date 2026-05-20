import { useEffect, useRef, useState } from 'react'
import { DiscordSDK } from '@discord/embedded-app-sdk'

const discordSdk = new DiscordSDK(import.meta.env.VITE_CLIENT_ID)

function App() {
  const [auth, setAuth] = useState(null)
  const [error, setError] = useState(null)
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

  return (
    <div style={{ padding: 24 }}>
      <h1>FutBot Activity</h1>
      <p>Logged in as <strong>{auth.user.username}</strong></p>
      <p style={{ color: '#888', fontSize: 14 }}>Auth working — ready to build features.</p>
    </div>
  )
}

export default App
