from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from db import get_db

router = APIRouter()


@router.get("/profile")
async def get_profile(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    player = db.execute("SELECT * FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    p = dict(player)

    # Card counts by rarity
    cards = db.execute("""
        SELECT c.card_rarity, COUNT(*) as count
        FROM inventories i JOIN cards c ON i.card_id = c.card_id
        WHERE i.user_id = ?
        GROUP BY c.card_rarity
    """, (user_id,)).fetchall()
    card_counts = {r["card_rarity"]: r["count"] for r in cards}
    total_cards = sum(card_counts.values())

    # Earned achievement titles
    titles = db.execute("""
        SELECT a.achievement_id, a.title, a.description
        FROM achievements a
        JOIN user_achievements ua ON a.achievement_id = ua.achievement_id
        WHERE ua.user_id = ?
        ORDER BY ua.date_earned DESC
    """, (user_id,)).fetchall()

    win_rate = round(p["battles_won"] / p["battles_played"] * 100) if p["battles_played"] > 0 else 0

    return {
        "player": p,
        "win_rate": win_rate,
        "card_counts": {
            "total": total_cards,
            "common": card_counts.get("Common", 0),
            "uncommon": card_counts.get("Uncommon", 0),
            "rare": card_counts.get("Rare", 0),
        },
        "titles": [dict(t) for t in titles],
    }


class SetTitleBody(BaseModel):
    title: str

@router.put("/profile/title")
async def set_title(body: SetTitleBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    # Verify user has earned this title
    owned = db.execute("""
        SELECT 1 FROM achievements a
        JOIN user_achievements ua ON a.achievement_id = ua.achievement_id
        WHERE ua.user_id = ? AND a.title = ?
    """, (user_id, body.title)).fetchone()

    if not owned and body.title != "":
        raise HTTPException(status_code=403, detail="Title not earned")

    db.execute("UPDATE players SET display_title = ? WHERE user_id = ?",
               (body.title if body.title else None, user_id))
    db.commit()
    return {"status": "updated"}
