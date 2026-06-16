from fastapi import APIRouter, HTTPException, Query, Request

from typing import List, Optional, Dict
import random
import re
from supabase_client import get_supabase

# ============ FUZZY SEARCH UTILS ============

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calculate edit distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]


def fuzzy_match(query: str, target: str) -> float:
    """Return match score 0-1 based on fuzzy matching."""
    query = query.lower().strip()
    target = target.lower().strip()
    
    # Exact match
    if query == target:
        return 1.0
    
    # Contains query
    if query in target:
        return 0.9
    
    # Target starts with query
    if target.startswith(query):
        return 0.85
    
    # Word boundary match
    words = target.split()
    for word in words:
        if word.startswith(query):
            return 0.8
        if query in word:
            return 0.7
    
    # Fuzzy match with edit distance
    max_len = max(len(query), len(target))
    if max_len == 0:
        return 0.0
    
    distance = levenshtein_distance(query, target)
    similarity = 1 - (distance / max_len)
    
    if similarity >= 0.6:  # Threshold for fuzzy match
        return similarity * 0.6  # Scale down fuzzy matches
    
    return 0.0


# Cache all player names for fast search
_player_name_cache: List[dict] = []

def get_cached_players():
    """Get cached player list or fetch from DB."""
    global _player_name_cache
    if not _player_name_cache:
        supabase = get_supabase()
        result = supabase.table("players").select("id,name").execute()
        _player_name_cache = result.data or []
    return _player_name_cache


router = APIRouter(prefix="/api/social")

@router.get("/test")
async def test_endpoint():
    """Test that new code is loaded."""
    return {"status": "ok", "version": "2"}


@router.get("/games/guess-player/search")
async def search_players(query: str = Query(..., min_length=1), limit: int = 5):
    """Fuzzy search for player autocomplete."""
    players = get_cached_players()
    query = query.lower().strip()
    
    # Score all players
    scored = []
    for player in players:
        name = player.get("name", "")
        if not name:
            continue
        
        score = fuzzy_match(query, name)
        if score > 0:
            scored.append({**player, "score": score})
    
    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)
    
    # Return top results without score
    results = [{"id": p["id"], "name": p["name"]} for p in scored[:limit]]
    return {"results": results, "query": query}

# ============ GUESS THE PLAYER ============




CLUE_TYPES = [
    {"key": "league", "label": "League", "priority": 1},
    {"key": "position", "label": "Position", "priority": 2},
    {"key": "nationality", "label": "Nationality", "priority": 3},
    {"key": "club", "label": "Club", "priority": 4},
    {"key": "age", "label": "Age", "priority": 5},
]


@router.get("/games/guess-player/random")
async def get_random_player_for_guess():
    """Get a random player with clues for Guess The Player game."""
    supabase = get_supabase()
    
    # Get random player
    result = supabase.table("players").select("*").limit(100).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No players found")
    
    player = random.choice(result.data)
    
    # Generate clues (reveal some, hide others)
    clues_to_reveal = random.sample(CLUE_TYPES, k=min(3, len(CLUE_TYPES)))
    clues = []
    
    for clue_type in clues_to_reveal:
        value = player.get(clue_type["key"], "Unknown")
        if value and value != "Unknown":
            clues.append({
                "type": clue_type["label"],
                "value": value,
                "priority": clue_type["priority"]
            })
    
    # Sort by priority
    clues.sort(key=lambda x: x["priority"])
    
    return {
        "player_id": player["id"],
        "player_name": player["name"],  # For "give up" reveal
        "clues": clues,
    }


@router.post("/games/guess-player/check2")
async def check_guess(request: Request):
    """Check if the guess is correct."""
    import logging
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger(__name__)
    
    # Parse JSON body manually
    try:
        body = await request.json()
        logger.info(f"Received raw body: {body}")
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")
    
    supabase = get_supabase()
    
    guess = body.get('guess', '').strip() if body.get('guess') else ''
    player_id = body.get('player_id')
    
    logger.info(f"Extracted: guess='{guess}', player_id={player_id}, type={type(player_id)}")
    
    # Convert player_id to int if it's a string
    if isinstance(player_id, str):
        try:
            player_id = int(player_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="player_id must be a number")
    
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id is required")
    
    logger.info(f"Final: guess='{guess}', player_id={player_id}, type={type(player_id)}")
    
    # Get the actual player
    result = supabase.table("players").select("*").eq("id", player_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player = result.data
    correct_name = player["name"].lower().strip()
    guess_lower = guess.lower()
    
    # Check exact match or contains
    is_correct = (guess_lower == correct_name or 
                  guess_lower in correct_name or 
                  correct_name in guess_lower or
                  # Check last name only
                  guess_lower == correct_name.split()[-1].lower())
    
    return {
        "correct": is_correct,
        "player": player,
        "your_guess": guess
    }


# ============ HIGHER OR LOWER ============

STAT_OPTIONS = [
    {"key": "goals", "label": "Career Goals"},
    {"key": "assists", "label": "Career Assists"},
    {"key": "appearances", "label": "Appearances"},
]


@router.get("/games/higher-lower/stats")
async def get_higher_lower_stats():
    """Get available stat options."""
    return {"stats": STAT_OPTIONS}


@router.get("/games/higher-lower/start")
async def start_higher_lower(stat: str = "goals"):
    """Start a new Higher or Lower game with selected stat."""
    supabase = get_supabase()
    
    # Validate stat
    valid_stats = [s["key"] for s in STAT_OPTIONS]
    if stat not in valid_stats:
        stat = "goals"
    
    # Get two random players
    result = supabase.table("players").select("*").gte("appearances", 100).limit(100).execute()
    if len(result.data) < 2:
        raise HTTPException(status_code=404, detail="Not enough players")
    
    players = random.sample(result.data, k=2)
    stat_label = next(s["label"] for s in STAT_OPTIONS if s["key"] == stat)
    
    return {
        "current_player": players[0],
        "next_player_id": players[1]["id"],
        "stat": stat,
        "stat_label": stat_label,
    }


@router.post("/games/higher-lower/guess2")
async def check_higher_lower(request: Request):
    """Check higher/lower guess and return result."""
    supabase = get_supabase()
    
    body = await request.json()
    
    current_player_id = body.get('current_player_id')
    next_player_id = body.get('next_player_id')
    stat = body.get('stat', 'goals')
    guess = body.get('guess', '').lower()
    
    # Get both players
    current = supabase.table("players").select("*").eq("id", current_player_id).single().execute()
    next_player = supabase.table("players").select("*").eq("id", next_player_id).single().execute()
    
    if not current.data or not next_player.data:
        raise HTTPException(status_code=404, detail="Player not found")
    
    current_val = current.data.get(stat, 0) or 0
    next_val = next_player.data.get(stat, 0) or 0
    
    # Determine correct answer
    if next_val > current_val:
        correct_answer = "higher"
    elif next_val < current_val:
        correct_answer = "lower"
    else:
        correct_answer = "equal"  # Edge case
    
    is_correct = guess == correct_answer or correct_answer == "equal"
    
    # Get next random player for continuing the game
    new_result = supabase.table("players").select("*").gte("appearances", 100).limit(50).execute()
    new_next = random.choice(new_result.data) if new_result.data else None
    
    return {
        "correct": is_correct,
        "current_value": current_val,
        "next_value": next_val,
        "next_player": next_player.data,
        "new_next_player_id": new_next["id"] if new_next else None,
        "stat_label": next(s["label"] for s in STAT_OPTIONS if s["key"] == stat),
    }


# ============ FOOTBALL SURVIVOR ============

# Predefined question templates
SURVIVOR_QUESTIONS = [
    {"text": "Who is the better striker?", "type": "comparison"},
    {"text": "Who is the better playmaker?", "type": "comparison"},
    {"text": "Who had the more successful career?", "type": "comparison"},
    {"text": "Who would you rather sign for your team?", "type": "preference"},
    {"text": "Who is more underrated?", "type": "opinion"},
    {"text": "Who is the bigger club legend?", "type": "opinion"},
    {"text": "Who was more clutch in big games?", "type": "opinion"},
    {"text": "Who had better technique?", "type": "comparison"},
    {"text": "Who would win in a 1v1?", "type": "hypothetical"},
    {"text": "Who had the better prime years?", "type": "comparison"},
]

# In-memory storage for rooms (use Redis in production)
survivor_rooms: Dict[str, dict] = {}


@router.post("/games/survivor/create2")
async def create_survivor_room(request: Request):
    """Create a new Survivor game room."""
    import uuid
    
    body = await request.json()
    host_id = body.get('host_id')
    host_name = body.get('host_name')
    
    room_id = str(uuid.uuid4())[:8].upper()
    
    survivor_rooms[room_id] = {
        "room_id": room_id,
        "host_id": host_id,
        "players": [{"id": host_id, "name": host_name, "alive": True}],
        "status": "waiting",
        "question": None,
        "votes": {},
        "round": 0,
        "vote_end_time": None,
        "min_players": 4,
        "max_players": 10,
    }
    
    return {"room_id": room_id, "status": "waiting"}


@router.post("/games/survivor/join2")
async def join_survivor_room(request: Request):
    """Join an existing Survivor room."""
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    player_name = body.get('player_name')
    
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    
    # Check room capacity
    if len(room["players"]) >= room.get("max_players", 10):
        raise HTTPException(status_code=400, detail="Room is full (max 10 players)")
    
    # Check if player already in room
    if any(p["id"] == player_id for p in room["players"]):
        return {"room": room}
    
    # Add player
    room["players"].append({
        "id": player_id,
        "name": player_name,
        "alive": True
    })
    
    return {"room": room}


@router.get("/games/survivor/room/{room_id}")
async def get_survivor_room(room_id: str):
    """Get current state of a Survivor room."""
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return survivor_rooms[room_id]


@router.post("/games/survivor/start-round2")
async def start_survivor_round(request: Request):
    """Start a new voting round with 10-second timer."""
    import time
    
    body = await request.json()
    room_id = body.get('room_id')
    
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    supabase = get_supabase()
    
    # Get alive players only
    alive_players_list = [p for p in room["players"] if p["alive"]]
    
    # Check minimum players
    if len(alive_players_list) < 2:
        room["status"] = "finished"
        return {"room": room, "error": "Not enough players remaining"}
    
    # Get two random players for comparison
    result = supabase.table("players").select("*").gte("appearances", 200).limit(100).execute()
    if len(result.data) < 2:
        raise HTTPException(status_code=404, detail="Not enough players in database")
    
    players = random.sample(result.data, k=2)
    
    # Select random question template
    question_template = random.choice(SURVIVOR_QUESTIONS)
    
    question = {
        "text": question_template["text"],
        "type": question_template["type"],
        "option_a": {"name": players[0]["name"], "id": players[0]["id"], "club": players[0].get("club", ""), "position": players[0].get("position", "")},
        "option_b": {"name": players[1]["name"], "id": players[1]["id"], "club": players[1].get("club", ""), "position": players[1].get("position", "")}
    }
    
    room["question"] = question
    room["status"] = "voting"
    room["votes"] = {}
    room["round"] += 1
    room["vote_end_time"] = time.time() + 10  # 10 seconds to vote
    
    return {"room": room, "vote_duration": 10}


@router.post("/games/survivor/vote2")
async def submit_survivor_vote(request: Request):
    """Submit a vote in Survivor."""
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    vote = body.get('vote')
    
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    room["votes"][str(player_id)] = vote
    
    return {"success": True, "votes_count": len(room["votes"])}


@router.post("/games/survivor/reveal2")
async def reveal_survivor_results(request: Request):
    """Reveal results and eliminate minority voters."""
    body = await request.json()
    room_id = body.get('room_id')
    
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    
    # Get only alive players who voted
    alive_players = [p for p in room["players"] if p["alive"]]
    alive_player_ids = {str(p["id"]) for p in alive_players}
    
    # Filter votes to only alive players
    valid_votes = {k: v for k, v in room["votes"].items() if k in alive_player_ids}
    
    # Count votes
    votes_a = sum(1 for v in valid_votes.values() if v == "option_a")
    votes_b = sum(1 for v in valid_votes.values() if v == "option_b")
    total_votes = votes_a + votes_b
    
    # Determine minority (eliminate them)
    eliminated = []
    winning_option = None
    
    if total_votes == 0:
        # No votes - random elimination
        import random
        if alive_players:
            victim = random.choice(alive_players)
            victim["alive"] = False
            eliminated.append(victim["name"])
    elif votes_a == votes_b:
        # Tie - everyone survives
        pass
    elif votes_a < votes_b:
        # Option A is minority - eliminate A voters
        winning_option = "option_b"
        for player_id, vote in valid_votes.items():
            if vote == "option_a":
                for p in room["players"]:
                    if str(p["id"]) == player_id:
                        p["alive"] = False
                        eliminated.append(p["name"])
                        break
    else:
        # Option B is minority - eliminate B voters
        winning_option = "option_a"
        for player_id, vote in valid_votes.items():
            if vote == "option_b":
                for p in room["players"]:
                    if str(p["id"]) == player_id:
                        p["alive"] = False
                        eliminated.append(p["name"])
                        break
    
    # Check if game over (1 player left or less)
    remaining_alive = [p for p in room["players"] if p["alive"]]
    if len(remaining_alive) <= 1:
        room["status"] = "finished"
        winner = remaining_alive[0] if remaining_alive else None
    else:
        room["status"] = "results"
        winner = None
    
    return {
        "room": room,
        "results": {
            "votes_a": votes_a,
            "votes_b": votes_b,
            "winning_option": winning_option,
            "eliminated": eliminated,
            "winner": winner,
            "remaining": len(remaining_alive)
        }
    }


# ============ FOOTBALL IMPOSTOR ============

impostor_rooms: Dict[str, dict] = {}

@router.post("/games/impostor/auto-join")
async def auto_join_impostor(request: Request):
    body = await request.json()
    channel_id = body.get('channel_id')
    player_id = body.get('player_id')
    player_name = body.get('player_name')
    avatar = body.get('avatar')
    
    if not channel_id:
        channel_id = "LOCAL_DEV_ROOM"
        
    room_id = channel_id
    
    if room_id not in impostor_rooms:
        impostor_rooms[room_id] = {
            "room_id": room_id,
            "host_id": player_id,
            "status": "waiting",
            "players": [{"id": player_id, "name": player_name, "avatar": avatar, "is_ready": False}],
            "secret_word": None,
            "category": None,
            "impostor_id": None,
            "turn_index": 0,
            "clues": [],
            "votes": {},
            "vote_end_time": None,
            "winner": None,
            "impostor_guess": None,
            "results_reason": None,
            "current_round": 1,
            "scores": {str(player_id): 0},
            "settings": {
                "clue_time": 30,
                "voting_time": 60,
                "show_category": True,
                "total_rounds": 5
            }
        }
    else:
        room = impostor_rooms[room_id]
        if room["status"] == "waiting":
            if not any(str(p["id"]) == str(player_id) for p in room["players"]):
                room["players"].append({"id": player_id, "name": player_name, "avatar": avatar, "is_ready": False})
                if str(player_id) not in room.get("scores", {}):
                    room.setdefault("scores", {})[str(player_id)] = 0
        elif room["status"] == "results":
            # If the game is already over, auto-reset the room for the new players
            room["status"] = "waiting"
            room["secret_word"] = None
            room["category"] = None
            room["impostor_id"] = None
            room["turn_index"] = 0
            room["clues"] = []
            room["impostor_guess"] = None
            room["results_reason"] = None
            room["current_round"] = 1
            room["scores"] = {}
            for p in room["players"]:
                p["name"] = p["name"].replace(" (Spectator)", "")
                room["scores"][str(p["id"])] = 0
            if not any(str(p["id"]) == str(player_id) for p in room["players"]):
                room["players"].append({"id": player_id, "name": player_name, "avatar": avatar, "is_ready": False})
                room["scores"][str(player_id)] = 0
        else:
            # If game started, let them spectate or resume if they were already in it
            if not any(str(p["id"]) == str(player_id) for p in room["players"]):
                room["players"].append({"id": player_id, "name": player_name + " (Spectator)", "avatar": avatar, "is_ready": False})
            
    return {"room": impostor_rooms[room_id]}

def award_impostor_points(room):
    if "scores" not in room:
        room["scores"] = {str(p["id"]): 0 for p in room["players"]}
        
    if room["winner"] == "impostor":
        if room["impostor_id"]:
            room["scores"][str(room["impostor_id"])] = room.get("scores", {}).get(str(room["impostor_id"]), 0) + 3
    elif room["winner"] == "crew":
        for p in room["players"]:
            if str(p["id"]) != str(room["impostor_id"]) and "(Spectator)" not in p["name"]:
                room["scores"][str(p["id"])] = room.get("scores", {}).get(str(p["id"]), 0) + 1

@router.post("/games/impostor/ready")
async def toggle_impostor_ready(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    
    if room["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Can only ready up in lobby")
        
    for p in room["players"]:
        if str(p["id"]) == str(player_id):
            p["is_ready"] = not p.get("is_ready", False)
            break
            
    return {"room": room}

@router.post("/games/impostor/settings")
async def update_settings(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    settings = body.get('settings')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    if str(room["host_id"]) != str(player_id):
        raise HTTPException(status_code=403, detail="Only host can change settings")
        
    if room["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Can only change settings in lobby")
        
    room["settings"].update(settings)
    return {"room": room}

@router.get("/games/impostor/room/{room_id}")
async def get_impostor_room(room_id: str):
    import time
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    
    # Process ghost timeouts
    if room["status"] == "clues" and room.get("clue_end_time") and time.time() > room["clue_end_time"]:
        current_player = room["players"][room["turn_index"]]
        room["clues"].append({
            "player_id": current_player["id"],
            "player_name": current_player["name"],
            "clue": "[SKIPPED]"
        })
        room["turn_index"] += 1
        if room["turn_index"] >= len(room["players"]):
            room["status"] = "voting"
            room["vote_end_time"] = time.time() + room["settings"]["voting_time"] if room["settings"]["voting_time"] > 0 else None
        else:
            room["clue_end_time"] = time.time() + room["settings"]["clue_time"] if room["settings"]["clue_time"] > 0 else None
            
    elif room["status"] == "voting" and room.get("vote_end_time") and time.time() > room["vote_end_time"]:
        vote_counts = {}
        for v in room["votes"].values():
            vote_counts[v] = vote_counts.get(v, 0) + 1
            
        if not vote_counts:
            room["status"] = "results"
            room["winner"] = "impostor"
            room["results_reason"] = "Voting timed out. The Impostor escaped!"
            award_impostor_points(room)
        elif len(vote_counts) > 0:
            max_votes = max(vote_counts.values())
            most_voted_ids = [k for k, v in vote_counts.items() if v == max_votes]
            
            if len(most_voted_ids) > 1:
                room["status"] = "results"
                room["winner"] = "impostor"
                room["results_reason"] = "The vote was a tie! The Impostor escaped."
                award_impostor_points(room)
            else:
                voted_out_id = most_voted_ids[0]
                if str(voted_out_id) == str(room["impostor_id"]):
                    room["status"] = "guess"
                    room["guess_end_time"] = time.time() + room["settings"].get("clue_time", 30) if room["settings"].get("clue_time", 30) > 0 else None
                else:
                    room["status"] = "results"
                    room["winner"] = "impostor"
                    innocent_name = next((p["name"] for p in room["players"] if str(p["id"]) == str(voted_out_id)), "Someone")
                    room["results_reason"] = f"You voted out {innocent_name}, who was innocent. The Impostor escaped!"
                    award_impostor_points(room)

    elif room["status"] == "guess" and room.get("guess_end_time") and time.time() > room["guess_end_time"]:
        room["status"] = "results"
        room["winner"] = "crew"
        room["results_reason"] = f"The Impostor ran out of time to guess '{room['secret_word']}'!"
        award_impostor_points(room)

    return room

@router.post("/games/impostor/leave")
async def leave_impostor_room(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    
    if room_id not in impostor_rooms:
        return {"success": True}
        
    room = impostor_rooms[room_id]
    
    # Remove player
    room["players"] = [p for p in room["players"] if str(p["id"]) != str(player_id)]
    
    if not room["players"]:
        # Delete room if empty
        del impostor_rooms[room_id]
        return {"success": True}
        
    # Reassign host if needed
    if str(room["host_id"]) == str(player_id):
        room["host_id"] = room["players"][0]["id"]
        
    # If mid-game and impostor left
    if room["status"] in ["clues", "voting", "guess"] and str(room["impostor_id"]) == str(player_id):
        room["status"] = "results"
        room["winner"] = "crew"
        room["results_reason"] = "The Impostor disconnected. The Crew wins!"
        
    return {"room": room}

@router.post("/games/impostor/reset")
async def reset_impostor_room(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    if str(room["host_id"]) != str(player_id):
        raise HTTPException(status_code=403, detail="Only host can reset")
        
    room["status"] = "waiting"
    room["secret_word"] = None
    room["category"] = None
    room["impostor_id"] = None
    room["turn_index"] = 0
    room["clues"] = []
    room["votes"] = {}
    room["vote_end_time"] = None
    room["winner"] = None
    room["impostor_guess"] = None
    room["results_reason"] = None
    room["current_round"] = 1
    room["scores"] = {}
    
    # Clean spectator tags and reset ready state
    for p in room["players"]:
        p["name"] = p["name"].replace(" (Spectator)", "")
        p["is_ready"] = False
        room["scores"][str(p["id"])] = 0
        
    return {"room": room}

@router.post("/games/impostor/start2")
async def start_impostor_game(request: Request):
    import time
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    
    if str(room["host_id"]) != str(player_id):
        raise HTTPException(status_code=403, detail="Only host can start the game")
    
    # Filter out spectators
    active_players = [p for p in room["players"] if "(Spectator)" not in p["name"]]
    if len(active_players) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 players")
        
    # Check if all non-host active players are ready
    for p in active_players:
        if str(p["id"]) != str(room["host_id"]) and not p.get("is_ready", False):
            raise HTTPException(status_code=400, detail="Not all players are ready")
            
    supabase = get_supabase()
    
    result = supabase.table("impostor_words").select("*").execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="No words in database")
        
    word_obj = random.choice(result.data)
    room["secret_word"] = word_obj["word"]
    room["category"] = word_obj["category"]
    
    impostor = random.choice(active_players)
    room["impostor_id"] = impostor["id"]
    
    random.shuffle(active_players)
    # Only active players take turns
    room["players"] = active_players
    
    room["status"] = "clues"
    room["turn_index"] = 0
    room["clues"] = []
    room["votes"] = {}
    room["winner"] = None
    room["impostor_guess"] = None
    room["results_reason"] = None
    room["clue_end_time"] = time.time() + room["settings"]["clue_time"] if room["settings"]["clue_time"] > 0 else None
    
    return {"room": room}

@router.post("/games/impostor/next_round")
async def next_impostor_round(request: Request):
    import time
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    
    if str(room["host_id"]) != str(player_id):
        raise HTTPException(status_code=403, detail="Only host can start next round")
        
    if room.get("current_round", 1) >= room["settings"].get("total_rounds", 5):
        raise HTTPException(status_code=400, detail="Match is already over")
        
    # Increment round
    room["current_round"] = room.get("current_round", 1) + 1
    
    # Filter active players
    active_players = [p for p in room["players"] if "(Spectator)" not in p["name"]]
    
    supabase = get_supabase()
    result = supabase.table("impostor_words").select("*").execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="No words in database")
        
    word_obj = random.choice(result.data)
    room["secret_word"] = word_obj["word"]
    room["category"] = word_obj["category"]
    
    impostor = random.choice(active_players)
    room["impostor_id"] = impostor["id"]
    
    random.shuffle(active_players)
    room["players"] = active_players
    
    room["status"] = "clues"
    room["turn_index"] = 0
    room["clues"] = []
    room["votes"] = {}
    room["winner"] = None
    room["impostor_guess"] = None
    room["results_reason"] = None
    room["clue_end_time"] = time.time() + room["settings"]["clue_time"] if room["settings"]["clue_time"] > 0 else None
    
    return {"room": room}

@router.post("/games/impostor/clue2")
async def submit_impostor_clue(request: Request):
    import time
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    clue = body.get('clue')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    
    if room["status"] != "clues":
        raise HTTPException(status_code=400, detail="Not in clue phase")
        
    current_player = room["players"][room["turn_index"]]
    if str(current_player["id"]) != str(player_id) and clue != "[SKIPPED]":
        raise HTTPException(status_code=400, detail="Not your turn")
        
    room["clues"].append({
        "player_id": current_player["id"],
        "player_name": current_player["name"],
        "clue": clue
    })
    
    room["turn_index"] += 1
    
    if room["turn_index"] >= len(room["players"]):
        room["status"] = "voting"
        room["vote_end_time"] = time.time() + room["settings"]["voting_time"] if room["settings"]["voting_time"] > 0 else None
    else:
        room["clue_end_time"] = time.time() + room["settings"]["clue_time"] if room["settings"]["clue_time"] > 0 else None
        
    return {"room": room}

@router.post("/games/impostor/vote2")
async def submit_impostor_vote(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    player_id = body.get('player_id')
    target_id = body.get('target_id')
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    if room["status"] != "voting":
        raise HTTPException(status_code=400, detail="Not in voting phase")
        
    room["votes"][str(player_id)] = target_id
    
    if len(room["votes"]) >= len(room["players"]):
        vote_counts = {}
        for v in room["votes"].values():
            vote_counts[v] = vote_counts.get(v, 0) + 1
            
        max_votes = max(vote_counts.values())
        most_voted_ids = [k for k, v in vote_counts.items() if v == max_votes]
        
        if len(most_voted_ids) > 1:
            room["status"] = "results"
            room["winner"] = "impostor"
            room["results_reason"] = "The vote was a tie! The Impostor escaped."
            award_impostor_points(room)
        else:
            voted_out_id = most_voted_ids[0]
            if str(voted_out_id) == str(room["impostor_id"]):
                room["status"] = "guess"
                import time
                clue_t = room["settings"].get("clue_time", 30)
                room["guess_end_time"] = time.time() + clue_t if clue_t > 0 else None
            else:
                room["status"] = "results"
                room["winner"] = "impostor"
                innocent_name = next((p["name"] for p in room["players"] if str(p["id"]) == str(voted_out_id)), "Someone")
                room["results_reason"] = f"You voted out {innocent_name}, who was innocent. The Impostor escaped!"
                award_impostor_points(room)
                
    return {"room": room}

@router.post("/games/impostor/guess2")
async def impostor_guess(request: Request):
    body = await request.json()
    room_id = body.get('room_id')
    guess = body.get('guess', '').strip().lower()
    
    if room_id not in impostor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room = impostor_rooms[room_id]
    if room["status"] != "guess":
        raise HTTPException(status_code=400, detail="Not in guess phase")
        
    secret_word = room["secret_word"].lower()
    
    room["status"] = "results"
    room["impostor_guess"] = guess
    
    import re
    clean_guess = re.sub(r'[^\w\s]', '', guess)
    clean_secret = re.sub(r'[^\w\s]', '', secret_word)
    
    if clean_guess == clean_secret or (clean_guess and clean_guess in clean_secret) or (clean_secret and clean_secret in clean_guess):
        room["winner"] = "impostor"
        room["results_reason"] = f"The Impostor was caught, but they correctly guessed '{room['secret_word']}' and stole the win!"
    else:
        room["winner"] = "crew"
        room["results_reason"] = f"The Impostor was caught and failed to guess '{room['secret_word']}'!"
        
    award_impostor_points(room)
        
    return {"room": room}

# ============ SHARED ============

@router.get("/player-count")
async def get_player_count():
    """Get total number of players in database."""
    supabase = get_supabase()
    result = supabase.table("players").select("count", count="exact").execute()
    return {"count": result.count if result.count else 0}


@router.get("/players/random")
async def get_random_player():
    """Get a random player."""
    supabase = get_supabase()
    result = supabase.table("players").select("*").limit(100).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No players found")
    
    return random.choice(result.data)
