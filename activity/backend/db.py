import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "cards_game.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
