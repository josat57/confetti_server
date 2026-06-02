"""
Learning Service — MongoDB-backed
Tracks real user interactions, computes preference patterns from actual data,
and persists everything to the ai_learning collection across restarts.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_mongo_db = None


def _get_db():
    global _mongo_db
    if _mongo_db is None:
        from pymongo import MongoClient
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/confetti")
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        db_name = uri.split("/")[-1].split("?")[0] or "confetti"
        _mongo_db = client[db_name]
    return _mongo_db


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
        interaction = {
            "timestamp": datetime.utcnow(),
            "eventType": event_data.get("eventType", ""),
            "budget": event_data.get("budget", {}),
            "clientProfile": event_data.get("clientProfile", {}),
            "generatedPlan": {
                "vendorCount": len(generated_plan.get("vendor_matching", {}).get("matches", [])),
                "confidenceScore": generated_plan.get("overall_confidence", 0),
                "aiEnriched": generated_plan.get("ai_enriched", False),
            },
            "feedback": feedback or {},
        }

        try:
            db = _get_db()
            result = db.ailearnings.update_one(
                {"userId": user_id, "userType": user_type},
                {
                    "$push": {"learningData.interactions": interaction},
                    "$inc": {"learningData.totalInteractions": 1},
                    "$set": {
                        "lastInteraction": datetime.utcnow(),
                        "lastUpdated": datetime.utcnow(),
                    },
                    "$setOnInsert": {
                        "userId": user_id,
                        "userType": user_type,
                        "createdAt": datetime.utcnow(),
                        "status": "learning",
                        "learningData.accuracy": 0.5,
                        "learningData.totalInteractions": 0,
                        "modelConfig.aiPersonality": "professional",
                        "modelConfig.responseStyle": "detailed",
                        "modelConfig.adaptationLevel": "basic",
                    },
                },
                upsert=True,
            )

            # Recompute metrics asynchronously-ish (same call, cheap)
            self._update_accuracy(user_id, user_type)

            return {
                "recorded": True,
                "upserted": result.upserted_id is not None,
            }
        except Exception as e:
            logger.error(f"record_interaction failed for {user_id}: {e}")
            return {"recorded": False, "error": str(e)}

    def record_feedback(
        self,
        user_id: str,
        user_type: str,
        interaction_index: int,
        rating: int,
        comments: str = "",
        successful: bool = True,
    ) -> Dict[str, Any]:
        """Attach feedback to the most recent interaction."""
        try:
            db = _get_db()
            db.ailearnings.update_one(
                {"userId": user_id, "userType": user_type},
                {
                    "$set": {
                        "learningData.interactions.$[last].feedback": {
                            "rating": rating,
                            "comments": comments,
                            "successful": successful,
                        }
                    },
                    "$inc": {"learningData.totalInteractions": 0},  # touch doc for pre-save hook analog
                },
                array_filters=[{"last.feedback": {"$exists": False}}],
            )
            self._update_accuracy(user_id, user_type)
            return {"updated": True}
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
                {"userId": user_id, "userType": user_type},
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
                {"userId": user_id, "userType": user_type},
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
                {"userId": user_id, "userType": user_type},
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
                {"userId": user_id, "userType": user_type},
                {"$set": {
                    "learningData.accuracy": accuracy,
                    "performanceMetrics.clientSatisfactionScore": round(avg_rating, 2),
                    "performanceMetrics.planAcceptanceRate": round(
                        len([i for i in rated if i["feedback"].get("successful")]) / len(rated), 4
                    ),
                    "lastUpdated": datetime.utcnow(),
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
                {"userId": user_id, "userType": user_type},
                {"learningData.accuracy": 1, "learningData.totalInteractions": 1},
            )
            old_accuracy = doc.get("learningData", {}).get("accuracy", 0.5) if doc else 0.5

            # Persist patterns
            db.ailearnings.update_one(
                {"userId": user_id, "userType": user_type},
                {"$set": {
                    "learningData.successPatterns": patterns,
                    "learningData.preferences.preferredEventTypes": prefs.get("preferred_event_types", []),
                    "learningData.lastTrainingDate": datetime.utcnow(),
                    "lastUpdated": datetime.utcnow(),
                }},
            )

            new_doc = db.ailearnings.find_one(
                {"userId": user_id, "userType": user_type},
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
                {"userId": user_id, "userType": user_type},
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
