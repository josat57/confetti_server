"""Learning records shared with Node's AILearning model."""

from bson import ObjectId

import run
import services.learning_service as learning_mod
from tests.conftest import requires_mongo

pytestmark = requires_mongo


def test_interactions_upsert_and_feedback(client, auth, db):
    uid = str(ObjectId())
    L = run.learning_service
    first = L.record_interaction(uid, "user", {"eventType": "wedding", "budget": 500_000}, {})
    second = L.record_interaction(uid, "user", {"eventType": "birthday"}, {})
    assert first["recorded"] and first["upserted"] and second["recorded"]

    doc = db.ailearnings.find_one({"userId": ObjectId(uid)})
    assert doc["learningData"]["totalInteractions"] == 2
    assert doc["learningData"]["interactions"][0]["budget"] == {"amount": 500_000.0, "currency": "NGN"}

    latest = client.post("/ai/feedback", json={"user_id": uid, "user_type": "user", "rating": 5}, headers=auth)
    assert latest.status_code == 200 and latest.json["interaction_id"] == second["interaction_id"]
    by_id = client.post("/ai/feedback", headers=auth, json={
        "user_id": uid, "user_type": "user", "rating": 2, "interaction_id": first["interaction_id"]})
    assert by_id.status_code == 200

    ints = db.ailearnings.find_one({"userId": ObjectId(uid)})["learningData"]["interactions"]
    assert [i["feedback"]["rating"] for i in ints] == [2, 5]
    assert db.ailearnings.find_one({"userId": ObjectId(uid)})["learningData"]["accuracy"] == 0.7


def test_feedback_validation(client, auth, db):
    assert client.post("/ai/feedback", json={"user_id": str(ObjectId()), "rating": 9}, headers=auth).status_code == 400
    assert client.post("/ai/feedback", json={"user_id": str(ObjectId()), "rating": 4}, headers=auth).status_code == 404


def test_interaction_history_is_capped(db, monkeypatch):
    monkeypatch.setattr(learning_mod, "MAX_INTERACTIONS", 3)
    uid = str(ObjectId())
    for i in range(5):
        run.learning_service.record_interaction(uid, "user", {"eventType": f"e{i}"}, {})
    data = db.ailearnings.find_one({"userId": ObjectId(uid)})["learningData"]
    assert [i["eventType"] for i in data["interactions"]] == ["e2", "e3", "e4"]
    assert data["totalInteractions"] == 5


def test_comprehensive_analysis_returns_interaction_id(client, auth, db, wedding, mock_openai):
    uid = str(ObjectId())
    resp = client.post("/ai/comprehensive-analysis", headers=auth, json={
        "event_data": {**wedding, "guestCount": "", "location": None}, "vendors": [],
        "user_context": {"userId": uid, "userType": "user", "planLevel": "abc"}})
    assert resp.status_code == 200
    assert ObjectId.is_valid(resp.json["metadata"]["interaction_id"])
