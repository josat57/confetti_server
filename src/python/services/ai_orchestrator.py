"""
AI Orchestrator Service
Local-first intelligence: uses MongoDB vendor/event data as the primary source.
External AI (OpenAI / Anthropic) is invoked only when local data is insufficient
or when a higher plan tier explicitly requests enriched AI output.
"""

import os
import json
import logging
import hashlib
import time
from typing import Dict, Any, List, Optional, Generator
from datetime import datetime

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy SDK singletons — avoids crash on import if a package isn't installed
# ---------------------------------------------------------------------------

_openai_client = None
_anthropic_client = None
_redis_client = None
_mongo_db = None


def _get_openai():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            key = os.environ.get("OPENAI_API_KEY")
            if key:
                _openai_client = OpenAI(api_key=key)
            else:
                logger.warning("OPENAI_API_KEY not set — GPT-4 unavailable")
        except ImportError:
            logger.warning("openai package not installed")
    return _openai_client


def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic
            key = os.environ.get("ANTHROPIC_API_KEY")
            if key:
                _anthropic_client = anthropic.Anthropic(api_key=key)
            else:
                logger.warning("ANTHROPIC_API_KEY not set — Claude unavailable")
        except ImportError:
            logger.warning("anthropic package not installed")
    return _anthropic_client


def _get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            import redis as redis_lib
            _redis_client = redis_lib.Redis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379"),
                decode_responses=True,
                socket_connect_timeout=2,
            )
            _redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis unavailable — semantic caching disabled: {e}")
            _redis_client = None
    return _redis_client


def _get_mongo_db():
    global _mongo_db
    if _mongo_db is None:
        from pymongo import MongoClient
        uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/confetti")
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        db_name = uri.split("/")[-1].split("?")[0] or "confetti"
        _mongo_db = client[db_name]
    return _mongo_db


# ---------------------------------------------------------------------------
# System prompt templates (Fix 2 — structured JSON output with explicit schema)
# ---------------------------------------------------------------------------

PLANNING_SYSTEM_PROMPT = """You are an expert AI event planning consultant with deep expertise in budget optimization, vendor management, and guest experience design.

Your output MUST be valid JSON matching this exact schema — no markdown, no extra text:
{
  "client_insights": {
    "personality_profile": "string",
    "key_priorities": ["string"],
    "communication_style": "string",
    "risk_tolerance": "low|medium|high"
  },
  "budget_analysis": {
    "feasibility": "excellent|good|fair|challenging",
    "feasibility_score": 0-100,
    "recommended_allocation": {
      "venue": 0-100,
      "catering": 0-100,
      "entertainment": 0-100,
      "photography": 0-100,
      "decoration": 0-100,
      "contingency": 0-100
    },
    "cost_saving_tips": ["string"],
    "budget_risks": ["string"]
  },
  "vendor_gaps": {
    "missing_categories": ["string"],
    "sourcing_recommendations": ["string"],
    "alternative_options": ["string"]
  },
  "timeline": {
    "planning_horizon_weeks": number,
    "critical_milestones": [{"week": number, "task": "string", "priority": "high|medium|low"}],
    "day_of_schedule": [{"time": "string", "activity": "string"}]
  },
  "risk_assessment": {
    "overall_risk": "low|medium|high",
    "risks": [{"factor": "string", "severity": "low|medium|high", "mitigation": "string", "probability": 0-1}]
  },
  "creative_suggestions": {
    "themes": ["string"],
    "unique_elements": ["string"],
    "guest_experience_ideas": ["string"]
  },
  "confidence_score": 0-1
}"""

ENRICHMENT_SYSTEM_PROMPT = """You are an AI event planning specialist. Local vendor data was insufficient for this request.
Provide gap-filling recommendations to complement what was already found locally.

Output MUST be valid JSON:
{
  "missing_vendor_suggestions": [
    {"category": "string", "what_to_look_for": "string", "estimated_budget_pct": number, "search_tips": "string"}
  ],
  "creative_theme_ideas": ["string"],
  "budget_reallocation": {"rationale": "string", "adjustments": [{"category": "string", "change_pct": number, "reason": "string"}]},
  "risk_mitigation": [{"risk": "string", "action": "string"}],
  "local_market_tips": "string",
  "confidence_score": 0-1
}"""


# ---------------------------------------------------------------------------
# Required vendor categories per event type
# ---------------------------------------------------------------------------

EVENT_CATEGORY_REQUIREMENTS = {
    "wedding": ["venue", "catering", "photography", "decoration", "entertainment"],
    "corporate": ["venue", "catering", "audio_visual", "photography"],
    "birthday": ["venue", "catering", "decoration", "entertainment"],
    "graduation": ["venue", "catering", "photography", "decoration"],
    "conference": ["venue", "catering", "audio_visual", "event_planning"],
    "other": ["venue", "catering"],
}


class AIOrchestrator:
    """
    Orchestrates AI intelligence for event planning.

    Decision flow:
    1. Query MongoDB vendors directly (local intelligence).
    2. Score and rank vendors using IntelligentVendorMatcher.
    3. Assess data sufficiency (category coverage, budget fit, vendor count).
    4. If sufficient → return local result (no external AI cost).
    5. If insufficient OR plan level >= 2 → call OpenAI / Anthropic to fill gaps.
    6. Cache identical requests in Redis to avoid duplicate API calls.
    """

    def __init__(self):
        self.models = {
            "gpt4": {"name": "gpt-4o", "available": bool(os.environ.get("OPENAI_API_KEY"))},
            "claude": {"name": "claude-sonnet-4-6", "available": bool(os.environ.get("ANTHROPIC_API_KEY"))},
            "gemini": {"name": "gemini-2.0-flash", "available": False},  # coming soon
            "local": {"name": "local-scoring", "available": True},
        }

    # ------------------------------------------------------------------
    # Public: main entry point
    # ------------------------------------------------------------------

    def comprehensive_analysis(
        self,
        event_data: Dict,
        vendors: List,
        vendor_statistics: Dict,
        vendor_id: str = None,
        plan_level: int = 1,
        vendor_profile: Dict = None,
        user_context: Dict = None,
    ) -> Dict[str, Any]:
        start = time.time()
        event_type = event_data.get("eventType", "event")
        user_ctx = user_context or {}

        logger.info(f"comprehensive_analysis | event={event_type} plan_level={plan_level} vendors={len(vendors)}")

        # 1. Always run local scoring (no API cost)
        local_result = self._run_local_analysis(event_data, vendors, vendor_statistics, user_ctx)

        # 2. Assess whether local data is enough
        sufficiency = self._assess_local_data_sufficiency(vendors, event_data)
        local_result["data_sufficiency"] = sufficiency

        # 3. Decide whether to call external AI
        use_external = self._should_use_external_ai(sufficiency, plan_level, user_ctx)

        ai_enrichment = None
        model_used = "local-scoring"

        if use_external:
            ai_enrichment = self._call_external_ai(event_data, local_result, sufficiency, plan_level, user_ctx)
            model_used = ai_enrichment.get("_model_used", "unknown")

        # 4. Merge results
        result = self._merge_results(local_result, ai_enrichment, event_data, plan_level)
        result["metadata"] = {
            "processing_time_ms": round((time.time() - start) * 1000, 1),
            "models_used": [model_used],
            "plan_level": plan_level,
            "user_type": user_ctx.get("userType", "guest"),
            "data_sufficiency": sufficiency,
            "vendors_analyzed": len(vendors),
        }

        return result

    # ------------------------------------------------------------------
    # Local intelligence — no external API calls
    # ------------------------------------------------------------------

    def _run_local_analysis(
        self,
        event_data: Dict,
        vendors: List,
        vendor_statistics: Dict,
        user_context: Dict,
    ) -> Dict[str, Any]:
        """Score and analyze using only data already in MongoDB."""
        from services.intelligent_matcher import IntelligentVendorMatcher

        matcher = IntelligentVendorMatcher()
        event_type = event_data.get("eventType", "event")
        budget = event_data.get("budget", {})
        budget_amount = float(budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0))
        guest_count = int(event_data.get("guestCount", 0))
        location = event_data.get("location", {})

        requirements = {
            "event_type": event_type,
            "budget": budget_amount,
            "guest_count": guest_count,
            "location": location,
            "date": event_data.get("eventDate"),
            "preferences": event_data.get("specialRequirements", []),
        }

        # Vendor matching
        match_result = matcher.match_vendors(requirements, vendors)

        # Budget breakdown
        budget_breakdown = self._calculate_budget_breakdown(budget_amount, event_type, guest_count)

        # Timeline
        timeline = self._build_timeline(event_data)

        # Risk assessment from real data
        risk = self._assess_risks_from_data(event_data, vendors, match_result)

        return {
            "client_analysis": self._derive_client_profile(event_data, user_context),
            "vendor_matching": match_result,
            "budget_optimization": budget_breakdown,
            "timeline_suggestions": timeline,
            "risk_assessment": risk,
            "market_insights": self._query_market_insights(location, event_type),
            "overall_confidence": match_result.get("avg_confidence", 0.7),
        }

    def _derive_client_profile(self, event_data: Dict, user_context: Dict) -> Dict:
        """Build a client profile from actual submitted event data."""
        budget = event_data.get("budget", {})
        amount = float(budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0))
        guest_count = int(event_data.get("guestCount", 0))
        per_head = round(amount / guest_count, 2) if guest_count > 0 else 0

        tier = "budget" if per_head < 50 else "mid-range" if per_head < 150 else "premium"

        return {
            "spending_tier": tier,
            "budget_per_guest": per_head,
            "event_scale": "intimate" if guest_count < 50 else "medium" if guest_count < 200 else "large",
            "special_requirements": event_data.get("specialRequirements", []),
            "theme": event_data.get("theme", "unspecified"),
        }

    def _calculate_budget_breakdown(self, budget: float, event_type: str, guest_count: int) -> Dict:
        """Evidence-based percentage allocations per event type."""
        allocations = {
            "wedding":     {"venue": 30, "catering": 28, "photography": 12, "decoration": 10, "entertainment": 10, "contingency": 10},
            "corporate":   {"venue": 35, "catering": 30, "audio_visual": 15, "photography": 8, "decoration": 5, "contingency": 7},
            "birthday":    {"venue": 25, "catering": 30, "decoration": 15, "entertainment": 20, "contingency": 10},
            "graduation":  {"venue": 30, "catering": 30, "photography": 15, "decoration": 15, "contingency": 10},
            "conference":  {"venue": 40, "catering": 25, "audio_visual": 20, "event_planning": 8, "contingency": 7},
        }
        pcts = allocations.get(event_type.lower(), {"venue": 30, "catering": 30, "decoration": 15, "entertainment": 15, "contingency": 10})

        breakdown = {cat: round(budget * pct / 100, 2) for cat, pct in pcts.items()}
        breakdown["total_budget"] = budget
        breakdown["cost_per_guest"] = round(budget / guest_count, 2) if guest_count > 0 else 0
        breakdown["percentages"] = pcts
        breakdown["feasibility_score"] = self._score_budget_feasibility(budget, event_type, guest_count)

        return breakdown

    def _score_budget_feasibility(self, budget: float, event_type: str, guest_count: int) -> int:
        if guest_count == 0:
            return 70
        per_head = budget / guest_count
        thresholds = {
            "wedding": (80, 150), "corporate": (60, 120), "birthday": (40, 80),
            "graduation": (40, 80), "conference": (60, 100),
        }
        low, high = thresholds.get(event_type.lower(), (50, 100))
        if per_head >= high:
            return 95
        if per_head >= low:
            return 75
        if per_head >= low * 0.6:
            return 55
        return 35

    def _build_timeline(self, event_data: Dict) -> Dict:
        event_date_str = event_data.get("eventDate")
        try:
            event_date = datetime.fromisoformat(str(event_date_str).replace("Z", "+00:00"))
            weeks_away = max(0, (event_date - datetime.now(event_date.tzinfo)).days // 7)
        except Exception:
            weeks_away = 12

        milestones = [
            {"week": weeks_away, "task": "Confirm event requirements and set budget", "priority": "high"},
            {"week": max(1, weeks_away - 2), "task": "Book venue and confirm availability", "priority": "high"},
            {"week": max(1, weeks_away - 3), "task": "Select and contract key vendors (catering, photography)", "priority": "high"},
            {"week": max(1, weeks_away - 4), "task": "Send invitations / notify attendees", "priority": "medium"},
            {"week": max(1, weeks_away - 6), "task": "Finalize decoration and entertainment", "priority": "medium"},
            {"week": 2, "task": "Confirm all vendor bookings and final headcount", "priority": "high"},
            {"week": 1, "task": "Final walkthrough and day-of briefing", "priority": "high"},
        ]

        return {
            "weeks_until_event": weeks_away,
            "planning_horizon_weeks": weeks_away,
            "urgency": "critical" if weeks_away < 4 else "urgent" if weeks_away < 8 else "normal",
            "key_milestones": [m for m in milestones if m["week"] <= weeks_away],
            "critical_path": ["Venue booking", "Catering contract", "Guest RSVPs", "Final headcount"],
        }

    def _assess_risks_from_data(self, event_data: Dict, vendors: List, match_result: Dict) -> Dict:
        risks = []
        budget = event_data.get("budget", {})
        amount = float(budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0))
        guest_count = int(event_data.get("guestCount", 0))

        # Vendor coverage risk
        total = len(vendors)
        if total < 5:
            risks.append({"factor": "Limited vendor options", "severity": "high",
                          "mitigation": "Expand search radius or consider alternative categories",
                          "probability": 0.7})
        # Budget risk
        feasibility = self._score_budget_feasibility(amount, event_data.get("eventType", ""), guest_count)
        if feasibility < 55:
            risks.append({"factor": "Budget may be insufficient for event scale", "severity": "high",
                          "mitigation": "Reduce guest count or increase budget by 20-30%",
                          "probability": 0.8})
        elif feasibility < 75:
            risks.append({"factor": "Budget is tight — limited room for overruns", "severity": "medium",
                          "mitigation": "Maintain a 10% contingency fund", "probability": 0.5})

        # Date risk
        try:
            event_date = datetime.fromisoformat(str(event_data.get("eventDate", "")).replace("Z", "+00:00"))
            days_away = (event_date - datetime.now(event_date.tzinfo)).days
            if days_away < 30:
                risks.append({"factor": "Very short planning window", "severity": "high",
                              "mitigation": "Prioritize venue and catering immediately, delegate tasks",
                              "probability": 0.9})
        except Exception:
            pass

        # Availability risk
        low_avail = sum(1 for v in vendors if v.get("availabilityStatus") == "low")
        if low_avail > len(vendors) * 0.4:
            risks.append({"factor": "Many vendors showing low availability", "severity": "medium",
                          "mitigation": "Book vendors immediately; have backup options ready",
                          "probability": 0.6})

        overall = "high" if any(r["severity"] == "high" for r in risks) else \
                  "medium" if any(r["severity"] == "medium" for r in risks) else "low"

        return {
            "overall_risk": overall,
            "overall_risk_score": round(len([r for r in risks if r["severity"] == "high"]) * 0.3 +
                                        len([r for r in risks if r["severity"] == "medium"]) * 0.15, 2),
            "risks": risks,
            "mitigation_strategies": [r["mitigation"] for r in risks],
        }

    def _query_market_insights(self, location: Dict, event_type: str) -> Dict:
        """Pull aggregated stats from the local vendor collection."""
        try:
            db = _get_mongo_db()
            city = location.get("city", "")
            state = location.get("state", "")

            query = {"status": "approved", "isActive": True}
            if city:
                query["address.city"] = {"$regex": city, "$options": "i"}
            elif state:
                query["address.state"] = {"$regex": state, "$options": "i"}

            pipeline = [
                {"$match": query},
                {"$group": {
                    "_id": "$category",
                    "count": {"$sum": 1},
                    "avg_rating": {"$avg": "$rating"},
                    "avg_price": {"$avg": "$averagePrice"},
                    "high_avail": {"$sum": {"$cond": [{"$eq": ["$availabilityStatus", "high"]}, 1, 0]}},
                }},
                {"$sort": {"count": -1}},
            ]

            stats = list(db.vendors.aggregate(pipeline))
            market = {
                "city": city or state or "your area",
                "vendor_market": {s["_id"]: {"count": s["count"],
                                             "avg_rating": round(s.get("avg_rating") or 0, 2),
                                             "avg_price": round(s.get("avg_price") or 0, 2),
                                             "high_availability_count": s["high_avail"]}
                                  for s in stats if s["_id"]},
                "total_vendors_in_area": sum(s["count"] for s in stats),
                "data_source": "local_db",
            }
            return market
        except Exception as e:
            logger.warning(f"market insights query failed: {e}")
            return {"data_source": "unavailable", "total_vendors_in_area": 0}

    # ------------------------------------------------------------------
    # Sufficiency assessment
    # ------------------------------------------------------------------

    def _assess_local_data_sufficiency(self, vendors: List, event_data: Dict) -> Dict:
        """
        Decides whether local data can satisfy the plan request without external AI.
        Returns: {sufficient: bool, confidence: float, gaps: [str]}
        """
        event_type = event_data.get("eventType", "event").lower()
        budget = event_data.get("budget", {})
        budget_amount = float(budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0))
        guest_count = int(event_data.get("guestCount", 0))

        gaps = []
        confidence = 1.0

        # Not enough vendors at all
        if len(vendors) < 3:
            gaps.append(f"Only {len(vendors)} vendor(s) found — insufficient for matching")
            confidence -= 0.4

        # Category coverage
        required = set(EVENT_CATEGORY_REQUIREMENTS.get(event_type, ["venue", "catering"]))
        available_cats = set(
            (v.get("category") or v.get("businessType") or "").lower()
            for v in vendors
        )
        missing = required - available_cats
        if missing:
            gaps.append(f"Missing categories: {', '.join(missing)}")
            confidence -= 0.15 * len(missing)

        # Budget coverage
        if budget_amount > 0:
            affordable = [
                v for v in vendors
                if self._vendor_fits_budget(v, budget_amount, guest_count)
            ]
            if len(affordable) < 2:
                gaps.append("Very few vendors match the budget range")
                confidence -= 0.25

        confidence = max(0.0, round(confidence, 2))
        return {
            "sufficient": confidence >= 0.6 and len(gaps) < 3,
            "confidence": confidence,
            "gaps": gaps,
            "vendor_count": len(vendors),
        }

    def _vendor_fits_budget(self, vendor: Dict, budget: float, guest_count: int) -> bool:
        price_range = vendor.get("priceRange", {})
        avg = vendor.get("averagePrice", 0)
        if avg and avg <= budget:
            return True
        max_price = price_range.get("max", 0)
        if max_price and max_price <= budget:
            return True
        # Services-based estimate
        for svc in vendor.get("services", []):
            price = svc.get("price", {})
            total = (price.get("amount", 0) or 0)
            if total <= budget:
                return True
        return avg == 0  # Include vendors with no price data as potentially affordable

    # ------------------------------------------------------------------
    # External AI decision + calls (Fix 1 + Fix 2)
    # ------------------------------------------------------------------

    def _should_use_external_ai(self, sufficiency: Dict, plan_level: int, user_context: Dict) -> bool:
        """Use external AI when: data is insufficient OR plan tier >= 2."""
        if plan_level >= 2 and not sufficiency["sufficient"]:
            return True
        if plan_level >= 3:
            return True  # Business+ always gets AI enrichment
        if not sufficiency["sufficient"]:
            return bool(_get_openai() or _get_anthropic())  # Free tier gets AI only if available
        return False

    def _call_external_ai(
        self,
        event_data: Dict,
        local_result: Dict,
        sufficiency: Dict,
        plan_level: int,
        user_context: Dict,
    ) -> Optional[Dict]:
        """Call OpenAI or Anthropic with a rich, context-specific prompt."""
        # Build cache key from the event parameters
        cache_key = self._build_cache_key(event_data, plan_level)
        cached = self._cache_get(cache_key)
        if cached:
            cached["_from_cache"] = True
            return cached

        prompt = self._build_enrichment_prompt(event_data, local_result, sufficiency)

        result = None
        # Prefer GPT-4o for plan levels 2-3, Claude for 3+ (or fallback)
        if plan_level <= 3 and _get_openai():
            result = self.query_gpt4(prompt)
        elif _get_anthropic():
            result = self.query_claude(prompt)
        elif _get_openai():
            result = self.query_gpt4(prompt)

        if result:
            self._cache_set(cache_key, result, ttl=21600)  # cache 6 hours
        return result

    def query_gpt4(
        self,
        prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 2000,
        context: Dict = None,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        """Real GPT-4o call with structured JSON output."""
        client = _get_openai()
        if not client:
            return self._fallback_enrichment()

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt or ENRICHMENT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            data["_model_used"] = "gpt-4o"
            data["_tokens_used"] = response.usage.total_tokens
            logger.info(f"GPT-4o call OK | tokens={response.usage.total_tokens}")
            return data
        except json.JSONDecodeError as e:
            logger.error(f"GPT-4o JSON parse error: {e}")
            return self._fallback_enrichment()
        except Exception as e:
            logger.error(f"GPT-4o call failed: {e}")
            return self._fallback_enrichment()

    def query_claude(
        self,
        prompt: str,
        temperature: float = 0.4,
        max_tokens: int = 2000,
        context: Dict = None,
        system_prompt: str = None,
    ) -> Dict[str, Any]:
        """Real Claude Sonnet call with structured JSON output."""
        client = _get_anthropic()
        if not client:
            return self._fallback_enrichment()

        try:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=max_tokens,
                temperature=temperature,
                system=system_prompt or ENRICHMENT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text
            # Strip any accidental markdown fences
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            data = json.loads(raw.strip())
            data["_model_used"] = "claude-sonnet-4-6"
            data["_tokens_used"] = response.usage.input_tokens + response.usage.output_tokens
            logger.info(f"Claude call OK | tokens={response.usage.input_tokens + response.usage.output_tokens}")
            return data
        except json.JSONDecodeError as e:
            logger.error(f"Claude JSON parse error: {e}")
            return self._fallback_enrichment()
        except Exception as e:
            logger.error(f"Claude call failed: {e}")
            return self._fallback_enrichment()

    def query_gemini(self, prompt: str, temperature: float = 0.5, max_tokens: int = 1000, context: Dict = None) -> Dict[str, Any]:
        """Placeholder — Gemini integration to be added when key is available."""
        logger.info("Gemini not yet configured — routing to GPT-4o")
        return self.query_gpt4(prompt, temperature, max_tokens, context)

    def query_local_model(self, prompt: str, context: Dict = None) -> Dict[str, Any]:
        """The 'local model' is the scoring engine — no external API call."""
        return {
            "response": {"message": "Answered using local scoring engine"},
            "confidence": 0.75,
            "model": "local-scoring",
        }

    # ------------------------------------------------------------------
    # Streaming (Fix 6)
    # ------------------------------------------------------------------

    def stream_gpt4_analysis(
        self,
        event_data: Dict,
        local_result: Dict,
        sufficiency: Dict,
    ) -> Generator[str, None, None]:
        """Yield SSE-compatible chunks from a streaming GPT-4o call."""
        client = _get_openai()
        if not client:
            yield json.dumps({"error": "OpenAI not configured", "done": True})
            return

        prompt = self._build_enrichment_prompt(event_data, local_result, sufficiency)

        try:
            with client.chat.completions.stream(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": ENRICHMENT_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=2000,
            ) as stream:
                for chunk in stream:
                    delta = chunk.choices[0].delta.content if chunk.choices else None
                    if delta:
                        yield json.dumps({"text": delta, "done": False})
            yield json.dumps({"text": "", "done": True})
        except Exception as e:
            logger.error(f"GPT-4o streaming failed: {e}")
            yield json.dumps({"error": str(e), "done": True})

    # ------------------------------------------------------------------
    # Prompt builder (Fix 2 — context-rich prompts)
    # ------------------------------------------------------------------

    def _build_enrichment_prompt(
        self,
        event_data: Dict,
        local_result: Dict,
        sufficiency: Dict,
    ) -> str:
        budget = event_data.get("budget", {})
        budget_amount = budget.get("amount", "unspecified") if isinstance(budget, dict) else budget
        currency = budget.get("currency", "USD") if isinstance(budget, dict) else "USD"

        top_vendors = []
        matching = local_result.get("vendor_matching", {})
        for v in (matching.get("matches") or [])[:5]:
            top_vendors.append(
                f"  - {v.get('business_name', 'Unknown')} ({v.get('category', 'N/A')}) "
                f"score={v.get('overall_score', 0):.2f}"
            )

        gaps_text = "\n".join(f"  - {g}" for g in sufficiency.get("gaps", [])) or "  None identified"

        return f"""EVENT PLANNING REQUEST — Please fill the gaps local data could not cover.

EVENT DETAILS:
  Type: {event_data.get('eventType', 'unspecified')}
  Date: {event_data.get('eventDate', 'unspecified')}
  Guest count: {event_data.get('guestCount', 'unspecified')}
  Budget: {budget_amount} {currency}
  Location: {event_data.get('location', {}).get('city', 'unspecified')}, {event_data.get('location', {}).get('state', '')}
  Theme: {event_data.get('theme', 'unspecified')}
  Special requirements: {event_data.get('specialRequirements', 'none')}

LOCAL DATA ALREADY FOUND ({sufficiency.get('vendor_count', 0)} vendors):
{chr(10).join(top_vendors) if top_vendors else '  No vendors found locally'}

GAPS THAT NEED YOUR HELP:
{gaps_text}

LOCAL BUDGET ALLOCATION ALREADY CALCULATED:
  Feasibility score: {local_result.get('budget_optimization', {}).get('feasibility_score', 'N/A')}/100
  Cost per guest: {local_result.get('budget_optimization', {}).get('cost_per_guest', 'N/A')} {currency}

Please provide enriched recommendations to fill these specific gaps. Focus on actionable, specific advice."""

    # ------------------------------------------------------------------
    # Result merger
    # ------------------------------------------------------------------

    def _merge_results(
        self,
        local: Dict,
        ai: Optional[Dict],
        event_data: Dict,
        plan_level: int,
    ) -> Dict:
        merged = {**local}

        if ai:
            # Vendor gaps from AI
            if "missing_vendor_suggestions" in ai:
                merged["vendor_gap_recommendations"] = ai["missing_vendor_suggestions"]

            # Creative suggestions
            if "creative_theme_ideas" in ai:
                merged["creative_suggestions"] = {
                    "themes": ai.get("creative_theme_ideas", []),
                    "unique_elements": [],
                    "guest_experience_ideas": [],
                }

            # Budget adjustments
            if "budget_reallocation" in ai:
                merged["budget_optimization"]["ai_adjustments"] = ai["budget_reallocation"]

            # Risk additions
            if "risk_mitigation" in ai:
                existing_risks = merged.get("risk_assessment", {}).get("risks", [])
                for rm in ai.get("risk_mitigation", []):
                    existing_risks.append({
                        "factor": rm.get("risk", ""),
                        "mitigation": rm.get("action", ""),
                        "severity": "medium",
                        "probability": 0.4,
                    })
                merged["risk_assessment"]["risks"] = existing_risks

            # Local market tips
            if "local_market_tips" in ai:
                merged["market_insights"]["ai_tips"] = ai["local_market_tips"]

            merged["ai_enriched"] = True
            merged["overall_confidence"] = max(
                merged.get("overall_confidence", 0.7),
                ai.get("confidence_score", 0.7),
            )
        else:
            merged["ai_enriched"] = False

        return merged

    # ------------------------------------------------------------------
    # Semantic cache (Fix 7)
    # ------------------------------------------------------------------

    def _build_cache_key(self, event_data: Dict, plan_level: int) -> str:
        budget = event_data.get("budget", {})
        amount = budget.get("amount", 0) if isinstance(budget, dict) else (budget or 0)
        # Round budget to nearest 5000 so similar amounts share cache
        rounded_budget = round(float(amount) / 5000) * 5000

        key_data = "|".join([
            event_data.get("eventType", ""),
            event_data.get("location", {}).get("city", "") if isinstance(event_data.get("location"), dict) else "",
            str(rounded_budget),
            str(event_data.get("guestCount", 0)),
            str(plan_level),
        ])
        return f"ai_cache:{hashlib.md5(key_data.encode()).hexdigest()}"

    def _cache_get(self, key: str) -> Optional[Dict]:
        r = _get_redis()
        if not r:
            return None
        try:
            val = r.get(key)
            if val:
                logger.info(f"Semantic cache HIT: {key}")
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
        return None

    def _cache_set(self, key: str, value: Dict, ttl: int = 21600):
        r = _get_redis()
        if not r:
            return
        try:
            r.setex(key, ttl, json.dumps(value))
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")

    # ------------------------------------------------------------------
    # Fallback
    # ------------------------------------------------------------------

    def _fallback_enrichment(self) -> Dict:
        return {
            "_model_used": "fallback",
            "missing_vendor_suggestions": [],
            "creative_theme_ideas": ["classic elegance", "modern minimalist", "rustic charm"],
            "budget_reallocation": {"rationale": "Default allocation", "adjustments": []},
            "risk_mitigation": [
                {"risk": "Vendor cancellation", "action": "Keep 1-2 backup vendors per category"},
                {"risk": "Budget overrun", "action": "Maintain 10% contingency fund"},
            ],
            "local_market_tips": "Book early, compare at least 3 vendors per category, and read recent reviews.",
            "confidence_score": 0.55,
        }

    # ------------------------------------------------------------------
    # Health / model availability
    # ------------------------------------------------------------------

    def health_check(self) -> str:
        return "operational"

    def check_models_availability(self) -> Dict[str, Dict[str, Any]]:
        return {
            "gpt4":   {"status": "live" if bool(os.environ.get("OPENAI_API_KEY")) else "not_configured", "model": "gpt-4o"},
            "claude": {"status": "live" if bool(os.environ.get("ANTHROPIC_API_KEY")) else "not_configured", "model": "claude-sonnet-4-6"},
            "gemini": {"status": "coming_soon"},
            "local":  {"status": "operational", "model": "local-scoring"},
        }
