import os
import random
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from db import get_db

router = APIRouter()

NON_DROPPABLE_TYPES = ('Unique',)


def card_to_dict(row):
    d = dict(row)
    d["image_url"] = "/images/" + os.path.basename(d["image_path"]) if d.get("image_path") else None
    return d


def is_duplicate(db, user_id: int, card_id: int) -> bool:
    return db.execute(
        "SELECT COUNT(*) FROM inventories WHERE user_id = ? AND card_id = ?", (user_id, card_id)
    ).fetchone()[0] > 0


def add_to_inventory(db, user_id: int, card_id: int):
    current_copies = db.execute("SELECT copies FROM cards WHERE card_id = ?", (card_id,)).fetchone()[0]
    db.execute("INSERT INTO inventories (user_id, card_id, edition) VALUES (?, ?, ?)", (user_id, card_id, current_copies))
    db.execute("UPDATE cards SET copies = copies + 1 WHERE card_id = ?", (card_id,))


def draw_unique(db, query, params, user_id: int, max_tries=200):
    for _ in range(max_tries):
        row = db.execute(query, params).fetchone()
        if row and not is_duplicate(db, user_id, row["card_id"]):
            return row
    return None


def open_rare_player_pack(db, user_id: int):
    ndt = NON_DROPPABLE_TYPES
    ndt_sql = ",".join("?" * len(ndt))
    for _ in range(200):
        chosen_type = random.choices(["Standard", "Other"], [0.8, 0.2])[0]
        if chosen_type == "Standard":
            row = db.execute(
                "SELECT * FROM cards WHERE card_type = 'Standard' AND overall > 85 ORDER BY RANDOM() LIMIT 1"
            ).fetchone()
        else:
            row = db.execute(
                f"SELECT * FROM cards WHERE card_type != 'Standard' AND card_type NOT IN ({ndt_sql}) AND overall > 85 ORDER BY RANDOM() LIMIT 1",
                ndt,
            ).fetchone()
        if row and not is_duplicate(db, user_id, row["card_id"]):
            return [row]
    raise HTTPException(status_code=500, detail="Could not find a unique card")


def open_icon_pack(db, user_id: int):
    card = draw_unique(db, "SELECT * FROM cards WHERE card_type = 'Icon' ORDER BY RANDOM() LIMIT 1", (), user_id)
    if not card:
        raise HTTPException(status_code=500, detail="Could not find a unique Icon card")
    return [card]


def open_hero_pack(db, user_id: int):
    card = draw_unique(db, "SELECT * FROM cards WHERE card_type = 'Hero' ORDER BY RANDOM() LIMIT 1", (), user_id)
    if not card:
        raise HTTPException(status_code=500, detail="Could not find a unique Hero card")
    return [card]


def open_tester_pack(db, user_id: int):
    ndt = NON_DROPPABLE_TYPES
    ndt_sql = ",".join("?" * len(ndt))
    icon = draw_unique(db, "SELECT * FROM cards WHERE card_type = 'Icon' ORDER BY RANDOM() LIMIT 1", (), user_id)
    if not icon:
        raise HTTPException(status_code=500, detail="Could not find a unique Icon card")
    cards = [icon]
    drawn_ids = {icon["card_id"]}
    for _ in range(4):
        for _ in range(200):
            chosen_type = random.choices(["Standard", "Other"], [0.9, 0.1])[0]
            if chosen_type == "Standard":
                row = db.execute(
                    "SELECT * FROM cards WHERE card_type = 'Standard' AND overall > 85 ORDER BY RANDOM() LIMIT 1"
                ).fetchone()
            else:
                row = db.execute(
                    f"SELECT * FROM cards WHERE card_type != 'Standard' AND card_type NOT IN ({ndt_sql}) AND overall > 85 ORDER BY RANDOM() LIMIT 1",
                    ndt,
                ).fetchone()
            if row and row["card_id"] not in drawn_ids and not is_duplicate(db, user_id, row["card_id"]):
                cards.append(row)
                drawn_ids.add(row["card_id"])
                break
    return cards


PACK_OPENERS = {
    "rare_player_pack": open_rare_player_pack,
    "icon_pack": open_icon_pack,
    "hero_pack": open_hero_pack,
    "tester_pack": open_tester_pack,
}


@router.get("/packs")
async def get_packs(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    row = db.execute("SELECT * FROM packs WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return {"rare_player_pack": 0, "icon_pack": 0, "hero_pack": 0, "tester_pack": 0}
    d = dict(row)
    d.pop("user_id", None)
    return d


@router.post("/packs/starter")
async def claim_starter_pack(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    player = db.execute("SELECT has_claimed_starter_pack FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if player["has_claimed_starter_pack"]:
        raise HTTPException(status_code=400, detail="Already claimed")

    all_cards = db.execute("SELECT * FROM cards").fetchall()
    commons   = [c for c in all_cards if 70 <= c["overall"] <= 79 and c["card_type"] not in NON_DROPPABLE_TYPES]
    uncommons = [c for c in all_cards if 80 <= c["overall"] <= 85 and c["card_type"] not in NON_DROPPABLE_TYPES]
    rares     = [c for c in all_cards if c["overall"] > 85 and c["card_type"] == "Standard"]

    selected = random.sample(commons, min(6, len(commons))) + \
               random.sample(uncommons, min(3, len(uncommons))) + \
               random.sample(rares, min(1, len(rares)))

    for card in selected:
        if not is_duplicate(db, user_id, card["card_id"]):
            add_to_inventory(db, user_id, card["card_id"])

    db.execute("UPDATE players SET has_claimed_starter_pack = 1 WHERE user_id = ?", (user_id,))
    db.commit()

    return [card_to_dict(c) for c in selected]


@router.post("/packs/open/{pack_type}")
async def open_pack(pack_type: str, discord_user=Depends(get_current_user)):
    if pack_type not in PACK_OPENERS:
        raise HTTPException(status_code=400, detail="Invalid pack type")

    user_id = int(discord_user["id"])
    db = get_db()

    row = db.execute("SELECT * FROM packs WHERE user_id = ?", (user_id,)).fetchone()
    if not row or dict(row).get(pack_type, 0) <= 0:
        raise HTTPException(status_code=400, detail="You don't own this pack")

    cards = PACK_OPENERS[pack_type](db, user_id)

    for card in cards:
        add_to_inventory(db, user_id, card["card_id"])

    db.execute(
        f"UPDATE packs SET {pack_type} = {pack_type} - 1 WHERE user_id = ?", (user_id,)
    )
    db.commit()

    return [card_to_dict(c) for c in cards]
