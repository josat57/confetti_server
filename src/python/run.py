"""
Confetti AI Python Service — v3.0
Local-first intelligence with optional external AI enrichment.
"""

# Load .env before any other import so env vars are available to all modules
from dotenv import load_dotenv
load_dotenv()

import os
import hmac
import json
import time
import uuid
import logging

from flask import Flask, request, jsonify, Response, stream_with_context, g, has_request_context
from werkzeug.exceptions import HTTPException

from services.budget_optimizer import BudgetOptimizer
from services.price_predictor import PricePredictor
from services.recommendation_engine import RecommendationEngine
from services.event_simulator import EventSimulator
from services.nlp_service import NLPService
from services.ai_orchestrator import AIOrchestrator
from services.visual_ai_service import VisualAIService, VisionUnavailableError
from services.learning_service import LearningService
from services.market_intelligence import MarketIntelligence
from services.ai_orchestrator import _to_int, _budget_amount

app = Flask(__name__)
# No CORS: this service is called server-to-server by the Node API only.
app.config['MAX_CONTENT_LENGTH'] = int(os.environ.get('MAX_REQUEST_MB') or '5') * 1024 * 1024


class _RequestIdFilter(logging.Filter):
    """Tag every log line with the current request id (or '-')."""
    def filter(self, record):
        record.request_id = g.get('request_id', '-') if has_request_context() else '-'
        return True


_log_handler = logging.StreamHandler()
_log_handler.addFilter(_RequestIdFilter())
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] — %(message)s",
    handlers=[_log_handler],
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Service-to-service auth
# ---------------------------------------------------------------------------
IS_DEVELOPMENT = os.environ.get("FLASK_ENV", "production") == "development"
PYTHON_API_KEY = os.environ.get("PYTHON_API_KEY", "")
PUBLIC_PATHS   = {"/health/ai"}

# Upper bounds for caller-supplied LLM parameters (cost control)
MAX_TOKENS_CAP = 4000

if not PYTHON_API_KEY:
    if IS_DEVELOPMENT:
        logger.warning("PYTHON_API_KEY not set — auth disabled (development only)")
    else:
        logger.error("PYTHON_API_KEY not set — rejecting all non-health requests")


@app.before_request
def start_request():
    # Reuse the caller's id so a request can be traced across Node and Python
    g.request_id = (request.headers.get('X-Request-ID') or uuid.uuid4().hex)[:64]
    g.started = time.time()


@app.after_request
def finish_request(response):
    response.headers['X-Request-ID'] = g.get('request_id', '')
    if request.path not in PUBLIC_PATHS:
        logger.info(f"{request.method} {request.path} {response.status_code} "
                    f"{(time.time() - g.get('started', time.time())) * 1000:.0f}ms")
    return response


@app.before_request
def require_api_key():
    if request.path in PUBLIC_PATHS:
        return None
    if not PYTHON_API_KEY:
        if IS_DEVELOPMENT:
            return None
        return jsonify({'status': 'error', 'message': 'Service not configured'}), 503

    header = request.headers.get("Authorization", "")
    token = header[7:] if header.startswith("Bearer ") else request.headers.get("X-API-Key", "")
    if not hmac.compare_digest(token.encode(), PYTHON_API_KEY.encode()):
        return jsonify({'status': 'error', 'message': 'Unauthorized'}), 401
    return None


@app.errorhandler(HTTPException)
def handle_http_error(e):
    # e.g. malformed JSON body, wrong method, unknown route
    return jsonify({'status': 'error', 'message': e.description}), e.code


@app.errorhandler(KeyError)
def handle_missing_field(e):
    # Legacy endpoints index request.json directly
    logger.warning(f"KeyError on {request.path}: {e}")
    return jsonify({'status': 'error', 'message': f'Missing required field: {e.args[0]}'}), 400


@app.errorhandler(Exception)
def handle_unexpected_error(e):
    logger.exception(f"Unhandled error on {request.method} {request.path}")
    return jsonify({'status': 'error', 'message': 'Internal server error'}), 500


def _server_error(message='Internal server error', **extra):
    """Log the active exception with its traceback; never send internals to the caller."""
    logger.exception(f"{request.method} {request.path} failed")
    return jsonify({'status': 'error', 'message': message,
                    'request_id': g.get('request_id'), **extra}), 500


def _llm_params(d, default_temperature, default_max_tokens):
    """Clamp caller-supplied temperature / max_tokens to safe ranges."""
    try:
        temperature = float(d.get('temperature', default_temperature))
    except (TypeError, ValueError):
        temperature = default_temperature
    try:
        max_tokens = int(d.get('max_tokens', default_max_tokens))
    except (TypeError, ValueError):
        max_tokens = default_max_tokens
    return min(max(temperature, 0.0), 1.0), min(max(max_tokens, 1), MAX_TOKENS_CAP)

# ---------------------------------------------------------------------------
# Service singletons
# ---------------------------------------------------------------------------
budget_optimizer      = BudgetOptimizer()
price_predictor       = PricePredictor()
recommendation_engine = RecommendationEngine()
event_simulator       = EventSimulator()
nlp_service           = NLPService()
ai_orchestrator       = AIOrchestrator()
visual_ai_service     = VisualAIService()
learning_service      = LearningService()
market_intelligence   = MarketIntelligence()

logger.info("All AI services initialised — local-first mode active")
logger.info(f"OpenAI available:    {bool(os.environ.get('OPENAI_API_KEY'))}")
logger.info(f"Anthropic available: {bool(os.environ.get('ANTHROPIC_API_KEY'))}")

# ===========================================================================
# Existing endpoints (unchanged logic, kept for backward compat)
# ===========================================================================

@app.route('/optimize-budget', methods=['POST'])
def optimize_budget():
    data = request.get_json(silent=True) or {}
    result = budget_optimizer.optimize(data['budget'], data['preferences'])
    return jsonify(result)


@app.route('/predict-prices', methods=['POST'])
def predict_prices():
    data = request.get_json(silent=True) or {}
    result = price_predictor.predict(data['items'])
    return jsonify(result)


@app.route('/match-vendors', methods=['POST'])
def match_vendors():
    """Score vendors with the same matcher the comprehensive analysis uses.
    Response: {matches: [...], category_matches, insights, total_matches, top_vendors, avg_confidence}."""
    data = request.get_json(silent=True) or {}
    req = data['requirements'] or {}
    requirements = {
        'event_type': req.get('event_type') or '',
        'budget': _budget_amount(req.get('budget')),
        'guest_count': _to_int(req.get('guest_count')),
        'location': req.get('location') or {},
        'preferences': req.get('preferences') or [],
    }
    result = ai_orchestrator.matcher.match_vendors(requirements, req.get('vendors') or [])
    # Legacy keys kept for older callers (event.controller planEvent)
    result['total_matches'] = result['total_analyzed']
    result['top_vendors'] = result['matches'][:10]
    return jsonify(result)


@app.route('/get-recommendations', methods=['POST'])
def get_recommendations():
    data = request.get_json(silent=True) or {}
    result = recommendation_engine.recommend(data['preferences'])
    return jsonify(result)


@app.route('/simulate-event', methods=['POST'])
def simulate_event():
    data = request.get_json(silent=True) or {}
    result = event_simulator.simulate(data['plan'])
    return jsonify(result)


@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    data = request.get_json(silent=True) or {}
    sentiment = nlp_service.analyze_sentiment(data['text'])
    keywords  = nlp_service.extract_keywords(data['text'])
    return jsonify({'sentiment': sentiment, 'keywords': keywords})


@app.route('/analyze-event-plan', methods=['POST'])
def analyze_event_plan():
    """Full event plan analysis — NLP + budget + vendor matching."""
    t0 = time.time()
    try:
        data        = request.get_json(silent=True) or {}
        event_data  = data.get('event_data', {})
        vendors     = data.get('vendors', [])
        event_type  = event_data.get('eventType') or 'other'
        # Node sends budget as {amount, currency}; the optimizer needs a number
        budget      = _budget_amount(event_data.get('budget'))
        guest_count = _to_int(event_data.get('guestCount'))
        location    = event_data.get('location') or {}

        nlp_analysis = nlp_service.analyze_comprehensive(event_data.get('eventDescription', ''))
        nlp_analysis['event_context'] = {
            'event_type': event_type,
            'guest_count': guest_count,
            'location': location.get('city', 'Unknown'),
        }

        budget_optimization = budget_optimizer.optimize(
            budget,
            {'event_type': event_type, 'guest_count': guest_count,
             'location': location,
             'formality': (event_data.get('guestClass') or {}).get('formality', 'casual')},
        )

        vendor_matches = ai_orchestrator.matcher.match_vendors({
            'event_type': event_type, 'budget': budget,
            'guest_count': guest_count, 'location': location,
        }, vendors)

        recommendations = recommendation_engine.recommend({
            'event_type': event_type, 'budget': budget,
            'guest_count': guest_count, 'vendor_count': len(vendors),
            'feasibility_score': budget_optimization.get('feasibility_score', 75),
        })

        ms = (time.time() - t0) * 1000
        resp = jsonify({
            'nlp_analysis': nlp_analysis,
            'budget_optimization': budget_optimization,
            'vendor_matches': vendor_matches,
            'recommendations': recommendations,
            'metadata': {'processing_time_ms': ms, 'version': '3.0.0'},
        })
        resp.headers['X-Processing-Time'] = str(int(ms))
        return resp

    except Exception:
        return _server_error('Event plan analysis failed')


# ===========================================================================
# AI model endpoints
# ===========================================================================

# Free-form prompts from Node carry their own JSON schema in the prompt text,
# so the system prompt only enforces "JSON, following the requested schema".
GENERIC_SYSTEM_PROMPT = (
    "You are an expert event planning assistant for an event platform in Nigeria. "
    "Answer the user's request as a single JSON object. If the request specifies a JSON "
    "schema or field names, follow them exactly; otherwise use concise snake_case keys."
)


def _generic_ai_response(query_fn, default_temperature, default_max_tokens):
    """Shared handler for /ai/gpt4, /ai/claude, /ai/gemini.
    Response: {status, response: <model JSON>, model, tokens_used, processing_time}."""
    d = request.get_json(silent=True) or {}
    prompt = d.get('prompt')
    if not isinstance(prompt, str) or not prompt.strip():
        return jsonify({'status': 'error', 'message': 'prompt is required'}), 400

    temperature, max_tokens = _llm_params(d, default_temperature, default_max_tokens)
    started = time.time()
    result = query_fn(prompt=prompt, temperature=temperature, max_tokens=max_tokens,
                      context=d.get('context', {}), system_prompt=GENERIC_SYSTEM_PROMPT)

    if ai_orchestrator._is_fallback(result):
        # Don't pass canned enrichment text off as an answer; callers have fallbacks
        return jsonify({'status': 'error', 'message': 'AI model unavailable'}), 503

    meta = {k: result.pop(k) for k in list(result) if k.startswith('_')}
    return jsonify({
        'status': 'success',
        'response': result,
        'model': meta.get('_model_used'),
        'tokens_used': meta.get('_tokens_used', 0),
        'processing_time': round((time.time() - started) * 1000, 1),
    })


@app.route('/ai/gpt4', methods=['POST'])
def query_gpt4():
    try:
        return _generic_ai_response(ai_orchestrator.query_gpt4, 0.4, 2000)
    except Exception:
        return _server_error()


@app.route('/ai/claude', methods=['POST'])
def query_claude():
    try:
        return _generic_ai_response(ai_orchestrator.query_claude, 0.4, 2000)
    except Exception:
        return _server_error()


@app.route('/ai/gemini', methods=['POST'])
def query_gemini():
    try:
        return _generic_ai_response(ai_orchestrator.query_gemini, 0.5, 1000)
    except Exception:
        return _server_error()


@app.route('/ai/local', methods=['POST'])
def query_local():
    try:
        d = request.get_json(silent=True) or {}
        context = d.get('context') or {}
        if not context.get('event_data'):
            # The local engine scores event plans; it can't answer free-form
            # prompts. Return an empty answer so callers use their own defaults.
            return jsonify({'status': 'success', 'response': {}, 'model': 'local-scoring',
                            'confidence': 0.0, 'tokens_used': 0,
                            'note': 'local engine needs context.event_data; no free-form answer'})
        result = ai_orchestrator.query_local_model(prompt=d.get('prompt'), context=context)
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


# ===========================================================================
# Comprehensive analysis — local-first, external AI on demand (Fix 1 + Fix 2)
# ===========================================================================

@app.route('/ai/comprehensive-analysis', methods=['POST'])
def comprehensive_ai_analysis():
    """
    Primary planning endpoint.
    1. Runs local vendor scoring against MongoDB data.
    2. Escalates to GPT-4o / Claude when data is insufficient or plan level >= 3.
    3. Records the interaction for ongoing learning.
    """
    t0 = time.time()
    data = request.get_json(silent=True) or {}

    try:
        user_context = data.get('user_context', {})
        user_type    = user_context.get('userType', 'guest')
        user_id      = user_context.get('userId')
        plan_level   = _to_int(user_context.get('planLevel'), 1)

        result = ai_orchestrator.comprehensive_analysis(
            event_data        = data.get('event_data', {}),
            vendors           = data.get('vendors', []),
            vendor_statistics = data.get('vendor_statistics', {}),
            vendor_id         = user_id if user_type == 'vendor' else None,
            plan_level        = plan_level,
            vendor_profile    = user_context.get('profile', {}),
            user_context      = user_context,
        )

        ms = (time.time() - t0) * 1000

        # Persist interaction for authenticated users (Fix 3)
        interaction_id = None
        if user_id and user_type != 'guest':
            recorded = learning_service.record_interaction(
                user_id=user_id,
                user_type=user_type,
                event_data=data.get('event_data', {}),
                generated_plan=result,
            )
            interaction_id = recorded.get('interaction_id')

        resp = jsonify({
            'status': 'success',
            'analysis': result,
            'user_context': {'userType': user_type, 'planLevel': plan_level, 'isAuthenticated': bool(user_id)},
            'metadata': {
                'processing_time_ms': round(ms, 1),
                'version': '3.0.0',
                'models_used': result.get('metadata', {}).get('models_used', ['local-scoring']),
                'confidence': result.get('overall_confidence', 0.75),
                'ai_enriched': result.get('ai_enriched', False),
                'interaction_id': interaction_id,
            },
        })
        resp.headers['X-Processing-Time'] = str(int(ms))
        return resp

    except Exception:
        return _server_error('Comprehensive analysis failed', fallback_available=True)


# ===========================================================================
# SSE Streaming endpoint (Fix 6)
# ===========================================================================

@app.route('/ai/stream-plan', methods=['POST'])
def stream_plan():
    """
    Server-Sent Events endpoint.
    Immediately returns local scoring results, then streams GPT-4o enrichment
    token-by-token so the client can render progressively.
    """
    data = request.get_json(silent=True) or {}
    event_data   = data.get('event_data', {})
    vendors      = data.get('vendors', [])
    user_context = data.get('user_context', {})
    plan_level   = _to_int(user_context.get('planLevel'), 1)

    def generate():
        try:
            # Phase 1 — instant local result
            yield f"data: {json.dumps({'phase': 'local', 'status': 'started'})}\n\n"

            local = ai_orchestrator._run_local_analysis(
                event_data, vendors,
                data.get('vendor_statistics', {}),
                user_context,
            )
            yield f"data: {json.dumps({'phase': 'local', 'status': 'complete', 'data': local})}\n\n"

            # Phase 2 — assess sufficiency
            sufficiency = ai_orchestrator._assess_local_data_sufficiency(vendors, event_data)
            yield f"data: {json.dumps({'phase': 'sufficiency', 'data': sufficiency})}\n\n"

            # Phase 3 — stream external AI if needed
            should_enrich = ai_orchestrator._should_use_external_ai(sufficiency, plan_level, user_context)
            if should_enrich:
                yield f"data: {json.dumps({'phase': 'ai_enrichment', 'status': 'started', 'gaps': sufficiency.get('gaps', [])})}\n\n"

                for chunk_json in ai_orchestrator.stream_gpt4_analysis(event_data, local, sufficiency):
                    yield f"data: {chunk_json}\n\n"

                yield f"data: {json.dumps({'phase': 'ai_enrichment', 'status': 'complete'})}\n\n"

            yield f"data: {json.dumps({'phase': 'done'})}\n\n"

        except Exception:
            logger.exception("stream-plan failed")
            yield f"data: {json.dumps({'error': 'Plan streaming failed', 'phase': 'error'})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'},
    )


# ===========================================================================
# Feedback endpoint (feeds the learning loop)
# ===========================================================================

@app.route('/ai/feedback', methods=['POST'])
def record_feedback():
    """
    Record user feedback on a generated plan.
    This is what improves the learning model over time.
    """
    try:
        d        = request.get_json(silent=True) or {}
        user_id  = d.get('user_id')
        user_type = d.get('user_type', 'user')
        rating   = _to_int(d.get('rating'), 3)
        comments = d.get('comments', '')
        successful = bool(d.get('successful', rating >= 4))

        if not user_id:
            return jsonify({'status': 'error', 'message': 'user_id required'}), 400

        if not 1 <= rating <= 5:
            return jsonify({'status': 'error', 'message': 'rating must be 1-5'}), 400

        result = learning_service.record_feedback(
            user_id=user_id,
            user_type=user_type,
            rating=rating,
            comments=comments,
            successful=successful,
            interaction_id=d.get('interaction_id'),
        )
        if not result.get('updated'):
            return jsonify({'status': 'error', 'message': result.get('error', 'feedback not recorded')}), 404
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


# ===========================================================================
# Learning / training endpoints (Fix 3)
# ===========================================================================

@app.route('/ai/train-user-model', methods=['POST'])
def train_user_model():
    try:
        d = request.get_json(silent=True) or {}
        result = learning_service.train_user_model(
            user_id      = d.get('user_id'),
            user_type    = d.get('user_type', 'user'),
            training_data = d.get('training_data', []),
            model_type   = d.get('model_type', 'personalized'),
        )
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


@app.route('/ai/train-vendor-model', methods=['POST'])
def train_vendor_model():
    """Backward-compat alias for vendor training."""
    try:
        d = request.get_json(silent=True) or {}
        result = learning_service.train_user_model(
            user_id      = d.get('vendor_id'),
            user_type    = 'vendor',
            training_data = d.get('training_data', []),
            model_type   = d.get('model_type', 'personalized'),
        )
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


@app.route('/ai/user-preferences/<user_type>/<user_id>', methods=['GET'])
def get_user_preferences(user_type, user_id):
    try:
        prefs = learning_service.get_user_preferences(user_id, user_type)
        return jsonify({'status': 'success', 'preferences': prefs, 'has_data': prefs is not None})
    except Exception:
        return _server_error()


@app.route('/ai/model-metrics/<user_type>/<user_id>', methods=['GET'])
def get_model_metrics(user_type, user_id):
    try:
        status = learning_service.get_learning_status(user_id, user_type)
        return jsonify({'status': 'success', 'metrics': status, 'user_type': user_type, 'user_id': user_id})
    except Exception:
        return _server_error()


# ===========================================================================
# Image / visual endpoints
# ===========================================================================

@app.route('/ai/generate-image', methods=['POST'])
def generate_image():
    try:
        d = request.get_json(silent=True) or {}
        result = visual_ai_service.generate_image(
            prompt=d.get('prompt'), model=d.get('model', 'dall-e-3'),
            style=d.get('style', 'photorealistic'), aspect_ratio=d.get('aspect_ratio', '16:9'),
            quality=d.get('quality', 'high'),
        )
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


@app.route('/ai/analyze-image', methods=['POST'])
def analyze_image():
    try:
        d = request.get_json(silent=True) or {}
        result = visual_ai_service.analyze_image(
            image_url=d.get('image_url'), prompt=d.get('prompt'),
            model=d.get('model', 'gpt-4o'), analysis_type=d.get('analysis_type', 'general'),
        )
        return jsonify({'status': 'success', **result})
    except ValueError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except VisionUnavailableError as e:
        logger.warning(str(e))
        return jsonify({'status': 'error', 'message': 'Image analysis is currently unavailable'}), 503
    except Exception:
        return _server_error()


# ===========================================================================
# Market insights
# ===========================================================================

@app.route('/ai/market-insights', methods=['POST'])
def generate_market_insights():
    try:
        d = request.get_json(silent=True) or {}
        result = market_intelligence.generate_insights(
            location=d.get('location'), event_type=d.get('event_type'),
            timeframe=d.get('timeframe', 'monthly'), analysis_depth=d.get('analysis_depth', 'comprehensive'),
        )
        return jsonify({'status': 'success', **result})
    except Exception:
        return _server_error()


# ===========================================================================
# Health check
# ===========================================================================

@app.route('/health/ai', methods=['GET'])
def health_check():
    t0 = time.time()
    try:
        services = {
            'nlp':                'operational',
            'budget_optimizer':   'operational',
            'recommendation':     'operational',
            'ai_orchestrator':    ai_orchestrator.health_check(),
            'learning_service':   learning_service.health_check(),
            'visual_ai':          visual_ai_service.health_check(),
            'market_intelligence': market_intelligence.health_check(),
        }
        models = ai_orchestrator.check_models_availability()
        ms = (time.time() - t0) * 1000

        # Always 200 while the process can serve: probes shouldn't restart
        # pods because Redis or an external AI key is missing
        return jsonify({
            'status': 'degraded' if 'degraded' in services.values() else 'healthy',
            'response_time_ms': round(ms, 1),
            'version': '3.0.0',
            'services': services,
            'models': models,
            'env': {
                'openai':    bool(os.environ.get('OPENAI_API_KEY')),
                'anthropic': bool(os.environ.get('ANTHROPIC_API_KEY')),
                'redis':     bool(os.environ.get('REDIS_URL')),
                'mongodb':   bool(os.environ.get('MONGODB_URI')),
            },
        })
    except Exception:
        logger.exception("health check failed")
        return jsonify({'status': 'unhealthy'}), 503


if __name__ == '__main__':
    # Local development only — production runs under gunicorn (see Dockerfile).
    # The Werkzeug debugger allows remote code execution, so it is opt-in and
    # bound to localhost.
    port = int(os.environ.get('PYTHON_PORT', 5600))
    debug = os.environ.get('FLASK_DEBUG') == '1'
    host = '127.0.0.1' if debug else os.environ.get('PYTHON_HOST', '0.0.0.0')
    logger.info(f"Starting Confetti AI Python Service v3.0.0 on {host}:{port} (debug={debug})")
    app.run(debug=debug, host=host, port=port)
