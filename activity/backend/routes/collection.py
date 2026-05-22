import os
from fastapi import APIRouter, Depends
from auth import get_current_user
from db import get_db

router = APIRouter()

def image_url(path):
    if not path:
        return None
    return "/images/" + os.path.basename(path)

@router.get("/collection")
async def get_collection(
    rarity: str = None,
    position: str = None,
    card_type: str = None,
    discord_user=Depends(get_current_user),
):
    user_id = int(discord_user["id"])
    db = get_db()

    query = """
        SELECT c.card_id, c.name, c.attack, c.defense, c.speed, c.overall,
               c.club, c.position, c.card_rarity, c.card_type, c.league,
               c.nation, c.image_path,
               (SELECT COUNT(*) FROM inventories WHERE card_id = c.card_id) AS copies,
               COALESCE(c.wishlist_count, 0)        AS wishlist_count,
               COALESCE(c.total_battles_played, 0)  AS total_battles_played,
               COALESCE(c.total_battles_won, 0)     AS total_battles_won,
               COALESCE(c.total_rounds_played, 0)   AS total_rounds_played,
               COALESCE(c.total_rounds_won, 0)      AS total_rounds_won,
               i.edition,
               COALESCE(i.trade_count, 0)           AS trade_count,
               COALESCE(i.battles_played, 0)        AS copy_battles_played,
               COALESCE(i.battles_won, 0)           AS copy_battles_won,
               COALESCE(i.rounds_played, 0)         AS copy_rounds_played,
               COALESCE(i.rounds_won, 0)            AS copy_rounds_won
        FROM inventories i
        JOIN cards c ON i.card_id = c.card_id
        WHERE i.user_id = ?
    """
    params = [user_id]

    if rarity:
        query += " AND c.card_rarity = ?"
        params.append(rarity)
    if position:
        query += " AND c.position = ?"
        params.append(position)
    if card_type:
        query += " AND c.card_type = ?"
        params.append(card_type)

    query += " ORDER BY c.overall DESC"

    rows = db.execute(query, params).fetchall()
    return [
        {**dict(r), "image_url": image_url(r["image_path"])}
        for r in rows
    ]
