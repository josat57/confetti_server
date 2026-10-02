"""
Shared MongoDB / Redis access.

One MongoClient per process (it is thread-safe and pools connections), and a
Redis client that backs off after a failed connect instead of paying the
connect timeout on every request while Redis is down.
"""

import os
import json
import time
import logging
import threading
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_mongo_db = None
_redis_client = None
_redis_retry_at = 0.0
REDIS_RETRY_SECONDS = 30


def get_db():
    global _mongo_db
    if _mongo_db is None:
        with _lock:
            if _mongo_db is None:
                from pymongo import MongoClient
                uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/confetti")
                client = MongoClient(
                    uri,
                    serverSelectionTimeoutMS=3000,
                    connectTimeoutMS=3000,
                    socketTimeoutMS=15000,
                )
                db_name = uri.split("/")[-1].split("?")[0] or "confetti"
                _mongo_db = client[db_name]
    return _mongo_db


def get_redis():
    """Return a connected Redis client, or None (retrying at most every 30s)."""
    global _redis_client, _redis_retry_at
    if _redis_client is not None:
        return _redis_client
    if time.monotonic() < _redis_retry_at:
        return None
    with _lock:
        if _redis_client is not None:
            return _redis_client
        try:
            import redis as redis_lib
            client = redis_lib.Redis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            client.ping()
            _redis_client = client
        except Exception as e:
            _redis_retry_at = time.monotonic() + REDIS_RETRY_SECONDS
            logger.warning(f"Redis unavailable — caching disabled for {REDIS_RETRY_SECONDS}s: {e}")
    return _redis_client


def cache_get(key: str) -> Optional[Any]:
    r = get_redis()
    if not r:
        return None
    try:
        val = r.get(key)
        return json.loads(val) if val else None
    except Exception as e:
        logger.warning(f"Cache get failed for {key}: {e}")
        return None


def cache_set(key: str, value: Any, ttl: int) -> None:
    r = get_redis()
    if not r:
        return
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache set failed for {key}: {e}")


def cached(key: str, ttl: int, compute: Callable[[], Any]) -> Any:
    """Return the cached value for key, computing and storing it on a miss."""
    hit = cache_get(key)
    if hit is not None:
        return hit
    value = compute()
    cache_set(key, value, ttl)
    return value


def to_object_id(value: Any):
    """ObjectId for a valid 24-hex id, otherwise the value unchanged."""
    from bson import ObjectId
    if isinstance(value, ObjectId):
        return value
    return ObjectId(value) if value is not None and ObjectId.is_valid(str(value)) else value
