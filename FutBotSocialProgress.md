# FUTBOT Social - Progress Tracker

## Overview
FUTBOT Social is a football party-game platform for Discord Activities with three games: Guess The Player, Higher or Lower, and Football Survivor.

---

## Data Source
- **Kaggle Dataset**: `salimt/football-datasets` (or similar football player datasets)
- **Files used**:
  - `player_profiles.csv` - Player metadata (name, nationality, position, current club, DOB)
  - `player_performances.csv` - Club match statistics (goals, assists, appearances, minutes, cards, clean sheets) per season
  - `player_national_performances.csv` - National team caps and goals (optional)

## Database Schema (Supabase)
Table: `players`
```sql
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    nationality TEXT NOT NULL DEFAULT 'Unknown',
    position TEXT NOT NULL DEFAULT 'Unknown',
    club TEXT NOT NULL DEFAULT 'Unknown',
    league TEXT NOT NULL DEFAULT 'Unknown',
    age INTEGER DEFAULT 25,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    appearances INTEGER DEFAULT 0,
    rating DECIMAL(4,2) DEFAULT 75.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Import Script (`activity/backend/data/import_players.py`)

### Processing Pipeline
1. **Read profiles**: Load player metadata from `player_profiles.csv`
2. **Aggregate club stats**: Process `player_performances.csv` in chunks (100k rows at a time)
   - Sum ALL career stats (goals, assists, appearances, minutes, yellow cards, clean sheets) from ALL leagues
   - Track top league appearances separately (for filtering only)
3. **Add national stats**: Read `player_national_performances.csv` and add caps + goals to totals
4. **Combine totals**: 
   - `goals = club_goals + national_goals`
   - `appearances = club_appearances + national_caps`
   - `assists = club_assists` (national assists not tracked separately)

### Fame Filter (Target: ~15,000 players)
A player qualifies if they meet ANY of:
- **30+ top-league appearances** (played in Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, etc.)
- **5+ national caps** (representative of national team level)
- **50+ career goals** (proven goalscorer regardless of league)

### Top Leagues Recognized
Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Eredivisie, Primeira Liga, Süper Lig, Scottish Premiership, Championship, and 20+ more major competitions.

### Top Clubs Recognized
Manchester City, Real Madrid, Bayern Munich, Juventus, PSG, Ajax, Porto, Celtic, Galatasaray, and 30+ other major clubs.

### Name Cleaning
- Removed `(ID)` artifacts from names using regex: `re.sub(r'\s*\(\d+\)\s*$', '', name)`
- Example: `"Cristiano Ronaldo (8198)"` → `"Cristiano Ronaldo"`

### Position Normalization
- Goalkeeper → GK
- Defender/Back → DEF
- Midfielder → MID
- Forward/Attack/Striker/Winger → FWD

### Hard Cap
- Maximum **15,000 players** imported (sorted by top league appearances, then goals, then national caps)
- Final count: ~15,000 famous players

### Import to Supabase
- Clears existing table before import
- Batch inserts of 1,000 players at a time
- Uses `upsert` on conflict with `name` field
- Uses Service Role Key (not anon key) for backend access
- Enables RLS with public read policy for game queries

## Environment Setup
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Indexes Created
- `idx_players_position` - For filtering by position
- `idx_players_league` - For league-based queries
- `idx_players_nationality` - For nationality clues
- `idx_players_rating` - For rating-based sorting
- `idx_players_goals` - For stat-based queries

---

## Backend API (`backend/routes/social_games.py`)

### Fuzzy Search
- `GET /api/social/games/guess-player/search?query={name}&limit=5`
- Levenshtein distance matching for typos (e.g., "halland" → "Haaland")
- 100ms debounce on frontend

### Guess The Player
- `GET /api/social/games/guess-player/random` - Returns random player with clues (no name!)
- `POST /api/social/games/guess-player/check` - Validates guess against player ID

### Higher or Lower
- `GET /api/social/games/higher-lower/stats` - Available stat categories
- `GET /api/social/games/higher-lower/start?stat={goals|assists|appearances}` - Start game
- `POST /api/social/games/higher-lower/guess` - Submit higher/lower guess

### Football Survivor
- `POST /api/social/games/survivor/create` - Create room (4-10 players)
- `POST /api/social/games/survivor/join` - Join room by code
- `GET /api/social/games/survivor/room/{room_id}` - Get room state
- `POST /api/social/games/survivor/start-round` - Start voting round (10s timer)
- `POST /api/social/games/survivor/vote` - Submit secret vote
- `POST /api/social/games/survivor/reveal` - Reveal results, eliminate minority

---

## Frontend Games

### Social Home (`frontend/src/pages/social/SocialHome.jsx`)
- Dark stadium background with purple branding
- Discord-friendly UI
- One primary action per screen
- Navigation to all three games

### Guess The Player (`frontend/src/pages/social/GuessThePlayer.jsx`)
- **Autocomplete**: Fuzzy search with dropdown, keyboard navigation (↑↓), Enter to select
- **Difficulty selector**: Easy (3 clues), Medium (2 clues), Hard (1 clue)
- **Scoring**: 10→8→6→4→2 points based on clues used
- **10 rounds** per game
- **Flow**: Start with 1 clue → guess wrong → next clue auto-revealed → repeat until correct or out of clues
- **"I Give Up"** button reveals answer with 0 points
- **Final score screen** with accuracy percentage

### Higher or Lower (`frontend/src/pages/social/HigherOrLower.jsx`)
- **Stat selector**: Goals, Assists, or Appearances (chosen once per game)
- **15 rounds** per game
- **5-second countdown timer** with visual bar (green → yellow → red)
- **"Now or Never"** mechanic - forces simultaneous decisions
- **Streak tracking** with high score saved to localStorage
- **Game over screen** with accuracy stats

### Football Survivor (`frontend/src/pages/social/FootballSurvivor.jsx`)
- **Room system**: 4-10 players, host needs 4+ to start
- **10 predefined questions**: "Better striker?", "Who would you sign?", etc.
- **10-second voting timer** with visual countdown bar
- **Secret voting**: Votes hidden until reveal
- **Majority survives, minority eliminated** (tie = everyone survives)
- **Auto-elimination**: No votes = random elimination
- **Final standings** with winner crowned

---

## Known Issues & Fixes Applied

| Issue | Fix |
|-------|-----|
| Player names had `(id)` appended | Regex cleaning in import script |
| National caps showed 0 | Fixed column mapping for national performances CSV |
| 422 Unprocessable Entity errors | Switched all POST endpoints from query params to JSON body parsing |
| Pydantic model caching issues | Added `2` suffix to endpoints (e.g., `/check2`) to bypass FastAPI cache |
| Guess submission didn't work | Added manual "Submit Guess" button, fixed click handlers |
| Next clue was slow | Removed setTimeout delay, instant reveal on wrong guess |
| Frontend build errors | Removed duplicate function declarations |

---

## Next Steps (V1)
- [ ] Test all three games end-to-end
- [ ] Add player avatars/images to game UIs
- [ ] Add sound effects for correct/wrong answers
- [ ] Add Discord Activity SDK integration
- [ ] Add leaderboard for high scores
- [ ] Add game history/stats tracking

## V2 Features (Future)
- Daily challenges
- Tournament mode
- Custom room settings
- Spectator mode
- More question types for Survivor
- Player rarity tiers (Bronze/Silver/Gold)

---

## Files Created/Modified

### Backend
- `backend/routes/social_games.py` - All game endpoints
- `data/import_players.py` - Player database import
- `data/README.md` - Import documentation

### Frontend
- `frontend/src/pages/social/GuessThePlayer.jsx` - Guess game
- `frontend/src/pages/social/HigherOrLower.jsx` - Higher/Lower game
- `frontend/src/pages/social/FootballSurvivor.jsx` - Survivor game
- `frontend/src/pages/social/SocialHome.jsx` - Social hub
- `frontend/src/App.jsx` - Updated routing
- `frontend/src/lib/api.js` - Added error logging

### Design
- `FutBotSocial.md` - Full game design document
- `FutBotSocialProgress.md` - This file

---

*Last updated: 2026-06-14*
*Games implemented: 3/3 (100%)*
*Testing status: Ready for testing*
