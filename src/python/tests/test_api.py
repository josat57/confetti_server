"""Auth, request handling and endpoint contracts (no database needed)."""

import json

import run


def test_health_is_public(client):
    resp = client.get("/health/ai")
    assert resp.status_code == 200
    assert resp.json["status"] in ("healthy", "degraded")


def test_requires_api_key(client):
    assert client.post("/analyze-text", json={"text": "hi"}).status_code == 401
    bad = {"Authorization": "Bearer wrong"}
    assert client.post("/analyze-text", json={"text": "hi"}, headers=bad).status_code == 401


def test_fails_closed_without_key_in_production(client, monkeypatch):
    monkeypatch.setattr(run, "PYTHON_API_KEY", "")
    assert client.post("/analyze-text", json={"text": "hi"}).status_code == 503
    monkeypatch.setattr(run, "IS_DEVELOPMENT", True)
    assert client.post("/analyze-text", json={"text": "hi"}).status_code == 200


def test_llm_params_are_clamped():
    assert run._llm_params({"temperature": 9, "max_tokens": 10**6}, 0.4, 2000) == (1.0, run.MAX_TOKENS_CAP)
    assert run._llm_params({"max_tokens": "x", "temperature": None}, 0.4, 2000) == (0.4, 2000)


def test_request_id_round_trip(client, auth):
    resp = client.post("/analyze-text", json={"text": "hi"}, headers={**auth, "X-Request-ID": "abc123"})
    assert resp.headers["X-Request-ID"] == "abc123"


def test_malformed_json_and_missing_fields_are_json_400(client, auth):
    resp = client.post("/optimize-budget", data="{nope", content_type="application/json", headers=auth)
    assert resp.status_code == 400 and resp.is_json
    resp = client.post("/optimize-budget", json={"budget": 1}, headers=auth)
    assert resp.status_code == 400 and "preferences" in resp.json["message"]


def test_unexpected_errors_do_not_leak_internals(client, auth, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("secret connection string")
    monkeypatch.setattr(run.market_intelligence, "generate_insights", boom)
    resp = client.post("/ai/market-insights", json={"location": {}}, headers=auth)
    assert resp.status_code == 500
    assert "secret" not in resp.get_data(as_text=True)
    assert resp.json["request_id"]


def test_keywords_use_bundled_nltk_data(client, auth):
    resp = client.post("/analyze-text", json={"text": "An elegant garden wedding with fresh flowers."}, headers=auth)
    assert resp.status_code == 200
    # "flower" (lemmatized) proves the WordNet corpus loads, not just the tokenizer
    assert {k["word"] for k in resp.json["keywords"]} >= {"garden", "wedding", "flower"}


def test_analyze_event_plan_accepts_object_or_number_budget(client, auth, wedding):
    for budget in ({"amount": 5_000_000, "currency": "NGN"}, 5_000_000):
        resp = client.post("/analyze-event-plan", json={"event_data": {**wedding, "budget": budget}}, headers=auth)
        assert resp.status_code == 200, resp.json
        assert resp.json["nlp_analysis"]["summary"].startswith("An elegant")


def test_predict_prices_is_rule_based(client, auth):
    resp = client.post("/predict-prices", json={"items": ["catering", {"category": "venue", "guest_count": 200}, "spaceship"]},
                       headers=auth)
    preds = resp.json["predictions"]
    assert resp.json["method"] == "rule_based"
    assert preds[0]["estimated_price"] > 0 and preds[1]["estimated_price"] > 0
    assert preds[2]["estimated_price"] is None


def test_simulation_is_deterministic(client, auth):
    plan = {"plan": {"budget": {"total": 1_000_000}, "guest_count": 100, "event_type": "wedding", "vendors": []}}
    first = client.post("/simulate-event", json=plan, headers=auth).json
    for _ in range(5):
        assert client.post("/simulate-event", json=plan, headers=auth).json == first
    assert first["outcome"] in ("success", "needs_attention", "at_risk")


def test_market_insights_unknown_city_is_not_lagos_and_not_random(client, auth):
    body = {"location": {"city": "Enugu"}, "event_type": "wedding"}
    first = client.post("/ai/market-insights", json=body, headers=auth).json
    second = client.post("/ai/market-insights", json=body, headers=auth).json
    assert first["metadata"]["city_profile"] == "default"
    assert first["insights"]["market_overview"]["market_size"] == "unknown"
    landscape = lambda r: r["insights"]["competitive_landscape"]["key_players"]
    assert landscape(first) == landscape(second)


def test_generic_model_endpoint_returns_response_field(client, auth, mock_openai):
    mock_openai.answer = {"personality": "warm", "priorities": ["food"]}
    resp = client.post("/ai/gpt4", json={"prompt": "Analyze. Respond as JSON."}, headers=auth)
    assert resp.status_code == 200
    assert resp.json["response"] == {"personality": "warm", "priorities": ["food"]}
    assert resp.json["tokens_used"] == 15
    # caller's schema wins: the enrichment system prompt is not used here
    assert "gap-filling" not in mock_openai.requests[-1]["messages"][0]["content"]


def test_generic_model_endpoint_503_when_provider_fails(client, auth, mock_openai):
    mock_openai.fail = True
    resp = client.post("/ai/gpt4", json={"prompt": "hi"}, headers=auth)
    assert resp.status_code == 503


def test_local_endpoint_runs_scoring_engine(client, auth, wedding):
    resp = client.post("/ai/local", json={"prompt": "x", "context": {"event_data": wedding}}, headers=auth)
    assert resp.status_code == 200
    assert "budget_optimization" in resp.json["response"]
    empty = client.post("/ai/local", json={"prompt": "x"}, headers=auth).json
    assert empty["status"] == "success" and empty["response"] == {}


def test_analyze_image_uses_vision_model(client, auth, mock_openai):
    mock_openai.answer = {"analysis": {"style_assessment": {"style": "rustic"}},
                          "detected_elements": ["tables", "string lights"],
                          "recommendations": ["add florals"], "overall_score": 0.7}
    resp = client.post("/ai/analyze-image", json={"image_url": "https://example.com/venue.jpg"}, headers=auth)
    assert resp.status_code == 200
    assert resp.json["detected_elements"] == ["tables", "string lights"]
    content = mock_openai.requests[-1]["messages"][1]["content"]
    assert any(part.get("type") == "image_url" for part in content)


def test_analyze_image_errors(client, auth, monkeypatch):
    resp = client.post("/ai/analyze-image", json={"image_url": "file:///etc/passwd"}, headers=auth)
    assert resp.status_code == 400
    import services.ai_orchestrator as orch
    monkeypatch.setattr(orch, "_get_openai", lambda: None)
    resp = client.post("/ai/analyze-image", json={"image_url": "https://example.com/a.jpg"}, headers=auth)
    assert resp.status_code == 503


def test_stream_plan_reassembles_json(client, auth, wedding, mock_openai):
    resp = client.post("/ai/stream-plan", json={"event_data": wedding, "vendors": [], "user_context": {"planLevel": 3}},
                       headers=auth)
    events = [json.loads(line[6:]) for line in resp.get_data(as_text=True).splitlines() if line.startswith("data: ")]
    assert not any("error" in e for e in events)
    text = "".join(e["text"] for e in events if "text" in e)
    assert json.loads(text) == mock_openai.answer
    assert events[-1] == {"phase": "done"}


def test_match_vendors_returns_scored_matches(client, auth):
    vendors = [
        {"id": "65a000000000000000000001", "name": "Eko Hall", "category": "venue", "rating": 4.7,
         "pricing": {"averagePrice": 1_500_000}, "eventTypes": ["wedding"],
         "location": {"address": {"city": "Lagos"}}, "availabilityStatus": "high"},
        {"id": "65a000000000000000000002", "name": "Lens", "category": "photography", "rating": 3.0},
    ]
    resp = client.post("/match-vendors", headers=auth, json={"requirements": {
        "event_type": "wedding", "budget": {"amount": 5_000_000}, "guest_count": 150,
        "location": {"city": "Lagos"}, "vendors": vendors}})
    assert resp.status_code == 200
    matches = resp.json["matches"]
    # Node maps matches back to vendors by id, so ids must round-trip
    assert [m["vendor_id"] for m in matches] == [v["id"] for v in vendors]
    assert matches[0]["rating"] == 4.7 and matches[0]["business_name"] == "Eko Hall"
    assert resp.json["top_vendors"] == matches[:10]
