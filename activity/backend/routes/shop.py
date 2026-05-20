import os
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from db import get_db

router = APIRouter()

BUYABLE_PACKS = {
    "rare_player_pack": {"display_name": "Rare Player Pack", "cost": 1000, "icon": "🌟", "desc": "1 Rare or Special card (85+ OVR)"},
    "icon_pack":        {"display_name": "Icon Pack",         "cost": 2500, "icon": "👑", "desc": "1 guaranteed Icon card"},
    "hero_pack":        {"display_name": "Hero Pack",          "cost": 1750, "icon": "🦸", "desc": "1 guaranteed Hero card"},
}


def calculate_card_value(card: dict) -> int:
    card_type = card["card_type"].lower()
    overall   = card["overall"]
    if "icon" in card_type:
        value = 250
    elif "hero" in card_type:
        value = 175
    else:
        value = 100
    if overall >= 70:
        value += 50 + (overall - 70) * 5
    return int(value)


@router.get("/shop/packs")
async def get_shop_packs(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    player = db.execute("SELECT coins FROM players WHERE user_id = ?", (user_id,)).fetchone()
    coins = player["coins"] if player else 0
    return {"coins": coins, "packs": BUYABLE_PACKS}


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

    row = db.execute("SELECT * FROM packs WHERE user_id = ?", (user_id,)).fetchone()
    if row:
        db.execute(f"UPDATE packs SET {pack_type} = {pack_type} + 1 WHERE user_id = ?", (user_id,))
    else:
        db.execute(
            "INSERT INTO packs (user_id, rare_player_pack, icon_pack, hero_pack, tester_pack) VALUES (?, 0, 0, 0, 0)",
            (user_id,)
        )
        db.execute(f"UPDATE packs SET {pack_type} = 1 WHERE user_id = ?", (user_id,))

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

    owned = db.execute(
        "SELECT 1 FROM inventories WHERE user_id = ? AND card_id = ?", (user_id, card_id)
    ).fetchone()
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
