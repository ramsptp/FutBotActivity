from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import random
from supabase_client import get_supabase

router = APIRouter(prefix="/api/social")

# ============ GUESS THE PLAYER ============

class GuessPlayerRound(BaseModel):
    clues: List[dict]
    player_id: int
    player_name: str  # Hidden from client, used for answer checking


class GuessPlayerRequest(BaseModel):
    guess: str
    player_id: int


class GuessPlayerResponse(BaseModel):
    correct: bool
    player: dict
    clues_revealed: List[dict]


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
        "clues": clues,
        # Don't send player name to client!
    }


@router.post("/games/guess-player/check")
async def check_guess(request: GuessPlayerRequest):
    """Check if the guess is correct."""
    supabase = get_supabase()
    
    # Get the actual player
    result = supabase.table("players").select("*").eq("id", request.player_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player = result.data
    correct_name = player["name"].lower().strip()
    guess = request.guess.lower().strip()
    
    # Check exact match or contains
    is_correct = (guess == correct_name or 
                  guess in correct_name or 
                  correct_name in guess or
                  # Check last name only
                  guess == correct_name.split()[-1].lower())
    
    return {
        "correct": is_correct,
        "player": player,
        "your_guess": request.guess
    }


# ============ HIGHER OR LOWER ============

class HigherLowerRound(BaseModel):
    current_player: dict
    next_player_id: int
    stat: str


class HigherLowerGuess(BaseModel):
    guess: str  # 'higher' or 'lower'
    current_player_id: int
    next_player_id: int
    stat: str


class HigherLowerResult(BaseModel):
    correct: bool
    current_value: int
    next_value: int
    next_player: dict
    message: str


STAT_OPTIONS = ["goals", "assists", "appearances"]


@router.get("/games/higher-lower/start")
async def start_higher_lower():
    """Start a new Higher or Lower game with first player."""
    supabase = get_supabase()
    
    # Get two random players
    result = supabase.table("players").select("*").gte("appearances", 100).limit(100).execute()
    if len(result.data) < 2:
        raise HTTPException(status_code=404, detail="Not enough players")
    
    players = random.sample(result.data, k=2)
    stat = random.choice(STAT_OPTIONS)
    
    return {
        "current_player": players[0],
        "next_player_id": players[1]["id"],
        "stat": stat,
        "stat_label": stat.replace("_", " ").title()
    }


@router.post("/games/higher-lower/guess")
async def check_higher_lower(request: HigherLowerGuess):
    """Check higher/lower guess and return result."""
    supabase = get_supabase()
    
    # Get both players
    current = supabase.table("players").select("*").eq("id", request.current_player_id).single().execute()
    next_player = supabase.table("players").select("*").eq("id", request.next_player_id).single().execute()
    
    if not current.data or not next_player.data:
        raise HTTPException(status_code=404, detail="Player not found")
    
    current_val = current.data.get(request.stat, 0) or 0
    next_val = next_player.data.get(request.stat, 0) or 0
    
    # Determine correct answer
    if next_val > current_val:
        correct_answer = "higher"
    elif next_val < current_val:
        correct_answer = "lower"
    else:
        correct_answer = "equal"  # Edge case
    
    is_correct = request.guess.lower() == correct_answer
    
    # Get next random player for continuing the game
    new_result = supabase.table("players").select("*").gte("appearances", 100).limit(50).execute()
    new_next = random.choice(new_result.data) if new_result.data else None
    
    return {
        "correct": is_correct,
        "current_value": current_val,
        "next_value": next_val,
        "next_player": next_player.data,
        "new_next_player_id": new_next["id"] if new_next else None,
        "message": f"{next_player.data['name']} has {next_val} {request.stat} vs {current_val}"
    }


# ============ FOOTBALL SURVIVOR ============

class SurvivorRoom(BaseModel):
    room_id: str
    players: List[dict]
    question: Optional[dict]
    status: str  # 'waiting', 'voting', 'results', 'finished'


class CreateSurvivorRoom(BaseModel):
    host_id: int
    host_name: str


class JoinSurvivorRoom(BaseModel):
    room_id: str
    player_id: int
    player_name: str


class SurvivorVote(BaseModel):
    room_id: str
    player_id: int
    vote: str  # 'option_a' or 'option_b'


# In-memory storage for rooms (use Redis in production)
survivor_rooms: Dict[str, dict] = {}


@router.post("/games/survivor/create")
async def create_survivor_room(request: CreateSurvivorRoom):
    """Create a new Survivor game room."""
    import uuid
    
    room_id = str(uuid.uuid4())[:8].upper()
    
    survivor_rooms[room_id] = {
        "room_id": room_id,
        "host_id": request.host_id,
        "players": [{"id": request.host_id, "name": request.host_name, "alive": True}],
        "status": "waiting",
        "question": None,
        "votes": {},
        "round": 0
    }
    
    return {"room_id": room_id, "status": "waiting"}


@router.post("/games/survivor/join")
async def join_survivor_room(request: JoinSurvivorRoom):
    """Join an existing Survivor room."""
    if request.room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[request.room_id]
    
    # Check if player already in room
    if any(p["id"] == request.player_id for p in room["players"]):
        return {"room": room}
    
    # Add player
    room["players"].append({
        "id": request.player_id,
        "name": request.player_name,
        "alive": True
    })
    
    return {"room": room}


@router.get("/games/survivor/room/{room_id}")
async def get_survivor_room(room_id: str):
    """Get current state of a Survivor room."""
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return survivor_rooms[room_id]


@router.post("/games/survivor/start-round")
async def start_survivor_round(room_id: str):
    """Start a new voting round."""
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    supabase = get_supabase()
    
    # Get two random players for comparison
    result = supabase.table("players").select("*").gte("appearances", 200).limit(100).execute()
    if len(result.data) < 2:
        raise HTTPException(status_code=404, detail="Not enough players")
    
    players = random.sample(result.data, k=2)
    
    # Generate question
    stat = random.choice(["goals", "appearances"])
    question = {
        "text": f"Who has more career {stat}?",
        "stat": stat,
        "option_a": {"name": players[0]["name"], "id": players[0]["id"]},
        "option_b": {"name": players[1]["name"], "id": players[1]["id"]}
    }
    
    room["question"] = question
    room["status"] = "voting"
    room["votes"] = {}
    room["round"] += 1
    
    return {"room": room}


@router.post("/games/survivor/vote")
async def submit_survivor_vote(request: SurvivorVote):
    """Submit a vote in Survivor."""
    if request.room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[request.room_id]
    room["votes"][str(request.player_id)] = request.vote
    
    return {"success": True, "votes_count": len(room["votes"])}


@router.post("/games/survivor/reveal")
async def reveal_survivor_results(room_id: str):
    """Reveal results and eliminate players."""
    if room_id not in survivor_rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = survivor_rooms[room_id]
    supabase = get_supabase()
    
    # Get actual stats
    option_a_id = room["question"]["option_a"]["id"]
    option_b_id = room["question"]["option_b"]["id"]
    stat = room["question"]["stat"]
    
    player_a = supabase.table("players").select("*").eq("id", option_a_id).single().execute()
    player_b = supabase.table("players").select("*").eq("id", option_b_id).single().execute()
    
    val_a = player_a.data.get(stat, 0) or 0
    val_b = player_b.data.get(stat, 0) or 0
    
    # Determine correct answer
    if val_a > val_b:
        correct_option = "option_a"
    elif val_b > val_a:
        correct_option = "option_b"
    else:
        correct_option = "tie"
    
    # Count votes
    votes_a = sum(1 for v in room["votes"].values() if v == "option_a")
    votes_b = sum(1 for v in room["votes"].values() if v == "option_b")
    
    # Determine minority (eliminate them)
    if votes_a < votes_b:
        eliminate_option = "option_a"
    elif votes_b < votes_a:
        eliminate_option = "option_b"
    else:
        eliminate_option = None  # Tie - no elimination or random
    
    # Mark eliminated players
    eliminated = []
    if eliminate_option:
        for player_id, vote in room["votes"].items():
            if vote == eliminate_option:
                # Find player and mark dead
                for p in room["players"]:
                    if str(p["id"]) == player_id:
                        p["alive"] = False
                        eliminated.append(p["name"])
    
    # Check if game over (1 player left)
    alive_players = [p for p in room["players"] if p["alive"]]
    if len(alive_players) <= 1:
        room["status"] = "finished"
        winner = alive_players[0] if alive_players else None
    else:
        room["status"] = "results"
        winner = None
    
    return {
        "room": room,
        "results": {
            "correct_option": correct_option,
            "option_a_value": val_a,
            "option_b_value": val_b,
            "votes_a": votes_a,
            "votes_b": votes_b,
            "eliminated": eliminated,
            "winner": winner
        }
    }


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
