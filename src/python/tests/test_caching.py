"""AI result caching and provider failover (needs Redis)."""

from tests.conftest import requires_redis

pytestmark = requires_redis


def _analyze(client, auth, wedding):
    return client.post("/ai/comprehensive-analysis", json={"event_data": wedding, "vendors": []}, headers=auth).json


def test_real_results_cached_fallbacks_not(client, auth, wedding, mock_openai, redis_client):
    assert _analyze(client, auth, wedding)["metadata"]["models_used"] == ["gpt-4o"]
    assert len(redis_client.keys("ai_cache:v2:*")) == 1

    redis_client.flushdb()
    mock_openai.fail = True
    assert _analyze(client, auth, wedding)["metadata"]["models_used"] == ["fallback"]
    assert redis_client.keys("ai_cache:*") == []

    mock_openai.fail = False  # recovers on the very next request
    assert _analyze(client, auth, wedding)["metadata"]["models_used"] == ["gpt-4o"]


def test_cache_key_depends_on_vendors(client, auth, wedding, mock_openai, redis_client):
    client.post("/ai/comprehensive-analysis", json={"event_data": wedding, "vendors": []}, headers=auth)
    vendors = [{"id": "65a000000000000000000001", "name": "A", "category": "venue", "rating": 4}]
    client.post("/ai/comprehensive-analysis", json={"event_data": wedding, "vendors": vendors}, headers=auth)
    assert len(redis_client.keys("ai_cache:v2:*")) == 2
