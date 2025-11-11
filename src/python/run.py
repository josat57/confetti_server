from flask import Flask, request, jsonify
from flask_cors import CORS
from services.budget_optimizer import BudgetOptimizer
from services.price_predictor import PricePredictor
from services.vendor_matcher import VendorMatcher
from services.recommendation_engine import RecommendationEngine
from services.event_simulator import EventSimulator
from services.nlp_service import NLPService

app = Flask(__name__)
CORS(app)

# Initialize services
budget_optimizer = BudgetOptimizer()
price_predictor = PricePredictor()
vendor_matcher = VendorMatcher()
recommendation_engine = RecommendationEngine()
event_simulator = EventSimulator()
nlp_service = NLPService()

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
        
        # 1. NLP Analysis on event description
        event_description = event_data.get('eventDescription', '')
        nlp_analysis = {
            'sentiment': nlp_service.analyze_sentiment(event_description),
            'keywords': nlp_service.extract_keywords(event_description),
            'event_insights': f"Analysis for {event_data.get('eventType', 'event')} with {event_data.get('guestCount', 0)} guests"
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

@app.route('/health/ai', methods=['GET'])
def health_check():
    """Health check for AI services"""
    return jsonify({
        'status': 'healthy',
        'services': {
            'nlp': 'operational',
            'budget_optimizer': 'operational',
            'vendor_matcher': 'operational',
            'recommendation_engine': 'operational'
        },
        'version': '1.0.0'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5600) 