from flask import Flask
from flask_cors import CORS
# from api.auth import auth_bp
# from api.analytics import analytics_bp
# from api.notifications import notifications_bp
# from api.payments import payments_bp
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

# Register blueprints
# app.register_blueprint(auth_bp, url_prefix='/api/auth')
# app.register_blueprint(analytics_bp, url_prefix='/api/analytics')
# app.register_blueprint(notifications_bp, url_prefix='/api/notifications')
# app.register_blueprint(payments_bp, url_prefix='/api/payments')

if __name__ == '__main__':
    app.run(debug=True, port=5600) 