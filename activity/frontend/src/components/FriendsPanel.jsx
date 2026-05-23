import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import { avatarUrl, FALLBACK_AVATAR } from '../lib/avatar'

const MONTSERRAT = "'Montserrat', system-ui, sans-serif"
const INTER      = "'Inter', system-ui, sans-serif"

function Avatar({ user_id, avatar, name, online, size = 38 }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img
        src={avatarUrl(user_id, avatar, size * 2)}
        alt={name}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          border: `1.5px solid ${online ? 'rgba(74,222,128,0.65)' : 'rgba(255,255,255,0.08)'}`,
        }}
        onError={e => { e.target.src = FALLBACK_AVATAR }}
      />
      {online && (
        <span style={{
          position: 'absolute', bottom: -1, right: -1,
          width: 11, height: 11, borderRadius: '50%',
          background: '#4ade80', border: '2px solid #0a0e1a',
          boxShadow: '0 0 6px rgba(74,222,128,0.8)',
        }} />
      )}
    </div>
  )
}

function Toast({ msg, ok }) {
  return (
    <div style={{
      position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
      background: ok ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
      color: '#fff', padding: '8px 16px', borderRadius: 8,
      fontSize: 12, fontWeight: 700, zIndex: 50,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap',
    }} className="anim-fadeUp">{msg}</div>
  )
}

export default function FriendsPanel({ token, onClose, onTrade, onViewProfile, onlineIds = new Set(), onPendingCountChange }) {
  const [tab, setTab]                 = useState('friends')
  const [friends, setFriends]         = useState(null)
  const [requests, setRequests]       = useState({ incoming: [], outgoing: [] })
  const [search, setSearch]           = useState('')
  const [results, setResults]         = useState(null)
  const [searching, setSearching]     = useState(false)
  const [toast, setToast]             = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)

  const panelRef = useRef(null)
  const searchRef = useRef(null)
  const searchTimer = useRef(null)

  useEffect(() => {
    loadFriends()
    loadRequests()
  }, [])

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (tab === 'find' && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 200)
    }
  }, [tab])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2200)
  }

  async function loadFriends() {
    try {
      const data = await apiFetch('/api/friends', token)
      setFriends(data)
    } catch { setFriends([]) }
  }

  async function loadRequests() {
    try {
      const data = await apiFetch('/api/friends/requests', token)
      setRequests(data)
      onPendingCountChange?.(data.incoming?.length || 0)
    } catch {}
  }

  // Debounced search
  useEffect(() => {
    if (tab !== 'find') return
    if (search.trim().length < 2) { setResults(null); return }
    clearTimeout(searchTimer.current)
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await apiFetch(`/api/friends/search?q=${encodeURIComponent(search)}`, token)
        setResults(data)
      } catch { setResults([]) }
      setSearching(false)
    }, 300)
    return () => clearTimeout(searchTimer.current)
  }, [search, tab])

  async function sendRequest(p) {
    try {
      const res = await apiFetch('/api/friends/request', token, {
        method: 'POST',
        body: JSON.stringify({ to_user_id: p.user_id, to_name: p.name }),
      })
      if (res.status === 'auto_accepted') {
        showToast(`You're now friends with ${p.name}!`)
        loadFriends(); loadRequests()
      } else {
        showToast(`Request sent to ${p.name}`)
        loadRequests()
      }
      setResults(prev => prev?.map(r =>
        r.user_id === p.user_id ? { ...r, pending_out: res.status !== 'auto_accepted', is_friend: res.status === 'auto_accepted' } : r
      ))
    } catch (e) {
      showToast('Request failed', false)
    }
  }

  async function acceptReq(r) {
    try {
      await apiFetch(`/api/friends/accept/${r.request_id}`, token, { method: 'POST' })
      showToast(`You're now friends with ${r.name}`)
      loadFriends(); loadRequests()
    } catch { showToast('Failed to accept', false) }
  }

  async function declineReq(r) {
    try {
      await apiFetch(`/api/friends/decline/${r.request_id}`, token, { method: 'POST' })
      loadRequests()
    } catch { showToast('Failed to decline', false) }
  }

  async function cancelOutgoing(r) {
    try {
      await apiFetch(`/api/friends/decline/${r.request_id}`, token, { method: 'POST' })
      loadRequests()
    } catch { showToast('Failed to cancel', false) }
  }

  async function removeFriend(f) {
    try {
      await apiFetch(`/api/friends/${f.user_id}`, token, { method: 'DELETE' })
      showToast(`Removed ${f.name}`)
      loadFriends()
    } catch { showToast('Failed to remove', false) }
    setConfirmRemove(null)
  }

  const incomingCount = requests.incoming?.length || 0

  return (
    <div style={s.overlay}>
      <div ref={panelRef} style={s.panel} className="anim-slideR">

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerHexes}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#ffca45', fontVariationSettings: "'FILL' 1" }}>group</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={s.headerTitle}>Friends</div>
            <div style={s.headerSub}>{friends?.length ?? 0} connected · {incomingCount} pending</div>
          </div>
          <button onClick={onClose} style={s.closeBtn}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Tabs */}
        <div style={s.tabRow}>
          {[
            { key: 'friends',  label: 'Friends',  icon: 'group',         count: friends?.length },
            { key: 'requests', label: 'Requests', icon: 'mark_email_unread', count: incomingCount, accent: incomingCount > 0 },
            { key: 'find',     label: 'Find',     icon: 'person_search' },
          ].map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ ...s.tabBtn, color: active ? '#ffca45' : t.accent ? '#ffca45' : 'rgba(255,255,255,0.5)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span style={{
                    background: active ? '#ffca45' : t.accent ? '#ef4444' : 'rgba(255,255,255,0.1)',
                    color: active ? '#1a0a00' : '#fff',
                    fontSize: 10, fontWeight: 800,
                    padding: '1px 6px', borderRadius: 8, minWidth: 14, textAlign: 'center',
                  }}>{t.count}</span>
                )}
                {active && <div style={s.tabUnderline} />}
              </button>
            )
          })}
        </div>

        {/* Toast */}
        {toast && <Toast msg={toast.msg} ok={toast.ok} />}

        {/* Body */}
        <div style={s.body}>

          {/* ── FRIENDS TAB ── */}
          {tab === 'friends' && (
            <>
              {friends === null && <Loading />}
              {friends?.length === 0 && (
                <EmptyState
                  icon="group_off"
                  title="No friends yet"
                  body="Use the Find tab to search for players and send them a friend request."
                />
              )}
              {friends?.length > 0 && (
                <div style={s.list}>
                  {friends.map((f, i) => {
                    const online = onlineIds.has(String(f.user_id)) || onlineIds.has(f.user_id)
                    return (
                      <div key={f.user_id} style={{ ...s.card, animationDelay: `${i * 0.04}s` }} className="anim-fadeUp">
                        <Avatar user_id={f.user_id} avatar={f.avatar} name={f.name} online={online} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={s.cardName}>{f.name}</div>
                          <div style={s.cardSub}>
                            {online ? (
                              <span style={{ color: '#4ade80', fontWeight: 700 }}>● Online</span>
                            ) : (
                              <span style={{ color: '#475569' }}>○ Offline</span>
                            )}
                            <span style={{ color: '#334155', margin: '0 6px' }}>·</span>
                            <span style={{ color: '#94a3b8' }}>{f.battles_won}W</span>
                          </div>
                        </div>
                        <div style={s.cardActions}>
                          {onViewProfile && (
                            <button onClick={() => { onViewProfile({ user_id: String(f.user_id), name: f.name, avatar: f.avatar }); onClose() }}
                              style={s.iconBtn} title="View profile">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
                            </button>
                          )}
                          {onTrade && (
                            <button onClick={() => { onTrade(f.user_id); onClose() }}
                              style={{ ...s.iconBtn, color: '#c084fc', borderColor: 'rgba(168,85,247,0.35)' }} title="Trade">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>swap_horiz</span>
                            </button>
                          )}
                          <button onClick={() => setConfirmRemove(f)} style={{ ...s.iconBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} title="Remove">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_remove</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* ── REQUESTS TAB ── */}
          {tab === 'requests' && (
            <>
              <SectionLabel>Incoming · {requests.incoming.length}</SectionLabel>
              {requests.incoming.length === 0 ? (
                <div style={s.emptyMini}>Nothing pending.</div>
              ) : (
                <div style={s.list}>
                  {requests.incoming.map((r, i) => (
                    <div key={r.request_id} style={{ ...s.card, ...s.incomingCard, animationDelay: `${i * 0.04}s` }} className="anim-fadeUp">
                      <Avatar user_id={r.user_id} avatar={r.avatar} name={r.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.cardName}>{r.name}</div>
                        <div style={{ ...s.cardSub, color: '#ffca45' }}>wants to be friends</div>
                      </div>
                      <button onClick={() => declineReq(r)} style={s.declineBtn}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                      <button onClick={() => acceptReq(r)} style={s.acceptBtn}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                        Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <SectionLabel style={{ marginTop: 20 }}>Outgoing · {requests.outgoing.length}</SectionLabel>
              {requests.outgoing.length === 0 ? (
                <div style={s.emptyMini}>None sent.</div>
              ) : (
                <div style={s.list}>
                  {requests.outgoing.map((r, i) => (
                    <div key={r.request_id} style={{ ...s.card, animationDelay: `${i * 0.04}s` }} className="anim-fadeUp">
                      <Avatar user_id={r.user_id} avatar={r.avatar} name={r.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.cardName}>{r.name}</div>
                        <div style={{ ...s.cardSub, color: '#94a3b8' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: 'middle' }}>schedule</span>
                          {' '}awaiting reply
                        </div>
                      </div>
                      <button onClick={() => cancelOutgoing(r)} style={s.cancelBtn}>Cancel</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── FIND TAB ── */}
          {tab === 'find' && (
            <>
              <div style={s.searchWrap}>
                <span className="material-symbols-outlined" style={s.searchIcon}>search</span>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search players by name…"
                  style={s.searchInput}
                />
                {search && (
                  <button onClick={() => { setSearch(''); setResults(null) }} style={s.searchClear}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                  </button>
                )}
              </div>
              <div style={s.searchHint}>Min 2 characters</div>

              {searching && <Loading />}

              {!searching && search.length >= 2 && results?.length === 0 && (
                <EmptyState
                  icon="search_off"
                  title="No matches"
                  body={`No players found for "${search}"`}
                />
              )}

              {!searching && results?.length > 0 && (
                <div style={s.list}>
                  {results.map((p, i) => (
                    <div key={p.user_id} style={{ ...s.card, animationDelay: `${i * 0.04}s` }} className="anim-fadeUp">
                      <Avatar user_id={p.user_id} avatar={p.avatar} name={p.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.cardName}>{p.name}</div>
                        <div style={s.cardSub}>
                          <span style={{ color: '#ffca45' }}>{p.battles_won}W</span>
                          <span style={{ color: '#334155', margin: '0 6px' }}>·</span>
                          <span style={{ color: '#94a3b8' }}>🪙 {p.coins.toLocaleString()}</span>
                        </div>
                      </div>
                      {p.is_friend ? (
                        <span style={s.statusChip('#4ade80')}>Friends</span>
                      ) : p.pending_in ? (
                        <span style={s.statusChip('#ffca45')}>Wants you</span>
                      ) : p.pending_out ? (
                        <span style={s.statusChip('#94a3b8')}>Sent</span>
                      ) : (
                        <button onClick={() => sendRequest(p)} style={s.addBtn}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_add</span>
                          Add
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!search && (
                <EmptyState
                  icon="person_search"
                  title="Find players"
                  body="Type a name to search the FutBot community."
                />
              )}
            </>
          )}

        </div>

        {/* Confirm remove modal */}
        {confirmRemove && (
          <div onClick={() => setConfirmRemove(null)} style={s.confirmOverlay}>
            <div onClick={e => e.stopPropagation()} style={s.confirmBox} className="anim-fadeUp">
              <div style={{ fontSize: 28, marginBottom: 6 }}>⚠️</div>
              <div style={s.confirmTitle}>Remove {confirmRemove.name}?</div>
              <div style={s.confirmSub}>You'll be removed from their friends list too.</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setConfirmRemove(null)} style={s.confirmCancel}>Cancel</button>
                <button onClick={() => removeFriend(confirmRemove)} style={s.confirmRemove}>Remove</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 28, height: 28, border: '2.5px solid rgba(255,202,69,0.15)',
        borderTopColor: '#ffca45', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.4, marginBottom: 8 }}>{icon}</span>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 4, fontFamily: MONTSERRAT }}>{title}</div>
      <div style={{ fontSize: 12, lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}

function SectionLabel({ children, style: extra }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#475569',
      letterSpacing: '0.2em', textTransform: 'uppercase',
      marginBottom: 10, fontFamily: MONTSERRAT,
      ...extra,
    }}>{children}</div>
  )
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', justifyContent: 'flex-end', zIndex: 300,
  },
  panel: {
    width: 380, maxWidth: '100vw', height: '100%',
    background: 'linear-gradient(180deg, #0a0e1a 0%, #060914 100%)',
    backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    color: '#e2e8f0', fontFamily: INTER, position: 'relative',
  },

  // Header
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '20px 18px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'linear-gradient(180deg, rgba(255,202,69,0.04) 0%, transparent 100%)',
    flexShrink: 0,
  },
  headerHexes: {
    width: 42, height: 42,
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    background: 'linear-gradient(135deg, rgba(255,202,69,0.18), rgba(168,85,247,0.12))',
    border: '1px solid rgba(255,202,69,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: MONTSERRAT,
    letterSpacing: '0.05em',
  },
  headerSub: {
    fontSize: 11, color: '#64748b', marginTop: 2, letterSpacing: '0.05em',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  // Tabs
  tabRow: {
    display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.015)', flexShrink: 0,
  },
  tabBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '12px 8px', background: 'transparent', border: 'none',
    cursor: 'pointer', fontFamily: MONTSERRAT, fontWeight: 700, fontSize: 11,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    position: 'relative', transition: 'color 0.2s',
  },
  tabUnderline: {
    position: 'absolute', bottom: -1, left: '20%', right: '20%', height: 2,
    background: 'linear-gradient(90deg, transparent, #ffca45 50%, transparent)',
    boxShadow: '0 0 10px rgba(255,202,69,0.6)',
  },

  // Body
  body: {
    flex: 1, overflowY: 'auto', padding: '16px 16px 24px',
    scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
  },

  // List + card
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12, padding: '10px 12px',
    transition: 'border-color 0.2s, transform 0.15s',
  },
  incomingCard: {
    background: 'linear-gradient(135deg, rgba(255,202,69,0.06), rgba(255,202,69,0.01))',
    border: '1px solid rgba(255,202,69,0.18)',
  },
  cardName: { fontSize: 14, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardSub:  { fontSize: 11, marginTop: 2, color: '#64748b' },
  cardActions: { display: 'flex', gap: 5 },

  iconBtn: {
    width: 30, height: 30, borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    color: '#94a3b8', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', flexShrink: 0,
  },

  acceptBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none',
    borderRadius: 8, color: '#fff', padding: '7px 11px',
    fontSize: 11, fontWeight: 800, cursor: 'pointer',
    fontFamily: MONTSERRAT, letterSpacing: '0.05em', textTransform: 'uppercase',
    boxShadow: '0 2px 10px rgba(34,197,94,0.3)', flexShrink: 0,
  },
  declineBtn: {
    width: 30, height: 30, borderRadius: 8,
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
    color: '#ef4444', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cancelBtn: {
    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#94a3b8', padding: '6px 12px',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
  },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'linear-gradient(135deg, rgba(255,202,69,0.18), rgba(255,202,69,0.06))',
    border: '1px solid rgba(255,202,69,0.35)',
    borderRadius: 8, color: '#ffca45', padding: '7px 11px',
    fontSize: 11, fontWeight: 800, cursor: 'pointer',
    fontFamily: MONTSERRAT, letterSpacing: '0.05em', textTransform: 'uppercase',
    flexShrink: 0,
  },
  statusChip: (color) => ({
    fontSize: 10, fontWeight: 700, color,
    background: `${color}15`, border: `1px solid ${color}40`,
    padding: '5px 10px', borderRadius: 8,
    letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0,
    fontFamily: MONTSERRAT,
  }),

  // Search
  searchWrap: {
    position: 'relative', marginBottom: 6,
  },
  searchIcon: {
    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
    fontSize: 18, color: '#475569', pointerEvents: 'none',
  },
  searchInput: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, padding: '10px 36px',
    color: '#fff', fontSize: 13, fontFamily: INTER, outline: 'none',
    transition: 'border-color 0.2s',
  },
  searchClear: {
    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
    width: 24, height: 24, borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)', border: 'none',
    color: '#94a3b8', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  searchHint: {
    fontSize: 10, color: '#475569', marginBottom: 14,
    letterSpacing: '0.1em', textTransform: 'uppercase',
  },

  emptyMini: {
    fontSize: 12, color: '#475569', padding: '12px 14px',
    background: 'rgba(255,255,255,0.02)', borderRadius: 10,
    border: '1px dashed rgba(255,255,255,0.06)',
  },

  // Confirm
  confirmOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 20, zIndex: 40,
  },
  confirmBox: {
    background: '#0a0e1a', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 14, padding: 20, textAlign: 'center', maxWidth: 300,
    boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
  },
  confirmTitle: { fontSize: 15, fontWeight: 800, color: '#fff', fontFamily: MONTSERRAT, marginBottom: 4 },
  confirmSub: { fontSize: 12, color: '#94a3b8', lineHeight: 1.4 },
  confirmCancel: {
    flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: '#94a3b8', padding: '10px',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  confirmRemove: {
    flex: 1, background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none',
    borderRadius: 10, color: '#fff', padding: '10px',
    fontSize: 12, fontWeight: 800, cursor: 'pointer',
    fontFamily: MONTSERRAT, letterSpacing: '0.05em', textTransform: 'uppercase',
  },
}
