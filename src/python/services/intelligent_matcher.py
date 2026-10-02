"""
Intelligent Vendor Matcher
Scores vendors against event requirements using the vendor's own data plus
real booking outcomes and approved reviews from MongoDB.
"""

import logging
from collections import defaultdict
from typing import Any, Dict, List

from services.db import get_db, to_object_id

logger = logging.getLogger(__name__)

# Below this many finished bookings / reviews, history is too thin to score
MIN_HISTORY_SAMPLES = 3
NEUTRAL_SCORE = 75
# Share of the total budget assumed for one vendor when no category split is given
DEFAULT_CATEGORY_SHARE = 0.25


def _num(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def normalize_vendor(v: Dict) -> Dict[str, Any]:
    """
    Accept both vendor shapes seen in practice and return one canonical dict:
    - raw Mongo documents (_id, businessName, averagePrice, priceRange, address, services[].price)
    - Node's VendorService.formatVendorForAI output (id, name, pricing{}, location.address)
    """
    pricing = v.get("pricing") or {}
    price_range = v.get("priceRange") or pricing.get("priceRange") or {}
    location = v.get("location") if isinstance(v.get("location"), dict) else {}
    address = v.get("address") or location.get("address") or (v.get("businessInfo") or {}).get("address") or {}
    services = v.get("services") or []

    avg_price = _num(v.get("averagePrice") or pricing.get("averagePrice"))
    price_min, price_max = _num(price_range.get("min")), _num(price_range.get("max"))
    if not avg_price and price_min and price_max:
        avg_price = (price_min + price_max) / 2
    if not avg_price:
        service_prices = [_num((s.get("price") or {}).get("amount")) for s in services if isinstance(s, dict)]
        service_prices = [p for p in service_prices if p > 0]
        if service_prices:
            avg_price = sum(service_prices) / len(service_prices)

    vid = v.get("_id") or v.get("id")
    return {
        "id": str(vid) if vid is not None else None,
        "name": v.get("businessName") or v.get("name"),
        "category": (v.get("category") or v.get("businessType") or "").lower(),
        "event_types": [str(e).lower() for e in (v.get("eventTypes") or [])],
        "rating": _num(v.get("rating")),
        "review_count": int(_num(v.get("reviewCount") or v.get("totalReviews") or (v.get("stats") or {}).get("totalReviews"))),
        "address": address if isinstance(address, dict) else {},
        "avg_price": avg_price,
        "price_min": price_min,
        "price_max": price_max,
        "capacity": int(_num(v.get("capacity"))),
        "availability": v.get("availabilityStatus") or "medium",
        "tags": {str(t).lower() for t in (v.get("features") or [])}
                | {str((s.get("category") or s.get("name") or "")).lower() for s in services if isinstance(s, dict)},
    }


class IntelligentVendorMatcher:
    """Multi-factor vendor scoring. Stateless apart from per-call history lookups."""

    WEIGHTS = {
        "event_type": 0.20,
        "rating": 0.15,
        "availability": 0.15,
        "location": 0.10,
        "price": 0.15,
        "performance": 0.10,
        "preference": 0.10,
        "capacity": 0.05,
    }

    def match_vendors(self, event_requirements: Dict, vendors: List[Dict], user_history=None) -> Dict[str, Any]:
        """
        event_requirements: {event_type, budget, guest_count, location, preferences, date,
                             category_budgets (optional: {category: amount})}
        """
        normalized = [normalize_vendor(v) for v in vendors if isinstance(v, dict)]
        history = self.load_vendor_history([v["id"] for v in normalized if v["id"]])

        scored = []
        for vendor in normalized:
            breakdown = self._score(vendor, event_requirements, history.get(vendor["id"]))
            scored.append({
                "vendor_id": vendor["id"],
                "business_name": vendor["name"],
                "category": vendor["category"],
                "rating": vendor["rating"],
                "review_count": vendor["review_count"],
                "overall_score": breakdown["total"],
                "score_breakdown": breakdown,
                "match_reasons": self._generate_match_reasons(vendor, breakdown),
                "confidence": breakdown["confidence"],
                "estimated_price": self._estimate_price(vendor),
            })

        scored.sort(key=lambda x: x["overall_score"], reverse=True)
        confidences = [v["confidence"] for v in scored]

        return {
            "matches": scored[:20],
            "category_matches": self._group_by_category(scored),
            "insights": self._generate_insights(scored),
            "total_analyzed": len(normalized),
            "vendors_with_history": sum(1 for h in history.values() if h.get("sufficient")),
            # Plain float (never NaN): NaN is not valid JSON and breaks Node's parser
            "avg_confidence": round(sum(confidences) / len(confidences), 2) if confidences else 0.0,
        }

    # ------------------------------------------------------------------
    # Real performance history (MongoDB)
    # ------------------------------------------------------------------

    def load_vendor_history(self, vendor_ids: List[str]) -> Dict[str, Dict]:
        """
        Booking outcomes (vendorbookings + bookings) and approved reviews for
        the given vendors, in three aggregate queries. Returns {} if MongoDB
        is unreachable so matching still works on the vendor data alone.
        """
        oids = [o for o in (to_object_id(v) for v in vendor_ids) if not isinstance(o, str)]
        if not oids:
            return {}

        history: Dict[str, Dict] = defaultdict(lambda: {"completed": 0, "cancelled": 0, "review_avg": None, "review_count": 0})
        try:
            db = get_db()
            outcome_match = {"vendor": {"$in": oids}, "status": {"$in": ["completed", "cancelled"]}}
            for collection in ("vendorbookings", "bookings"):
                for row in db[collection].aggregate([
                    {"$match": outcome_match},
                    {"$group": {"_id": {"vendor": "$vendor", "status": "$status"}, "n": {"$sum": 1}}},
                ]):
                    history[str(row["_id"]["vendor"])][row["_id"]["status"]] += row["n"]

            for row in db.reviews.aggregate([
                {"$match": {"vendor": {"$in": oids}, "status": "approved"}},
                {"$group": {"_id": "$vendor", "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}},
            ]):
                h = history[str(row["_id"])]
                h["review_avg"], h["review_count"] = row["avg"], row["n"]
        except Exception as e:
            logger.warning(f"Vendor history lookup failed — scoring without it: {e}")
            return {}

        for h in history.values():
            finished = h["completed"] + h["cancelled"]
            h["finished"] = finished
            h["sufficient"] = finished >= MIN_HISTORY_SAMPLES or h["review_count"] >= MIN_HISTORY_SAMPLES
        return dict(history)

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _score(self, vendor: Dict, req: Dict, history: Dict = None) -> Dict[str, Any]:
        budget = _num(req.get("budget"))
        category_budget = (req.get("category_budgets") or {}).get(vendor["category"]) or budget * DEFAULT_CATEGORY_SHARE
        guest_count = int(_num(req.get("guest_count")))

        scores = {
            "event_type": self._score_event_type_match(vendor, req.get("event_type") or ""),
            "rating": self._score_rating(vendor["rating"], vendor["review_count"]),
            "availability": {"high": 100, "medium": 70, "low": 40, "booked": 0}.get(vendor["availability"], 70),
            "location": self._score_location(vendor["address"], req.get("location") or {}),
            "price": self._score_price_fit(vendor["avg_price"], _num(category_budget)),
            "performance": self._score_historical_performance(history),
            "preference": self._score_user_preference(vendor, req.get("preferences") or []),
            "capacity": self._score_capacity(vendor["capacity"], guest_count),
        }
        total = sum(scores[k] * w for k, w in self.WEIGHTS.items())
        return {
            "total": round(total, 2),
            "confidence": self._calculate_confidence(vendor, history),
            **{k: round(v, 2) for k, v in scores.items()},
        }

    def _score_event_type_match(self, vendor: Dict, event_type: str) -> float:
        event_type = event_type.lower()
        if not event_type:
            return 50
        if vendor["event_types"]:
            return 100 if event_type in vendor["event_types"] else 40
        if any(event_type in tag for tag in vendor["tags"] if tag):
            return 80
        return 50  # vendor didn't declare event types — unknown, not a mismatch

    def _score_rating(self, rating: float, review_count: int) -> float:
        if rating == 0:
            return 50  # Neutral for new vendors
        confidence_multiplier = min(1.0, review_count / 50)  # Max at 50 reviews
        return (rating / 5.0) * 100 * (0.7 + 0.3 * confidence_multiplier)

    def _score_location(self, vendor_address: Dict, event_location: Dict) -> float:
        vendor_city = str(vendor_address.get("city") or "").strip().lower()
        event_city = str(event_location.get("city") or "").strip().lower()
        if not vendor_city or not event_city:
            return 50  # unknown
        if vendor_city == event_city:
            return 100
        vendor_state = str(vendor_address.get("state") or "").strip().lower()
        event_state = str(event_location.get("state") or "").strip().lower()
        if vendor_state and vendor_state == event_state:
            return 70
        return 40

    def _score_price_fit(self, vendor_price: float, category_budget: float) -> float:
        if not vendor_price or not category_budget:
            return 50  # unknown
        ratio = vendor_price / category_budget
        if 0.7 <= ratio <= 1.0:
            return 100
        if 0.5 <= ratio < 0.7:
            return 90
        if 1.0 < ratio <= 1.2:
            return 80
        if ratio < 0.5:
            return 60
        return 30

    def _score_historical_performance(self, history: Dict = None) -> float:
        """Completion rate of finished bookings (60%) + approved review average (40%)."""
        if not history or not history.get("sufficient"):
            return NEUTRAL_SCORE
        finished = history["finished"]
        completion = history["completed"] / finished if finished >= MIN_HISTORY_SAMPLES else NEUTRAL_SCORE / 100
        review = (history["review_avg"] / 5.0) if history["review_count"] >= MIN_HISTORY_SAMPLES else NEUTRAL_SCORE / 100
        return completion * 60 + review * 40

    def _score_user_preference(self, vendor: Dict, preferences: List) -> float:
        prefs = [str(p).lower() for p in preferences if p]
        if not prefs:
            return 75
        matches = sum(1 for p in prefs if any(p in tag for tag in vendor["tags"] if tag))
        return 50 + (matches / len(prefs)) * 50

    def _score_capacity(self, vendor_capacity: int, guest_count: int) -> float:
        if vendor_capacity == 0 or guest_count == 0:
            return 75  # Unknown
        if vendor_capacity < guest_count:
            return 30
        ratio = vendor_capacity / guest_count
        return 100 if ratio <= 2.0 else 90

    def _calculate_confidence(self, vendor: Dict, history: Dict = None) -> float:
        """How much real data the score is based on (0.5 – 1.0)."""
        confidence = 100
        if vendor["rating"] == 0:
            confidence -= 15
        if vendor["review_count"] < 5:
            confidence -= 10
        if not vendor["avg_price"]:
            confidence -= 15
        if not vendor["event_types"]:
            confidence -= 5
        if vendor["capacity"] == 0:
            confidence -= 5
        if not (history and history.get("sufficient")):
            confidence -= 5
        return round(max(50, confidence) / 100, 2)

    # ------------------------------------------------------------------
    # Presentation
    # ------------------------------------------------------------------

    def _generate_match_reasons(self, vendor: Dict, breakdown: Dict) -> List[str]:
        reasons = []
        if breakdown["event_type"] >= 80:
            reasons.append("Specializes in this event type")
        if breakdown["rating"] >= 85:
            reasons.append(f"Highly rated ({vendor['rating']}/5.0)")
        if breakdown["availability"] >= 90:
            reasons.append("High availability")
        if breakdown["location"] >= 90:
            reasons.append("Located in your area")
        if breakdown["price"] >= 85:
            reasons.append("Good value for your budget")
        if breakdown["performance"] >= 85:
            reasons.append("Proven track record")
        return reasons or ["Good overall match for your event"]

    def _estimate_price(self, vendor: Dict) -> Dict[str, Any]:
        if not vendor["avg_price"]:
            return {"estimated": "Contact for quote", "range": None}
        return {
            "estimated": round(vendor["avg_price"]),
            "range": {
                "min": round(vendor["price_min"] or vendor["avg_price"] * 0.9),
                "max": round(vendor["price_max"] or vendor["avg_price"] * 1.1),
            },
        }

    def _group_by_category(self, scored: List[Dict]) -> Dict[str, List[Dict]]:
        categories: Dict[str, List[Dict]] = defaultdict(list)
        for vendor in scored:
            if len(categories[vendor["category"]]) < 5:
                categories[vendor["category"]].append(vendor)
        return dict(categories)

    def _generate_insights(self, scored: List[Dict]) -> List[Dict[str, str]]:
        if not scored:
            return [{"type": "warning", "message": "No vendors matched your search yet.", "priority": "high"}]

        insights = []
        top = scored[:10]
        if sum(1 for v in scored if v["score_breakdown"]["availability"] >= 90) < 5:
            insights.append({"type": "warning", "priority": "high",
                             "message": "Limited vendor availability for your date. Book early to secure your choices."})
        if sum(v["score_breakdown"]["price"] for v in top) / len(top) < 60:
            insights.append({"type": "info", "priority": "medium",
                             "message": "Your budget may be tight for top vendors. Consider increasing budget or adjusting requirements."})
        high_rated = sum(1 for v in top if v["score_breakdown"]["rating"] >= 85)
        if high_rated >= 7:
            insights.append({"type": "success", "priority": "low",
                             "message": f"Great news! {high_rated} highly-rated vendors match your requirements."})
        if sum(1 for v in scored if v["score_breakdown"]["location"] >= 90) < 5:
            insights.append({"type": "info", "priority": "low",
                             "message": "Consider expanding search to nearby areas for more options."})
        return insights
