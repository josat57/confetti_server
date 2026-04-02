import numpy as np
from datetime import datetime, timedelta
import random

class EventSimulator:
    """
    Simulate event outcomes based on planning parameters
    Helps predict success probability and identify risks
    """
    
    def __init__(self):
        self.simulation_results = []
        
        # Risk factors and their weights
        self.risk_factors = {
            'budget_adequacy': 0.25,
            'vendor_quality': 0.20,
            'planning_time': 0.15,
            'venue_suitability': 0.15,
            'weather_risk': 0.10,
            'vendor_availability': 0.10,
            'complexity': 0.05
        }

    def simulate_event(self, event_plan):
        """
        Simulate event outcome based on plan parameters
        
        Args:
            event_plan: dict with:
                - budget: dict
                - vendors: list
                - event_date: str
                - location: dict
                - guest_count: int
                - event_type: str
                - venue_type: str (indoor/outdoor)
        
        Returns:
            dict with simulation results
        """
        # Calculate risk scores
        risk_scores = self._calculate_risk_scores(event_plan)
        
        # Calculate overall success probability
        success_probability = self._calculate_success_probability(risk_scores)
        
        # Identify critical risks
        critical_risks = self._identify_critical_risks(risk_scores)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(risk_scores, critical_risks)
        
        # Simulate outcome
        outcome = 'success' if random.random() < success_probability else 'needs_attention'
        
        result = {
            'outcome': outcome,
            'success_probability': round(success_probability, 3),
            'risk_scores': risk_scores,
            'critical_risks': critical_risks,
            'recommendations': recommendations,
            'confidence': self._calculate_confidence(event_plan)
        }
        
        self.simulation_results.append(result)
        return result

    def _calculate_risk_scores(self, event_plan):
        """Calculate individual risk scores"""
        scores = {}
        
        # 1. Budget Adequacy Risk
        budget = event_plan.get('budget', {})
        budget_amount = budget.get('amount', 0)
        guest_count = event_plan.get('guest_count', 0)
        
        if guest_count > 0:
            budget_per_guest = budget_amount / guest_count
            # Ideal: 8000-15000 NGN per guest
            if budget_per_guest >= 12000:
                scores['budget_adequacy'] = 0.9  # Low risk
            elif budget_per_guest >= 8000:
                scores['budget_adequacy'] = 0.7
            elif budget_per_guest >= 5000:
                scores['budget_adequacy'] = 0.5
            else:
                scores['budget_adequacy'] = 0.3  # High risk
        else:
            scores['budget_adequacy'] = 0.5
        
        # 2. Vendor Quality Risk
        vendors = event_plan.get('vendors', [])
        if vendors:
            avg_rating = np.mean([v.get('rating', 3.5) for v in vendors])
            scores['vendor_quality'] = min(1.0, avg_rating / 5.0)
        else:
            scores['vendor_quality'] = 0.5  # Unknown
        
        # 3. Planning Time Risk
        event_date = event_plan.get('event_date')
        if event_date:
            days_until_event = self._days_until_event(event_date)
            event_type = event_plan.get('event_type', '').lower()
            
            # Required planning time by event type
            required_days = {
                'wedding': 180,
                'corporate': 90,
                'conference': 120,
                'birthday': 60,
                'other': 60
            }
            
            required = required_days.get(event_type, 60)
            
            if days_until_event >= required:
                scores['planning_time'] = 0.9
            elif days_until_event >= required * 0.7:
                scores['planning_time'] = 0.7
            elif days_until_event >= required * 0.5:
                scores['planning_time'] = 0.5
            else:
                scores['planning_time'] = 0.3  # Rushed
        else:
            scores['planning_time'] = 0.5
        
        # 4. Venue Suitability Risk
        venue_type = event_plan.get('venue_type', 'indoor')
        guest_count = event_plan.get('guest_count', 0)
        
        # Assume venue is suitable if not specified
        scores['venue_suitability'] = 0.8
        
        # 5. Weather Risk
        if venue_type == 'outdoor':
            # Check season
            if event_date:
                month = self._get_month(event_date)
                # Rainy season in Nigeria: April-October
                if 4 <= month <= 10:
                    scores['weather_risk'] = 0.4  # High risk
                else:
                    scores['weather_risk'] = 0.8  # Low risk
            else:
                scores['weather_risk'] = 0.6
        else:
            scores['weather_risk'] = 0.9  # Indoor = low weather risk
        
        # 6. Vendor Availability Risk
        if vendors:
            # Assume vendors are available if they're in the plan
            scores['vendor_availability'] = 0.8
        else:
            scores['vendor_availability'] = 0.3  # No vendors = high risk
        
        # 7. Event Complexity Risk
        complexity_score = self._calculate_complexity(event_plan)
        scores['complexity'] = 1.0 - (complexity_score / 100)  # Invert: high complexity = high risk
        
        return scores

    def _calculate_success_probability(self, risk_scores):
        """Calculate overall success probability from risk scores"""
        weighted_score = sum(
            risk_scores[factor] * weight
            for factor, weight in self.risk_factors.items()
            if factor in risk_scores
        )
        
        return weighted_score

    def _identify_critical_risks(self, risk_scores):
        """Identify risks that need attention"""
        critical = []
        
        for factor, score in risk_scores.items():
            if score < 0.5:
                severity = 'high' if score < 0.3 else 'medium'
                critical.append({
                    'factor': factor,
                    'score': round(score, 2),
                    'severity': severity,
                    'description': self._get_risk_description(factor, score)
                })
        
        return sorted(critical, key=lambda x: x['score'])

    def _get_risk_description(self, factor, score):
        """Get human-readable risk description"""
        descriptions = {
            'budget_adequacy': 'Budget may be insufficient for quality vendors and services',
            'vendor_quality': 'Vendor ratings are below recommended levels',
            'planning_time': 'Limited time for proper planning and vendor booking',
            'venue_suitability': 'Venue may not be suitable for guest count or event type',
            'weather_risk': 'High weather risk for outdoor event',
            'vendor_availability': 'Vendor availability is uncertain',
            'complexity': 'Event complexity may lead to coordination challenges'
        }
        
        return descriptions.get(factor, f'{factor} needs attention')

    def _generate_recommendations(self, risk_scores, critical_risks):
        """Generate actionable recommendations"""
        recommendations = []
        
        for risk in critical_risks:
            factor = risk['factor']
            
            if factor == 'budget_adequacy':
                recommendations.append('Consider increasing budget or reducing guest count')
                recommendations.append('Look for package deals to maximize value')
            elif factor == 'vendor_quality':
                recommendations.append('Research and compare multiple vendors')
                recommendations.append('Read reviews and check portfolios carefully')
            elif factor == 'planning_time':
                recommendations.append('Start booking vendors immediately')
                recommendations.append('Consider hiring a professional event planner')
            elif factor == 'weather_risk':
                recommendations.append('Arrange backup indoor venue')
                recommendations.append('Rent tents or covered areas')
            elif factor == 'vendor_availability':
                recommendations.append('Contact vendors ASAP to confirm availability')
                recommendations.append('Have backup vendor options ready')
        
        # General recommendations
        if not critical_risks:
            recommendations.append('Your event plan looks solid!')
            recommendations.append('Continue with vendor bookings and confirmations')
        
        return recommendations[:5]  # Top 5 recommendations

    def _calculate_complexity(self, event_plan):
        """Calculate event complexity score (0-100)"""
        complexity = 0
        
        guest_count = event_plan.get('guest_count', 0)
        if guest_count > 200:
            complexity += 30
        elif guest_count > 100:
            complexity += 20
        elif guest_count > 50:
            complexity += 10
        
        event_type = event_plan.get('event_type', '').lower()
        if event_type in ['wedding', 'conference']:
            complexity += 25
        elif event_type in ['corporate']:
            complexity += 15
        
        if event_plan.get('venue_type') == 'outdoor':
            complexity += 15
        
        vendor_count = len(event_plan.get('vendors', []))
        complexity += min(30, vendor_count * 3)
        
        return min(100, complexity)

    def _calculate_confidence(self, event_plan):
        """Calculate confidence in simulation"""
        confidence = 100
        
        if not event_plan.get('budget'):
            confidence -= 20
        if not event_plan.get('vendors'):
            confidence -= 15
        if not event_plan.get('event_date'):
            confidence -= 10
        if not event_plan.get('guest_count'):
            confidence -= 10
        
        return max(50, confidence) / 100

    def _days_until_event(self, event_date):
        """Calculate days until event"""
        try:
            if isinstance(event_date, str):
                event = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
            else:
                event = event_date
            
            today = datetime.now()
            delta = event - today
            return delta.days
        except:
            return 90  # Default

    def _get_month(self, date_str):
        """Get month from date string"""
        try:
            if isinstance(date_str, str):
                date = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                date = date_str
            return date.month
        except:
            return 6  # Default

    def get_simulation_results(self):
        """Get all simulation results"""
        return self.simulation_results

    def simulate(self, plan):
        """Legacy method for backward compatibility"""
        return self.simulate_event(plan) 