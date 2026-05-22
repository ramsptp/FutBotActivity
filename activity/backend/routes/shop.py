import os
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from db import get_db

router = APIRouter()

BUYABLE_PACKS = {
    "rare_player_pack": {"display_name": "Rare Player Pack", "cost": 1000, "icon": "🌟", "desc": "1 Rare or Special card (85+ OVR)"},
    "icon_pack":        {"display_name": "Icon Pack",         "cost": 2500, "icon": "👑", "desc": "1 guaranteed Icon card"},
    "hero_pack":        {"display_name": "Hero Pack",          "cost": 1750, "icon": "🦸", "desc": "1 guaranteed Hero card"},
}

# Add daily columns if not present (idempotent — safe to run on every startup)
def _ensure_daily_columns():
    try:
        db = get_db()
        migrations = [
            ("daily_streak",         "INTEGER DEFAULT 0"),
            ("last_daily_claim",     "TEXT"),
            ("daily_pending_card1",  "INTEGER"),
            ("daily_pending_card2",  "INTEGER"),
        ]
        for col, typedef in migrations:
            try:
                db.execute(f"ALTER TABLE players ADD COLUMN {col} {typedef}")
            except Exception:
                pass
        db.commit()
    except Exception:
        pass

_ensure_daily_columns()


def _img(path):
    if not path:
        return None
    return "/images/" + os.path.basename(path)


def _coins_for_streak(streak: int) -> int:
    if streak <= 3:  return 100
    if streak <= 6:  return 150
    if streak <= 13: return 200
    return 300


def _pick_weighted_cards(db, count: int = 2):
    """Replicate bot.py weighted_choice distribution for daily drop."""
    all_cards = db.execute("SELECT * FROM cards").fetchall()
    if not all_cards:
        return []

    def weight(c):
        t = (c["card_type"] or "").lower()
        r = c["card_rarity"]
        o = c["overall"]
        if "icon" in t:      return 1 if o >= 90 else 2
        if "hero" in t:      return 2
        if "euro" in t:      return 1
        if "copa" in t:      return 1
        if r == "Rare" and o > 90: return 3
        if r == "Rare":      return 7
        if r == "Uncommon":  return 20
        return 70

    pool = [dict(c) for c in all_cards]
    pool_w = [weight(c) for c in pool]
    picked = []
    for _ in range(min(count, len(pool))):
        choice = random.choices(pool, weights=pool_w, k=1)[0]
        picked.append(choice)
        idx = next(i for i, c in enumerate(pool) if c["card_id"] == choice["card_id"])
        pool.pop(idx)
        pool_w.pop(idx)
    return picked


def _award_pack(db, user_id: int, pack_col: str):
    row = db.execute("SELECT * FROM packs WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        db.execute(f"UPDATE packs SET {pack_col} = {pack_col} + 1 WHERE user_id = ?", (user_id,))
    else:
        db.execute(
            "INSERT INTO packs (user_id, rare_player_pack, icon_pack, hero_pack, tester_pack) VALUES (?, 0, 0, 0, 0)",
            (user_id,)
        )
        db.execute(f"UPDATE packs SET {pack_col} = 1 WHERE user_id = ?", (user_id,))


def calculate_card_value(card: dict) -> int:
    card_type = card["card_type"].lower()
    overall   = card["overall"]
    if "icon" in card_type:   value = 250
    elif "hero" in card_type: value = 175
    else:                     value = 100
    if overall >= 70:
        value += 50 + (overall - 70) * 5
    return int(value)


# ── DAILY DROP ────────────────────────────────────────────────────────────────

@router.get("/shop/daily")
async def get_daily_status(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    player = db.execute(
        "SELECT coins, daily_streak, last_daily_claim, daily_pending_card1, daily_pending_card2 FROM players WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    today = datetime.now().date()
    tomorrow = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    seconds_until_reset = int((tomorrow - datetime.now()).total_seconds())

    streak = (player["daily_streak"] or 0) if player else 0
    last_claim_str = player["last_daily_claim"] if player else None

    claimed_today = False
    next_streak = 1
    if last_claim_str:
        try:
            last_date = datetime.fromisoformat(str(last_claim_str)).date()
            claimed_today = (last_date == today)
            if claimed_today:
                next_streak = streak
            else:
                days_since = (today - last_date).days
                next_streak = streak + 1 if days_since == 1 else 1
        except Exception:
            pass

    coins_reward = _coins_for_streak(next_streak)
    pack_reward  = "rare_player_pack" if next_streak in (7, 14) else None

    # Resume pending pick if user claimed but hasn't chosen a card yet
    pending = None
    if player and claimed_today and player["daily_pending_card1"] and player["daily_pending_card2"]:
        c1 = db.execute("SELECT * FROM cards WHERE card_id = ?", (player["daily_pending_card1"],)).fetchone()
        c2 = db.execute("SELECT * FROM cards WHERE card_id = ?", (player["daily_pending_card2"],)).fetchone()
        if c1 and c2:
            d1 = dict(c1); d1["image_url"] = _img(d1.get("image_path"))
            d2 = dict(c2); d2["image_url"] = _img(d2.get("image_path"))
            pending = {"card1": d1, "card2": d2}

    return {
        "streak": streak,
        "next_streak": next_streak,
        "claimed": claimed_today,
        "seconds_until_reset": seconds_until_reset,
        "coins_reward": coins_reward,
        "pack_reward": pack_reward,
        "coins": (player["coins"] or 0) if player else 0,
        "pending": pending,
    }


@router.post("/shop/daily")
async def claim_daily(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    player = db.execute(
        "SELECT coins, daily_streak, last_daily_claim FROM players WHERE user_id = ?",
        (user_id,)
    ).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    today = datetime.now().date()
    last_claim_str = player["last_daily_claim"]

    if last_claim_str:
        try:
            last_date = datetime.fromisoformat(str(last_claim_str)).date()
            if last_date == today:
                raise HTTPException(status_code=400, detail="Already claimed today")
            days_since = (today - last_date).days
            new_streak = (player["daily_streak"] or 0) + 1 if days_since == 1 else 1
        except HTTPException:
            raise
        except Exception:
            new_streak = 1
    else:
        new_streak = 1

    coins = _coins_for_streak(new_streak)
    pack  = "rare_player_pack" if new_streak in (7, 14) else None
    cards = _pick_weighted_cards(db, 2)
    cid1  = cards[0]["card_id"] if len(cards) > 0 else None
    cid2  = cards[1]["card_id"] if len(cards) > 1 else None

    db.execute(
        "UPDATE players SET daily_streak=?, last_daily_claim=?, coins=coins+?, daily_pending_card1=?, daily_pending_card2=? WHERE user_id=?",
        (new_streak, today.isoformat(), coins, cid1, cid2, user_id)
    )
    if pack:
        _award_pack(db, user_id, pack)
    db.commit()

    new_balance = db.execute("SELECT coins FROM players WHERE user_id=?", (user_id,)).fetchone()["coins"]
    result = {"streak": new_streak, "coins_earned": coins, "pack_awarded": pack, "coins": new_balance}
    for i, c in enumerate(cards, 1):
        cd = dict(c); cd["image_url"] = _img(cd.get("image_path"))
        result[f"card{i}"] = cd
    return result


@router.post("/shop/daily/pick/{card_id}")
async def pick_daily_card(card_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    player = db.execute(
        "SELECT daily_pending_card1, daily_pending_card2 FROM players WHERE user_id=?",
        (user_id,)
    ).fetchone()
    if not player or (player["daily_pending_card1"] is None and player["daily_pending_card2"] is None):
        raise HTTPException(status_code=400, detail="No pending daily pick")
    if card_id not in {player["daily_pending_card1"], player["daily_pending_card2"]}:
        raise HTTPException(status_code=400, detail="Invalid card selection")

    last_ed = db.execute("SELECT MAX(edition) FROM inventories WHERE card_id=?", (card_id,)).fetchone()[0] or 0
    already = db.execute("SELECT 1 FROM inventories WHERE user_id=? AND card_id=?", (user_id, card_id)).fetchone()
    if not already:
        db.execute(
            "INSERT INTO inventories (user_id, card_id, edition, battles_played, battles_won, rounds_played, rounds_won, trade_count) VALUES (?,?,?,0,0,0,0,0)",
            (user_id, card_id, last_ed + 1)
        )
    db.execute("UPDATE players SET daily_pending_card1=NULL, daily_pending_card2=NULL WHERE user_id=?", (user_id,))
    db.commit()

    card = db.execute("SELECT * FROM cards WHERE card_id=?", (card_id,)).fetchone()
    c = dict(card); c["image_url"] = _img(c.get("image_path"))
    return {"status": "picked", "card": c}


# ── PACKS SHOP ────────────────────────────────────────────────────────────────

@router.get("/shop/packs")
async def get_shop_packs(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    player = db.execute("SELECT coins FROM players WHERE user_id = ?", (user_id,)).fetchone()
    return {"coins": player["coins"] if player else 0, "packs": BUYABLE_PACKS}


@router.post("/shop/buy/{pack_type}")
async def buy_pack(pack_type: str, discord_user=Depends(get_current_user)):
    if pack_type not in BUYABLE_PACKS:
        raise HTTPException(status_code=400, detail="Pack not available in shop")
    user_id = int(discord_user["id"])
    cost = BUYABLE_PACKS[pack_type]["cost"]
    db = get_db()
    player = db.execute("SELECT coins FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player or player["coins"] < cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    db.execute("UPDATE players SET coins = coins - ? WHERE user_id = ?", (cost, user_id))
    _award_pack(db, user_id, pack_type)
    db.commit()
    new_balance = db.execute("SELECT coins FROM players WHERE user_id = ?", (user_id,)).fetchone()["coins"]
    return {"status": "purchased", "coins": new_balance}


@router.get("/shop/sell-value/{card_id}")
async def get_sell_value(card_id: int, discord_user=Depends(get_current_user)):
    db = get_db()
    card = db.execute("SELECT * FROM cards WHERE card_id = ?", (card_id,)).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"value": calculate_card_value(dict(card))}


@router.post("/shop/sell/{card_id}")
async def sell_card(card_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    owned = db.execute("SELECT 1 FROM inventories WHERE user_id = ? AND card_id = ?", (user_id, card_id)).fetchone()
    if not owned:
        raise HTTPException(status_code=400, detail="Card not in inventory")
    card = db.execute("SELECT * FROM cards WHERE card_id = ?", (card_id,)).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    value = calculate_card_value(dict(card))
    db.execute("DELETE FROM inventories WHERE user_id = ? AND card_id = ?", (user_id, card_id))
    db.execute("UPDATE players SET coins = coins + ?, cards_sold = cards_sold + 1 WHERE user_id = ?", (value, user_id))
    db.commit()
    new_balance = db.execute("SELECT coins FROM players WHERE user_id = ?", (user_id,)).fetchone()["coins"]
    return {"status": "sold", "coins_earned": value, "coins": new_balance}
