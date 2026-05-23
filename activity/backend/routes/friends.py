from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from db import get_db

router = APIRouter()


def _ensure_player(db, user_id: int, name: str):
    if not db.execute("SELECT 1 FROM players WHERE user_id=?", (user_id,)).fetchone():
        db.execute("INSERT INTO players (user_id, name) VALUES (?, ?)", (user_id, name))
        db.commit()


def _are_friends(db, a: int, b: int) -> bool:
    return db.execute(
        "SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?", (a, b)
    ).fetchone() is not None


def _add_friendship(db, a: int, b: int):
    db.execute("INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?,?)", (a, b))
    db.execute("INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?,?)", (b, a))
    db.commit()


# ── GET FRIENDS LIST ──────────────────────────────────────────────────────────

@router.get("/friends")
async def list_friends(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    rows = db.execute("""
        SELECT f.friend_id, p.name, p.avatar, p.coins, p.battles_won, p.battles_played, p.display_title
        FROM friendships f
        LEFT JOIN players p ON f.friend_id = p.user_id
        WHERE f.user_id = ?
        ORDER BY p.name COLLATE NOCASE
    """, (user_id,)).fetchall()
    return [
        {
            "user_id":        str(r["friend_id"]),
            "name":           r["name"] or f"Player {r['friend_id']}",
            "avatar":         r["avatar"],
            "coins":          r["coins"] or 0,
            "battles_won":    r["battles_won"] or 0,
            "battles_played": r["battles_played"] or 0,
            "display_title":  r["display_title"],
        }
        for r in rows
    ]


# ── REQUESTS (incoming + outgoing) ───────────────────────────────────────────

@router.get("/friends/requests")
async def list_requests(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    incoming = db.execute("""
        SELECT fr.request_id, fr.requester_id, fr.requested_at, p.name, p.avatar
        FROM friend_requests fr
        LEFT JOIN players p ON fr.requester_id = p.user_id
        WHERE fr.recipient_id = ?
        ORDER BY fr.requested_at DESC
    """, (user_id,)).fetchall()

    outgoing = db.execute("""
        SELECT fr.request_id, fr.recipient_id, fr.requested_at, p.name, p.avatar
        FROM friend_requests fr
        LEFT JOIN players p ON fr.recipient_id = p.user_id
        WHERE fr.requester_id = ?
        ORDER BY fr.requested_at DESC
    """, (user_id,)).fetchall()

    return {
        "incoming": [
            {
                "request_id":   r["request_id"],
                "user_id":      str(r["requester_id"]),
                "name":         r["name"] or f"Player {r['requester_id']}",
                "avatar":       r["avatar"],
                "requested_at": r["requested_at"],
            }
            for r in incoming
        ],
        "outgoing": [
            {
                "request_id":   r["request_id"],
                "user_id":      str(r["recipient_id"]),
                "name":         r["name"] or f"Player {r['recipient_id']}",
                "avatar":       r["avatar"],
                "requested_at": r["requested_at"],
            }
            for r in outgoing
        ],
    }


@router.get("/friends/notifications")
async def notif_count(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    n = db.execute(
        "SELECT COUNT(*) FROM friend_requests WHERE recipient_id=?",
        (user_id,)
    ).fetchone()[0]
    return {"pending": n}


# ── SEND REQUEST ─────────────────────────────────────────────────────────────

class SendBody(BaseModel):
    to_user_id: int | str
    to_name: str | None = None


@router.post("/friends/request")
async def send_request(body: SendBody, discord_user=Depends(get_current_user)):
    user_id   = int(discord_user["id"])
    user_name = discord_user.get("username", f"Player {user_id}")
    target_id = int(body.to_user_id)

    if target_id == user_id:
        raise HTTPException(400, "Cannot friend yourself")

    db = get_db()
    _ensure_player(db, user_id, user_name)
    _ensure_player(db, target_id, body.to_name or f"Player {target_id}")

    if _are_friends(db, user_id, target_id):
        raise HTTPException(400, "Already friends")

    # Already sent?
    existing = db.execute(
        "SELECT 1 FROM friend_requests WHERE requester_id=? AND recipient_id=?",
        (user_id, target_id)
    ).fetchone()
    if existing:
        raise HTTPException(400, "Request already sent")

    # Reverse request? auto-accept.
    reverse = db.execute(
        "SELECT request_id FROM friend_requests WHERE requester_id=? AND recipient_id=?",
        (target_id, user_id)
    ).fetchone()
    if reverse:
        _add_friendship(db, user_id, target_id)
        db.execute("DELETE FROM friend_requests WHERE request_id=?", (reverse["request_id"],))
        db.commit()
        return {"status": "auto_accepted"}

    db.execute(
        "INSERT INTO friend_requests (requester_id, recipient_id) VALUES (?,?)",
        (user_id, target_id)
    )
    db.commit()
    return {"status": "sent"}


# ── ACCEPT / DECLINE ─────────────────────────────────────────────────────────

@router.post("/friends/accept/{request_id}")
async def accept_request(request_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    row = db.execute(
        "SELECT requester_id, recipient_id FROM friend_requests WHERE request_id=?",
        (request_id,)
    ).fetchone()
    if not row or row["recipient_id"] != user_id:
        raise HTTPException(404, "Request not found")
    _add_friendship(db, row["requester_id"], row["recipient_id"])
    db.execute("DELETE FROM friend_requests WHERE request_id=?", (request_id,))
    db.commit()
    return {"status": "accepted"}


@router.post("/friends/decline/{request_id}")
async def decline_request(request_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    row = db.execute(
        "SELECT recipient_id, requester_id FROM friend_requests WHERE request_id=?",
        (request_id,)
    ).fetchone()
    if not row:
        raise HTTPException(404, "Request not found")
    # Either recipient declines or requester cancels
    if user_id not in (row["recipient_id"], row["requester_id"]):
        raise HTTPException(403, "Not yours")
    db.execute("DELETE FROM friend_requests WHERE request_id=?", (request_id,))
    db.commit()
    return {"status": "declined"}


# ── REMOVE FRIEND ────────────────────────────────────────────────────────────

@router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: int, discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()
    if not _are_friends(db, user_id, friend_id):
        raise HTTPException(404, "Not friends")
    db.execute("DELETE FROM friendships WHERE user_id=? AND friend_id=?", (user_id, friend_id))
    db.execute("DELETE FROM friendships WHERE user_id=? AND friend_id=?", (friend_id, user_id))
    db.commit()
    return {"status": "removed"}


# ── SEARCH PLAYERS ───────────────────────────────────────────────────────────

@router.get("/friends/search")
async def search_players(q: str = "", discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    db = get_db()

    q = (q or "").strip()
    if len(q) < 2:
        return []

    rows = db.execute("""
        SELECT user_id, name, avatar, battles_won, coins
        FROM players
        WHERE name LIKE ? AND user_id != ?
        ORDER BY battles_won DESC, name COLLATE NOCASE
        LIMIT 20
    """, (f"%{q}%", user_id)).fetchall()

    if not rows:
        return []

    ids = [r["user_id"] for r in rows]
    placeholders = ",".join("?" * len(ids))

    # Already friends with these?
    fset = {r[0] for r in db.execute(
        f"SELECT friend_id FROM friendships WHERE user_id=? AND friend_id IN ({placeholders})",
        (user_id, *ids)
    ).fetchall()}

    # Outgoing requests?
    pending_out = {r[0] for r in db.execute(
        f"SELECT recipient_id FROM friend_requests WHERE requester_id=? AND recipient_id IN ({placeholders})",
        (user_id, *ids)
    ).fetchall()}

    # Incoming requests?
    pending_in = {r[0] for r in db.execute(
        f"SELECT requester_id FROM friend_requests WHERE recipient_id=? AND requester_id IN ({placeholders})",
        (user_id, *ids)
    ).fetchall()}

    return [
        {
            "user_id":     str(r["user_id"]),
            "name":        r["name"] or f"Player {r['user_id']}",
            "avatar":      r["avatar"],
            "battles_won": r["battles_won"] or 0,
            "coins":       r["coins"] or 0,
            "is_friend":   r["user_id"] in fset,
            "pending_out": r["user_id"] in pending_out,
            "pending_in":  r["user_id"] in pending_in,
        }
        for r in rows
    ]
