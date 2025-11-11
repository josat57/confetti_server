import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

class VendorMatcher:
    def __init__(self):
        self.vendors = []

    def match(self, requirements):
        """
        Match vendors based on event requirements
        """
        event_type = requirements.get('event_type', 'other')
        budget = requirements.get('budget', 0)
        guest_count = requirements.get('guest_count', 0)
        vendors = requirements.get('vendors', [])
        
        # Score each vendor
        scored_vendors = []
        for vendor in vendors:
            score = self._calculate_match_score(vendor, event_type, budget, guest_count)
            scored_vendors.append({
                'vendor_id': vendor.get('id'),
                'category': vendor.get('category'),
                'match_score': score,
                'reasons': self._get_match_reasons(vendor, event_type, score)
            })
        
        # Group by category
        category_matches = {}
        for scored in scored_vendors:
            category = scored['category']
            if category not in category_matches:
                category_matches[category] = []
            category_matches[category].append(scored)
        
        # Sort each category by score
        for category in category_matches:
            category_matches[category] = sorted(
                category_matches[category],
                key=lambda x: x['match_score'],
                reverse=True
            )[:5]  # Top 5 per category
        
        return {
            'total_matches': len(scored_vendors),
            'category_matches': category_matches,
            'top_vendors': sorted(scored_vendors, key=lambda x: x['match_score'], reverse=True)[:10]
        }
    
    def _calculate_match_score(self, vendor, event_type, budget, guest_count):
        """Calculate match score for a vendor"""
        score = 50  # Base score
        
        # Event type compatibility
        if event_type in vendor.get('eventTypes', []):
            score += 20
        
        # Rating boost
        rating = vendor.get('rating', 0)
        score += (rating / 5.0) * 15
        
        # Availability boost
        availability = vendor.get('availabilityStatus', 'medium')
        if availability == 'high':
            score += 10
        elif availability == 'low':
            score -= 5
        
        # Capacity check
        capacity = vendor.get('capacity', 0)
        if capacity > 0 and guest_count > 0:
            if capacity >= guest_count:
                score += 5
            else:
                score -= 10
        
        return min(100, max(0, score))
    
    def _get_match_reasons(self, vendor, event_type, score):
        """Generate reasons for match"""
        reasons = []
        
        if event_type in vendor.get('eventTypes', []):
            reasons.append(f"Specializes in {event_type} events")
        
        rating = vendor.get('rating', 0)
        if rating >= 4.5:
            reasons.append(f"Highly rated ({rating}/5.0)")
        
        if vendor.get('availabilityStatus') == 'high':
            reasons.append("High availability")
        
        if score >= 80:
            reasons.append("Excellent match for your event")
        
        return reasons

    def add_vendor(self, vendor_features):
        self.vendors.append(vendor_features)

    def match_vendors(self, event_features, top_n=5):
        # Legacy method for backward compatibility
        event_features = np.array(event_features).reshape(1, -1)
        vendor_features = np.array(self.vendors)
        similarities = cosine_similarity(event_features, vendor_features)
        top_indices = similarities.argsort()[0][-top_n:][::-1]
        return [self.vendors[i] for i in top_indices] 