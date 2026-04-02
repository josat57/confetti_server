import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime
import calendar

class PricePredictor:
    """
    Predict vendor pricing based on multiple factors
    Uses historical data and market trends
    """
    
    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.is_trained = False
        
        # Base pricing by category (NGN)
        self.base_prices = {
            'venue': {'min': 50000, 'avg': 200000, 'max': 1000000},
            'catering': {'min': 3000, 'avg': 8000, 'max': 25000},  # per person
            'photography': {'min': 50000, 'avg': 150000, 'max': 500000},
            'videography': {'min': 80000, 'avg': 200000, 'max': 600000},
            'decoration': {'min': 30000, 'avg': 150000, 'max': 500000},
            'entertainment': {'min': 50000, 'avg': 200000, 'max': 800000},
            'planning': {'min': 100000, 'avg': 300000, 'max': 1000000}
        }
        
        # Seasonal multipliers
        self.seasonal_multipliers = {
            'peak': 1.3,      # Dec, June, July
            'high': 1.15,     # May, Aug, Nov
            'normal': 1.0,    # Jan, Feb, Mar, Apr, Sep, Oct
        }
        
        # Location multipliers (relative to average)
        self.location_multipliers = {
            'lagos': 1.4,
            'abuja': 1.3,
            'port harcourt': 1.2,
            'ibadan': 1.0,
            'kano': 0.95,
            'default': 1.0
        }

    def fit(self, X, y):
        """Train the model with historical pricing data"""
        self.model.fit(X, y)
        self.is_trained = True

    def predict(self, X):
        """Make predictions using trained model"""
        if self.is_trained:
            return self.model.predict(X)
        return None

    def predict_category_price(self, category, event_params):
        """
        Predict price for a specific vendor category
        
        Args:
            category: str - vendor category
            event_params: dict with:
                - guest_count: int
                - event_type: str
                - location: dict
                - event_date: str
                - formality: str
        
        Returns:
            dict with price estimates
        """
        if category not in self.base_prices:
            category = 'venue'  # Default
        
        base = self.base_prices[category]
        guest_count = event_params.get('guest_count', 100)
        event_type = event_params.get('event_type', 'other').lower()
        location = event_params.get('location', {})
        event_date = event_params.get('event_date')
        formality = event_params.get('formality', 'casual').lower()
        
        # Start with base average
        estimated_price = base['avg']
        
        # Adjust for per-person categories
        if category in ['catering']:
            estimated_price = base['avg'] * guest_count
        
        # Event type multiplier
        event_multipliers = {
            'wedding': 1.3,
            'corporate': 1.2,
            'conference': 1.15,
            'birthday': 1.0,
            'graduation': 0.95,
            'other': 1.0
        }
        estimated_price *= event_multipliers.get(event_type, 1.0)
        
        # Formality multiplier
        formality_multipliers = {
            'formal': 1.25,
            'black-tie': 1.4,
            'semi-formal': 1.1,
            'casual': 1.0
        }
        estimated_price *= formality_multipliers.get(formality, 1.0)
        
        # Location multiplier
        city = location.get('city', '').lower()
        location_mult = self.location_multipliers.get(city, self.location_multipliers['default'])
        estimated_price *= location_mult
        
        # Seasonal multiplier
        if event_date:
            season = self._get_season(event_date)
            estimated_price *= self.seasonal_multipliers.get(season, 1.0)
        
        # Guest count scaling (for non-per-person categories)
        if category not in ['catering']:
            if guest_count > 200:
                estimated_price *= 1.3
            elif guest_count > 100:
                estimated_price *= 1.15
            elif guest_count < 50:
                estimated_price *= 0.85
        
        # Calculate range
        min_price = estimated_price * 0.7
        max_price = estimated_price * 1.4
        
        return {
            'category': category,
            'estimated_price': round(estimated_price),
            'price_range': {
                'min': round(min_price),
                'max': round(max_price)
            },
            'confidence': 0.75,  # Medium confidence without historical data
            'factors': {
                'base_price': base['avg'],
                'event_type_impact': event_multipliers.get(event_type, 1.0),
                'location_impact': location_mult,
                'formality_impact': formality_multipliers.get(formality, 1.0),
                'seasonal_impact': self.seasonal_multipliers.get(self._get_season(event_date), 1.0) if event_date else 1.0
            }
        }

    def predict_total_event_cost(self, event_params, required_categories=None):
        """
        Predict total cost for an event across all categories
        
        Args:
            event_params: dict with event details
            required_categories: list of categories needed (optional)
        
        Returns:
            dict with total cost breakdown
        """
        if required_categories is None:
            # Default categories for most events
            required_categories = ['venue', 'catering', 'photography', 'decoration']
        
        category_predictions = {}
        total_cost = 0
        
        for category in required_categories:
            prediction = self.predict_category_price(category, event_params)
            category_predictions[category] = prediction
            total_cost += prediction['estimated_price']
        
        # Add contingency (10%)
        contingency = total_cost * 0.1
        
        return {
            'total_estimated_cost': round(total_cost),
            'with_contingency': round(total_cost + contingency),
            'contingency_amount': round(contingency),
            'category_breakdown': category_predictions,
            'cost_per_guest': round(total_cost / event_params.get('guest_count', 1)),
            'confidence': 0.75
        }

    def compare_with_budget(self, predicted_cost, budget):
        """
        Compare predicted cost with user budget
        
        Returns:
            dict with comparison and recommendations
        """
        difference = budget - predicted_cost
        percentage_diff = (difference / predicted_cost) * 100 if predicted_cost > 0 else 0
        
        if percentage_diff >= 20:
            status = 'comfortable'
            message = 'Your budget is comfortable for this event'
        elif percentage_diff >= 0:
            status = 'adequate'
            message = 'Your budget is adequate but tight'
        elif percentage_diff >= -20:
            status = 'tight'
            message = 'Your budget is slightly below estimated cost'
        else:
            status = 'insufficient'
            message = 'Your budget may be insufficient for all requirements'
        
        return {
            'status': status,
            'message': message,
            'budget': budget,
            'predicted_cost': predicted_cost,
            'difference': round(difference),
            'percentage_difference': round(percentage_diff, 1),
            'recommendations': self._get_budget_recommendations(status, difference)
        }

    def _get_season(self, date_str):
        """Determine season from date"""
        try:
            if isinstance(date_str, str):
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                date = date_str
            
            month = date.month
            
            # Peak season: December, June, July
            if month in [12, 6, 7]:
                return 'peak'
            # High season: May, August, November
            elif month in [5, 8, 11]:
                return 'high'
            # Normal season: rest of the year
            else:
                return 'normal'
        except:
            return 'normal'

    def _get_budget_recommendations(self, status, difference):
        """Get recommendations based on budget status"""
        recommendations = []
        
        if status == 'comfortable':
            recommendations.append('Consider upgrading key categories for enhanced experience')
            recommendations.append('Allocate extra budget to photography and videography')
        elif status == 'adequate':
            recommendations.append('Prioritize essential categories')
            recommendations.append('Compare multiple vendor quotes')
        elif status == 'tight':
            recommendations.append('Consider reducing guest count by 10-20%')
            recommendations.append('Look for package deals from vendors')
            recommendations.append('Choose off-peak dates for better pricing')
        else:  # insufficient
            recommendations.append(f'Consider increasing budget by {abs(round(difference))} NGN')
            recommendations.append('Reduce guest count significantly')
            recommendations.append('Focus on 2-3 essential categories only')
            recommendations.append('Explore DIY options for decorations')
        
        return recommendations

    def predict_price(self, features):
        """Legacy method for backward compatibility"""
        X = np.array(features).reshape(1, -1)
        if self.is_trained:
            predicted_price = self.predict(X)
            return predicted_price
        return None 