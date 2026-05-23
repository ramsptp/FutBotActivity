import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from db import get_db

router = APIRouter()

MARKET_PAGE_SIZE = 10
MARKET_DURATIONS = {'1h': 1, '3h': 3, '6h': 6, '12h': 12, '24h': 24, '48h': 48}


def _img(path):
    if not path:
        return None
    return "/images/" + os.path.basename(path)


def _now():
    return datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')


def _secs_left(expires_at_str):
    try:
        expires = datetime.strptime(str(expires_at_str), '%Y-%m-%d %H:%M:%S')
        return max(0, int((expires - datetime.utcnow()).total_seconds()))
    except Exception:
        return 0


def _expire_listings(db):
    """Lazy expiry: return cards to sellers and mark listings expired."""
    now = _now()
    expired = db.execute(
        "SELECT listing_id, seller_id, card_id, edition, trade_count FROM market_listings WHERE expires_at <= ? AND status = 'active'",
        (now,)
    ).fetchall()
    for row in expired:
        listing_id, seller_id, card_id, edition, trade_count = row
        db.execute(
            "INSERT INTO inventories (user_id, card_id, edition, trade_count) VALUES (?,?,?,?)",
            (seller_id, card_id, edition, trade_count)
        )
        db.execute(
            "UPDATE market_listings SET status='expired', resolved_at=? WHERE listing_id=?",
            (now, listing_id)
        )
    if expired:
        db.commit()


def _calc_min_price(card: dict) -> int:
    t = (card.get("card_type") or "").lower()
    ovr = card.get("overall", 0)
    v = 250 if "icon" in t else 175 if "hero" in t else 100
    if ovr >= 70:
        v += 50 + (ovr - 70) * 5
    return int(v)


def _row_to_dict(row, user_id: int) -> dict:
    d = dict(row)
    d["image_url"]    = _img(d.get("image_path"))
    d["seconds_left"] = _secs_left(d.get("expires_at", ""))
    d["is_mine"]      = d.get("seller_id") == user_id
    return d


class ListBody(BaseModel):
    card_id:  int
    edition:  Optional[int] = None
    price:    int
    duration: str


# ── BROWSE ────────────────────────────────────────────────────────────────────

@router.get("/market/stats")
async def market_stats(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    def q(sql, *p):
        return db.execute(sql, p).fetchone()[0] or 0

    total_listed  = q("SELECT COUNT(*) FROM market_listings WHERE seller_id=?", user_id)
    active        = q("SELECT COUNT(*) FROM market_listings WHERE seller_id=? AND status='active'", user_id)
    sold          = q("SELECT COUNT(*) FROM market_listings WHERE seller_id=? AND status='sold'", user_id)
    cancelled     = q("SELECT COUNT(*) FROM market_listings WHERE seller_id=? AND status='cancelled'", user_id)
    expired       = q("SELECT COUNT(*) FROM market_listings WHERE seller_id=? AND status='expired'", user_id)
    revenue       = q("SELECT COALESCE(SUM(price),0) FROM market_listings WHERE seller_id=? AND status='sold'", user_id)
    spend         = q("SELECT COALESCE(SUM(price),0) FROM market_listings WHERE buyer_id=? AND status='sold'", user_id)
    bought        = q("SELECT COUNT(*) FROM market_listings WHERE buyer_id=? AND status='sold'", user_id)
    sell_rate     = round(sold / total_listed * 100) if total_listed > 0 else 0

    return {
        "total_listed": total_listed,
        "active":       active,
        "sold":         sold,
        "cancelled":    cancelled,
        "expired":      expired,
        "revenue":      revenue,
        "spend":        spend,
        "bought":       bought,
        "profit":       revenue - spend,
        "sell_rate":    sell_rate,
    }


@router.get("/market")
async def browse_market(search: str = "", page: int = 0, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    _expire_listings(db)

    base = """
        SELECT ml.listing_id, ml.seller_id, ml.card_id, ml.edition, ml.trade_count,
               ml.price, ml.listed_at, ml.expires_at,
               c.name, c.overall, c.card_rarity, c.card_type, c.image_path,
               c.attack, c.defense, c.speed, c.position, c.club, c.league, c.nation,
               c.total_rounds_played, c.total_rounds_won,
               (SELECT COUNT(*) FROM inventories WHERE card_id = c.card_id) +
               (SELECT COUNT(*) FROM market_listings WHERE card_id = c.card_id AND status = 'active') AS copies,
               p.name AS seller_name
        FROM market_listings ml
        JOIN cards   c ON ml.card_id   = c.card_id
        JOIN players p ON ml.seller_id = p.user_id
        WHERE ml.status = 'active'
    """
    params = []
    if search:
        base += " AND c.name LIKE ?"
        params.append(f"%{search}%")
    base += " ORDER BY ml.listed_at DESC"

    all_rows = db.execute(base, params).fetchall()
    total    = len(all_rows)
    start    = page * MARKET_PAGE_SIZE
    sliced   = all_rows[start:start + MARKET_PAGE_SIZE]

    return {
        "listings": [_row_to_dict(r, user_id) for r in sliced],
        "total":    total,
        "page":     page,
        "pages":    max(1, (total + MARKET_PAGE_SIZE - 1) // MARKET_PAGE_SIZE),
    }


# ── MY LISTINGS ───────────────────────────────────────────────────────────────

@router.get("/market/mine")
async def my_listings(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    _expire_listings(db)

    rows = db.execute("""
        SELECT ml.listing_id, ml.seller_id, ml.card_id, ml.edition, ml.trade_count,
               ml.price, ml.listed_at, ml.expires_at,
               c.name, c.overall, c.card_rarity, c.card_type, c.image_path,
               c.attack, c.defense, c.speed, c.position, c.club, c.league, c.nation,
               c.total_rounds_played, c.total_rounds_won,
               (SELECT COUNT(*) FROM inventories WHERE card_id = c.card_id) AS copies,
               p.name AS seller_name
        FROM market_listings ml
        JOIN cards   c ON ml.card_id   = c.card_id
        JOIN players p ON ml.seller_id = p.user_id
        WHERE ml.seller_id = ? AND ml.status = 'active'
        ORDER BY ml.listed_at DESC
    """, (user_id,)).fetchall()

    return [_row_to_dict(r, user_id) for r in rows]


# ── LIST A CARD ───────────────────────────────────────────────────────────────

@router.post("/market/list")
async def list_card(body: ListBody, discord_user=Depends(get_current_user)):
    if body.duration not in MARKET_DURATIONS:
        raise HTTPException(status_code=400, detail="Invalid duration")

    user_id = int(discord_user["id"])
    db = get_db()

    # Find inventory row
    if body.edition is not None:
        inv = db.execute(
            "SELECT rowid, edition, trade_count FROM inventories WHERE user_id=? AND card_id=? AND edition=?",
            (user_id, body.card_id, body.edition)
        ).fetchone()
    else:
        inv = db.execute(
            "SELECT rowid, edition, trade_count FROM inventories WHERE user_id=? AND card_id=? ORDER BY rowid LIMIT 1",
            (user_id, body.card_id)
        ).fetchone()

    if not inv:
        raise HTTPException(status_code=400, detail="Card not in inventory")

    rowid, edition, trade_count = inv

    # Can't list if already active
    if db.execute(
        "SELECT 1 FROM market_listings WHERE seller_id=? AND card_id=? AND edition=? AND status='active'",
        (user_id, body.card_id, edition)
    ).fetchone():
        raise HTTPException(status_code=400, detail="This copy is already listed")

    card = db.execute("SELECT * FROM cards WHERE card_id=?", (body.card_id,)).fetchone()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    min_price = _calc_min_price(dict(card))
    if body.price < min_price:
        raise HTTPException(status_code=400, detail=f"Minimum price is {min_price} coins")

    # Escrow: remove from inventory
    db.execute("DELETE FROM inventories WHERE rowid=?", (rowid,))

    now     = _now()
    expires = (datetime.utcnow() + timedelta(hours=MARKET_DURATIONS[body.duration])).strftime('%Y-%m-%d %H:%M:%S')
    db.execute(
        "INSERT INTO market_listings (seller_id, card_id, edition, trade_count, price, listed_at, expires_at) VALUES (?,?,?,?,?,?,?)",
        (user_id, body.card_id, edition, trade_count, body.price, now, expires)
    )
    db.commit()
    return {"status": "listed", "expires_at": expires}


# ── BUY ───────────────────────────────────────────────────────────────────────

@router.post("/market/buy/{listing_id}")
async def buy_card(listing_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    listing = db.execute(
        "SELECT seller_id, card_id, edition, trade_count, price, expires_at FROM market_listings WHERE listing_id=? AND status='active'",
        (listing_id,)
    ).fetchone()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing no longer available")

    seller_id, card_id, edition, trade_count, price, expires_at = listing

    if _secs_left(expires_at) <= 0:
        _expire_listings(db)
        raise HTTPException(status_code=400, detail="Listing has expired")

    if seller_id == user_id:
        raise HTTPException(status_code=400, detail="You can't buy your own listing")

    buyer = db.execute("SELECT coins FROM players WHERE user_id=?", (user_id,)).fetchone()
    if not buyer or buyer["coins"] < price:
        raise HTTPException(status_code=400, detail="Not enough coins")

    now = _now()
    db.execute("UPDATE players SET coins=coins-? WHERE user_id=?", (price, user_id))
    db.execute("UPDATE players SET coins=coins+? WHERE user_id=?", (price, seller_id))
    db.execute(
        "INSERT INTO inventories (user_id, card_id, edition, trade_count) VALUES (?,?,?,?)",
        (user_id, card_id, edition, trade_count + 1)
    )
    db.execute(
        "UPDATE market_listings SET status='sold', resolved_at=?, buyer_id=? WHERE listing_id=?",
        (now, user_id, listing_id)
    )
    db.commit()

    card    = db.execute("SELECT * FROM cards WHERE card_id=?", (card_id,)).fetchone()
    new_bal = db.execute("SELECT coins FROM players WHERE user_id=?", (user_id,)).fetchone()["coins"]
    return {
        "status":      "purchased",
        "card":        {**dict(card), "image_url": _img(card["image_path"]), "edition": edition},
        "coins_spent": price,
        "coins":       new_bal,
    }


# ── CANCEL (UNLIST) ───────────────────────────────────────────────────────────

@router.delete("/market/listings/{listing_id}")
async def cancel_listing(listing_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    listing = db.execute(
        "SELECT card_id, edition, trade_count FROM market_listings WHERE listing_id=? AND seller_id=? AND status='active'",
        (listing_id, user_id)
    ).fetchone()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not yours")

    card_id, edition, trade_count = listing
    db.execute(
        "INSERT INTO inventories (user_id, card_id, edition, trade_count) VALUES (?,?,?,?)",
        (user_id, card_id, edition, trade_count)
    )
    db.execute(
        "UPDATE market_listings SET status='cancelled', resolved_at=? WHERE listing_id=?",
        (_now(), listing_id)
    )
    db.commit()
    return {"status": "cancelled"}
