from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.auth import router as auth_router
from routes.collection import router as collection_router
from routes.decks import router as decks_router
from routes.battles import router as battles_router
from routes.packs import router as packs_router
from routes.shop import router as shop_router
from routes.profile import router as profile_router
from routes.market import router as market_router
from db import get_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve card images from wherever they're stored on disk
def get_images_dir():
    db = get_db()
    row = db.execute("SELECT image_path FROM cards WHERE image_path IS NOT NULL LIMIT 1").fetchone()
    if row:
        import os
        return os.path.dirname(row["image_path"])
    return None

images_dir = get_images_dir()
if images_dir:
    app.mount("/images", StaticFiles(directory=images_dir), name="images")

# Serve fantasy draft card images
def get_fantasy_images_dir():
    db = get_db()
    row = db.execute("SELECT image_path FROM fantasy_cards WHERE image_path IS NOT NULL LIMIT 1").fetchone()
    if row:
        import os
        return os.path.dirname(row["image_path"])
    return None

fantasy_dir = get_fantasy_images_dir()
if fantasy_dir:
    import os
    if os.path.isdir(fantasy_dir):
        app.mount("/fantasy-images", StaticFiles(directory=fantasy_dir), name="fantasy-images")

def _run_migrations():
    db = get_db()
    db.execute("""
        CREATE TABLE IF NOT EXISTS market_listings (
            listing_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id   INTEGER,
            card_id     INTEGER,
            edition     INTEGER DEFAULT 1,
            trade_count INTEGER DEFAULT 0,
            price       INTEGER,
            listed_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            expires_at  TEXT,
            status      TEXT DEFAULT 'active',
            resolved_at TEXT,
            buyer_id    INTEGER
        )
    """)
    db.commit()
    migrations = [
        ("players", "daily_streak",        "INTEGER DEFAULT 0"),
        ("players", "last_daily_claim",    "TEXT"),
        ("players", "daily_pending_card1", "INTEGER"),
        ("players", "daily_pending_card2", "INTEGER"),
        ("inventories", "battles_played",  "INTEGER DEFAULT 0"),
        ("inventories", "battles_won",     "INTEGER DEFAULT 0"),
        ("inventories", "rounds_played",   "INTEGER DEFAULT 0"),
        ("inventories", "rounds_won",      "INTEGER DEFAULT 0"),
        ("cards",   "wishlist_count",      "INTEGER DEFAULT 0"),
        ("cards",   "total_battles_played","INTEGER DEFAULT 0"),
        ("cards",   "total_battles_won",   "INTEGER DEFAULT 0"),
        ("cards",   "total_rounds_played", "INTEGER DEFAULT 0"),
        ("cards",   "total_rounds_won",    "INTEGER DEFAULT 0"),
    ]
    for table, col, typedef in migrations:
        try:
            db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typedef}")
        except Exception:
            pass
    db.commit()

_run_migrations()

app.include_router(auth_router, prefix="/api")
app.include_router(collection_router, prefix="/api")
app.include_router(decks_router, prefix="/api")
app.include_router(battles_router)
app.include_router(packs_router, prefix="/api")
app.include_router(shop_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(market_router,  prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
