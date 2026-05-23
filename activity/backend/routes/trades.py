import uuid
import asyncio
import os
import time
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from db import get_db


async def _verify_ws_token(token: str):
    from auth import _token_cache, CACHE_TTL
    cached = _token_cache.get(token)
    if cached and time.time() < cached[1]:
        return cached[0]
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://discord.com/api/v10/users/@me",
                                headers={"Authorization": f"Bearer {token}"})
    if resp.status_code != 200:
        return None
    user = resp.json()
    _token_cache[token] = (user, time.time() + CACHE_TTL)
    return user

router = APIRouter()

pending_trade_invites: dict[int, dict] = {}   # to_user_id -> invite info
trade_rooms: dict[str, dict] = {}              # room_id -> room state


class TradeInviteBody(BaseModel):
    to_user_id: int | str


def _img(path):
    return "/images/" + os.path.basename(path) if path else None


def _room_state(room: dict, viewer_id: int) -> dict:
    return {
        "type":    "state",
        "my_side": "p1" if viewer_id == room["p1_id"] else "p2",
        "status":  room["status"],
        "p1": {
            "id": room["p1_id"], "name": room["p1_name"],
            "offer": room["p1_offer"],
            "locked": room["p1_locked"], "confirmed": room["p1_confirmed"],
        },
        "p2": {
            "id": room["p2_id"], "name": room["p2_name"],
            "offer": room["p2_offer"],
            "locked": room["p2_locked"], "confirmed": room["p2_confirmed"],
        },
    }


async def _broadcast_state(room: dict):
    for uid, ws in list(room["connections"].items()):
        try:
            await ws.send_json(_room_state(room, uid))
        except Exception:
            pass


async def _broadcast(room: dict, msg: dict):
    for ws in list(room["connections"].values()):
        try:
            await ws.send_json(msg)
        except Exception:
            pass


# ── HTTP ──────────────────────────────────────────────────────────────────────

@router.post("/api/trades/invite")
async def send_trade_invite(body: TradeInviteBody, discord_user=Depends(get_current_user)):
    from_id   = int(discord_user["id"])
    from_name = discord_user.get("username", "Unknown")
    to_id     = int(body.to_user_id)

    if from_id == to_id:
        raise HTTPException(status_code=400, detail="Cannot trade with yourself")

    room_id = str(uuid.uuid4())[:8]

    pending_trade_invites[to_id] = {
        "from_user_id": from_id,
        "from_name":    from_name,
        "room_id":      room_id,
        "expires_at":   (datetime.utcnow() + timedelta(seconds=90)).isoformat(),
    }

    trade_rooms[room_id] = {
        "room_id": room_id,
        "p1_id": from_id,        "p1_name": from_name,
        "p2_id": to_id,          "p2_name": "",
        "p1_offer": {"cards": [], "coins": 0},
        "p2_offer": {"cards": [], "coins": 0},
        "p1_locked": False,    "p2_locked": False,
        "p1_confirmed": False, "p2_confirmed": False,
        "status": "waiting",
        "connections": {},
    }

    return {"room_id": room_id}


@router.get("/api/trades/incoming")
async def get_incoming_trade(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    invite  = pending_trade_invites.get(user_id)
    if not invite:
        return None
    try:
        if datetime.fromisoformat(invite["expires_at"]) < datetime.utcnow():
            pending_trade_invites.pop(user_id, None)
            trade_rooms.pop(invite.get("room_id", ""), None)
            return None
    except Exception:
        pass
    return invite


@router.delete("/api/trades/decline")
async def decline_trade(discord_user=Depends(get_current_user)):
    user_id = int(discord_user["id"])
    invite  = pending_trade_invites.pop(user_id, None)
    if invite:
        trade_rooms.pop(invite.get("room_id", ""), None)
    return {"status": "declined"}


# ── WEBSOCKET ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/trade/{room_id}")
async def trade_ws(websocket: WebSocket, room_id: str, user_id: int = 0, username: str = "", token: str = ""):
    await websocket.accept()

    room = trade_rooms.get(room_id)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    if user_id == 0 or user_id not in (room["p1_id"], room["p2_id"]):
        user = await _verify_ws_token(token)
        if not user:
            await websocket.send_json({"type": "error", "message": "Unauthorized"})
            await websocket.close(code=4001)
            return
        user_id = int(user["id"])
        username = user.get("username", "Player")

    # Use provided username or fall back to existing room name
    if not username:
        username = room["p1_name"] if user_id == room["p1_id"] else (room["p2_name"] or "Player")
    room     = trade_rooms.get(room_id)

    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    # Reject if not a participant
    if user_id not in (room["p1_id"], room["p2_id"]):
        await websocket.send_json({"type": "error", "message": "Not your trade"})
        await websocket.close()
        return

    room["connections"][user_id] = websocket

    if user_id == room["p2_id"] and not room["p2_name"]:
        room["p2_name"] = username
        pending_trade_invites.pop(user_id, None)

    if len(room["connections"]) == 2 and room["status"] == "waiting":
        room["status"] = "negotiating"

    await _broadcast_state(room)

    # 5-minute session timeout
    async def _timeout():
        await asyncio.sleep(300)
        if room_id in trade_rooms and trade_rooms[room_id]["status"] in ("waiting", "negotiating"):
            trade_rooms[room_id]["status"] = "timed_out"
            await _broadcast(trade_rooms[room_id], {"type": "timeout"})
            trade_rooms.pop(room_id, None)
    asyncio.create_task(_timeout())

    db = get_db()

    try:
        while True:
            data     = await websocket.receive_json()
            msg_type = data.get("type")

            if room.get("status") not in ("waiting", "negotiating"):
                break

            my_side   = "p1" if user_id == room["p1_id"] else "p2"
            my_offer  = room[f"{my_side}_offer"]

            if msg_type == "add_card":
                card_id = int(data.get("card_id", 0))
                edition = data.get("edition")

                if edition is not None:
                    row = db.execute(
                        "SELECT c.card_id, c.name, c.overall, c.card_rarity, c.card_type, c.image_path "
                        "FROM inventories i JOIN cards c ON i.card_id=c.card_id "
                        "WHERE i.user_id=? AND i.card_id=? AND i.edition=?",
                        (user_id, card_id, edition)
                    ).fetchone()
                else:
                    row = db.execute(
                        "SELECT c.card_id, c.name, c.overall, c.card_rarity, c.card_type, c.image_path "
                        "FROM inventories i JOIN cards c ON i.card_id=c.card_id "
                        "WHERE i.user_id=? AND i.card_id=? ORDER BY i.rowid LIMIT 1",
                        (user_id, card_id)
                    ).fetchone()

                if not row:
                    await websocket.send_json({"type": "error", "message": "Card not in inventory"})
                    continue

                act_edition = edition if edition is not None else db.execute(
                    "SELECT edition FROM inventories WHERE user_id=? AND card_id=? ORDER BY rowid LIMIT 1",
                    (user_id, card_id)
                ).fetchone()[0]

                if any(c["card_id"] == card_id and c.get("edition") == act_edition for c in my_offer["cards"]):
                    continue

                my_offer["cards"].append({
                    "card_id":    row["card_id"],
                    "edition":    act_edition,
                    "name":       row["name"],
                    "overall":    row["overall"],
                    "card_rarity": row["card_rarity"],
                    "card_type":  row["card_type"],
                    "image_url":  _img(row["image_path"]),
                })
                room["p1_locked"] = room["p2_locked"] = False
                room["p1_confirmed"] = room["p2_confirmed"] = False

            elif msg_type == "remove_card":
                card_id = int(data.get("card_id", 0))
                edition = data.get("edition")
                my_offer["cards"] = [
                    c for c in my_offer["cards"]
                    if not (c["card_id"] == card_id and c.get("edition") == edition)
                ]
                room["p1_locked"] = room["p2_locked"] = False
                room["p1_confirmed"] = room["p2_confirmed"] = False

            elif msg_type == "set_coins":
                amount = max(0, int(data.get("amount", 0)))
                bal    = db.execute("SELECT coins FROM players WHERE user_id=?", (user_id,)).fetchone()
                if not bal or bal["coins"] < amount:
                    await websocket.send_json({"type": "error", "message": "Not enough coins"})
                    continue
                my_offer["coins"] = amount
                room["p1_locked"] = room["p2_locked"] = False
                room["p1_confirmed"] = room["p2_confirmed"] = False

            elif msg_type == "lock":
                room[f"{my_side}_locked"] = not room[f"{my_side}_locked"]
                if not room[f"{my_side}_locked"]:
                    room["p1_confirmed"] = room["p2_confirmed"] = False

            elif msg_type == "confirm":
                if not (room["p1_locked"] and room["p2_locked"]):
                    await websocket.send_json({"type": "error", "message": "Both players must lock first"})
                    continue
                room[f"{my_side}_confirmed"] = True
                if room["p1_confirmed"] and room["p2_confirmed"]:
                    await _execute_trade(room, db)
                    trade_rooms.pop(room_id, None)
                    return

            elif msg_type == "cancel":
                room["status"] = "cancelled"
                await _broadcast(room, {"type": "cancelled", "by": username})
                # Close the other player's connection cleanly
                for uid, other_ws in list(room["connections"].items()):
                    if uid != user_id:
                        try:
                            await other_ws.close(code=1000)
                        except Exception:
                            pass
                trade_rooms.pop(room_id, None)
                return

            await _broadcast_state(room)

    except WebSocketDisconnect:
        room["connections"].pop(user_id, None)
        if room_id in trade_rooms:
            await _broadcast(room, {"type": "cancelled", "by": f"{username} disconnected"})
            trade_rooms.pop(room_id, None)


async def _execute_trade(room: dict, db):
    p1_id, p2_id = room["p1_id"], room["p2_id"]
    p1o, p2o     = room["p1_offer"], room["p2_offer"]

    # Final asset verification
    for card in p1o["cards"]:
        if not db.execute("SELECT 1 FROM inventories WHERE user_id=? AND card_id=? AND edition=?",
                          (p1_id, card["card_id"], card["edition"])).fetchone():
            await _broadcast(room, {"type": "error", "message": f"{room['p1_name']} no longer owns {card['name']}"})
            return
    for card in p2o["cards"]:
        if not db.execute("SELECT 1 FROM inventories WHERE user_id=? AND card_id=? AND edition=?",
                          (p2_id, card["card_id"], card["edition"])).fetchone():
            await _broadcast(room, {"type": "error", "message": f"{room['p2_name']} no longer owns {card['name']}"})
            return

    r1 = db.execute("SELECT coins FROM players WHERE user_id=?", (p1_id,)).fetchone()
    r2 = db.execute("SELECT coins FROM players WHERE user_id=?", (p2_id,)).fetchone()
    if (r1["coins"] if r1 else 0) < p1o["coins"]:
        await _broadcast(room, {"type": "error", "message": f"{room['p1_name']} doesn't have enough coins"})
        return
    if (r2["coins"] if r2 else 0) < p2o["coins"]:
        await _broadcast(room, {"type": "error", "message": f"{room['p2_name']} doesn't have enough coins"})
        return

    # Coins
    if p1o["coins"] > 0:
        db.execute("UPDATE players SET coins=coins-? WHERE user_id=?", (p1o["coins"], p1_id))
        db.execute("UPDATE players SET coins=coins+? WHERE user_id=?", (p1o["coins"], p2_id))
    if p2o["coins"] > 0:
        db.execute("UPDATE players SET coins=coins-? WHERE user_id=?", (p2o["coins"], p2_id))
        db.execute("UPDATE players SET coins=coins+? WHERE user_id=?", (p2o["coins"], p1_id))

    # Cards p1 → p2
    for card in p1o["cards"]:
        row = db.execute("SELECT rowid FROM inventories WHERE user_id=? AND card_id=? AND edition=?",
                         (p1_id, card["card_id"], card["edition"])).fetchone()
        if row:
            db.execute("UPDATE inventories SET user_id=?, trade_count=trade_count+1 WHERE rowid=?",
                       (p2_id, row[0]))

    # Cards p2 → p1
    for card in p2o["cards"]:
        row = db.execute("SELECT rowid FROM inventories WHERE user_id=? AND card_id=? AND edition=?",
                         (p2_id, card["card_id"], card["edition"])).fetchone()
        if row:
            db.execute("UPDATE inventories SET user_id=?, trade_count=trade_count+1 WHERE rowid=?",
                       (p1_id, row[0]))

    db.commit()

    await _broadcast(room, {
        "type":        "complete",
        "p1_name":     room["p1_name"],
        "p2_name":     room["p2_name"],
        "p1_received": {"cards": [c["name"] for c in p2o["cards"]], "coins": p2o["coins"]},
        "p2_received": {"cards": [c["name"] for c in p1o["cards"]], "coins": p1o["coins"]},
    })
