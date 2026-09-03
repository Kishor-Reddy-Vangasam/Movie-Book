"""
db.py — PyMongo connection and collection helpers.

Reads credentials from environment variables (loaded via python-dotenv).
Never hardcodes credentials here.
"""
import os
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson import ObjectId
from dotenv import load_dotenv
from pathlib import Path

# Load .env from project root (three levels up: api -> backend -> project root)
_env_path = Path(__file__).resolve().parent.parent.parent / '.env'
load_dotenv(_env_path)

logger = logging.getLogger(__name__)

MONGO_URI = os.environ.get('MONGO_URI')
MONGO_DB_NAME = os.environ.get('MONGO_DB_NAME', 'movie_booking')

if not MONGO_URI:
    raise EnvironmentError(
        "MONGO_URI is not set. Please create a .env file in the project root "
        "with your MongoDB Atlas connection string."
    )

try:
    _client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    # Ping to verify connection on startup
    _client.admin.command('ping')
    logger.info("✅ Connected to MongoDB Atlas successfully.")
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    logger.error(f"❌ MongoDB connection failed: {e}")
    raise

_db = _client[MONGO_DB_NAME]


def get_db():
    """Return the active MongoDB database instance."""
    return _db


# ── Collection accessors ─────────────────────────────────────────────────────

def users_col():
    return _db['users']


def movies_col():
    return _db['movies']


def theatres_col():
    return _db['theatres']


def screens_col():
    return _db['screens']


def shows_col():
    return _db['shows']


def bookings_col():
    return _db['bookings']


def sessions_col():
    return _db['sessions']


# ── Index creation (called at startup) ───────────────────────────────────────

def create_indexes():
    """Create useful indexes. Safe to call multiple times (idempotent)."""
    try:
        users_col().create_index([('email', ASCENDING)], unique=True)
        sessions_col().create_index([('token', ASCENDING)], unique=True)
        sessions_col().create_index([('expires_at', ASCENDING)], expireAfterSeconds=0)
        movies_col().create_index([('title', ASCENDING)])
        movies_col().create_index([('genre', ASCENDING)])
        movies_col().create_index([('language', ASCENDING)])
        movies_col().create_index([('status', ASCENDING)])
        shows_col().create_index([('movie_id', ASCENDING)])
        shows_col().create_index([('theatre_id', ASCENDING)])
        shows_col().create_index([('date', ASCENDING)])
        bookings_col().create_index([('user_id', ASCENDING)])
        bookings_col().create_index([('show_id', ASCENDING)])
        bookings_col().create_index([('booking_reference', ASCENDING)], unique=True, sparse=True)
        logger.info("✅ MongoDB indexes ensured.")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")


# ── Serialization helpers ─────────────────────────────────────────────────────

def serialize_doc(doc):
    """
    Recursively convert MongoDB document to JSON-safe dict.
    Converts ObjectId → str and datetime → ISO string.
    """
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)
            elif hasattr(v, 'isoformat'):
                result[k] = v.isoformat()
            elif isinstance(v, dict):
                result[k] = serialize_doc(v)
            elif isinstance(v, list):
                result[k] = [serialize_doc(i) if isinstance(i, (dict, ObjectId)) else (str(i) if isinstance(i, ObjectId) else i) for i in v]
            else:
                result[k] = v
        return result
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc


def is_valid_object_id(oid_str):
    """Return True if the string is a valid MongoDB ObjectId."""
    try:
        ObjectId(oid_str)
        return True
    except Exception:
        return False


def to_object_id(oid_str):
    """Convert string to ObjectId, raising ValueError on failure."""
    try:
        return ObjectId(oid_str)
    except Exception:
        raise ValueError(f"Invalid ObjectId: {oid_str}")
