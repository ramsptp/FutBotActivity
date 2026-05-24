from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from auth import get_current_user
from db import get_db

router = APIRouter()
DECK_SIZE = 5


def parse_cards_field(cards_str: str) -> list[dict]:
    """Parse 'card_id:edition,...' (new) or legacy 'card_id,...' format."""
    slots = []
    for token in cards_str.split(","):
        token = token.strip()
        if not token:
            continue
        if ":" in token:
            cid_str, ed_str = token.split(":", 1)
            slots.append({"card_id": int(cid_str), "edition": int(ed_str)})
        else:
            slots.append({"card_id": int(token), "edition": None})
    return slots


def enrich_deck(db, deck, user_id=None):
    import os
    slots = parse_cards_field(deck["cards"])
    cards = []
    for slot in slots:
        cid     = slot["card_id"]
        edition = slot["edition"]
        row = db.execute("SELECT * FROM cards WHERE card_id = ?", (cid,)).fetchone()
        if row:
            d = dict(row)
            d["image_url"] = "/images/" + os.path.basename(d["image_path"]) if d.get("image_path") else None
            d["edition"] = edition
            if user_id is not None:
                if edition is not None:
                    owned = db.execute(
                        "SELECT 1 FROM inventories WHERE user_id = ? AND card_id = ? AND edition = ?",
                        (user_id, cid, edition)
                    ).fetchone()
                else:
                    owned = db.execute(
                        "SELECT 1 FROM inventories WHERE user_id = ? AND card_id = ?",
                        (user_id, cid)
                    ).fetchone()
                d["owned"] = bool(owned)
            cards.append(d)
    complete = len(cards) == DECK_SIZE and all(c.get("owned", True) for c in cards)
    return {"deck_name": deck["deck_name"], "cards": cards, "complete": complete}


@router.get("/decks")
async def list_decks(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    rows = db.execute("SELECT * FROM decks WHERE user_id = ?", (user_id,)).fetchall()
    return [enrich_deck(db, dict(r), user_id) for r in rows]


class CardSlot(BaseModel):
    card_id: int
    edition: Optional[int] = None


class DeckBody(BaseModel):
    deck_name: str
    cards: list[CardSlot]


def _serialize_cards(cards: list[CardSlot]) -> str:
    parts = []
    for c in cards:
        parts.append(f"{c.card_id}:{c.edition}" if c.edition is not None else str(c.card_id))
    return ",".join(parts)


@router.post("/decks")
async def create_deck(body: DeckBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    if len(body.cards) != DECK_SIZE:
        raise HTTPException(status_code=400, detail=f"Deck must have exactly {DECK_SIZE} cards")
    db = get_db()
    existing = db.execute(
        "SELECT 1 FROM decks WHERE user_id = ? AND deck_name = ?", (user_id, body.deck_name)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Deck name already exists")
    db.execute(
        "INSERT INTO decks (user_id, deck_name, cards) VALUES (?, ?, ?)",
        (user_id, body.deck_name, _serialize_cards(body.cards))
    )
    db.commit()
    return {"status": "created"}


@router.put("/decks/{deck_name}")
async def update_deck(deck_name: str, body: DeckBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    if len(body.cards) != DECK_SIZE:
        raise HTTPException(status_code=400, detail=f"Deck must have exactly {DECK_SIZE} cards")
    db = get_db()
    result = db.execute(
        "UPDATE decks SET deck_name = ?, cards = ? WHERE user_id = ? AND deck_name = ?",
        (body.deck_name, _serialize_cards(body.cards), user_id, deck_name)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.commit()
    return {"status": "updated"}


@router.delete("/decks/{deck_name}")
async def delete_deck(deck_name: str, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    result = db.execute(
        "DELETE FROM decks WHERE user_id = ? AND deck_name = ?", (user_id, deck_name)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.commit()
    return {"status": "deleted"}
