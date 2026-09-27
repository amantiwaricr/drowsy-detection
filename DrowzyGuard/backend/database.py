"""MongoDB connection, user operations, and detection history.

Collections:
    users:      _id, name, email, password, createdAt
    detections: _id, userId, score, status, alert, timestamp
"""

import os
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

_db = None


def get_db():
    """Return the database handle, creating the client on first use."""
    global _db
    if _db is None:
        client = MongoClient(
            os.getenv("MONGO_URI", "mongodb://localhost:27017"),
            serverSelectionTimeoutMS=3000,
            tz_aware=True,
        )
        _db = client[os.getenv("MONGO_DB", "drowzyguard")]
    return _db


def init_db():
    """Create indexes. Returns True if MongoDB is reachable, False otherwise."""
    try:
        db = get_db()
        db.users.create_index("email", unique=True)
        db.detections.create_index([("userId", ASCENDING), ("timestamp", DESCENDING)])
        return True
    except PyMongoError as exc:
        print(f"[database] MongoDB unavailable: {exc}")
        return False


def is_connected():
    try:
        get_db().command("ping")
        return True
    except PyMongoError:
        return False


def _to_object_id(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


def _normalize_email(email):
    return email.strip().lower()


# ---------- Users ----------

def create_user(name, email, password_hash):
    """Insert a user. Returns the new user id, or None if the email is taken."""
    try:
        result = get_db().users.insert_one({
            "name": name,
            "email": _normalize_email(email),
            "password": password_hash,
            "createdAt": datetime.now(timezone.utc),
        })
    except DuplicateKeyError:
        return None
    return str(result.inserted_id)


def find_user_by_email(email):
    return get_db().users.find_one({"email": _normalize_email(email)})


def find_user_by_id(user_id):
    oid = _to_object_id(user_id)
    return get_db().users.find_one({"_id": oid}) if oid else None


# ---------- Detections ----------

def _serialize_detection(doc):
    return {
        "id": str(doc["_id"]),
        "score": doc["score"],
        "status": doc["status"],
        "alert": doc["alert"],
        "timestamp": doc["timestamp"].isoformat(),
    }


def save_detection(user_id, score, status, alert):
    """Store one detection result. Returns the new detection id."""
    result = get_db().detections.insert_one({
        "userId": _to_object_id(user_id),
        "score": int(score),
        "status": status,
        "alert": bool(alert),
        "timestamp": datetime.now(timezone.utc),
    })
    return str(result.inserted_id)


def get_history(user_id, limit=100):
    """Most recent detections first."""
    cursor = (
        get_db().detections.find({"userId": _to_object_id(user_id)})
        .sort("timestamp", DESCENDING)
        .limit(limit)
    )
    return [_serialize_detection(doc) for doc in cursor]


def get_latest_detection(user_id):
    doc = get_db().detections.find_one(
        {"userId": _to_object_id(user_id)}, sort=[("timestamp", DESCENDING)]
    )
    return _serialize_detection(doc) if doc else None


def count_alerts(user_id):
    return get_db().detections.count_documents(
        {"userId": _to_object_id(user_id), "alert": True}
    )
