"""
Confetti AI Python Service — v3.0
Local-first intelligence with optional external AI enrichment.
"""

# Load .env before any other import so env vars are available to all modules
from dotenv import load_dotenv
load_dotenv()

import os
import json
import time
import logging

from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

from services.budget_optimizer import BudgetOptimizer
from services.price_predictor import PricePredictor
from services.vendor_matcher import VendorMatcher
from services.recommendation_engine import RecommendationEngine
from services.event_simulator import EventSimulator
from services.nlp_service import NLPService
from services.ai_orchestrator import AIOrchestrator
from services.visual_ai_service import VisualAIService
from services.learning_service import LearningService
from services.market_intelligence import MarketIntelligence

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Service singletons
# ---------------------------------------------------------------------------
budget_optimizer      = BudgetOptimizer()
price_predictor       = PricePredictor()
vendor_matcher        = VendorMatcher()
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
    data = request.json
    result = budget_optimizer.optimize(data['budget'], data['preferences'])
    return jsonify(result)


@app.route('/predict-prices', methods=['POST'])
def predict_prices():
    data = request.json
    result = price_predictor.predict(data['items'])
    return jsonify(result)


@app.route('/match-vendors', methods=['POST'])
def match_vendors():
    data = request.json
    result = vendor_matcher.match(data['requirements'])
    return jsonify(result)


@app.route('/get-recommendations', methods=['POST'])
def get_recommendations():
    data = request.json
    result = recommendation_engine.recommend(data['preferences'])
    return jsonify(result)


@app.route('/simulate-event', methods=['POST'])
def simulate_event():
    data = request.json
    result = event_simulator.simulate(data['plan'])
    return jsonify(result)


@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    data = request.json
    sentiment = nlp_service.analyze_sentiment(data['text'])
    keywords  = nlp_service.extract_keywords(data['text'])
    return jsonify({'sentiment': sentiment, 'keywords': keywords})


@app.route('/analyze-event-plan', methods=['POST'])
def analyze_event_plan():
    """Full event plan analysis — NLP + budget + vendor matching."""
    t0 = time.time()
    try:
        data        = request.json
        event_data  = data.get('event_data', {})
        vendors     = data.get('vendors', [])
        event_type  = event_data.get('eventType', 'other')
        budget      = event_data.get('budget', 0)
        guest_count = event_data.get('guestCount', 0)

        nlp_analysis = nlp_service.analyze_comprehensive(event_data.get('eventDescription', ''))
        nlp_analysis['event_context'] = {
            'event_type': event_type,
            'guest_count': guest_count,
            'location': event_data.get('location', {}).get('city', 'Unknown'),
        }

        budget_optimization = budget_optimizer.optimize(
            budget,
            {'event_type': event_type, 'guest_count': guest_count,
             'location': event_data.get('location', {}),
             'formality': event_data.get('guestClass', {}).get('formality', 'casual')},
        )

        vendor_matches = vendor_matcher.match({
            'event_type': event_type, 'budget': budget,
            'guest_count': guest_count, 'vendors': vendors,
            'location': event_data.get('location', {}),
        })

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

    except Exception as e:
        logger.error(f"analyze-event-plan failed: {e}")
        return jsonify({'error': str(e)}), 500


# ===========================================================================
# AI model endpoints
# ===========================================================================

@app.route('/ai/gpt4', methods=['POST'])
def query_gpt4():
    try:
        d = request.json
        result = ai_orchestrator.query_gpt4(
            prompt=d.get('prompt'), temperature=d.get('temperature', 0.4),
            max_tokens=d.get('max_tokens', 2000), context=d.get('context', {}),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/claude', methods=['POST'])
def query_claude():
    try:
        d = request.json
        result = ai_orchestrator.query_claude(
            prompt=d.get('prompt'), temperature=d.get('temperature', 0.4),
            max_tokens=d.get('max_tokens', 2000), context=d.get('context', {}),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/gemini', methods=['POST'])
def query_gemini():
    try:
        d = request.json
        result = ai_orchestrator.query_gemini(
            prompt=d.get('prompt'), temperature=d.get('temperature', 0.5),
            max_tokens=d.get('max_tokens', 1000), context=d.get('context', {}),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/local', methods=['POST'])
def query_local():
    try:
        d = request.json
        result = ai_orchestrator.query_local_model(prompt=d.get('prompt'), context=d.get('context', {}))
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


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
    data = request.json or {}

    try:
        user_context = data.get('user_context', {})
        user_type    = user_context.get('userType', 'guest')
        user_id      = user_context.get('userId')
        plan_level   = int(user_context.get('planLevel', 1))

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
        if user_id and user_type != 'guest':
            learning_service.record_interaction(
                user_id=user_id,
                user_type=user_type,
                event_data=data.get('event_data', {}),
                generated_plan=result,
            )

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
            },
        })
        resp.headers['X-Processing-Time'] = str(int(ms))
        return resp

    except Exception as e:
        logger.error(f"comprehensive-analysis failed: {e}")
        return jsonify({'status': 'error', 'message': str(e), 'fallback_available': True}), 500


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
    data = request.json or {}
    event_data   = data.get('event_data', {})
    vendors      = data.get('vendors', [])
    user_context = data.get('user_context', {})
    plan_level   = int(user_context.get('planLevel', 1))

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

        except Exception as e:
            logger.error(f"stream-plan failed: {e}")
            yield f"data: {json.dumps({'error': str(e), 'phase': 'error'})}\n\n"

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
        d        = request.json or {}
        user_id  = d.get('user_id')
        user_type = d.get('user_type', 'user')
        rating   = int(d.get('rating', 3))
        comments = d.get('comments', '')
        successful = bool(d.get('successful', rating >= 4))

        if not user_id:
            return jsonify({'status': 'error', 'message': 'user_id required'}), 400

        result = learning_service.record_feedback(
            user_id=user_id,
            user_type=user_type,
            interaction_index=-1,
            rating=rating,
            comments=comments,
            successful=successful,
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ===========================================================================
# Learning / training endpoints (Fix 3)
# ===========================================================================

@app.route('/ai/train-user-model', methods=['POST'])
def train_user_model():
    try:
        d = request.json
        result = learning_service.train_user_model(
            user_id      = d.get('user_id'),
            user_type    = d.get('user_type', 'user'),
            training_data = d.get('training_data', []),
            model_type   = d.get('model_type', 'personalized'),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/train-vendor-model', methods=['POST'])
def train_vendor_model():
    """Backward-compat alias for vendor training."""
    try:
        d = request.json
        result = learning_service.train_user_model(
            user_id      = d.get('vendor_id'),
            user_type    = 'vendor',
            training_data = d.get('training_data', []),
            model_type   = d.get('model_type', 'personalized'),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/user-preferences/<user_type>/<user_id>', methods=['GET'])
def get_user_preferences(user_type, user_id):
    try:
        prefs = learning_service.get_user_preferences(user_id, user_type)
        return jsonify({'status': 'success', 'preferences': prefs, 'has_data': prefs is not None})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/model-metrics/<user_type>/<user_id>', methods=['GET'])
def get_model_metrics(user_type, user_id):
    try:
        status = learning_service.get_learning_status(user_id, user_type)
        return jsonify({'status': 'success', 'metrics': status, 'user_type': user_type, 'user_id': user_id})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ===========================================================================
# Image / visual endpoints
# ===========================================================================

@app.route('/ai/generate-image', methods=['POST'])
def generate_image():
    try:
        d = request.json
        result = visual_ai_service.generate_image(
            prompt=d.get('prompt'), model=d.get('model', 'dall-e-3'),
            style=d.get('style', 'photorealistic'), aspect_ratio=d.get('aspect_ratio', '16:9'),
            quality=d.get('quality', 'high'),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/ai/analyze-image', methods=['POST'])
def analyze_image():
    try:
        d = request.json
        result = visual_ai_service.analyze_image(
            image_url=d.get('image_url'), prompt=d.get('prompt'),
            model=d.get('model', 'gpt-4o'), analysis_type=d.get('analysis_type', 'general'),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


# ===========================================================================
# Market insights
# ===========================================================================

@app.route('/ai/market-insights', methods=['POST'])
def generate_market_insights():
    try:
        d = request.json
        result = market_intelligence.generate_insights(
            location=d.get('location'), event_type=d.get('event_type'),
            timeframe=d.get('timeframe', 'monthly'), analysis_depth=d.get('analysis_depth', 'comprehensive'),
        )
        return jsonify({'status': 'success', **result})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


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
            'vendor_matcher':     'operational',
            'recommendation':     'operational',
            'ai_orchestrator':    ai_orchestrator.health_check(),
            'learning_service':   learning_service.health_check(),
            'visual_ai':          visual_ai_service.health_check(),
            'market_intelligence': market_intelligence.health_check(),
        }
        models = ai_orchestrator.check_models_availability()
        ms = (time.time() - t0) * 1000

        return jsonify({
            'status': 'healthy',
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
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503


if __name__ == '__main__':
    port = int(os.environ.get('PYTHON_PORT', 5600))
    debug = os.environ.get('NODE_ENV', 'development') == 'development'
    logger.info(f"Starting Confetti AI Python Service v3.0.0 on port {port}")
    app.run(debug=debug, host='0.0.0.0', port=port)
