# FutBot Activity — Build Progress

## Overview

A Discord Activity (embedded iframe web app) for the FutBot Discord bot. Phase 1 is fully standalone — shares `cards_game.db` with the bot but has its own API server and drop logic. Phase 2 (future) will integrate directly with the bot.

**Primary feature:** Real-time 1v1 card battles.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + Vite |
| Discord SDK | `@discord/embedded-app-sdk` |
| Backend | FastAPI (Python) |
| Database | SQLite (`cards_game.db`) — WAL mode |
| Real-time | FastAPI WebSockets |
| Dev tunnel | cloudflared |
| Fonts | Montserrat (headlines), Inter (body), Material Symbols Outlined (self-hosted via `material-symbols` npm) |

---

## Folder Structure

```
FutBot/
├── bot.py                        # existing bot — untouched
├── cards_game.db                 # shared DB
├── activity/
│   ├── frontend/                 # React + Vite
│   │   ├── public/
│   │   │   ├── background.png    # stadium background
│   │   │   ├── packs.png         # packs panel image
│   │   │   ├── playmatch.png     # play match panel image
│   │   │   ├── decks.png         # decks panel image
│   │   │   └── futbot.png        # logo for loading screen
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Nav.jsx              # bottom nav (all pages except home)
│   │       │   ├── FutCard.jsx          # shared card display component
│   │       │   ├── StarterPackModal.jsx # new user starter pack reveal
│   │       │   ├── LoadingScreen.jsx    # auth loading screen
│   │       │   ├── ChallengeNotification.jsx  # global challenge banner
│   │       │   ├── OnlinePanel.jsx      # VC participants popup
│   │       │   └── ProfileModal.jsx     # slide-in profile panel
│   │       ├── pages/
│   │       │   ├── Home.jsx       # landing page with custom nav
│   │       │   ├── Collection.jsx # card browser
│   │       │   ├── DeckBuilder.jsx
│   │       │   ├── Battle.jsx     # full battle system
│   │       │   ├── Packs.jsx      # pack opening with flip animation
│   │       │   └── Shop.jsx       # buy packs / sell cards
│   │       ├── lib/
│   │       │   ├── api.js         # apiFetch, preloadImage, preloadImages
│   │       │   └── discord.js     # discordSdk singleton
│   │       ├── App.jsx
│   │       ├── index.css          # global styles + CSS animations
│   │       └── main.jsx
│   └── backend/
│       ├── main.py               # FastAPI app entry
│       ├── db.py                 # SQLite connection (WAL mode)
│       ├── auth.py               # Discord OAuth token verification + 5min cache
│       └── routes/
│           ├── auth.py           # POST /api/token, GET /api/me
│           ├── collection.py     # GET /api/collection
│           ├── decks.py          # GET/POST/PUT/DELETE /api/decks
│           ├── packs.py          # GET /api/packs, POST /api/packs/open/{type}, POST /api/packs/starter
│           ├── shop.py           # GET /api/shop/packs, POST /api/shop/buy/{type}, POST /api/shop/sell/{id}
│           ├── profile.py        # GET /api/profile, PUT /api/profile/title
│           └── battles.py        # WebSocket battles + lobby/challenge REST endpoints
```

---

## Features Built

### Auth
- Discord OAuth2 via Embedded App SDK
- Token exchanged server-side (`POST /api/token`)
- Token verification cached for 5 minutes (avoids hitting Discord API on every request)
- New players auto-created in `players` table on first `/api/me` call

### Home Page
- Custom layout (not using global bottom nav)
- **Top bar:** FutBot logo, coin balance, profile pill (clickable)
- **Three panels:** Packs, Play Match (gold border, pulsing CTA), Decks — each using provided PNG as full background
- **Bottom nav:** HOME, COLLECTION, SHOP, PACKS, DECKS, BATTLE with gold active state + glow underline
- **Online chip:** shows stacked avatars of VC participants, clickable to open OnlinePanel popup
- Stadium `background.png` shows through all panels with dark overlay
- Ember particle animations (floating gold dots)

### Collection Browser
- Grid view, cards sorted by overall DESC
- Filter by Rarity, Position, Type
- Click card → modal with OVR (large), ATK/DEF/SPD stats
- Lazy loading on grid images, eager loading where immediate display needed

### Deck Builder
- List decks with mini card strip preview
- Editor: 5 slots at top (fixed 125px wide, crop to show card face), inventory grid below
- Filters by position and rarity in editor
- Create / Update / Delete decks

### Pack Opening
- Shows only packs you own (hides empty types)
- 3D card flip animation (face-down → flip to reveal)
- All card images preloaded before animation starts
- Card-by-card reveal with stats, then summary grid

**Pack types:**
| Pack | Contents | Cost |
|------|----------|------|
| Rare Player Pack | 1 card, 80% Standard >85 OVR / 20% non-Standard >85 OVR | 1,000 coins |
| Icon Pack | 1 Icon card | 2,500 coins |
| Hero Pack | 1 Hero card | 1,750 coins |
| Tester Pack | 1 Icon + 4 high-overall cards (not buyable) | — |

**Starter Pack (new users):** 6 Common (70-79 OVR) + 3 Uncommon (80-85 OVR) + 1 Rare Standard (>85 OVR). Claimed once on first activity open, then user is redirected to Deck Builder.

### Shop
- **Buy Packs tab:** shows affordable packs, coin balance, buy with coins
- **Sell Cards tab:** collection grid with sell value shown, tap → confirm sheet
- Sell value formula (matches bot): Base (100/175/250) + 50 + (overall-70)×5

### Profile Modal
- Opens by clicking profile pill in home top bar
- Slide-in panel from right
- Shows: avatar, username, current title, coins
- Battle stats: Played, Won, Lost, Drawn, Win Rate
- Round stats: Played, Won, Lost, Drawn
- Card collection: Total, Common, Uncommon, Rare counts
- **Title selector:** chips for each earned achievement title, save updates top bar instantly

### Battle System

**Lobby modes (from Home → Find Match or Play with Friend):**
- **Find Match:** shows VC participants with Challenge buttons; "Create Room" fallback
- **Play with Friend:** Create Room & Share Code, or Join with code input

**Flow:**
1. Both players connect to room (no deck needed yet)
2. Both see "Select Your Squad" deck selection screen in the arena
3. If opponent selects first → green "✓ ready" banner appears
4. Both send `ready` → VS splash (2.2s) → game starts

**Battle mechanic:**
- 5 rounds, best of 3 wins (first to 3 round wins wins the match)
- Odd rounds: host picks stat | Even rounds: guest picks stat (alternates)
- Stat pairs: Attack ↔ Defense (attacker's ATK vs defender's DEF), Speed ↔ Speed
- Tiebreaker if stat values equal: higher overall wins; if still equal → round draw
- 4 second delay between rounds (auto-advance)

**Surrender:** Two-step in-bar confirmation (Surrender → "Sure? Yes / No"), no browser dialog

**Rematch:** Both click Rematch → goes back to deck selection (can switch decks)

**Rewards (match end):**
- Win: +200 coins, `battles_played+1`, `battles_won+1`
- Loss: +100 coins, `battles_played+1`, `battles_lost+1`
- Draw: +150 coins each, `battles_played+1`, `battles_drawn+1`

**Round stats (every round):**
- Both: `rounds_played+1`
- Winner: `rounds_won+1` | Loser: `rounds_lost+1` | True draw: both `rounds_drawn+1`

### Challenge System
- **Online chip:** clickable on all pages → OnlinePanel popup showing VC participants with Challenge buttons
- **Challenging:** sends `POST /api/challenges` with room_id, challenger connects to room and waits
- **Accepting (notification):** global `ChallengeNotification` banner appears on any page → click Accept → "Enter the Arena" screen with deck selector → connects to room
- **Accepting (Battle page):** same Arena screen shown
- **Declining:** sends `challenge_declined` WebSocket message to inviter → they see message and return to lobby
- Challenge TTL: 60 seconds

### Online/Presence System
- Lobby registration: `POST /api/lobby/register` called every 30s with channel_id
- Participants: `GET /api/lobby/participants` returns others in same VC session with avatar hashes
- Stacked avatar display in online chip across all pages

---

## WebSocket Protocol (`/ws/battle/{room_id}`)

### Server → Client

| Message | When |
|---------|------|
| `waiting` | First player connected |
| `select_deck` | Both connected — deck selection phase |
| `opponent_deck_ready` | Opponent has selected their deck |
| `round_start` | Round begins; includes `picks_stat` (bool), hand, score |
| `stat_chosen` | Host picked stat; includes `your_stat`, `opponent_stat` |
| `opponent_picked` | Opponent has played a card |
| `round_result` | Round resolved; includes both cards, winner, score |
| `game_over` | Match over; includes winner, final_score, coins_earned |
| `rematch_requested` | Opponent wants a rematch |
| `challenge_declined` | Challenge was declined |
| `opponent_disconnected` | Other player left |
| `error` | Something went wrong |

### Client → Server

| Message | When |
|---------|------|
| `ready` | Player has selected deck; includes `deck_name` |
| `pick_stat` | Host choosing stat for round (odd rounds) |
| `pick_card` | Playing a card; includes `card_id` |
| `surrender` | Forfeit match |
| `rematch_request` | Request a rematch |

---

## REST API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/token` | Exchange OAuth code for access token |
| GET | `/api/me` | Auth'd user + player row (creates player if new) |
| GET | `/api/collection` | User's cards with filters |
| GET | `/api/decks` | User's decks with card details |
| POST | `/api/decks` | Create deck |
| PUT | `/api/decks/{name}` | Update deck |
| DELETE | `/api/decks/{name}` | Delete deck |
| GET | `/api/packs` | User's pack inventory |
| POST | `/api/packs/open/{type}` | Open a pack |
| POST | `/api/packs/starter` | Claim starter pack (once) |
| GET | `/api/shop/packs` | Buyable packs + coin balance |
| POST | `/api/shop/buy/{type}` | Buy a pack |
| GET | `/api/shop/sell-value/{id}` | Get sell price for a card |
| POST | `/api/shop/sell/{id}` | Sell a card |
| GET | `/api/profile` | Full profile: stats + card counts + earned titles |
| PUT | `/api/profile/title` | Set display title |
| POST | `/api/lobby/register` | Register VC presence (call every 30s) |
| GET | `/api/lobby/participants` | Other users in same VC session |
| POST | `/api/challenges` | Send a challenge to another user |
| GET | `/api/challenges/incoming` | Check for pending incoming challenge |
| DELETE | `/api/challenges/decline` | Decline/clear challenge (`?silent=true` for accepts) |

---

## Key Design Decisions

- **No deck selection in lobby** — deck is picked inside the arena after both players connect, making the challenge flow frictionless
- **Pack drop logic is standalone** — replicated from bot.py weights but independent; will be reconciled in Phase 2
- **Token verification cached** — Discord API is hit once per 5 minutes per token to avoid latency on every request
- **Images preloaded before animations** — pack flip and battle reveal wait for images to load before playing
- **Material Symbols self-hosted** — Discord Activity CSP blocks Google Fonts CDN; font served from local `node_modules/material-symbols/`
- **No lazy loading in battle** — `loading="lazy"` removed from battle card images since they need to appear immediately

---

## Local Dev Setup

```bash
# Terminal 1 — tunnel
cloudflared tunnel --url http://localhost:5173

# Terminal 2 — frontend
cd activity/frontend && npm run dev

# Terminal 3 — backend
cd activity/backend && uvicorn main:app --reload --port 8000
```

Vite proxies `/api`, `/ws`, and `/images` to FastAPI locally.

---
