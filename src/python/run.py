from flask import Flask, request, jsonify
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
import time
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize services
budget_optimizer = BudgetOptimizer()
price_predictor = PricePredictor()
vendor_matcher = VendorMatcher()
recommendation_engine = RecommendationEngine()
event_simulator = EventSimulator()
nlp_service = NLPService()

# Initialize enhanced AI services
ai_orchestrator = AIOrchestrator()
visual_ai_service = VisualAIService()
learning_service = LearningService()
market_intelligence = MarketIntelligence()

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
    keywords = nlp_service.extract_keywords(data['text'])
    return jsonify({
        'sentiment': sentiment,
        'keywords': keywords
    })

@app.route('/analyze-event-plan', methods=['POST'])
def analyze_event_plan():
    """
    Comprehensive AI analysis for event planning
    Combines NLP, budget optimization, and vendor matching
    """
    import time
    start_time = time.time()
    
    try:
        data = request.json
        event_data = data.get('event_data', {})
        vendors = data.get('vendors', [])
        vendor_stats = data.get('vendor_statistics', {})
        
        # 1. Comprehensive NLP Analysis on event description
        event_description = event_data.get('eventDescription', '')
        nlp_analysis = nlp_service.analyze_comprehensive(event_description)
        
        # Add event context
        nlp_analysis['event_context'] = {
            'event_type': event_data.get('eventType', 'event'),
            'guest_count': event_data.get('guestCount', 0),
            'location': event_data.get('location', {}).get('city', 'Unknown')
        }
        
        # 2. Budget Optimization
        budget = event_data.get('budget', 0)
        guest_count = event_data.get('guestCount', 0)
        event_type = event_data.get('eventType', 'other')
        
        budget_optimization = budget_optimizer.optimize(
            budget,
            {
                'event_type': event_type,
                'guest_count': guest_count,
                'location': event_data.get('location', {}),
                'formality': event_data.get('guestClass', {}).get('formality', 'casual')
            }
        )
        
        # 3. Vendor Matching
        vendor_matches = vendor_matcher.match({
            'event_type': event_type,
            'budget': budget,
            'guest_count': guest_count,
            'vendors': vendors,
            'location': event_data.get('location', {})
        })
        
        # 4. Generate Recommendations
        recommendations = recommendation_engine.recommend({
            'event_type': event_type,
            'budget': budget,
            'guest_count': guest_count,
            'vendor_count': len(vendors),
            'feasibility_score': budget_optimization.get('feasibility_score', 75)
        })
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        result = {
            'nlp_analysis': nlp_analysis,
            'budget_optimization': budget_optimization,
            'vendor_matches': vendor_matches,
            'recommendations': recommendations,
            'metadata': {
                'processing_time_ms': processing_time,
                'version': '1.0.0',
                'model': 'ai-event-planner-v1'
            }
        }
        
        response = jsonify(result)
        response.headers['X-Processing-Time'] = str(int(processing_time))
        return response
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'message': 'AI analysis failed'
        }), 500

# ============================================
# ENHANCED AI ENDPOINTS
# ============================================

@app.route('/ai/gpt4', methods=['POST'])
def query_gpt4():
    """Query GPT-4 model for advanced AI capabilities"""
    try:
        data = request.json
        result = ai_orchestrator.query_gpt4(
            prompt=data.get('prompt'),
            temperature=data.get('temperature', 0.7),
            max_tokens=data.get('max_tokens', 2000),
            context=data.get('context', {})
        )
        return jsonify({
            'status': 'success',
            'response': result['response'],
            'confidence': result.get('confidence', 0.8),
            'processing_time': result.get('processing_time', 0),
            'tokens_used': result.get('tokens_used', 0)
        })
    except Exception as e:
        logger.error(f"GPT-4 query failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/claude', methods=['POST'])
def query_claude():
    """Query Claude model for sophisticated analysis"""
    try:
        data = request.json
        result = ai_orchestrator.query_claude(
            prompt=data.get('prompt'),
            temperature=data.get('temperature', 0.6),
            max_tokens=data.get('max_tokens', 1500),
            context=data.get('context', {})
        )
        return jsonify({
            'status': 'success',
            'response': result['response'],
            'confidence': result.get('confidence', 0.8),
            'processing_time': result.get('processing_time', 0)
        })
    except Exception as e:
        logger.error(f"Claude query failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/gemini', methods=['POST'])
def query_gemini():
    """Query Gemini model for contextual understanding"""
    try:
        data = request.json
        result = ai_orchestrator.query_gemini(
            prompt=data.get('prompt'),
            temperature=data.get('temperature', 0.8),
            max_tokens=data.get('max_tokens', 1000),
            context=data.get('context', {})
        )
        return jsonify({
            'status': 'success',
            'response': result['response'],
            'confidence': result.get('confidence', 0.8),
            'processing_time': result.get('processing_time', 0)
        })
    except Exception as e:
        logger.error(f"Gemini query failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/local', methods=['POST'])
def query_local():
    """Query local AI model for fast processing"""
    try:
        data = request.json
        result = ai_orchestrator.query_local_model(
            prompt=data.get('prompt'),
            context=data.get('context', {})
        )
        return jsonify({
            'status': 'success',
            'response': result['response'],
            'confidence': result.get('confidence', 0.7),
            'processing_time': result.get('processing_time', 0)
        })
    except Exception as e:
        logger.error(f"Local model query failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/generate-image', methods=['POST'])
def generate_image():
    """Generate images using AI models"""
    try:
        data = request.json
        result = visual_ai_service.generate_image(
            prompt=data.get('prompt'),
            model=data.get('model', 'stable-diffusion'),
            style=data.get('style', 'photorealistic'),
            aspect_ratio=data.get('aspect_ratio', '16:9'),
            quality=data.get('quality', 'high')
        )
        return jsonify({
            'status': 'success',
            'image_url': result['image_url'],
            'detected_style': result.get('detected_style'),
            'confidence': result.get('confidence', 0.8),
            'processing_time': result.get('processing_time', 0)
        })
    except Exception as e:
        logger.error(f"Image generation failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/analyze-image', methods=['POST'])
def analyze_image():
    """Analyze images using AI vision models"""
    try:
        data = request.json
        result = visual_ai_service.analyze_image(
            image_url=data.get('image_url'),
            prompt=data.get('prompt'),
            model=data.get('model', 'gpt-4-vision'),
            analysis_type=data.get('analysis_type', 'general')
        )
        return jsonify({
            'status': 'success',
            'analysis': result['analysis'],
            'confidence': result.get('confidence', 0.8),
            'detected_elements': result.get('detected_elements', []),
            'recommendations': result.get('recommendations', []),
            'overall_score': result.get('overall_score', 0)
        })
    except Exception as e:
        logger.error(f"Image analysis failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/train-user-model', methods=['POST'])
def train_user_model():
    """Train user-specific AI model for any user type"""
    try:
        data = request.json
        result = learning_service.train_user_model(
            user_id=data.get('user_id'),
            user_type=data.get('user_type', 'user'),
            training_data=data.get('training_data'),
            model_type=data.get('model_type', 'personalized')
        )
        return jsonify({
            'status': 'success',
            'model_id': result['model_id'],
            'training_metrics': result.get('training_metrics', {}),
            'accuracy': result.get('accuracy', 0),
            'training_time': result.get('training_time', 0),
            'model_version': result.get('model_version', '1.0')
        })
    except Exception as e:
        logger.error(f"Model training failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Backward compatibility endpoint
@app.route('/ai/train-vendor-model', methods=['POST'])
def train_vendor_model():
    """Train vendor-specific AI model (backward compatibility)"""
    try:
        data = request.json
        result = learning_service.train_user_model(
            user_id=data.get('vendor_id'),
            user_type='vendor',
            training_data=data.get('training_data'),
            model_type=data.get('model_type', 'personalized')
        )
        return jsonify({
            'status': 'success',
            'model_id': result['model_id'],
            'training_metrics': result.get('training_metrics', {}),
            'accuracy': result.get('accuracy', 0),
            'training_time': result.get('training_time', 0),
            'model_version': result.get('model_version', '1.0')
        })
    except Exception as e:
        logger.error(f"Model training failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/model-metrics/<user_type>/<user_id>', methods=['GET'])
def get_user_model_metrics(user_type, user_id):
    """Get AI model performance metrics for any user type"""
    try:
        model_key = f"{user_type}_{user_id}"
        result = learning_service.get_model_metrics(model_key)
        return jsonify({
            'status': 'success',
            'metrics': result,
            'user_type': user_type,
            'user_id': user_id
        })
    except Exception as e:
        logger.error(f"Failed to get model metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Backward compatibility endpoint
@app.route('/ai/model-metrics/<vendor_id>', methods=['GET'])
def get_model_metrics(vendor_id):
    """Get AI model performance metrics (backward compatibility)"""
    try:
        model_key = f"vendor_{vendor_id}"
        result = learning_service.get_model_metrics(model_key)
        return jsonify({
            'status': 'success',
            'metrics': result
        })
    except Exception as e:
        logger.error(f"Failed to get model metrics: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/market-insights', methods=['POST'])
def generate_market_insights():
    """Generate market insights using AI"""
    try:
        data = request.json
        result = market_intelligence.generate_insights(
            location=data.get('location'),
            event_type=data.get('event_type'),
            timeframe=data.get('timeframe', 'monthly'),
            analysis_depth=data.get('analysis_depth', 'comprehensive')
        )
        return jsonify({
            'status': 'success',
            'insights': result['insights'],
            'trends': result.get('trends', {}),
            'predictions': result.get('predictions', []),
            'confidence': result.get('confidence', 0.8),
            'data_freshness': result.get('data_freshness', 'current')
        })
    except Exception as e:
        logger.error(f"Market insights generation failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/ai/comprehensive-analysis', methods=['POST'])
def comprehensive_ai_analysis():
    """
    Universal AI analysis orchestrating multiple AI services
    Supports all user types: vendors, planners, users, admins, and guests
    """
    start_time = time.time()
    
    try:
        data = request.json
        user_context = data.get('user_context', {})
        user_type = user_context.get('userType', 'guest')
        user_id = user_context.get('userId')
        plan_level = user_context.get('planLevel', 1)
        
        logger.info(f"Starting universal AI analysis for {user_type} (plan level {plan_level})")
        
        # Orchestrate comprehensive analysis using all AI services
        result = ai_orchestrator.comprehensive_analysis(
            event_data=data.get('event_data', {}),
            vendors=data.get('vendors', []),
            vendor_statistics=data.get('vendor_statistics', {}),
            vendor_id=user_id if user_type == 'vendor' else None,
            plan_level=plan_level,
            vendor_profile=user_context.get('profile', {}),
            user_context=user_context  # Pass full user context
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        # Update learning model for authenticated users
        if user_id and user_type != 'guest':
            learning_service.update_learning_model(
                user_id=user_id,
                user_type=user_type,
                interaction_data={
                    'event_data': data.get('event_data', {}),
                    'result': result,
                    'processing_time': processing_time,
                    'plan_level': plan_level
                }
            )
        
        response_data = {
            'status': 'success',
            'analysis': result,
            'user_context': {
                'userType': user_type,
                'planLevel': plan_level,
                'isAuthenticated': user_id is not None
            },
            'metadata': {
                'processing_time_ms': processing_time,
                'version': '2.0.0-universal',
                'models_used': result.get('metadata', {}).get('models_used', []),
                'confidence': result.get('overall_confidence', 0.8)
            }
        }
        
        response = jsonify(response_data)
        response.headers['X-Processing-Time'] = str(int(processing_time))
        return response
        
    except Exception as e:
        logger.error(f"Universal AI analysis failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'fallback_available': True,
            'user_type': data.get('user_context', {}).get('userType', 'guest')
        }), 500

@app.route('/health/ai', methods=['GET'])
def health_check():
    """Enhanced health check for all AI services"""
    try:
        start_time = time.time()
        
        # Check all services
        services_status = {
            'nlp': 'operational',
            'budget_optimizer': 'operational',
            'vendor_matcher': 'operational',
            'recommendation_engine': 'operational',
            'ai_orchestrator': ai_orchestrator.health_check(),
            'visual_ai': visual_ai_service.health_check(),
            'learning_service': learning_service.health_check(),
            'market_intelligence': market_intelligence.health_check()
        }
        
        # Check AI model availability
        models_status = ai_orchestrator.check_models_availability()
        
        response_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'status': 'healthy',
            'response_time': response_time,
            'version': '2.0.0',
            'uptime': time.time(),
            'services': services_status,
            'models': models_status,
            'capabilities': {
                'text_generation': True,
                'image_generation': True,
                'image_analysis': True,
                'model_training': True,
                'market_analysis': True,
                'learning': True
            },
            'performance': {
                'avg_response_time': response_time,
                'requests_per_minute': 0,  # Would be tracked in production
                'error_rate': 0.0
            }
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'version': '2.0.0'
        }), 503

if __name__ == '__main__':
    logger.info("Starting Enhanced AI Event Planner Python Service v2.0.0")
    app.run(debug=True, host='0.0.0.0', port=5600) 