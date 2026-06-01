from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from supabase_client import get_supabase

router = APIRouter(prefix="/api/social")


@router.get("/player-count")
async def get_player_count():
    """Get the total number of players in the social database."""
    supabase = get_supabase()
    result = supabase.table("players").select("count", count="exact").execute()
    return {"count": result.count if result.count else 0}


@router.get("/players/random")
async def get_random_player():
    """Get a random player from the database."""
    supabase = get_supabase()
    result = supabase.table("players").select("*").limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No players found")
    return result.data[0]


@router.get("/players/by-id/{player_id}")
async def get_player_by_id(player_id: int):
    """Get a specific player by ID."""
    supabase = get_supabase()
    result = supabase.table("players").select("*").eq("id", player_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Player not found")
    return result.data


class GuessPlayerRequest(BaseModel):
    clues: List[str]  # List of clue types to reveal
    guess: str  # Player name guess


class GuessPlayerResponse(BaseModel):
    correct: bool
    player: Optional[dict]
    clues_revealed: List[dict]


@router.post("/games/guess-player/check", response_model=GuessPlayerResponse)
async def check_guess(request: GuessPlayerRequest):
    """Check a guess-the-player answer."""
    # TODO: Implement game logic
    pass


class HigherLowerRequest(BaseModel):
    current_player_id: int
    next_player_id: int
    stat: str  # 'goals', 'assists', 'appearances', 'rating'
    guess: str  # 'higher' or 'lower'


@router.post("/games/higher-lower/check")
async def check_higher_lower(request: HigherLowerRequest):
    """Check a higher-or-lower answer."""
    # TODO: Implement game logic
    pass
