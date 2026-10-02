"""
Test setup. Environment is configured before the app is imported.

Database/cache tests need a throwaway MongoDB and Redis:
    TEST_MONGODB_URI=mongodb://localhost:27017/confetti_test \
    TEST_REDIS_URL=redis://localhost:6379/15 pytest tests/
They are skipped when those variables are unset. The Mongo database name
must end in "_test" — tests delete data.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.mock_openai import MockOpenAI  # noqa: E402

API_KEY = "test-api-key"
MOCK_OPENAI = MockOpenAI()

TEST_MONGODB_URI = os.environ.get("TEST_MONGODB_URI")
TEST_REDIS_URL = os.environ.get("TEST_REDIS_URL")
if TEST_MONGODB_URI and not TEST_MONGODB_URI.split("?")[0].rstrip("/").endswith("_test"):
    raise RuntimeError("TEST_MONGODB_URI database name must end in _test (tests delete data)")

os.environ.update({
    "FLASK_ENV": "production",
    "PYTHON_API_KEY": API_KEY,
    "OPENAI_API_KEY": "sk-test",
    "OPENAI_BASE_URL": MOCK_OPENAI.url,
    "AI_MAX_RETRIES": "0",
    # Unreachable defaults so nothing touches a real database by accident
    "MONGODB_URI": TEST_MONGODB_URI or "mongodb://127.0.0.1:1/unused_test",
    "REDIS_URL": TEST_REDIS_URL or "redis://127.0.0.1:1/0",
})
for var in ("ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
    os.environ.pop(var, None)

import run  # noqa: E402

requires_mongo = pytest.mark.skipif(not TEST_MONGODB_URI, reason="TEST_MONGODB_URI not set")
requires_redis = pytest.mark.skipif(not TEST_REDIS_URL, reason="TEST_REDIS_URL not set")


@pytest.fixture
def client():
    return run.app.test_client()


@pytest.fixture
def auth():
    return {"Authorization": f"Bearer {API_KEY}"}


@pytest.fixture
def mock_openai():
    MOCK_OPENAI.fail = False
    MOCK_OPENAI.answer = {"creative_theme_ideas": ["mock theme"], "confidence_score": 0.9}
    MOCK_OPENAI.requests.clear()
    yield MOCK_OPENAI
    MOCK_OPENAI.fail = False


@pytest.fixture
def db():
    from services.db import get_db
    database = get_db()
    for name in ("ailearnings", "vendors", "vendorbookings", "bookings", "reviews"):
        database[name].delete_many({})
    return database


@pytest.fixture
def redis_client():
    from services.db import get_redis
    r = get_redis()
    r.flushdb()
    return r


@pytest.fixture
def wedding():
    return {
        "eventType": "wedding",
        "guestCount": 150,
        "budget": {"amount": 5_000_000, "currency": "NGN"},
        "location": {"city": "Lagos", "state": "Lagos"},
        "eventDate": "2027-06-12T00:00:00.000Z",
        "eventDescription": "An elegant garden wedding for 150 guests with live music.",
    }
