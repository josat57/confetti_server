import numpy as np
from sklearn.linear_model import LinearRegression

class BudgetOptimizer:
    def __init__(self):
        self.model = LinearRegression()
        
        # Budget allocation templates by event type
        self.templates = {
            'wedding': {
                'venue': 0.30,
                'catering': 0.35,
                'photography': 0.10,
                'videography': 0.05,
                'decoration': 0.08,
                'florals': 0.04,
                'entertainment': 0.05,
                'transportation': 0.03
            },
            'corporate': {
                'venue': 0.35,
                'catering': 0.30,
                'audio_visual': 0.15,
                'event_planning': 0.10,
                'transportation': 0.05,
                'security': 0.05
            },
            'birthday': {
                'venue': 0.25,
                'catering': 0.40,
                'entertainment': 0.15,
                'decoration': 0.10,
                'photography': 0.05,
                'cake_desserts': 0.05
            },
            'graduation': {
                'venue': 0.30,
                'catering': 0.35,
                'photography': 0.10,
                'decoration': 0.10,
                'entertainment': 0.10,
                'favors_gifts': 0.05
            },
            'conference': {
                'venue': 0.35,
                'catering': 0.25,
                'audio_visual': 0.20,
                'event_planning': 0.10,
                'transportation': 0.05,
                'security': 0.05
            }
        }

    def optimize(self, budget, preferences):
        """
        Optimize budget allocation for event planning
        """
        event_type = preferences.get('event_type', 'other')
        guest_count = preferences.get('guest_count', 100)
        formality = preferences.get('formality', 'casual')
        
        # Get base template
        template = self.templates.get(event_type, self.templates['birthday'])
        
        # Calculate allocations
        allocations = []
        for category, percentage in template.items():
            allocations.append({
                'category': category,
                'percentage': percentage * 100,
                'amount': budget * percentage,
                'priority': self._get_priority(category, event_type)
            })
        
        # Calculate feasibility score
        min_budget_per_person = self._get_min_budget_per_person(event_type)
        budget_per_person = budget / guest_count if guest_count > 0 else 0
        feasibility_score = min(100, (budget_per_person / min_budget_per_person) * 100) if min_budget_per_person > 0 else 75
        
        return {
            'allocations': allocations,
            'feasibility_score': int(feasibility_score),
            'total_allocated': budget * 0.92,  # 8% contingency
            'contingency': budget * 0.08,
            'recommendations': self._generate_budget_recommendations(feasibility_score, budget, guest_count)
        }
    
    def _get_priority(self, category, event_type):
        """Determine priority level for category"""
        essential = ['venue', 'catering', 'photography', 'audio_visual']
        if category in essential:
            return 'essential'
        elif category in ['decoration', 'entertainment', 'event_planning']:
            return 'recommended'
        else:
            return 'optional'
    
    def _get_min_budget_per_person(self, event_type):
        """Get minimum budget per person for event type"""
        minimums = {
            'wedding': 15000,
            'corporate': 10000,
            'birthday': 5000,
            'graduation': 4000,
            'conference': 12000
        }
        return minimums.get(event_type, 5000)
    
    def _generate_budget_recommendations(self, feasibility_score, budget, guest_count):
        """Generate budget-specific recommendations"""
        recommendations = []
        
        if feasibility_score < 60:
            recommendations.append('Consider reducing guest count or increasing budget')
            recommendations.append('Focus on essential categories only')
        elif feasibility_score < 75:
            recommendations.append('Budget is adequate but tight - prioritize carefully')
            recommendations.append('Look for package deals from vendors')
        else:
            recommendations.append('Budget is good - you have flexibility in vendor selection')
            recommendations.append('Consider premium options for key categories')
        
        return recommendations

    def fit(self, X, y):
        self.model.fit(X, y)

    def predict(self, X):
        return self.model.predict(X)

    def optimize_budget(self, budget, preferences, constraints):
        # Legacy method for backward compatibility
        X = np.array(preferences).reshape(-1, 1)
        y = np.array(constraints).reshape(-1, 1)
        self.fit(X, y)
        optimized_budget = self.predict(np.array(budget).reshape(-1, 1))
        return optimized_budget 