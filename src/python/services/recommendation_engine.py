import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class RecommendationEngine:
    def __init__(self):
        self.events = []

    def recommend(self, preferences):
        """
        Generate AI-powered recommendations for event planning
        """
        event_type = preferences.get('event_type', 'other')
        budget = preferences.get('budget', 0)
        guest_count = preferences.get('guest_count', 0)
        vendor_count = preferences.get('vendor_count', 0)
        feasibility_score = preferences.get('feasibility_score', 75)
        
        recommendations = {
            'budget_tips': self._get_budget_tips(feasibility_score, budget, guest_count),
            'vendor_tips': self._get_vendor_tips(vendor_count, event_type),
            'timeline_tips': self._get_timeline_tips(event_type),
            'general_tips': self._get_general_tips(event_type, guest_count)
        }
        
        return recommendations
    
    def _get_budget_tips(self, feasibility_score, budget, guest_count):
        """Generate budget-specific tips"""
        tips = []
        
        if feasibility_score < 60:
            tips.append('Your budget is tight - consider reducing guest count by 20-30%')
            tips.append('Focus spending on venue and catering as priorities')
            tips.append('Look for all-inclusive packages to save costs')
        elif feasibility_score < 75:
            tips.append('Allocate 8-10% of budget as contingency for unexpected costs')
            tips.append('Compare at least 3 vendors per category before booking')
        else:
            tips.append('You have budget flexibility - consider premium vendors for key categories')
            tips.append('Invest in professional photography and videography')
            tips.append('Consider adding luxury touches like valet parking or premium bar service')
        
        return tips
    
    def _get_vendor_tips(self, vendor_count, event_type):
        """Generate vendor selection tips"""
        tips = []
        
        if vendor_count < 20:
            tips.append('Limited vendors in your area - book early to secure availability')
            tips.append('Consider expanding search radius to nearby cities')
        else:
            tips.append('Good vendor selection available - take time to compare options')
            tips.append('Read reviews and check portfolios before making decisions')
        
        tips.append('Always have backup vendors in case of cancellations')
        tips.append('Get everything in writing with clear contracts')
        
        return tips
    
    def _get_timeline_tips(self, event_type):
        """Generate timeline tips"""
        tips = []
        
        if event_type == 'wedding':
            tips.append('Start planning at least 6-12 months in advance')
            tips.append('Book venue and photographer first as they fill up quickly')
        elif event_type == 'corporate':
            tips.append('Plan 3-4 months ahead for corporate events')
            tips.append('Confirm AV equipment and catering 2 weeks before')
        else:
            tips.append('Start planning 2-3 months in advance')
            tips.append('Send invitations at least 3 weeks before the event')
        
        tips.append('Create a detailed day-of timeline and share with all vendors')
        
        return tips
    
    def _get_general_tips(self, event_type, guest_count):
        """Generate general event planning tips"""
        tips = []
        
        tips.append('Visit venues in person before booking')
        tips.append('Taste test catering options before finalizing menu')
        tips.append('Have a rain plan for outdoor events')
        
        if guest_count > 200:
            tips.append('Consider hiring a professional event coordinator')
            tips.append('Plan for adequate parking and transportation')
        
        return tips

    def add_event(self, event_features):
        self.events.append(event_features)

    def recommend_events(self, user_preferences, top_n=5):
        # Legacy method for backward compatibility
        user_preferences = np.array(user_preferences).reshape(1, -1)
        event_features = np.array(self.events)
        similarities = cosine_similarity(user_preferences, event_features)
        top_indices = similarities.argsort()[0][-top_n:][::-1]
        return [self.events[i] for i in top_indices] 