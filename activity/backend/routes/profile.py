import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from db import get_db

router = APIRouter()

# Bot's original achievements only (IDs 1-8). ID 9 is admin-only, excluded.
ACHIEVEMENTS = [
    ("round_rookie",    "Round Rookie",    "Win 10 rounds"),
    ("round_champion",  "Round Champion",  "Win 50 rounds"),
    ("battle_beginner", "Battle Beginner", "Win 1 battle"),
    ("battle_newbie",   "Battle Newbie",   "Win 10 battles"),
    ("battle_pro",      "Battle Pro",      "Win 25 battles"),
    ("battle_champion", "Battle Champion", "Win 50 battles"),
    ("battle_master",   "Battle Master",   "Win 100 battles"),
    ("round_hero",      "Round Hero",      "Win 100 rounds"),
]


def seed_achievements(db):
    # Backfill slugs onto bot's original achievements (matched by title)
    for slug, title, desc in ACHIEVEMENTS:
        existing = db.execute("SELECT achievement_id FROM achievements WHERE title = ?", (title,)).fetchone()
        if existing:
            db.execute(
                "UPDATE achievements SET slug = ? WHERE achievement_id = ? AND (slug IS NULL OR slug = '')",
                (slug, existing["achievement_id"])
            )
        else:
            db.execute(
                "INSERT INTO achievements (slug, title, description) VALUES (?,?,?)",
                (slug, title, desc)
            )

    db.commit()


def check_and_award(db, user_id: int) -> list[str]:
    """Check all achievement conditions for user_id and award any newly earned ones. Returns list of newly earned slugs."""
    player = db.execute("SELECT * FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player:
        return []
    p = dict(player)

    battles_won = p.get("battles_won") or 0
    rounds_won  = p.get("rounds_won")  or 0

    conditions = {
        "battle_beginner": battles_won >= 1,
        "battle_newbie":   battles_won >= 10,
        "battle_pro":      battles_won >= 25,
        "battle_champion": battles_won >= 50,
        "battle_master":   battles_won >= 100,
        "round_rookie":    rounds_won  >= 10,
        "round_champion":  rounds_won  >= 50,
        "round_hero":      rounds_won  >= 100,
    }

    earned = []
    for slug, met in conditions.items():
        if not met:
            continue
        ach = db.execute("SELECT achievement_id FROM achievements WHERE slug = ?", (slug,)).fetchone()
        if not ach:
            continue
        already = db.execute(
            "SELECT 1 FROM user_achievements WHERE user_id = ? AND achievement_id = ?",
            (user_id, ach["achievement_id"])
        ).fetchone()
        if not already:
            db.execute(
                "INSERT INTO user_achievements (user_id, achievement_id) VALUES (?,?)",
                (user_id, ach["achievement_id"])
            )
            earned.append(slug)
    if earned:
        db.commit()
    return earned


def _card_image_url(path):
    if not path:
        return None
    return "/images/" + os.path.basename(path)


def _fetch_titles(db, user_id: int):
    return [dict(r) for r in db.execute("""
        SELECT a.achievement_id, a.slug, a.title, a.description
        FROM achievements a
        JOIN user_achievements ua ON a.achievement_id = ua.achievement_id
        WHERE ua.user_id = ?
        ORDER BY ua.date_earned DESC
    """, (user_id,)).fetchall()]


@router.get("/profile")
async def get_profile(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    player = db.execute("SELECT * FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    p = dict(player)

    cards = db.execute("""
        SELECT c.card_rarity, COUNT(*) as count
        FROM inventories i JOIN cards c ON i.card_id = c.card_id
        WHERE i.user_id = ?
        GROUP BY c.card_rarity
    """, (user_id,)).fetchall()
    card_counts = {r["card_rarity"]: r["count"] for r in cards}
    total_cards = sum(card_counts.values())

    titles = _fetch_titles(db, user_id)
    win_rate = round(p["battles_won"] / p["battles_played"] * 100) if p["battles_played"] > 0 else 0

    showcase_card = None
    if p.get("showcase_card_id"):
        row = db.execute("""
            SELECT c.* FROM cards c
            JOIN inventories i ON i.card_id = c.card_id
            WHERE i.user_id = ? AND c.card_id = ? LIMIT 1
        """, (user_id, p["showcase_card_id"])).fetchone()
        if row:
            d = dict(row)
            d["image_url"] = _card_image_url(d.pop("image_path", None))
            showcase_card = d

    return {
        "player": p,
        "win_rate": win_rate,
        "card_counts": {
            "total": total_cards,
            "common": card_counts.get("Common", 0),
            "uncommon": card_counts.get("Uncommon", 0),
            "rare": card_counts.get("Rare", 0),
        },
        "titles": titles,
        "showcase_card": showcase_card,
    }


@router.get("/profile/{target_user_id}/collection")
async def get_public_collection(target_user_id: int, discord_user=Depends(get_current_user)):
    requester_id = int(discord_user["id"])
    db = get_db()
    player = db.execute("SELECT hide_collection FROM players WHERE user_id = ?", (target_user_id,)).fetchone()
    if player and player["hide_collection"] and requester_id != target_user_id:
        return {"hidden": True, "cards": []}
    rows = db.execute("""
        SELECT c.card_id, c.name, c.attack, c.defense, c.speed, c.overall,
               c.card_rarity, c.card_type, c.position, c.club, c.league, c.nation,
               c.image_path, i.edition,
               (SELECT COUNT(*) FROM inventories WHERE card_id = c.card_id) AS copies,
               COALESCE(c.wishlist_count, 0)        AS wishlist_count,
               COALESCE(c.total_battles_played, 0)  AS total_battles_played,
               COALESCE(c.total_battles_won, 0)     AS total_battles_won,
               COALESCE(c.total_rounds_played, 0)   AS total_rounds_played,
               COALESCE(c.total_rounds_won, 0)      AS total_rounds_won,
               COALESCE(i.battles_played, 0)        AS copy_battles_played,
               COALESCE(i.battles_won, 0)           AS copy_battles_won,
               COALESCE(i.rounds_played, 0)         AS copy_rounds_played,
               COALESCE(i.rounds_won, 0)            AS copy_rounds_won,
               COALESCE(i.trade_count, 0)           AS trade_count
        FROM inventories i JOIN cards c ON i.card_id = c.card_id
        WHERE i.user_id = ?
        ORDER BY
            CASE c.card_rarity WHEN 'Rare' THEN 0 WHEN 'Uncommon' THEN 1 ELSE 2 END,
            c.overall DESC
    """, (target_user_id,)).fetchall()
    cards = []
    for r in rows:
        d = dict(r)
        d["image_url"] = _card_image_url(d.pop("image_path", None))
        cards.append(d)
    return {"hidden": False, "cards": cards}


@router.get("/profile/{target_user_id}/history")
async def get_public_history(target_user_id: int, discord_user=Depends(get_current_user)):
    requester_id = int(discord_user["id"])
    db = get_db()
    player = db.execute("SELECT hide_battle_history FROM players WHERE user_id = ?", (target_user_id,)).fetchone()
    if player and player["hide_battle_history"] and requester_id != target_user_id:
        return {"hidden": True, "battles": []}
    rows = db.execute("""
        SELECT * FROM battle_history
        WHERE p1_id = ? OR p2_id = ?
        ORDER BY played_at DESC LIMIT 30
    """, (target_user_id, target_user_id)).fetchall()
    battles = []
    for r in rows:
        d = dict(r)
        is_p1 = d["p1_id"] == target_user_id
        d["my_score"]  = d["p1_score"] if is_p1 else d["p2_score"]
        d["opp_score"] = d["p2_score"] if is_p1 else d["p1_score"]
        d["opp_name"]  = d["p2_name"]  if is_p1 else d["p1_name"]
        d["opp_id"]    = str(d["p2_id"]) if is_p1 else str(d["p1_id"])
        if d["winner_id"] is None:
            d["result"] = "draw"
        elif d["winner_id"] == target_user_id:
            d["result"] = "win"
        else:
            d["result"] = "loss"
        d["p1_id"] = str(d["p1_id"])
        d["p2_id"] = str(d["p2_id"])
        if d["winner_id"] is not None:
            d["winner_id"] = str(d["winner_id"])
        battles.append(d)
    return {"hidden": False, "battles": battles}


@router.get("/profile/{target_user_id}")
async def get_public_profile(target_user_id: int, discord_user=Depends(get_current_user)):
    db = get_db()
    player = db.execute("SELECT * FROM players WHERE user_id = ?", (target_user_id,)).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    p = dict(player)

    cards = db.execute("""
        SELECT c.card_rarity, COUNT(*) as count FROM inventories i
        JOIN cards c ON i.card_id = c.card_id WHERE i.user_id = ? GROUP BY c.card_rarity
    """, (target_user_id,)).fetchall()
    card_counts = {r["card_rarity"]: r["count"] for r in cards}
    total_cards = sum(card_counts.values())
    win_rate = round(p["battles_won"] / p["battles_played"] * 100) if p["battles_played"] > 0 else 0

    titles = _fetch_titles(db, target_user_id)

    showcase_card = None
    if p.get("showcase_card_id"):
        row = db.execute("""
            SELECT c.* FROM cards c JOIN inventories i ON i.card_id = c.card_id
            WHERE i.user_id = ? AND c.card_id = ? LIMIT 1
        """, (target_user_id, p["showcase_card_id"])).fetchone()
        if row:
            d = dict(row)
            d["image_url"] = _card_image_url(d.pop("image_path", None))
            showcase_card = d

    return {
        "player": p,
        "win_rate": win_rate,
        "card_counts": {
            "total": total_cards,
            "common": card_counts.get("Common", 0),
            "uncommon": card_counts.get("Uncommon", 0),
            "rare": card_counts.get("Rare", 0),
        },
        "titles": titles,
        "showcase_card": showcase_card,
    }


class SetTitleBody(BaseModel):
    title: str

@router.put("/profile/title")
async def set_title(body: SetTitleBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
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


class SetShowcaseBody(BaseModel):
    card_id: int = None

@router.put("/profile/showcase")
async def set_showcase(body: SetShowcaseBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    if body.card_id:
        owns = db.execute("SELECT 1 FROM inventories WHERE user_id = ? AND card_id = ?",
                          (user_id, body.card_id)).fetchone()
        if not owns:
            raise HTTPException(status_code=403, detail="Card not in your collection")
    db.execute("UPDATE players SET showcase_card_id = ? WHERE user_id = ?", (body.card_id, user_id))
    db.commit()
    return {"status": "updated"}


class PrivacyBody(BaseModel):
    hide_battle_history: Optional[bool] = None
    hide_collection: Optional[bool] = None

@router.put("/profile/settings")
async def update_privacy(body: PrivacyBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    updates = {}
    if body.hide_battle_history is not None:
        updates["hide_battle_history"] = int(body.hide_battle_history)
    if body.hide_collection is not None:
        updates["hide_collection"] = int(body.hide_collection)
    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        db.execute(f"UPDATE players SET {set_clause} WHERE user_id = ?",
                   list(updates.values()) + [user_id])
        db.commit()
    return {"status": "ok"}


class SetTutorialBody(BaseModel):
    step: int

@router.put("/tutorial")
async def set_tutorial(body: SetTutorialBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    db.execute("UPDATE players SET tutorial_step = ? WHERE user_id = ?", (body.step, user_id))
    db.commit()
    return {"status": "updated"}
