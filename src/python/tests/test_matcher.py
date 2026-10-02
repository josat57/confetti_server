"""Vendor normalization and scoring."""

import json

from bson import ObjectId

from services.intelligent_matcher import IntelligentVendorMatcher, normalize_vendor
from tests.conftest import requires_mongo

NODE_SHAPE = {  # VendorService.formatVendorForAI
    "id": "65a000000000000000000001", "name": "Bella Catering", "category": "catering",
    "location": {"lat": 0, "lng": 0, "address": {"city": "Lagos", "state": "Lagos"}},
    "pricing": {"averagePrice": 900_000, "priceRange": {"min": 700_000, "max": 1_200_000}},
    "rating": 4.8, "reviewCount": 60, "eventTypes": ["wedding"], "capacity": 300,
    "availabilityStatus": "high", "features": ["halal"],
}
MONGO_SHAPE = {
    "_id": "65a000000000000000000002", "businessName": "Lens Studio", "category": "photography",
    "address": {"city": "Abuja"}, "averagePrice": 0, "services": [{"name": "photo", "price": {"amount": 400_000}}],
    "rating": 4.0, "reviewCount": 3,
}


def test_normalizes_both_vendor_shapes():
    a, b = normalize_vendor(NODE_SHAPE), normalize_vendor(MONGO_SHAPE)
    assert (a["id"], a["name"], a["avg_price"], a["address"]["city"]) == ("65a000000000000000000001", "Bella Catering", 900_000, "Lagos")
    assert (b["id"], b["name"], b["avg_price"]) == ("65a000000000000000000002", "Lens Studio", 400_000)


def test_scores_use_real_vendor_fields():
    req = {"event_type": "wedding", "budget": 5_000_000, "guest_count": 150,
           "location": {"city": "Lagos"}, "preferences": ["halal"], "category_budgets": {"catering": 1_000_000}}
    match = IntelligentVendorMatcher().match_vendors(req, [NODE_SHAPE])["matches"][0]
    s = match["score_breakdown"]
    assert match["vendor_id"] == NODE_SHAPE["id"] and match["business_name"] == "Bella Catering"
    assert s["event_type"] == 100 and s["location"] == 100 and s["price"] == 100 and s["preference"] == 100
    assert 0 < match["confidence"] <= 1


def test_empty_vendor_list_is_valid_json():
    result = IntelligentVendorMatcher().match_vendors({"event_type": "wedding"}, [])
    assert result["avg_confidence"] == 0.0
    json.dumps(result, allow_nan=False)  # NaN would break Node's JSON.parse


@requires_mongo
def test_history_score_from_bookings_and_reviews(db):
    good, bad = ObjectId(), ObjectId()
    db.vendorbookings.insert_many([{"vendor": good, "status": "completed"} for _ in range(4)])
    db.bookings.insert_many([{"vendor": bad, "status": "cancelled"} for _ in range(3)]
                            + [{"vendor": bad, "status": "completed"}])
    db.reviews.insert_many([{"vendor": good, "rating": 5, "status": "approved"} for _ in range(3)]
                           + [{"vendor": good, "rating": 1, "status": "pending"}])
    vendors = [{"_id": str(good), "category": "catering"}, {"_id": str(bad), "category": "catering"},
               {"_id": str(ObjectId()), "category": "catering"}]
    matches = {m["vendor_id"]: m for m in IntelligentVendorMatcher().match_vendors({"event_type": "x"}, vendors)["matches"]}
    assert matches[str(good)]["score_breakdown"]["performance"] == 100  # 4/4 completed, 5.0 approved reviews
    assert matches[str(bad)]["score_breakdown"]["performance"] == 45    # 1/4 completed, no reviews -> neutral review part
    assert matches[vendors[2]["_id"]]["score_breakdown"]["performance"] == 75  # no history -> neutral
