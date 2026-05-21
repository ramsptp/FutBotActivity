import asyncio
import json
import os
import random
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
    mode: str = "deck"

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
        "mode": body.mode,
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

    # Update round stats in DB
    from db import get_db
    db = get_db()
    for pid in player_ids:
        db.execute("UPDATE players SET rounds_played = rounds_played + 1 WHERE user_id = ?", (int(pid),))
    if winner_id:
        loser_id = next(x for x in player_ids if x != winner_id)
        db.execute("UPDATE players SET rounds_won = rounds_won + 1 WHERE user_id = ?", (int(winner_id),))
        db.execute("UPDATE players SET rounds_lost = rounds_lost + 1 WHERE user_id = ?", (int(loser_id),))
    else:
        for pid in player_ids:
            db.execute("UPDATE players SET rounds_drawn = rounds_drawn + 1 WHERE user_id = ?", (int(pid),))
    db.commit()

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


# ── Fantasy Draft helpers ─────────────────────────────────────────

def get_draft_cards(round_num: int, used_ids: set, db):
    """Tier-ramped card selection: rounds 1-2 = tier1, 3-4 = tier1+2, 5 = tier2+3"""
    if round_num <= 2:
        tiers = [1]
    elif round_num <= 4:
        tiers = [1, 2]
    else:
        tiers = [2, 3]
    tier_ph = ",".join("?" * len(tiers))
    if used_ids:
        id_ph = ",".join("?" * len(used_ids))
        rows = db.execute(
            f"SELECT * FROM fantasy_cards WHERE fantasy_tier IN ({tier_ph}) AND fantasy_card_id NOT IN ({id_ph}) ORDER BY RANDOM() LIMIT 3",
            tiers + list(used_ids)
        ).fetchall()
    else:
        rows = db.execute(
            f"SELECT * FROM fantasy_cards WHERE fantasy_tier IN ({tier_ph}) ORDER BY RANDOM() LIMIT 3",
            tiers
        ).fetchall()
    cards = []
    for row in rows:
        d = dict(row)
        d["image_url"] = "/fantasy-images/" + os.path.basename(d["image_path"]) if d.get("image_path") else None
        d["card_id"] = d["fantasy_card_id"]  # alias so battle system works
        del d["image_path"]
        cards.append(d)
    return cards


async def start_draft_round(room):
    from db import get_db
    db = get_db()
    draft = room["draft"]
    cards = get_draft_cards(draft["round"], draft["used_ids"], db)
    draft["cards"] = cards
    draft["picks"] = {}
    draft["claimed"] = {}
    positions = list(range(len(cards)))
    random.shuffle(positions)
    draft["position_to_card"] = positions
    for pid in room["players"]:
        await send_to(room["players"][pid], {
            "type": "draft_round_start",
            "round": draft["round"],
            "total_rounds": 5,
            "cards": cards,
        })
    asyncio.create_task(_draft_timeout(room, draft["round"]))


async def _draft_timeout(room, round_num):
    await asyncio.sleep(25)
    draft = room.get("draft", {})
    if draft.get("round") != round_num or room.get("state") != "drafting":
        return
    player_ids = list(room["players"].keys())
    all_pos = [0, 1, 2]
    for pid in player_ids:
        if pid not in draft["picks"]:
            unclaimed = [p for p in all_pos if p not in draft["claimed"]]
            if unclaimed:
                pos = random.choice(unclaimed)
                draft["claimed"][pos] = pid
                draft["picks"][pid] = pos
    if len(draft["picks"]) >= 1 and not draft.get("resolved"):
        draft["resolved"] = True
        asyncio.create_task(resolve_draft_round(room))


async def resolve_draft_round(room):
    draft = room["draft"]
    player_ids = list(room["players"].keys())
    host_id = room["host_id"]
    guest_id = next(x for x in player_ids if x != host_id)
    ptc = draft.get("position_to_card", [0, 1, 2])

    host_pos  = draft["picks"].get(host_id,  0)
    guest_pos = draft["picks"].get(guest_id, min(1, len(draft["cards"]) - 1))

    host_card  = draft["cards"][ptc[host_pos]]  if host_pos  < len(ptc) else draft["cards"][0]
    guest_card = draft["cards"][ptc[guest_pos]] if guest_pos < len(ptc) else draft["cards"][-1]

    draft["host_hand"].append(host_card)
    draft["guest_hand"].append(guest_card)
    # Mark ALL 3 cards from this round as used so none reappear in future rounds
    for c in draft["cards"]:
        draft["used_ids"].add(c["fantasy_card_id"])

    for pid in player_ids:
        is_host = pid == host_id
        await send_to(room["players"][pid], {
            "type": "draft_round_result",
            "round": draft["round"],
            "your_card": host_card if is_host else guest_card,
            "opponent_card": guest_card if is_host else host_card,
            "your_deck_so_far": draft["host_hand"] if is_host else draft["guest_hand"],
        })

    await asyncio.sleep(5)
    draft["round"] += 1
    draft["resolved"] = False
    if draft["round"] > 5:
        await complete_draft(room)
    else:
        await start_draft_round(room)


async def complete_draft(room):
    draft = room["draft"]
    player_ids = list(room["players"].keys())
    host_id = room["host_id"]
    guest_id = next(x for x in player_ids if x != host_id)

    room["players"][host_id]["hand"]  = list(draft["host_hand"])
    room["players"][guest_id]["hand"] = list(draft["guest_hand"])

    for pid in player_ids:
        is_host = pid == host_id
        await send_to(room["players"][pid], {
            "type": "draft_complete",
            "your_cards": draft["host_hand"] if is_host else draft["guest_hand"],
            "opponent_cards": draft["guest_hand"] if is_host else draft["host_hand"],
        })
    await asyncio.sleep(6)
    room["round"] = 1
    room["score"] = {pid: 0 for pid in player_ids}
    await start_round(room)


async def send_select_deck(room):
    player_ids = list(room["players"].keys())
    for pid in player_ids:
        opp_id = next(x for x in player_ids if x != pid)
        await send_to(room["players"][pid], {
            "type": "select_deck",
            "opponent_name": room["players"][opp_id]["name"],
        })


@router.websocket("/ws/battle/{room_id}")
async def battle_ws(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...),
    mode: str = Query("deck"),
):
    await websocket.accept()

    discord_user = await verify_ws_token(token)
    if not discord_user:
        await websocket.send_text(json.dumps({"type": "error", "message": "Invalid token"}))
        await websocket.close()
        return

    user_id = discord_user["id"]
    username = discord_user["username"]

    if room_id not in rooms:
        rooms[room_id] = {
            "room_id": room_id,
            "players": {},
            "host_id": user_id,
            "mode": mode,
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

    room["players"][user_id] = {"ws": websocket, "name": username, "hand": None, "deck_name": None}
    room["score"][user_id] = 0

    if len(room["players"]) == 1:
        await send_to(room["players"][user_id], {"type": "waiting", "room_id": room_id})
    else:
        if room.get("mode") == "draft":
            room["state"] = "drafting"
            room["draft"] = {
                "round": 1, "cards": [], "picks": {}, "used_ids": set(),
                "claimed": {}, "host_hand": [], "guest_hand": [],
                "position_to_card": [0, 1, 2], "resolved": False,
            }
            asyncio.create_task(start_draft_round(room))
        else:
            room["state"] = "selecting_decks"
            await send_select_deck(room)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            # Fantasy draft pick
            if msg.get("type") == "draft_pick" and room.get("mode") == "draft" and room["state"] == "drafting":
                position = msg.get("position")
                draft = room["draft"]
                if position not in [0, 1, 2] or position in draft["claimed"] or user_id in draft["picks"] or draft.get("resolved"):
                    continue
                draft["claimed"][position] = user_id
                draft["picks"][user_id] = position
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                await send_to(room["players"][user_id], {"type": "draft_position_claimed", "position": position, "by": "you"})
                await send_to(room["players"][opp_id],  {"type": "draft_position_claimed", "position": position, "by": "opponent"})
                if len(draft["picks"]) == 2 and not draft.get("resolved"):
                    draft["resolved"] = True
                    asyncio.create_task(resolve_draft_round(room))
                continue

            # Deck selection in arena
            if msg.get("type") == "ready" and room["state"] == "selecting_decks":
                from db import get_db
                db = get_db()
                dn = msg.get("deck_name")
                hand = load_deck(db, int(user_id), dn)
                if not hand:
                    await send_to(room["players"][user_id], {"type": "error", "message": "Deck not found"})
                    continue
                room["players"][user_id]["hand"] = hand
                room["players"][user_id]["deck_name"] = dn
                player_ids = list(room["players"].keys())
                opp_id = next(pid for pid in player_ids if pid != user_id)
                await send_to(room["players"][opp_id], {"type": "opponent_deck_ready"})
                if all(room["players"][pid].get("hand") for pid in player_ids):
                    room["round"] = 1
                    room["score"] = {pid: 0 for pid in player_ids}
                    await start_round(room)
                continue

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
                    for pid in player_ids:
                        room["players"][pid]["hand"] = None
                    room["round"] = 1
                    room["score"] = {pid: 0 for pid in player_ids}
                    room["rematch_requests"] = set()
                    room["picks"] = {}
                    room["chosen_stat"] = None
                    if room.get("mode") == "draft":
                        room["state"] = "drafting"
                        room["draft"] = {
                            "round": 1, "cards": [], "picks": {}, "used_ids": set(),
                            "claimed": {}, "host_hand": [], "guest_hand": [],
                            "position_to_card": [0, 1, 2], "resolved": False,
                        }
                        asyncio.create_task(start_draft_round(room))
                    else:
                        room["state"] = "selecting_decks"
                        asyncio.create_task(send_select_deck(room))

    except WebSocketDisconnect:
        room["players"].pop(user_id, None)
        for p in room["players"].values():
            await send_to(p, {"type": "opponent_disconnected"})
        if not room["players"]:
            rooms.pop(room_id, None)
