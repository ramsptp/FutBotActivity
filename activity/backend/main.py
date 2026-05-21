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

app.include_router(auth_router, prefix="/api")
app.include_router(collection_router, prefix="/api")
app.include_router(decks_router, prefix="/api")
app.include_router(battles_router)
app.include_router(packs_router, prefix="/api")
app.include_router(shop_router, prefix="/api")
app.include_router(profile_router, prefix="/api")

@app.get("/api/health")
def health():
    return {"status": "ok"}
