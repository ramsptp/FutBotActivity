import asyncio
import json
import os
import time
import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from pydantic import BaseModel
from auth import get_current_user

router = APIRouter()

ROUNDS = 5
COUNTER = {"attack": "defense", "defense": "attack", "speed": "speed"}
CHALLENGE_TTL = 60  # seconds

rooms: dict[str, dict] = {}

# Lobby: channel_id -> {user_id: {name, expires_at}}
lobby: dict[str, dict] = {}

# Pending challenges: to_user_id -> {from_user_id, from_name, room_id, deck_name, expires_at}
pending_challenges: dict[str, dict] = {}


# --- Lobby & Challenge REST endpoints ---

class LobbyRegister(BaseModel):
    channel_id: str

class ChallengeBody(BaseModel):
    to_user_id: str
    room_id: str
    deck_name: str

@router.post("/api/lobby/register")
async def register_lobby(body: LobbyRegister, discord_user=Depends(get_current_user)):
    user_id = discord_user["id"]
    channel = lobby.setdefault(body.channel_id, {})
    channel[user_id] = {
        "name": discord_user["username"],
        "avatar": discord_user.get("avatar"),
        "expires_at": time.time() + 35,
    }
    return {"ok": True}

@router.get("/api/lobby/participants")
async def get_participants(channel_id: str, discord_user=Depends(get_current_user)):
    user_id = discord_user["id"]
    now = time.time()
    channel = lobby.get(channel_id, {})
    return [
        {"user_id": uid, "name": info["name"], "avatar": info.get("avatar")}
        for uid, info in channel.items()
        if uid != user_id and info["expires_at"] > now
    ]

@router.post("/api/challenges")
async def send_challenge(body: ChallengeBody, discord_user=Depends(get_current_user)):
    from_id = discord_user["id"]
    pending_challenges[body.to_user_id] = {
        "from_user_id": from_id,
        "from_name": discord_user["username"],
        "room_id": body.room_id,
        "deck_name": body.deck_name,
        "expires_at": time.time() + CHALLENGE_TTL,
    }
    return {"ok": True}

@router.get("/api/challenges/incoming")
async def get_incoming_challenge(discord_user=Depends(get_current_user)):
    user_id = discord_user["id"]
    challenge = pending_challenges.get(user_id)
    if not challenge or challenge["expires_at"] < time.time():
        pending_challenges.pop(user_id, None)
        return None
    return challenge

@router.delete("/api/challenges/decline")
async def decline_challenge(discord_user=Depends(get_current_user), silent: bool = False):
    challenge = pending_challenges.pop(discord_user["id"], None)
    if not silent and challenge and challenge.get("room_id"):
        room = rooms.get(challenge["room_id"])
        if room:
            for p in room["players"].values():
                await send_to(p, {
                    "type": "challenge_declined",
                    "by": discord_user["username"],
                })
    return {"ok": True}


async def verify_ws_token(token: str):
    from auth import _token_cache, CACHE_TTL
    cached = _token_cache.get(token)
    if cached and time.time() < cached[1]:
        return cached[0]
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://discord.com/api/v10/users/@me",
            headers={"Authorization": f"Bearer {token}"}
        )
    if resp.status_code != 200:
        return None
    user = resp.json()
    _token_cache[token] = (user, time.time() + CACHE_TTL)
    return user


def load_deck(db, user_id: int, deck_name: str):
    row = db.execute(
        "SELECT cards FROM decks WHERE user_id = ? AND deck_name = ?", (user_id, deck_name)
    ).fetchone()
    if not row:
        return None
    card_ids = [int(x) for x in row["cards"].split(",") if x.strip()]
    cards = []
    for cid in card_ids:
        card = db.execute("SELECT * FROM cards WHERE card_id = ?", (cid,)).fetchone()
        if card:
            d = dict(card)
            d["image_url"] = "/images/" + os.path.basename(d["image_path"]) if d.get("image_path") else None
            del d["image_path"]
            cards.append(d)
    return cards


def update_battle_stats(db, winner_id, loser_id, is_draw: bool):
    if is_draw:
        for uid in [winner_id, loser_id]:
            db.execute(
                "UPDATE players SET battles_played = battles_played + 1, battles_drawn = battles_drawn + 1 WHERE user_id = ?",
                (int(uid),)
            )
    else:
        db.execute(
            "UPDATE players SET battles_played = battles_played + 1, battles_won = battles_won + 1 WHERE user_id = ?",
            (int(winner_id),)
        )
        db.execute(
            "UPDATE players SET battles_played = battles_played + 1, battles_lost = battles_lost + 1 WHERE user_id = ?",
            (int(loser_id),)
        )
    db.commit()


async def send_to(player, msg):
    try:
        await player["ws"].send_text(json.dumps(msg))
    except Exception:
        pass


async def start_round(room):
    room["state"] = "stat_selection"
    room["chosen_stat"] = None
    room["picks"] = {}

    host_id = room["host_id"]
    player_ids = list(room["players"].keys())
    guest_id = next(x for x in player_ids if x != host_id)

    # Odd rounds → host picks stat, even rounds → guest picks stat
    stat_picker_id = host_id if room["round"] % 2 == 1 else guest_id
    room["stat_picker_id"] = stat_picker_id

    for pid in player_ids:
        opp_id = next(x for x in player_ids if x != pid)
        opp = room["players"][opp_id]
        await send_to(room["players"][pid], {
            "type": "round_start",
            "round": room["round"],
            "picks_stat": pid == stat_picker_id,
            "your_hand": room["players"][pid]["hand"],
            "opponent_name": opp["name"],
            "opponent_card_count": len(opp["hand"]),
            "score": {"you": room["score"][pid], "opponent": room["score"][opp_id]},
        })


async def resolve_round(room):
    picker_id = room["stat_picker_id"]
    player_ids = list(room["players"].keys())
    other_id = next(x for x in player_ids if x != picker_id)

    picker_stat = room["chosen_stat"]
    other_stat = COUNTER[picker_stat]

    c_picker = room["picks"][picker_id]
    c_other = room["picks"][other_id]
    v_picker = c_picker.get(picker_stat, 0)
    v_other = c_other.get(other_stat, 0)

    if v_picker > v_other:
        winner_id = picker_id
    elif v_other > v_picker:
        winner_id = other_id
    else:
        # Tiebreaker: higher overall wins
        o_picker = c_picker.get("overall", 0)
        o_other = c_other.get("overall", 0)
        if o_picker > o_other:
            winner_id = picker_id
        elif o_other > o_picker:
            winner_id = other_id
        else:
            winner_id = None  # true draw

    # Remap to host/other naming for the rest of the function
    host_id = room["host_id"]
    opp_id = next(x for x in player_ids if x != host_id)

    if winner_id:
        room["score"][winner_id] += 1

    # Remove played cards
    for pid in player_ids:
        played_id = room["picks"][pid]["card_id"]
        room["players"][pid]["hand"] = [
            c for c in room["players"][pid]["hand"] if c["card_id"] != played_id
        ]

    # Send results — each player sees their own stat vs opponent's
    for pid in player_ids:
        opp = next(x for x in player_ids if x != pid)
        is_picker = pid == picker_id
        my_stat = picker_stat if is_picker else other_stat
        opp_stat = other_stat if is_picker else picker_stat
        round_winner = "draw" if winner_id is None else ("you" if winner_id == pid else "opponent")
        await send_to(room["players"][pid], {
            "type": "round_result",
            "round": room["round"],
            "your_stat": my_stat,
            "opponent_stat": opp_stat,
            "your_card": room["picks"][pid],
            "opponent_card": room["picks"][opp],
            "round_winner": round_winner,
            "score": {"you": room["score"][pid], "opponent": room["score"][opp]},
        })

    room["round"] += 1
    await asyncio.sleep(4)

    hands_empty = any(len(room["players"][pid]["hand"]) == 0 for pid in player_ids)
    someone_won = any(room["score"][pid] >= 3 for pid in player_ids)
    if room["round"] > ROUNDS or hands_empty or someone_won:
        await end_game(room)
    else:
        await start_round(room)


async def end_game(room):
    room["state"] = "game_over"
    from db import get_db
    db = get_db()

    player_ids = list(room["players"].keys())
    p1_id, p2_id = player_ids[0], player_ids[1]
    s1, s2 = room["score"][p1_id], room["score"][p2_id]

    if s1 == s2:
        update_battle_stats(db, p1_id, p2_id, is_draw=True)
        db.execute("UPDATE players SET coins = coins + 150 WHERE user_id = ?", (int(p1_id),))
        db.execute("UPDATE players SET coins = coins + 150 WHERE user_id = ?", (int(p2_id),))
    elif s1 > s2:
        update_battle_stats(db, p1_id, p2_id, is_draw=False)
        db.execute("UPDATE players SET coins = coins + 200 WHERE user_id = ?", (int(p1_id),))
        db.execute("UPDATE players SET coins = coins + 100 WHERE user_id = ?", (int(p2_id),))
    else:
        update_battle_stats(db, p2_id, p1_id, is_draw=False)
        db.execute("UPDATE players SET coins = coins + 200 WHERE user_id = ?", (int(p2_id),))
        db.execute("UPDATE players SET coins = coins + 100 WHERE user_id = ?", (int(p1_id),))
    db.commit()

    for pid in player_ids:
        opp_id = next(x for x in player_ids if x != pid)
        my_score = room["score"][pid]
        opp_score = room["score"][opp_id]
        winner = "draw" if my_score == opp_score else ("you" if my_score > opp_score else "opponent")
        coins_earned = 150 if my_score == opp_score else (200 if winner == "you" else 100)
        await send_to(room["players"][pid], {
            "type": "game_over",
            "winner": winner,
            "final_score": {"you": my_score, "opponent": opp_score},
            "coins_earned": coins_earned,
        })


@router.websocket("/ws/battle/{room_id}")
async def battle_ws(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
    deck_name: str = Query(...),
):
    await websocket.accept()

    discord_user = await verify_ws_token(token)
    if not discord_user:
        await websocket.send_text(json.dumps({"type": "error", "message": "Invalid token"}))
        await websocket.close()
        return

    user_id = discord_user["id"]
    username = discord_user["username"]

    from db import get_db
    db = get_db()
    hand = load_deck(db, int(user_id), deck_name)
    if not hand:
        await websocket.send_text(json.dumps({"type": "error", "message": "Deck not found"}))
        await websocket.close()
        return

    if room_id not in rooms:
        rooms[room_id] = {
            "room_id": room_id,
            "players": {},
            "host_id": user_id,
            "state": "waiting",
            "round": 1,
            "chosen_stat": None,
            "picks": {},
            "score": {},
            "rematch_requests": set(),
        }

    room = rooms[room_id]

    if len(room["players"]) >= 2:
        await websocket.send_text(json.dumps({"type": "error", "message": "Room is full"}))
        await websocket.close()
        return

    room["players"][user_id] = {"ws": websocket, "name": username, "hand": hand, "deck_name": deck_name}
    room["score"][user_id] = 0

    if len(room["players"]) == 1:
        await send_to(room["players"][user_id], {"type": "waiting", "room_id": room_id})
    else:
        await start_round(room)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Host picks the stat for the round
            if msg.get("type") == "pick_stat" and room["state"] == "stat_selection" and user_id == room["stat_picker_id"]:
                stat = msg.get("stat")
                if stat not in COUNTER:
                    continue
                room["chosen_stat"] = stat
                room["state"] = "picking"
                counter = COUNTER[stat]
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                # Tell host which stat they're using
                await send_to(room["players"][user_id], {
                    "type": "stat_chosen",
                    "stat": stat,
                    "your_stat": stat,
                    "opponent_stat": counter,
                })
                # Tell opponent the counter stat
                await send_to(room["players"][opp_id], {
                    "type": "stat_chosen",
                    "stat": stat,
                    "your_stat": counter,
                    "opponent_stat": stat,
                })

            # Both players pick a card
            elif msg.get("type") == "pick_card" and room["state"] == "picking":
                if user_id in room["picks"]:
                    continue
                card = next((c for c in room["players"][user_id]["hand"] if c["card_id"] == msg["card_id"]), None)
                if not card:
                    continue

                room["picks"][user_id] = card
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                await send_to(room["players"][opp_id], {"type": "opponent_picked"})

                if len(room["picks"]) == 2:
                    room["state"] = "resolving"
                    asyncio.create_task(resolve_round(room))

            elif msg.get("type") == "surrender" and room["state"] not in ["game_over", "waiting"]:
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                room["score"][user_id] = 0
                room["score"][opp_id] = 3
                room["state"] = "resolving"
                asyncio.create_task(end_game(room))

            elif msg.get("type") == "rematch_request" and room["state"] == "game_over":
                room["rematch_requests"].add(user_id)
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                await send_to(room["players"][opp_id], {"type": "rematch_requested"})

                if len(room["rematch_requests"]) == 2:
                    # Reload decks and reset room
                    from db import get_db
                    db = get_db()
                    for pid in player_ids:
                        fresh_hand = load_deck(db, int(pid), room["players"][pid]["deck_name"])
                        room["players"][pid]["hand"] = fresh_hand or []
                    room["round"] = 1
                    room["score"] = {pid: 0 for pid in player_ids}
                    room["state"] = "stat_selection"
                    room["rematch_requests"] = set()
                    room["picks"] = {}
                    room["chosen_stat"] = None
                    asyncio.create_task(start_round(room))

    except WebSocketDisconnect:
        room["players"].pop(user_id, None)
        for p in room["players"].values():
            await send_to(p, {"type": "opponent_disconnected"})
        if not room["players"]:
            rooms.pop(room_id, None)
