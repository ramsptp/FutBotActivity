import time
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from db import get_db

router = APIRouter()

STAT_COLUMNS = {
    "battles_won":    "Battles Won",
    "battles_played": "Battles Played",
    "rounds_won":     "Rounds Won",
    "rounds_played":  "Rounds Played",
    "coins":          "Coins",
    "cards_owned":    "Cards Owned",
}

# Stats backed by a subquery rather than a plain players column
STAT_EXPR_OVERRIDES = {
    "cards_owned": "(SELECT COUNT(*) FROM inventories i WHERE i.user_id = p.user_id)",
}

VALID_SCOPES = ("server", "vc", "global", "friends")
DEFAULT_LIMIT = 25


def _guild_member_ids(db, guild_id: str | None) -> set[int]:
    """Anyone known to be in this guild — via the dedicated guild_members table
    OR via any channel_members row that's been tagged with this guild_id."""
    if not guild_id:
        return set()
    rows = db.execute("""
        SELECT user_id FROM guild_members WHERE guild_id=?
        UNION
        SELECT user_id FROM channel_members WHERE guild_id=?
    """, (guild_id, guild_id)).fetchall()
    return {int(r["user_id"]) for r in rows}


def _vc_member_ids_live(channel_id: str | None) -> set[int]:
    """Currently-active lobby entries for this channel (live VC presence)."""
    if not channel_id:
        return set()
    # Import lazily to avoid circular deps
    from routes.battles import lobby
    now = time.time()
    channel = lobby.get(channel_id, {})
    return {int(uid) for uid, info in channel.items() if info.get("expires_at", 0) > now}


def _vc_member_ids_persistent(db, channel_id: str | None) -> set[int]:
    """All users ever seen in this VC (persistent membership)."""
    if not channel_id:
        return set()
    rows = db.execute(
        "SELECT user_id FROM channel_members WHERE channel_id=?",
        (channel_id,)
    ).fetchall()
    return {int(r["user_id"]) for r in rows}


def _friend_ids(db, user_id: int) -> set[int]:
    rows = db.execute(
        "SELECT friend_id FROM friendships WHERE user_id=?",
        (user_id,)
    ).fetchall()
    return {int(r["friend_id"]) for r in rows}


@router.get("/leaderboard")
async def leaderboard(
    stat: str = "battles_won",
    scope: str = "global",
    channel_id: str | None = None,
    guild_id: str | None = None,
    limit: int = DEFAULT_LIMIT,
    discord_user=Depends(get_current_user),
):
    if stat not in STAT_COLUMNS:
        raise HTTPException(400, "Invalid stat")
    scope = (scope or "global").lower()
    if scope not in VALID_SCOPES:
        raise HTTPException(400, "Invalid scope")

    user_id = int(discord_user["id"])
    db = get_db()

    stat_expr = STAT_EXPR_OVERRIDES.get(stat, f"p.{stat}")
    all_rows = db.execute(f"""
        SELECT p.user_id, p.name, p.avatar, p.display_title, {stat_expr} AS stat_value
        FROM players p
        ORDER BY stat_value DESC
    """).fetchall()

    if scope == "server":
        member_ids = _guild_member_ids(db, guild_id)
        member_ids.add(user_id)  # caller should always see their own rank
        filtered = [r for r in all_rows if int(r["user_id"]) in member_ids]
    elif scope == "vc":
        live = _vc_member_ids_live(channel_id)
        # Union live + caller (so they see themselves even if they happen to be inactive)
        live.add(user_id)
        # Also include persistent VC members that have been here before
        live |= _vc_member_ids_persistent(db, channel_id)
        filtered = [r for r in all_rows if int(r["user_id"]) in live]
    elif scope == "friends":
        fids = _friend_ids(db, user_id)
        fids.add(user_id)
        filtered = [r for r in all_rows if int(r["user_id"]) in fids]
    else:  # global
        filtered = list(all_rows)

    entries = []
    my_entry = None
    for rank, r in enumerate(filtered, start=1):
        uid_int = int(r["user_id"])
        e = {
            "rank":          rank,
            "user_id":       str(uid_int),  # string — JS would lose precision past 2^53
            "name":          r["name"] or f"Player {uid_int}",
            "avatar":        r["avatar"],
            "display_title": r["display_title"],
            "value":         int(r["stat_value"] or 0),
            "is_me":         uid_int == user_id,
        }
        if e["is_me"]:
            my_entry = e
        if rank <= limit:
            entries.append(e)

    return {
        "stat":      stat,
        "stat_name": STAT_COLUMNS[stat],
        "scope":     scope,
        "entries":   entries,
        "my_entry":  my_entry,
        "total":     len(filtered),
    }


@router.get("/leaderboard/stats")
async def list_stats():
    return [{"key": k, "name": v} for k, v in STAT_COLUMNS.items()]
