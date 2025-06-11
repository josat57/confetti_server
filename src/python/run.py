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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5600) 