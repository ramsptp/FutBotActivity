from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from db import get_db

router = APIRouter()
DECK_SIZE = 5

def enrich_deck(db, deck):
    card_ids = [int(x) for x in deck["cards"].split(",") if x.strip()]
    cards = []
    for cid in card_ids:
        row = db.execute("SELECT * FROM cards WHERE card_id = ?", (cid,)).fetchone()
        if row:
            import os
            d = dict(row)
            d["image_url"] = "/images/" + os.path.basename(d["image_path"]) if d.get("image_path") else None
            cards.append(d)
    return {"deck_name": deck["deck_name"], "cards": cards}

@router.get("/decks")
async def list_decks(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    rows = db.execute("SELECT * FROM decks WHERE user_id = ?", (user_id,)).fetchall()
    return [enrich_deck(db, dict(r)) for r in rows]

class DeckBody(BaseModel):
    deck_name: str
    card_ids: list[int]

@router.post("/decks")
async def create_deck(body: DeckBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    if len(body.card_ids) != DECK_SIZE:
        raise HTTPException(status_code=400, detail=f"Deck must have exactly {DECK_SIZE} cards")
    db = get_db()
    existing = db.execute(
        "SELECT 1 FROM decks WHERE user_id = ? AND deck_name = ?", (user_id, body.deck_name)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Deck name already exists")
    db.execute(
        "INSERT INTO decks (user_id, deck_name, cards) VALUES (?, ?, ?)",
        (user_id, body.deck_name, ",".join(str(i) for i in body.card_ids))
    )
    db.commit()
    return {"status": "created"}

@router.put("/decks/{deck_name}")
async def update_deck(deck_name: str, body: DeckBody, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    if len(body.card_ids) != DECK_SIZE:
        raise HTTPException(status_code=400, detail=f"Deck must have exactly {DECK_SIZE} cards")
    db = get_db()
    result = db.execute(
        "UPDATE decks SET deck_name = ?, cards = ? WHERE user_id = ? AND deck_name = ?",
        (body.deck_name, ",".join(str(i) for i in body.card_ids), user_id, deck_name)
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
