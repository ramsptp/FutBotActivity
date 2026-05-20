import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from auth import get_current_user
from db import get_db

router = APIRouter()

DISCORD_API = "https://discord.com/api/v10"

class TokenRequest(BaseModel):
    code: str

@router.post("/token")
async def exchange_token(body: TokenRequest):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DISCORD_API}/oauth2/token",
            data={
                "client_id": os.environ["DISCORD_CLIENT_ID"],
                "client_secret": os.environ["DISCORD_CLIENT_SECRET"],
                "grant_type": "authorization_code",
                "code": body.code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Token exchange failed")
    return resp.json()

@router.get("/me")
async def get_me(discord_user=Depends(get_current_user)):
    user_id = discord_user["id"]
    username = discord_user["username"]
    db = get_db()
    player = db.execute("SELECT * FROM players WHERE user_id = ?", (user_id,)).fetchone()
    if not player:
        db.execute("INSERT INTO players (user_id, name) VALUES (?, ?)", (int(user_id), username))
        db.commit()
        player = db.execute("SELECT * FROM players WHERE user_id = ?", (user_id,)).fetchone()
    return {**discord_user, "player": dict(player)}
