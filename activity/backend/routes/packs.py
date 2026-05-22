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


def add_to_inventory(db, user_id: int, card_id: int) -> int:
    """Insert a new copy into inventories. Returns the edition number assigned."""
    current_copies = db.execute("SELECT copies FROM cards WHERE card_id = ?", (card_id,)).fetchone()[0] or 0
    db.execute("INSERT INTO inventories (user_id, card_id, edition) VALUES (?, ?, ?)", (user_id, card_id, current_copies))
    db.execute("UPDATE cards SET copies = copies + 1 WHERE card_id = ?", (card_id,))
    return current_copies


def draw_random(db, query, params=()):
    """Pick one random card matching the query. No ownership check — duplicates are allowed."""
    row = db.execute(query, params).fetchone()
    if not row:
        raise HTTPException(status_code=500, detail="No matching cards found")
    return row


def open_rare_player_pack(db, user_id: int):
    ndt = NON_DROPPABLE_TYPES
    ndt_sql = ",".join("?" * len(ndt))
    chosen_type = random.choices(["Standard", "Other"], [0.8, 0.2])[0]
    if chosen_type == "Standard":
        row = draw_random(db, "SELECT * FROM cards WHERE card_type = 'Standard' AND overall > 85 ORDER BY RANDOM() LIMIT 1")
    else:
        row = draw_random(
            db,
            f"SELECT * FROM cards WHERE card_type != 'Standard' AND card_type NOT IN ({ndt_sql}) AND overall > 85 ORDER BY RANDOM() LIMIT 1",
            ndt,
        )
    return [row]


def open_icon_pack(db, user_id: int):
    return [draw_random(db, "SELECT * FROM cards WHERE card_type = 'Icon' ORDER BY RANDOM() LIMIT 1")]


def open_hero_pack(db, user_id: int):
    return [draw_random(db, "SELECT * FROM cards WHERE card_type = 'Hero' ORDER BY RANDOM() LIMIT 1")]


def open_tester_pack(db, user_id: int):
    ndt = NON_DROPPABLE_TYPES
    ndt_sql = ",".join("?" * len(ndt))
    icon = draw_random(db, "SELECT * FROM cards WHERE card_type = 'Icon' ORDER BY RANDOM() LIMIT 1")
    cards = [icon]
    drawn_ids = {icon["card_id"]}
    for _ in range(4):
        for _ in range(200):
            chosen_type = random.choices(["Standard", "Other"], [0.9, 0.1])[0]
            if chosen_type == "Standard":
                row = db.execute("SELECT * FROM cards WHERE card_type = 'Standard' AND overall > 85 ORDER BY RANDOM() LIMIT 1").fetchone()
            else:
                row = db.execute(
                    f"SELECT * FROM cards WHERE card_type != 'Standard' AND card_type NOT IN ({ndt_sql}) AND overall > 85 ORDER BY RANDOM() LIMIT 1",
                    ndt,
                ).fetchone()
            if row and row["card_id"] not in drawn_ids:
                cards.append(row)
                drawn_ids.add(row["card_id"])
                break
    return cards


def open_mega_test_pack(db, user_id: int):
    cards = []
    drawn_ids = set()

    def draw(query, params=()):
        for _ in range(200):
            row = db.execute(query, params).fetchone()
            if row and row["card_id"] not in drawn_ids:
                drawn_ids.add(row["card_id"])
                cards.append(row)
                return True
        return False

    for _ in range(2):
        draw("SELECT * FROM cards WHERE card_type = 'Icon' ORDER BY RANDOM() LIMIT 1")
    for _ in range(3):
        draw("SELECT * FROM cards WHERE card_type = 'Hero' ORDER BY RANDOM() LIMIT 1")
    while len(cards) < 20:
        if not draw("SELECT * FROM cards WHERE card_type = 'Standard' AND overall > 85 ORDER BY RANDOM() LIMIT 1"):
            break

    if not cards:
        raise HTTPException(status_code=500, detail="Could not assemble mega test pack")
    return cards


PACK_OPENERS = {
    "rare_player_pack": open_rare_player_pack,
    "icon_pack":        open_icon_pack,
    "hero_pack":        open_hero_pack,
    "tester_pack":      open_tester_pack,
    "mega_test_pack":   open_mega_test_pack,
}


@router.get("/packs")
async def get_packs(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    row = db.execute("SELECT * FROM packs WHERE user_id = ?", (user_id,)).fetchone()
    if not row:
        return {"rare_player_pack": 0, "icon_pack": 0, "hero_pack": 0, "tester_pack": 0, "mega_test_pack": 0}
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

    selected = (
        random.sample(commons,   min(6, len(commons)))   +
        random.sample(uncommons, min(3, len(uncommons))) +
        random.sample(rares,     min(1, len(rares)))
    )

    result = []
    for card in selected:
        edition = add_to_inventory(db, user_id, card["card_id"])
        cd = card_to_dict(card)
        cd["edition"] = edition
        result.append(cd)

    db.execute("UPDATE players SET has_claimed_starter_pack = 1 WHERE user_id = ?", (user_id,))
    db.commit()

    return result


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

    result = []
    for card in cards:
        edition = add_to_inventory(db, user_id, card["card_id"])
        cd = card_to_dict(card)
        cd["edition"] = edition
        result.append(cd)

    db.execute(f"UPDATE packs SET {pack_type} = {pack_type} - 1 WHERE user_id = ?", (user_id,))
    db.commit()

    return result
