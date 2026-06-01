import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Use service role key for backend

_supabase: Client | None = None


def get_supabase() -> Client:
    """Get or create Supabase client singleton."""
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables"
            )
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


def reset_supabase():
    """Reset the Supabase client (useful for testing)."""
    global _supabase
    _supabase = None
