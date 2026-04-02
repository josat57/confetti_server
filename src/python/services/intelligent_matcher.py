"""
Intelligent Vendor Matcher with Learning Capabilities
Combines multiple signals for better vendor recommendations
"""

import numpy as np
from collections import defaultdict
import json
from datetime import datetime

class IntelligentVendorMatcher:
    """
    Advanced vendor matching that learns from:
    - Historical bookings
    - User preferences
    - Vendor performance
    - Market trends
    """
    
    def __init__(self):
        self.booking_history = defaultdict(list)  # vendor_id: [event_outcomes]
        self.user_preferences = defaultdict(dict)  # user_id: preferences
        self.vendor_performance = defaultdict(lambda: {
            'success_rate': 0.75,  # Default
            'avg_rating': 4.0,
            'response_time': 24,  # hours
            'reliability_score': 0.8
        })
        
    def match_vendors(self, event_requirements, vendors, user_history=None):
        """
        Intelligent vendor matching with multiple scoring factors
        
        Args:
            event_requirements: {
                'event_type': str,
                'budget': float,
                'guest_count': int,
                'location': dict,
                'preferences': list,
                'date': str
            }
            vendors: list of vendor objects
            user_history: optional user booking history
            
        Returns:
            {
                'matches': [scored vendors],
                'insights': [AI insights],
                'confidence': float
            }
        """
        scored_vendors = []
        
        for vendor in vendors:
            score_breakdown = self._calculate_comprehensive_score(
                vendor,
                event_requirements,
                user_history
            )
            
            scored_vendors.append({
                'vendor_id': vendor.get('_id'),
                'business_name': vendor.get('businessName'),
                'category': vendor.get('category'),
                'overall_score': score_breakdown['total'],
                'score_breakdown': score_breakdown,
                'match_reasons': self._generate_match_reasons(vendor, score_breakdown),
                'confidence': score_breakdown['confidence'],
                'estimated_price': self._estimate_price(vendor, event_requirements)
            })
        
        # Sort by score
        scored_vendors.sort(key=lambda x: x['overall_score'], reverse=True)
        
        # Group by category
        category_matches = self._group_by_category(scored_vendors)
        
        # Generate insights
        insights = self._generate_insights(
            scored_vendors,
            event_requirements,
            vendors
        )
        
        return {
            'matches': scored_vendors[:20],  # Top 20
            'category_matches': category_matches,
            'insights': insights,
            'total_analyzed': len(vendors),
            'avg_confidence': np.mean([v['confidence'] for v in scored_vendors])
        }
    
    def _calculate_comprehensive_score(self, vendor, requirements, user_history):
        """
        Calculate multi-factor score
        """
        scores = {}
        weights = {}
        
        # 1. Event Type Match (20%)
        scores['event_type'] = self._score_event_type_match(
            vendor.get('services', []),
            requirements['event_type']
        )
        weights['event_type'] = 0.20
        
        # 2. Rating & Reviews (15%)
        scores['rating'] = self._score_rating(
            vendor.get('rating', 0),
            vendor.get('totalReviews', 0)
        )
        weights['rating'] = 0.15
        
        # 3. Availability (15%)
        scores['availability'] = self._score_availability(
            vendor.get('availabilityStatus', 'medium'),
            requirements.get('date')
        )
        weights['availability'] = 0.15
        
        # 4. Location Proximity (10%)
        scores['location'] = self._score_location(
            vendor.get('businessInfo', {}).get('address', {}),
            requirements['location']
        )
        weights['location'] = 0.10
        
        # 5. Price Competitiveness (15%)
        scores['price'] = self._score_price_fit(
            vendor.get('services', []),
            requirements['budget'],
            requirements['guest_count']
        )
        weights['price'] = 0.15
        
        # 6. Historical Performance (10%)
        scores['performance'] = self._score_historical_performance(
            vendor.get('_id')
        )
        weights['performance'] = 0.10
        
        # 7. User Preference Match (10%)
        scores['preference'] = self._score_user_preference(
            vendor,
            requirements.get('preferences', []),
            user_history
        )
        weights['preference'] = 0.10
        
        # 8. Capacity Match (5%)
        scores['capacity'] = self._score_capacity(
            vendor.get('capacity', 0),
            requirements['guest_count']
        )
        weights['capacity'] = 0.05
        
        # Calculate weighted total
        total_score = sum(scores[k] * weights[k] for k in scores.keys())
        
        # Calculate confidence based on data availability
        confidence = self._calculate_confidence(vendor, scores)
        
        return {
            'total': round(total_score, 2),
            'confidence': round(confidence, 2),
            **scores
        }
    
    def _score_event_type_match(self, services, event_type):
        """Score how well vendor matches event type"""
        if not services:
            return 50
        
        event_type_lower = event_type.lower()
        
        for service in services:
            category = service.get('category', '').lower()
            # Direct match
            if event_type_lower in category or category in event_type_lower:
                return 100
            # Partial match
            if any(word in category for word in event_type_lower.split()):
                return 80
        
        return 40
    
    def _score_rating(self, rating, review_count):
        """Score based on rating and review count"""
        if rating == 0:
            return 50  # Neutral for new vendors
        
        # Base score from rating
        base_score = (rating / 5.0) * 100
        
        # Confidence boost from review count
        confidence_multiplier = min(1.0, review_count / 50)  # Max at 50 reviews
        
        return base_score * (0.7 + 0.3 * confidence_multiplier)
    
    def _score_availability(self, status, event_date):
        """Score availability"""
        availability_scores = {
            'high': 100,
            'medium': 70,
            'low': 40,
            'booked': 0
        }
        return availability_scores.get(status, 70)
    
    def _score_location(self, vendor_address, event_location):
        """Score location proximity"""
        vendor_city = vendor_address.get('city', '').lower()
        event_city = event_location.get('city', '').lower()
        
        if vendor_city == event_city:
            return 100
        
        vendor_state = vendor_address.get('state', '').lower()
        event_state = event_location.get('state', '').lower()
        
        if vendor_state == event_state:
            return 70
        
        return 40
    
    def _score_price_fit(self, services, budget, guest_count):
        """Score how well vendor pricing fits budget"""
        if not services or budget == 0:
            return 50
        
        # Estimate vendor cost
        estimated_cost = 0
        for service in services:
            pricing = service.get('pricing', {})
            base_price = pricing.get('basePrice', 0)
            per_person = pricing.get('perPerson', 0)
            estimated_cost += base_price + (per_person * guest_count)
        
        if estimated_cost == 0:
            return 50
        
        # Calculate fit
        ratio = estimated_cost / budget
        
        if 0.7 <= ratio <= 1.0:  # Perfect fit
            return 100
        elif 0.5 <= ratio < 0.7:  # Under budget
            return 90
        elif 1.0 < ratio <= 1.2:  # Slightly over
            return 80
        elif ratio < 0.5:  # Way under (might be low quality)
            return 60
        else:  # Way over budget
            return 30
    
    def _score_historical_performance(self, vendor_id):
        """Score based on historical performance"""
        if vendor_id not in self.vendor_performance:
            return 75  # Neutral for new vendors
        
        perf = self.vendor_performance[vendor_id]
        
        # Weighted performance score
        score = (
            perf['success_rate'] * 40 +
            (perf['avg_rating'] / 5.0) * 30 +
            perf['reliability_score'] * 30
        )
        
        return score
    
    def _score_user_preference(self, vendor, preferences, user_history):
        """Score based on user preferences"""
        if not preferences:
            return 75
        
        score = 75  # Base score
        
        # Check if vendor matches stated preferences
        vendor_tags = set()
        for service in vendor.get('services', []):
            vendor_tags.add(service.get('category', '').lower())
            vendor_tags.update(service.get('tags', []))
        
        preference_matches = sum(
            1 for pref in preferences
            if pref.lower() in vendor_tags
        )
        
        if preferences:
            match_ratio = preference_matches / len(preferences)
            score = 50 + (match_ratio * 50)
        
        return score
    
    def _score_capacity(self, vendor_capacity, guest_count):
        """Score capacity match"""
        if vendor_capacity == 0:
            return 75  # Unknown capacity
        
        if vendor_capacity >= guest_count:
            # Perfect if capacity is 1-2x guest count
            ratio = vendor_capacity / guest_count
            if 1.0 <= ratio <= 2.0:
                return 100
            elif ratio > 2.0:
                return 90  # Might be too large
            else:
                return 80
        else:
            # Under capacity
            return 30
    
    def _calculate_confidence(self, vendor, scores):
        """Calculate confidence in the match"""
        confidence = 100
        
        # Reduce confidence for missing data
        if vendor.get('rating', 0) == 0:
            confidence -= 15
        if vendor.get('totalReviews', 0) < 5:
            confidence -= 10
        if not vendor.get('services'):
            confidence -= 20
        if vendor.get('capacity', 0) == 0:
            confidence -= 5
        
        return max(50, confidence)
    
    def _generate_match_reasons(self, vendor, score_breakdown):
        """Generate human-readable match reasons"""
        reasons = []
        
        if score_breakdown['event_type'] >= 80:
            reasons.append("Specializes in this event type")
        
        if score_breakdown['rating'] >= 85:
            rating = vendor.get('rating', 0)
            reasons.append(f"Highly rated ({rating}/5.0)")
        
        if score_breakdown['availability'] >= 90:
            reasons.append("High availability")
        
        if score_breakdown['location'] >= 90:
            reasons.append("Located in your area")
        
        if score_breakdown['price'] >= 85:
            reasons.append("Good value for your budget")
        
        if score_breakdown['performance'] >= 85:
            reasons.append("Proven track record")
        
        if not reasons:
            reasons.append("Good overall match for your event")
        
        return reasons
    
    def _estimate_price(self, vendor, requirements):
        """Estimate price for this vendor"""
        total = 0
        
        for service in vendor.get('services', []):
            pricing = service.get('pricing', {})
            base = pricing.get('basePrice', 0)
            per_person = pricing.get('perPerson', 0)
            total += base + (per_person * requirements['guest_count'])
        
        if total == 0:
            # Rough estimate based on category
            return {
                'estimated': 'Contact for quote',
                'range': None
            }
        
        return {
            'estimated': round(total),
            'range': {
                'min': round(total * 0.9),
                'max': round(total * 1.1)
            }
        }
    
    def _group_by_category(self, scored_vendors):
        """Group vendors by category"""
        categories = defaultdict(list)
        
        for vendor in scored_vendors:
            category = vendor['category']
            categories[category].append(vendor)
        
        # Keep top 5 per category
        for category in categories:
            categories[category] = categories[category][:5]
        
        return dict(categories)
    
    def _generate_insights(self, scored_vendors, requirements, all_vendors):
        """Generate AI insights"""
        insights = []
        
        # Availability insight
        high_avail = sum(1 for v in scored_vendors if v['score_breakdown']['availability'] >= 90)
        if high_avail < 5:
            insights.append({
                'type': 'warning',
                'message': 'Limited vendor availability for your date. Book early to secure your choices.',
                'priority': 'high'
            })
        
        # Budget insight
        avg_price_score = np.mean([v['score_breakdown']['price'] for v in scored_vendors[:10]])
        if avg_price_score < 60:
            insights.append({
                'type': 'info',
                'message': 'Your budget may be tight for top vendors. Consider increasing budget or adjusting requirements.',
                'priority': 'medium'
            })
        
        # Quality insight
        high_rated = sum(1 for v in scored_vendors[:10] if v['score_breakdown']['rating'] >= 85)
        if high_rated >= 7:
            insights.append({
                'type': 'success',
                'message': f'Great news! {high_rated} highly-rated vendors match your requirements.',
                'priority': 'low'
            })
        
        # Location insight
        local_vendors = sum(1 for v in scored_vendors if v['score_breakdown']['location'] >= 90)
        if local_vendors < 5:
            insights.append({
                'type': 'info',
                'message': 'Consider expanding search to nearby areas for more options.',
                'priority': 'low'
            })
        
        return insights
    
    def learn_from_booking(self, vendor_id, event_outcome):
        """
        Learn from completed event
        
        Args:
            vendor_id: str
            event_outcome: {
                'success': bool,
                'rating': float,
                'on_time': bool,
                'quality': float,
                'would_recommend': bool
            }
        """
        if vendor_id not in self.vendor_performance:
            self.vendor_performance[vendor_id] = {
                'success_rate': 0.75,
                'avg_rating': 4.0,
                'response_time': 24,
                'reliability_score': 0.8,
                'total_bookings': 0
            }
        
        perf = self.vendor_performance[vendor_id]
        n = perf['total_bookings']
        
        # Update with exponential moving average
        alpha = 0.3  # Learning rate
        
        if event_outcome.get('success'):
            perf['success_rate'] = perf['success_rate'] * (1 - alpha) + alpha
        else:
            perf['success_rate'] = perf['success_rate'] * (1 - alpha)
        
        if 'rating' in event_outcome:
            perf['avg_rating'] = (
                perf['avg_rating'] * (1 - alpha) +
                event_outcome['rating'] * alpha
            )
        
        if 'on_time' in event_outcome:
            reliability = 1.0 if event_outcome['on_time'] else 0.0
            perf['reliability_score'] = (
                perf['reliability_score'] * (1 - alpha) +
                reliability * alpha
            )
        
        perf['total_bookings'] += 1
        
        # Store in booking history
        self.booking_history[vendor_id].append({
            'timestamp': datetime.now().isoformat(),
            'outcome': event_outcome
        })
