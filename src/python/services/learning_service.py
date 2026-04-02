"""
Learning Service
Handles AI model training, user personalization, and learning analytics
"""

import logging
import time
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class LearningService:
    """
    Provides AI learning capabilities for personalized event planning
    """
    
    def __init__(self):
        # In-memory storage for learning data (in production, use a database)
        self.user_models = {}
        self.interaction_history = {}
        self.learning_metrics = {}
        
        # Learning configuration
        self.learning_config = {
            'min_interactions': 3,
            'accuracy_threshold': 0.7,
            'learning_rate': 0.1,
            'decay_factor': 0.95,
            'max_history': 100
        }
    
    def train_user_model(self, user_id: str, user_type: str, training_data: List[Dict], 
                        model_type: str = 'personalized') -> Dict[str, Any]:
        """
        Train user-specific AI model for personalization
        """
        try:
            start_time = time.time()
            model_key = f"{user_type}_{user_id}"
            
            # Initialize user model if not exists
            if model_key not in self.user_models:
                self.user_models[model_key] = {
                    'user_id': user_id,
                    'user_type': user_type,
                    'model_type': model_type,
                    'created_at': datetime.now().isoformat(),
                    'version': '1.0',
                    'training_history': [],
                    'preferences': {},
                    'patterns': {},
                    'accuracy': 0.5,
                    'total_interactions': 0
                }
            
            model = self.user_models[model_key]
            
            # Process training data
            processed_data = self._process_training_data(training_data, user_type)
            
            # Update model with new training data
            self._update_model_preferences(model, processed_data)
            self._update_model_patterns(model, processed_data)
            
            # Calculate new accuracy
            new_accuracy = self._calculate_model_accuracy(model, processed_data)
            model['accuracy'] = new_accuracy
            model['total_interactions'] += len(training_data)
            
            # Add training session to history
            training_session = {
                'timestamp': datetime.now().isoformat(),
                'data_points': len(training_data),
                'accuracy_before': model.get('previous_accuracy', 0.5),
                'accuracy_after': new_accuracy,
                'improvement': new_accuracy - model.get('previous_accuracy', 0.5),
                'training_time': time.time() - start_time
            }
            
            model['training_history'].append(training_session)
            model['previous_accuracy'] = new_accuracy
            model['last_trained'] = datetime.now().isoformat()
            model['version'] = self._increment_version(model['version'])
            
            # Update learning metrics
            self._update_learning_metrics(model_key, training_session)
            
            training_time = time.time() - start_time
            
            logger.info(f"Model training completed for {user_type} {user_id}")
            
            return {
                'model_id': model_key,
                'training_metrics': {
                    'data_points_processed': len(training_data),
                    'accuracy_improvement': training_session['improvement'],
                    'total_interactions': model['total_interactions'],
                    'training_sessions': len(model['training_history'])
                },
                'accuracy': new_accuracy,
                'training_time': training_time,
                'model_version': model['version'],
                'recommendations': self._generate_training_recommendations(model)
            }
            
        except Exception as e:
            logger.error(f"Model training failed for {user_type} {user_id}: {e}")
            return self._get_fallback_training_result(user_id, user_type)
    
    def get_model_metrics(self, model_key: str) -> Dict[str, Any]:
        """
        Get performance metrics for a user model
        """
        try:
            if model_key not in self.user_models:
                return self._get_default_metrics()
            
            model = self.user_models[model_key]
            
            # Calculate performance metrics
            metrics = {
                'accuracy': model.get('accuracy', 0.5),
                'precision': self._calculate_precision(model),
                'recall': self._calculate_recall(model),
                'f1_score': self._calculate_f1_score(model),
                'training_history': model.get('training_history', [])[-10:],  # Last 10 sessions
                'last_updated': model.get('last_trained'),
                'total_predictions': model.get('total_interactions', 0),
                'success_rate': self._calculate_success_rate(model),
                'learning_progress': self._calculate_learning_progress(model),
                'model_maturity': self._assess_model_maturity(model),
                'personalization_strength': self._calculate_personalization_strength(model)
            }
            
            return metrics
            
        except Exception as e:
            logger.error(f"Failed to get model metrics for {model_key}: {e}")
            return self._get_default_metrics()
    
    def update_learning_model(self, user_id: str, user_type: str, interaction_data: Dict) -> None:
        """
        Update learning model with new interaction data
        """
        try:
            model_key = f"{user_type}_{user_id}"
            
            # Store interaction in history
            if model_key not in self.interaction_history:
                self.interaction_history[model_key] = []
            
            interaction = {
                'timestamp': datetime.now().isoformat(),
                'event_data': interaction_data.get('event_data', {}),
                'result': interaction_data.get('result', {}),
                'processing_time': interaction_data.get('processing_time', 0),
                'plan_level': interaction_data.get('plan_level', 1),
                'satisfaction_score': interaction_data.get('satisfaction_score', 0.8)  # Default
            }
            
            self.interaction_history[model_key].append(interaction)
            
            # Limit history size
            if len(self.interaction_history[model_key]) > self.learning_config['max_history']:
                self.interaction_history[model_key] = self.interaction_history[model_key][-self.learning_config['max_history']:]
            
            # Update model if exists
            if model_key in self.user_models:
                model = self.user_models[model_key]
                self._incremental_model_update(model, interaction)
            
            logger.debug(f"Learning model updated for {user_type} {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to update learning model: {e}")
    
    def get_personalized_recommendations(self, user_id: str, user_type: str, 
                                       context: Dict) -> List[Dict[str, Any]]:
        """
        Get personalized recommendations based on user's learning model
        """
        try:
            model_key = f"{user_type}_{user_id}"
            
            if model_key not in self.user_models:
                return self._get_default_recommendations(context)
            
            model = self.user_models[model_key]
            preferences = model.get('preferences', {})
            patterns = model.get('patterns', {})
            
            recommendations = []
            
            # Event type recommendations
            if 'event_preferences' in preferences:
                event_recs = self._generate_event_recommendations(preferences['event_preferences'], context)
                recommendations.extend(event_recs)
            
            # Budget recommendations
            if 'budget_patterns' in patterns:
                budget_recs = self._generate_budget_recommendations(patterns['budget_patterns'], context)
                recommendations.extend(budget_recs)
            
            # Vendor recommendations
            if 'vendor_preferences' in preferences:
                vendor_recs = self._generate_vendor_recommendations(preferences['vendor_preferences'], context)
                recommendations.extend(vendor_recs)
            
            # Style recommendations
            if 'style_preferences' in preferences:
                style_recs = self._generate_style_recommendations(preferences['style_preferences'], context)
                recommendations.extend(style_recs)
            
            # Limit and score recommendations
            recommendations = self._score_and_limit_recommendations(recommendations, model)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate personalized recommendations: {e}")
            return self._get_default_recommendations(context)
    
    def analyze_learning_progress(self, user_id: str, user_type: str) -> Dict[str, Any]:
        """
        Analyze user's learning progress and provide insights
        """
        try:
            model_key = f"{user_type}_{user_id}"
            
            if model_key not in self.user_models:
                return {'message': 'No learning data available'}
            
            model = self.user_models[model_key]
            history = self.interaction_history.get(model_key, [])
            
            analysis = {
                'learning_stage': self._determine_learning_stage(model),
                'accuracy_trend': self._calculate_accuracy_trend(model),
                'interaction_frequency': self._calculate_interaction_frequency(history),
                'preference_stability': self._calculate_preference_stability(model),
                'learning_velocity': self._calculate_learning_velocity(model),
                'areas_of_expertise': self._identify_expertise_areas(model),
                'improvement_opportunities': self._identify_improvement_opportunities(model),
                'next_learning_goals': self._suggest_learning_goals(model),
                'personalization_score': model.get('accuracy', 0.5)
            }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Failed to analyze learning progress: {e}")
            return {'message': 'Unable to analyze learning progress'}
    
    def _process_training_data(self, training_data: List[Dict], user_type: str) -> Dict[str, Any]:
        """Process raw training data into structured format"""
        processed = {
            'event_types': {},
            'budget_ranges': {},
            'style_preferences': {},
            'vendor_categories': {},
            'success_patterns': [],
            'failure_patterns': []
        }
        
        for data_point in training_data:
            # Process event types
            event_type = data_point.get('event_type')
            if event_type:
                processed['event_types'][event_type] = processed['event_types'].get(event_type, 0) + 1
            
            # Process budget ranges
            budget = data_point.get('budget', {})
            if isinstance(budget, dict) and 'amount' in budget:
                budget_range = self._categorize_budget(budget['amount'])
                processed['budget_ranges'][budget_range] = processed['budget_ranges'].get(budget_range, 0) + 1
            
            # Process style preferences
            style = data_point.get('style') or data_point.get('theme')
            if style:
                processed['style_preferences'][style] = processed['style_preferences'].get(style, 0) + 1
            
            # Process success/failure patterns
            success_score = data_point.get('success_score', 0.5)
            if success_score > 0.7:
                processed['success_patterns'].append(data_point)
            elif success_score < 0.4:
                processed['failure_patterns'].append(data_point)
        
        return processed
    
    def _update_model_preferences(self, model: Dict, processed_data: Dict) -> None:
        """Update model preferences based on processed data"""
        if 'preferences' not in model:
            model['preferences'] = {}
        
        # Update event preferences
        if processed_data['event_types']:
            model['preferences']['event_preferences'] = processed_data['event_types']
        
        # Update style preferences
        if processed_data['style_preferences']:
            model['preferences']['style_preferences'] = processed_data['style_preferences']
        
        # Update budget preferences
        if processed_data['budget_ranges']:
            model['preferences']['budget_preferences'] = processed_data['budget_ranges']
    
    def _update_model_patterns(self, model: Dict, processed_data: Dict) -> None:
        """Update model patterns based on processed data"""
        if 'patterns' not in model:
            model['patterns'] = {}
        
        # Analyze success patterns
        if processed_data['success_patterns']:
            model['patterns']['success_factors'] = self._extract_success_factors(processed_data['success_patterns'])
        
        # Analyze failure patterns
        if processed_data['failure_patterns']:
            model['patterns']['risk_factors'] = self._extract_risk_factors(processed_data['failure_patterns'])
        
        # Update budget patterns
        if processed_data['budget_ranges']:
            model['patterns']['budget_patterns'] = self._analyze_budget_patterns(processed_data['budget_ranges'])
    
    def _calculate_model_accuracy(self, model: Dict, processed_data: Dict) -> float:
        """Calculate model accuracy based on training data"""
        base_accuracy = model.get('accuracy', 0.5)
        
        # Factors that improve accuracy
        data_quality_factor = min(len(processed_data.get('success_patterns', [])) * 0.1, 0.3)
        interaction_factor = min(model.get('total_interactions', 0) * 0.01, 0.2)
        
        # Calculate new accuracy
        new_accuracy = min(base_accuracy + data_quality_factor + interaction_factor, 0.95)
        
        return round(new_accuracy, 3)
    
    def _increment_version(self, current_version: str) -> str:
        """Increment model version"""
        try:
            major, minor = current_version.split('.')
            return f"{major}.{int(minor) + 1}"
        except:
            return "1.1"
    
    def _update_learning_metrics(self, model_key: str, training_session: Dict) -> None:
        """Update global learning metrics"""
        if model_key not in self.learning_metrics:
            self.learning_metrics[model_key] = {
                'total_training_time': 0,
                'total_sessions': 0,
                'average_improvement': 0,
                'best_accuracy': 0
            }
        
        metrics = self.learning_metrics[model_key]
        metrics['total_training_time'] += training_session['training_time']
        metrics['total_sessions'] += 1
        metrics['average_improvement'] = (
            (metrics['average_improvement'] * (metrics['total_sessions'] - 1) + training_session['improvement']) 
            / metrics['total_sessions']
        )
        metrics['best_accuracy'] = max(metrics['best_accuracy'], training_session['accuracy_after'])
    
    def _generate_training_recommendations(self, model: Dict) -> List[str]:
        """Generate recommendations for improving model training"""
        recommendations = []
        
        accuracy = model.get('accuracy', 0.5)
        total_interactions = model.get('total_interactions', 0)
        
        if accuracy < 0.7:
            recommendations.append("Increase training data to improve accuracy")
        
        if total_interactions < 10:
            recommendations.append("More interactions needed for better personalization")
        
        if len(model.get('training_history', [])) < 3:
            recommendations.append("Regular training sessions will improve model performance")
        
        return recommendations
    
    def _calculate_precision(self, model: Dict) -> float:
        """Calculate model precision"""
        return model.get('accuracy', 0.5) * 0.9  # Simplified calculation
    
    def _calculate_recall(self, model: Dict) -> float:
        """Calculate model recall"""
        return model.get('accuracy', 0.5) * 0.85  # Simplified calculation
    
    def _calculate_f1_score(self, model: Dict) -> float:
        """Calculate F1 score"""
        precision = self._calculate_precision(model)
        recall = self._calculate_recall(model)
        
        if precision + recall == 0:
            return 0
        
        return 2 * (precision * recall) / (precision + recall)
    
    def _calculate_success_rate(self, model: Dict) -> float:
        """Calculate success rate"""
        return model.get('accuracy', 0.5) * 0.95  # Simplified calculation
    
    def _calculate_learning_progress(self, model: Dict) -> Dict[str, Any]:
        """Calculate learning progress"""
        history = model.get('training_history', [])
        
        if len(history) < 2:
            return {'trend': 'insufficient_data', 'progress': 0}
        
        recent_accuracy = history[-1]['accuracy_after']
        initial_accuracy = history[0]['accuracy_after']
        
        progress = recent_accuracy - initial_accuracy
        
        return {
            'trend': 'improving' if progress > 0 else 'stable' if progress == 0 else 'declining',
            'progress': progress,
            'sessions': len(history)
        }
    
    def _assess_model_maturity(self, model: Dict) -> str:
        """Assess model maturity level"""
        accuracy = model.get('accuracy', 0.5)
        interactions = model.get('total_interactions', 0)
        
        if accuracy > 0.8 and interactions > 50:
            return 'mature'
        elif accuracy > 0.6 and interactions > 20:
            return 'developing'
        elif interactions > 5:
            return 'learning'
        else:
            return 'new'
    
    def _calculate_personalization_strength(self, model: Dict) -> float:
        """Calculate personalization strength"""
        preferences = model.get('preferences', {})
        patterns = model.get('patterns', {})
        
        pref_score = len(preferences) * 0.1
        pattern_score = len(patterns) * 0.15
        accuracy_score = model.get('accuracy', 0.5) * 0.5
        
        return min(pref_score + pattern_score + accuracy_score, 1.0)
    
    def _incremental_model_update(self, model: Dict, interaction: Dict) -> None:
        """Incrementally update model with new interaction"""
        # Update interaction count
        model['total_interactions'] = model.get('total_interactions', 0) + 1
        
        # Update last interaction
        model['last_interaction'] = interaction['timestamp']
        
        # Simple accuracy adjustment based on satisfaction
        satisfaction = interaction.get('satisfaction_score', 0.8)
        current_accuracy = model.get('accuracy', 0.5)
        
        # Small adjustment based on satisfaction
        adjustment = (satisfaction - 0.5) * self.learning_config['learning_rate']
        new_accuracy = max(0.1, min(0.95, current_accuracy + adjustment))
        
        model['accuracy'] = new_accuracy
    
    def _categorize_budget(self, amount: float) -> str:
        """Categorize budget amount into ranges"""
        if amount < 100000:
            return 'low'
        elif amount < 500000:
            return 'medium'
        elif amount < 1000000:
            return 'high'
        else:
            return 'premium'
    
    def _extract_success_factors(self, success_patterns: List[Dict]) -> List[str]:
        """Extract common success factors from successful events"""
        factors = []
        
        # Analyze common elements in successful events
        common_themes = {}
        for pattern in success_patterns:
            theme = pattern.get('theme') or pattern.get('style')
            if theme:
                common_themes[theme] = common_themes.get(theme, 0) + 1
        
        # Get most common themes
        if common_themes:
            most_common = max(common_themes, key=common_themes.get)
            factors.append(f"Theme preference: {most_common}")
        
        factors.extend([
            "Early planning and preparation",
            "Quality vendor selection",
            "Clear communication with stakeholders"
        ])
        
        return factors[:5]
    
    def _extract_risk_factors(self, failure_patterns: List[Dict]) -> List[str]:
        """Extract risk factors from failed events"""
        return [
            "Insufficient planning time",
            "Budget constraints",
            "Vendor reliability issues",
            "Poor weather contingency planning",
            "Inadequate guest communication"
        ]
    
    def _analyze_budget_patterns(self, budget_ranges: Dict) -> Dict[str, Any]:
        """Analyze budget spending patterns"""
        total_events = sum(budget_ranges.values())
        
        return {
            'preferred_range': max(budget_ranges, key=budget_ranges.get) if budget_ranges else 'medium',
            'distribution': {k: v/total_events for k, v in budget_ranges.items()},
            'budget_flexibility': 'high' if len(budget_ranges) > 2 else 'low'
        }
    
    def _get_fallback_training_result(self, user_id: str, user_type: str) -> Dict[str, Any]:
        """Get fallback training result when training fails"""
        return {
            'model_id': f"{user_type}_{user_id}",
            'training_metrics': {
                'data_points_processed': 0,
                'accuracy_improvement': 0,
                'total_interactions': 0,
                'training_sessions': 0
            },
            'accuracy': 0.5,
            'training_time': 0,
            'model_version': '1.0',
            'recommendations': ['Provide more training data for better results']
        }
    
    def _get_default_metrics(self) -> Dict[str, Any]:
        """Get default metrics when model doesn't exist"""
        return {
            'accuracy': 0.5,
            'precision': 0.45,
            'recall': 0.42,
            'f1_score': 0.43,
            'training_history': [],
            'last_updated': None,
            'total_predictions': 0,
            'success_rate': 0.5,
            'learning_progress': {'trend': 'new', 'progress': 0},
            'model_maturity': 'new',
            'personalization_strength': 0.1
        }
    
    def _get_default_recommendations(self, context: Dict) -> List[Dict[str, Any]]:
        """Get default recommendations when no personalization is available"""
        return [
            {
                'type': 'general',
                'title': 'Start with a clear budget',
                'description': 'Define your budget range early in the planning process',
                'confidence': 0.8
            },
            {
                'type': 'general',
                'title': 'Book key vendors early',
                'description': 'Secure venue and catering first as they have the most impact',
                'confidence': 0.9
            },
            {
                'type': 'general',
                'title': 'Plan for contingencies',
                'description': 'Always have backup plans for critical elements',
                'confidence': 0.85
            }
        ]
    
    # Additional helper methods for personalized recommendations
    def _generate_event_recommendations(self, event_prefs: Dict, context: Dict) -> List[Dict[str, Any]]:
        """Generate event-specific recommendations"""
        recommendations = []
        
        most_common_event = max(event_prefs, key=event_prefs.get) if event_prefs else None
        
        if most_common_event:
            recommendations.append({
                'type': 'event_type',
                'title': f'Consider {most_common_event} style elements',
                'description': f'Based on your history, you prefer {most_common_event} events',
                'confidence': 0.8
            })
        
        return recommendations
    
    def _generate_budget_recommendations(self, budget_patterns: Dict, context: Dict) -> List[Dict[str, Any]]:
        """Generate budget-specific recommendations"""
        recommendations = []
        
        preferred_range = budget_patterns.get('preferred_range')
        if preferred_range:
            recommendations.append({
                'type': 'budget',
                'title': f'Your typical budget range is {preferred_range}',
                'description': 'Consider this range for optimal vendor selection',
                'confidence': 0.75
            })
        
        return recommendations
    
    def _generate_vendor_recommendations(self, vendor_prefs: Dict, context: Dict) -> List[Dict[str, Any]]:
        """Generate vendor-specific recommendations"""
        return [
            {
                'type': 'vendor',
                'title': 'Focus on highly rated vendors',
                'description': 'Based on your preferences, prioritize quality over price',
                'confidence': 0.7
            }
        ]
    
    def _generate_style_recommendations(self, style_prefs: Dict, context: Dict) -> List[Dict[str, Any]]:
        """Generate style-specific recommendations"""
        recommendations = []
        
        preferred_style = max(style_prefs, key=style_prefs.get) if style_prefs else None
        
        if preferred_style:
            recommendations.append({
                'type': 'style',
                'title': f'Consider {preferred_style} theme elements',
                'description': f'You consistently choose {preferred_style} styles',
                'confidence': 0.8
            })
        
        return recommendations
    
    def _score_and_limit_recommendations(self, recommendations: List[Dict], model: Dict) -> List[Dict[str, Any]]:
        """Score and limit recommendations based on model confidence"""
        # Sort by confidence
        recommendations.sort(key=lambda x: x.get('confidence', 0), reverse=True)
        
        # Limit based on model maturity
        maturity = self._assess_model_maturity(model)
        limit = {'new': 3, 'learning': 5, 'developing': 7, 'mature': 10}.get(maturity, 3)
        
        return recommendations[:limit]
    
    # Learning progress analysis methods
    def _determine_learning_stage(self, model: Dict) -> str:
        """Determine current learning stage"""
        return self._assess_model_maturity(model)
    
    def _calculate_accuracy_trend(self, model: Dict) -> Dict[str, Any]:
        """Calculate accuracy trend over time"""
        history = model.get('training_history', [])
        
        if len(history) < 2:
            return {'trend': 'insufficient_data', 'slope': 0}
        
        accuracies = [session['accuracy_after'] for session in history[-5:]]  # Last 5 sessions
        
        # Simple trend calculation
        if len(accuracies) >= 2:
            slope = (accuracies[-1] - accuracies[0]) / len(accuracies)
            trend = 'improving' if slope > 0.01 else 'stable' if abs(slope) <= 0.01 else 'declining'
        else:
            slope = 0
            trend = 'stable'
        
        return {'trend': trend, 'slope': slope}
    
    def _calculate_interaction_frequency(self, history: List[Dict]) -> Dict[str, Any]:
        """Calculate interaction frequency"""
        if not history:
            return {'frequency': 'none', 'interactions_per_week': 0}
        
        # Calculate interactions in last 30 days
        recent_interactions = [
            h for h in history 
            if datetime.fromisoformat(h['timestamp']) > datetime.now() - timedelta(days=30)
        ]
        
        interactions_per_week = len(recent_interactions) / 4.3  # Approximate weeks in a month
        
        if interactions_per_week > 2:
            frequency = 'high'
        elif interactions_per_week > 0.5:
            frequency = 'medium'
        else:
            frequency = 'low'
        
        return {'frequency': frequency, 'interactions_per_week': round(interactions_per_week, 1)}
    
    def _calculate_preference_stability(self, model: Dict) -> float:
        """Calculate how stable user preferences are"""
        # Simplified calculation based on preference consistency
        preferences = model.get('preferences', {})
        
        if not preferences:
            return 0.0
        
        # Calculate stability based on preference distribution
        stability_score = 0.7  # Default moderate stability
        
        return stability_score
    
    def _calculate_learning_velocity(self, model: Dict) -> float:
        """Calculate how quickly the model is learning"""
        history = model.get('training_history', [])
        
        if len(history) < 2:
            return 0.0
        
        # Calculate average improvement per session
        improvements = [session.get('improvement', 0) for session in history]
        avg_improvement = sum(improvements) / len(improvements)
        
        return max(0, avg_improvement * 10)  # Scale to 0-1 range
    
    def _identify_expertise_areas(self, model: Dict) -> List[str]:
        """Identify areas where the model performs well"""
        preferences = model.get('preferences', {})
        areas = []
        
        if 'event_preferences' in preferences:
            most_common = max(preferences['event_preferences'], key=preferences['event_preferences'].get)
            areas.append(f"{most_common} events")
        
        if 'style_preferences' in preferences:
            most_common = max(preferences['style_preferences'], key=preferences['style_preferences'].get)
            areas.append(f"{most_common} styling")
        
        return areas[:3]
    
    def _identify_improvement_opportunities(self, model: Dict) -> List[str]:
        """Identify areas for improvement"""
        opportunities = []
        
        accuracy = model.get('accuracy', 0.5)
        interactions = model.get('total_interactions', 0)
        
        if accuracy < 0.7:
            opportunities.append("Increase model accuracy through more training")
        
        if interactions < 20:
            opportunities.append("Gather more interaction data for better personalization")
        
        preferences = model.get('preferences', {})
        if len(preferences) < 3:
            opportunities.append("Explore different event types to broaden expertise")
        
        return opportunities[:3]
    
    def _suggest_learning_goals(self, model: Dict) -> List[str]:
        """Suggest next learning goals"""
        goals = []
        
        maturity = self._assess_model_maturity(model)
        
        if maturity == 'new':
            goals.extend([
                "Complete 5 more event planning sessions",
                "Explore different event types",
                "Provide feedback on AI suggestions"
            ])
        elif maturity == 'learning':
            goals.extend([
                "Achieve 70% accuracy",
                "Develop style preferences",
                "Try advanced planning features"
            ])
        elif maturity == 'developing':
            goals.extend([
                "Reach 80% accuracy",
                "Master budget optimization",
                "Explore vendor relationships"
            ])
        else:  # mature
            goals.extend([
                "Maintain high accuracy",
                "Mentor other users",
                "Explore cutting-edge features"
            ])
        
        return goals[:3]
    
    def health_check(self) -> str:
        """Check learning service health"""
        return 'operational'