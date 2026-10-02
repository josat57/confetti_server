"""
Learning Service — MongoDB-backed
Tracks real user interactions, computes preference patterns from actual data,
and persists everything to the ai_learning collection across restarts.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone

from services.db import get_db as _get_db, to_object_id

logger = logging.getLogger(__name__)

# Keep the embedded interactions array well under MongoDB's 16MB document limit
MAX_INTERACTIONS = 200


def _user_key(user_id: str, user_type: str) -> Dict[str, Any]:
    """Filter for a user's learning doc. The Node AILearning model stores
    userId as an ObjectId, so match that type or the two services diverge."""
    return {"userId": to_object_id(user_id), "userType": user_type}


def _normalize_budget(budget: Any) -> Dict[str, Any]:
    """Match the Node schema: budget is {amount, currency}."""
    if isinstance(budget, dict):
        return {"amount": budget.get("amount", 0), "currency": budget.get("currency", "NGN")}
    try:
        return {"amount": float(budget or 0), "currency": "NGN"}
    except (TypeError, ValueError):
        return {"amount": 0, "currency": "NGN"}


class LearningService:
    """
    Persists user AI learning state to MongoDB (ai_learning collection).
    Each user gets one document keyed by (userId, userType).
    Methods align with the AILearning Mongoose model structure.
    """

    # ------------------------------------------------------------------
    # Interaction recording
    # ------------------------------------------------------------------

    def record_interaction(
        self,
        user_id: str,
        user_type: str,
        event_data: Dict,
        generated_plan: Dict,
        feedback: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Append one planning interaction to the user's learning document.
        Creates the document if it doesn't exist yet.
        """
        from bson import ObjectId

        interaction = {
            "_id": ObjectId(),  # same shape as a Mongoose subdocument
            "timestamp": datetime.now(timezone.utc),
            "eventType": event_data.get("eventType", ""),
            "budget": _normalize_budget(event_data.get("budget")),
            "clientProfile": event_data.get("clientProfile", {}),
            "generatedPlan": {
                "vendorCount": len(generated_plan.get("vendor_matching", {}).get("matches", [])),
                "confidenceScore": generated_plan.get("overall_confidence", 0),
                "aiEnriched": generated_plan.get("ai_enriched", False),
            },
        }
        # Only set feedback when we have it, so "no feedback yet" is detectable
        if feedback:
            interaction["feedback"] = feedback

        try:
            db = _get_db()
            now = datetime.now(timezone.utc)
            result = db.ailearnings.update_one(
                _user_key(user_id, user_type),
                {
                    "$push": {"learningData.interactions": {
                        "$each": [interaction],
                        "$slice": -MAX_INTERACTIONS,
                    }},
                    # $inc creates the field on insert — it must not also
                    # appear in $setOnInsert or MongoDB rejects the update
                    "$inc": {"learningData.totalInteractions": 1},
                    "$set": {"lastInteraction": now, "lastUpdated": now},
                    "$setOnInsert": {
                        "createdAt": now,
                        "status": "learning",
                        "isActive": True,
                        "learningData.accuracy": 0.5,
                        "modelConfig.aiPersonality": "professional",
                        "modelConfig.responseStyle": "detailed",
                        "modelConfig.adaptationLevel": "basic",
                    },
                },
                upsert=True,
            )

            if feedback:
                self._update_accuracy(user_id, user_type)

            return {
                "recorded": True,
                "upserted": result.upserted_id is not None,
                "interaction_id": str(interaction["_id"]),
            }
        except Exception as e:
            logger.error(f"record_interaction failed for {user_id}: {e}")
            return {"recorded": False, "error": str(e)}

    def record_feedback(
        self,
        user_id: str,
        user_type: str,
        rating: int,
        comments: str = "",
        successful: bool = True,
        interaction_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Attach feedback to one interaction: the given interaction_id,
        or the most recent interaction when none is given."""
        from bson import ObjectId

        try:
            db = _get_db()
            key = _user_key(user_id, user_type)

            if interaction_id:
                if not ObjectId.is_valid(interaction_id):
                    return {"updated": False, "error": "invalid interaction_id"}
                target_id = ObjectId(interaction_id)
            else:
                doc = db.ailearnings.find_one(
                    key, {"learningData.interactions": {"$slice": -1}},
                )
                last = (doc or {}).get("learningData", {}).get("interactions", [])
                if not last or "_id" not in last[0]:
                    return {"updated": False, "error": "no interaction to attach feedback to"}
                target_id = last[0]["_id"]

            result = db.ailearnings.update_one(
                {**key, "learningData.interactions._id": target_id},
                {"$set": {
                    "learningData.interactions.$.feedback": {
                        "rating": rating,
                        "comments": comments,
                        "successful": successful,
                    },
                    "lastUpdated": datetime.now(timezone.utc),
                }},
            )
            if result.matched_count == 0:
                return {"updated": False, "error": "interaction not found"}

            self._update_accuracy(user_id, user_type)
            return {"updated": True, "interaction_id": str(target_id)}
        except Exception as e:
            logger.error(f"record_feedback failed for {user_id}: {e}")
            return {"updated": False, "error": str(e)}

    # ------------------------------------------------------------------
    # Preference / pattern derivation
    # ------------------------------------------------------------------

    def get_user_preferences(self, user_id: str, user_type: str) -> Optional[Dict]:
        """
        Derive user preferences from stored interaction history.
        Returns None if insufficient data (<3 interactions).
        """
        try:
            db = _get_db()
            doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {"learningData": 1, "modelConfig": 1},
            )
            if not doc:
                return None

            interactions = doc.get("learningData", {}).get("interactions", [])
            if len(interactions) < 3:
                return None  # Not enough data yet

            return self._compute_preferences(interactions)
        except Exception as e:
            logger.error(f"get_user_preferences failed for {user_id}: {e}")
            return None

    def _compute_preferences(self, interactions: List[Dict]) -> Dict:
        """Aggregate actual interaction data into preference signals."""
        event_type_counts: Dict[str, int] = {}
        budget_samples: List[float] = []
        successful_types: Dict[str, int] = {}
        rating_sum = 0
        rating_count = 0

        for i in interactions:
            et = i.get("eventType", "")
            if et:
                event_type_counts[et] = event_type_counts.get(et, 0) + 1

            budget = i.get("budget", {})
            amount = float(budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0))
            if amount > 0:
                budget_samples.append(amount)

            feedback = i.get("feedback", {})
            if feedback.get("successful") and et:
                successful_types[et] = successful_types.get(et, 0) + 1
            if feedback.get("rating"):
                rating_sum += feedback["rating"]
                rating_count += 1

        preferred_types = sorted(event_type_counts, key=lambda k: event_type_counts[k], reverse=True)[:3]
        avg_budget = sum(budget_samples) / len(budget_samples) if budget_samples else 0
        avg_rating = round(rating_sum / rating_count, 2) if rating_count > 0 else None

        return {
            "preferred_event_types": preferred_types,
            "avg_budget": avg_budget,
            "successful_event_types": list(successful_types.keys()),
            "avg_feedback_rating": avg_rating,
            "total_interactions": len(interactions),
            "data_source": "mongodb",
        }

    def identify_success_patterns(self, user_id: str, user_type: str) -> List[Dict]:
        """Surface patterns from interaction history where feedback was positive."""
        try:
            db = _get_db()
            doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {"learningData.interactions": 1},
            )
            if not doc:
                return []

            interactions = doc.get("learningData", {}).get("interactions", [])
            return self._extract_patterns(interactions)
        except Exception as e:
            logger.error(f"identify_success_patterns failed: {e}")
            return []

    def _extract_patterns(self, interactions: List[Dict]) -> List[Dict]:
        event_success: Dict[str, list] = {}

        for i in interactions:
            et = i.get("eventType", "other")
            feedback = i.get("feedback", {})
            if feedback.get("successful") or (feedback.get("rating", 0) >= 4):
                if et not in event_success:
                    event_success[et] = []
                event_success[et].append(i)

        patterns = []
        for et, successes in event_success.items():
            if len(successes) >= 2:
                avg_budget = sum(
                    float(s.get("budget", {}).get("amount", 0) or 0)
                    for s in successes
                ) / len(successes)
                patterns.append({
                    "pattern": f"Consistently successful with {et} events",
                    "confidence": min(1.0, len(successes) / 10),
                    "frequency": len(successes),
                    "lastSeen": max(s.get("timestamp", datetime.min) for s in successes
                                   if isinstance(s.get("timestamp"), datetime)),
                    "impact": "high" if len(successes) >= 10 else "medium" if len(successes) >= 5 else "low",
                    "avg_budget": round(avg_budget, 2),
                })

        return sorted(patterns, key=lambda p: p["confidence"], reverse=True)

    # ------------------------------------------------------------------
    # Accuracy tracking
    # ------------------------------------------------------------------

    def _update_accuracy(self, user_id: str, user_type: str):
        """Recompute accuracy from the last 50 rated interactions and persist."""
        try:
            db = _get_db()
            doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {"learningData.interactions": {"$slice": -50}},
            )
            if not doc:
                return

            interactions = doc.get("learningData", {}).get("interactions", [])
            rated = [i for i in interactions if i.get("feedback", {}).get("rating")]
            if not rated:
                return

            avg_rating = sum(i["feedback"]["rating"] for i in rated) / len(rated)
            accuracy = round(min(avg_rating / 5.0, 1.0), 4)

            db.ailearnings.update_one(
                _user_key(user_id, user_type),
                {"$set": {
                    "learningData.accuracy": accuracy,
                    "performanceMetrics.clientSatisfactionScore": round(avg_rating, 2),
                    "performanceMetrics.planAcceptanceRate": round(
                        len([i for i in rated if i["feedback"].get("successful")]) / len(rated), 4
                    ),
                    "lastUpdated": datetime.now(timezone.utc),
                }},
            )
        except Exception as e:
            logger.warning(f"_update_accuracy failed silently: {e}")

    # ------------------------------------------------------------------
    # Training (model training stub — hooks into record + pattern extraction)
    # ------------------------------------------------------------------

    def train_user_model(
        self,
        user_id: str,
        user_type: str,
        training_data: List[Dict],
        model_type: str = "personalized",
    ) -> Dict[str, Any]:
        """
        Process a batch of training interactions and update the user model.
        In a future iteration this will call a fine-tuning API; for now it
        updates the preference patterns and accuracy in MongoDB.
        """
        try:
            # Record each training item
            for item in training_data:
                self.record_interaction(user_id, user_type, item, item.get("plan", {}), item.get("feedback"))

            # Derive patterns from the full history
            patterns = self.identify_success_patterns(user_id, user_type)
            prefs = self.get_user_preferences(user_id, user_type) or {}

            db = _get_db()
            doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {"learningData.accuracy": 1, "learningData.totalInteractions": 1},
            )
            old_accuracy = doc.get("learningData", {}).get("accuracy", 0.5) if doc else 0.5

            # Persist patterns
            db.ailearnings.update_one(
                _user_key(user_id, user_type),
                {"$set": {
                    "learningData.successPatterns": patterns,
                    "learningData.preferences.preferredEventTypes": prefs.get("preferred_event_types", []),
                    "learningData.lastTrainingDate": datetime.now(timezone.utc),
                    "lastUpdated": datetime.now(timezone.utc),
                }},
            )

            new_doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {"learningData.accuracy": 1, "learningData.totalInteractions": 1},
            )
            new_accuracy = new_doc.get("learningData", {}).get("accuracy", old_accuracy) if new_doc else old_accuracy

            return {
                "model_id": f"{user_type}_{user_id}",
                "training_metrics": {
                    "data_points_processed": len(training_data),
                    "accuracy_before": old_accuracy,
                    "accuracy_after": new_accuracy,
                    "accuracy_improvement": round(new_accuracy - old_accuracy, 4),
                    "patterns_identified": len(patterns),
                    "total_interactions": new_doc.get("learningData", {}).get("totalInteractions", 0) if new_doc else 0,
                },
                "status": "trained",
                "data_source": "mongodb",
            }
        except Exception as e:
            logger.error(f"train_user_model failed for {user_id}: {e}")
            return {"status": "failed", "error": str(e)}

    # ------------------------------------------------------------------
    # Retrieval helpers
    # ------------------------------------------------------------------

    def get_learning_status(self, user_id: str, user_type: str) -> Dict:
        """Return the full learning document summary for a user."""
        try:
            db = _get_db()
            doc = db.ailearnings.find_one(
                _user_key(user_id, user_type),
                {
                    "learningData.accuracy": 1,
                    "learningData.totalInteractions": 1,
                    "learningData.lastTrainingDate": 1,
                    "status": 1,
                    "performanceMetrics": 1,
                },
            )
            if not doc:
                return {"exists": False, "status": "not_started"}

            return {
                "exists": True,
                "status": doc.get("status", "initializing"),
                "accuracy": doc.get("learningData", {}).get("accuracy", 0.5),
                "total_interactions": doc.get("learningData", {}).get("totalInteractions", 0),
                "last_trained": doc.get("learningData", {}).get("lastTrainingDate"),
                "performance": doc.get("performanceMetrics", {}),
            }
        except Exception as e:
            logger.error(f"get_learning_status failed: {e}")
            return {"exists": False, "error": str(e)}

    def health_check(self) -> str:
        try:
            _get_db().command("ping")
            return "operational"
        except Exception:
            return "degraded"
