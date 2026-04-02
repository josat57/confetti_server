from textblob import TextBlob
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from collections import Counter
import re
import string

class NLPService:
    """
    Comprehensive NLP service for event planning text analysis
    Analyzes event descriptions to extract insights, preferences, and requirements
    """
    
    def __init__(self):
        # Download required NLTK data
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('stopwords', quiet=True)
            nltk.download('wordnet', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)
        except:
            pass
        
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()
        
        # Event planning domain vocabulary
        self.event_themes = {
            'elegant', 'rustic', 'modern', 'traditional', 'vintage', 'bohemian',
            'minimalist', 'luxurious', 'casual', 'formal', 'intimate', 'grand',
            'romantic', 'fun', 'sophisticated', 'classic', 'contemporary', 'chic'
        }
        
        self.venue_preferences = {
            'outdoor', 'indoor', 'garden', 'beach', 'ballroom', 'rooftop',
            'barn', 'hotel', 'restaurant', 'hall', 'mansion', 'villa', 'park'
        }
        
        self.service_keywords = {
            'catering': ['food', 'catering', 'menu', 'meal', 'buffet', 'dinner', 'lunch', 'breakfast'],
            'decoration': ['decoration', 'decor', 'flowers', 'floral', 'centerpiece', 'lighting'],
            'entertainment': ['music', 'dj', 'band', 'entertainment', 'dance', 'performer'],
            'photography': ['photo', 'photography', 'photographer', 'pictures', 'videography'],
            'venue': ['venue', 'location', 'space', 'hall', 'room'],
            'planning': ['planner', 'coordinator', 'planning', 'organize']
        }
        
        self.formality_indicators = {
            'formal': ['formal', 'black-tie', 'elegant', 'sophisticated', 'upscale', 'luxury'],
            'semi-formal': ['semi-formal', 'cocktail', 'dressy', 'smart'],
            'casual': ['casual', 'relaxed', 'informal', 'laid-back', 'comfortable']
        }
        
        self.budget_indicators = {
            'high': ['luxury', 'premium', 'upscale', 'lavish', 'extravagant', 'high-end'],
            'medium': ['quality', 'nice', 'good', 'decent', 'reasonable'],
            'low': ['budget', 'affordable', 'economical', 'cost-effective', 'cheap', 'inexpensive']
        }

    def analyze_sentiment(self, text):
        """
        Analyze sentiment of event description
        Returns detailed sentiment analysis
        """
        if not text or not isinstance(text, str):
            return {
                'score': 0.0,
                'label': 'neutral',
                'confidence': 0.0
            }
        
        try:
            analysis = TextBlob(text)
            polarity = analysis.sentiment.polarity
            subjectivity = analysis.sentiment.subjectivity
            
            # Determine label
            if polarity > 0.3:
                label = 'very_positive'
            elif polarity > 0.1:
                label = 'positive'
            elif polarity < -0.3:
                label = 'very_negative'
            elif polarity < -0.1:
                label = 'negative'
            else:
                label = 'neutral'
            
            return {
                'score': round(polarity, 3),
                'label': label,
                'confidence': round(abs(polarity), 3),
                'subjectivity': round(subjectivity, 3)
            }
        except Exception as e:
            return {
                'score': 0.0,
                'label': 'neutral',
                'confidence': 0.0,
                'error': str(e)
            }

    def extract_keywords(self, text, top_n=10):
        """
        Extract meaningful keywords from text
        Returns list of important keywords with scores
        """
        if not text or not isinstance(text, str):
            return []
        
        try:
            # Clean and tokenize
            text_lower = text.lower()
            tokens = word_tokenize(text_lower)
            
            # Remove stopwords, punctuation, and short words
            filtered_tokens = [
                self.lemmatizer.lemmatize(word)
                for word in tokens
                if word not in self.stop_words
                and word not in string.punctuation
                and len(word) > 2
                and word.isalpha()
            ]
            
            # Count frequencies
            word_freq = Counter(filtered_tokens)
            
            # Get top keywords
            top_keywords = word_freq.most_common(top_n)
            
            return [
                {
                    'word': word,
                    'frequency': freq,
                    'relevance': round(freq / len(filtered_tokens), 3) if filtered_tokens else 0
                }
                for word, freq in top_keywords
            ]
        except Exception as e:
            return []

    def extract_themes(self, text):
        """
        Extract event themes from description
        """
        if not text:
            return []
        
        text_lower = text.lower()
        found_themes = []
        
        for theme in self.event_themes:
            if theme in text_lower:
                found_themes.append(theme)
        
        return found_themes if found_themes else ['general']

    def extract_venue_preferences(self, text):
        """
        Extract venue preferences from description
        """
        if not text:
            return []
        
        text_lower = text.lower()
        found_preferences = []
        
        for venue_type in self.venue_preferences:
            if venue_type in text_lower:
                found_preferences.append(venue_type)
        
        return found_preferences

    def detect_formality_level(self, text):
        """
        Detect formality level from description
        """
        if not text:
            return 'casual'
        
        text_lower = text.lower()
        scores = {'formal': 0, 'semi-formal': 0, 'casual': 0}
        
        for level, indicators in self.formality_indicators.items():
            for indicator in indicators:
                if indicator in text_lower:
                    scores[level] += 1
        
        # Return level with highest score
        max_level = max(scores, key=scores.get)
        return max_level if scores[max_level] > 0 else 'casual'

    def detect_budget_signals(self, text):
        """
        Detect budget level signals from description
        """
        if not text:
            return 'medium'
        
        text_lower = text.lower()
        scores = {'high': 0, 'medium': 0, 'low': 0}
        
        for level, indicators in self.budget_indicators.items():
            for indicator in indicators:
                if indicator in text_lower:
                    scores[level] += 1
        
        # Return level with highest score
        max_level = max(scores, key=scores.get)
        return max_level if scores[max_level] > 0 else 'medium'

    def extract_service_requirements(self, text):
        """
        Extract required services from description
        """
        if not text:
            return []
        
        text_lower = text.lower()
        required_services = []
        
        for service, keywords in self.service_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    required_services.append(service)
                    break
        
        return list(set(required_services))  # Remove duplicates

    def extract_guest_count_hints(self, text):
        """
        Extract hints about guest count from description
        """
        if not text:
            return None
        
        # Look for numbers followed by guest-related words
        patterns = [
            r'(\d+)\s*(?:guests?|people|attendees?|persons?)',
            r'(?:guests?|people|attendees?)\s*(?:of|around|about)?\s*(\d+)',
            r'(\d+)\s*(?:person|pax)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text.lower())
            if match:
                try:
                    return int(match.group(1))
                except:
                    pass
        
        # Look for size indicators
        if any(word in text.lower() for word in ['intimate', 'small', 'cozy']):
            return {'size': 'small', 'estimate': '10-50'}
        elif any(word in text.lower() for word in ['medium', 'moderate']):
            return {'size': 'medium', 'estimate': '50-150'}
        elif any(word in text.lower() for word in ['large', 'big', 'grand']):
            return {'size': 'large', 'estimate': '150+'}
        
        return None

    def extract_special_requirements(self, text):
        """
        Extract special requirements or constraints
        """
        if not text:
            return []
        
        text_lower = text.lower()
        requirements = []
        
        # Dietary requirements
        dietary_keywords = ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten-free', 'allergy', 'dietary']
        if any(keyword in text_lower for keyword in dietary_keywords):
            requirements.append('dietary_restrictions')
        
        # Accessibility
        accessibility_keywords = ['wheelchair', 'accessible', 'disability', 'accessibility']
        if any(keyword in text_lower for keyword in accessibility_keywords):
            requirements.append('accessibility_needs')
        
        # Cultural/Religious
        cultural_keywords = ['cultural', 'religious', 'traditional', 'custom']
        if any(keyword in text_lower for keyword in cultural_keywords):
            requirements.append('cultural_considerations')
        
        # Timing constraints
        timing_keywords = ['deadline', 'urgent', 'rush', 'quick', 'asap']
        if any(keyword in text_lower for keyword in timing_keywords):
            requirements.append('time_sensitive')
        
        # Weather considerations
        weather_keywords = ['rain', 'weather', 'backup', 'indoor option']
        if any(keyword in text_lower for keyword in weather_keywords):
            requirements.append('weather_backup_needed')
        
        return requirements

    def analyze_comprehensive(self, text):
        """
        Comprehensive analysis of event description
        Returns all extracted insights
        """
        if not text or not isinstance(text, str):
            return {
                'sentiment': self.analyze_sentiment(''),
                'keywords': [],
                'themes': [],
                'venue_preferences': [],
                'formality': 'casual',
                'budget_signal': 'medium',
                'required_services': [],
                'guest_count_hint': None,
                'special_requirements': [],
                'summary': 'No description provided'
            }
        
        return {
            'sentiment': self.analyze_sentiment(text),
            'keywords': self.extract_keywords(text, top_n=15),
            'themes': self.extract_themes(text),
            'venue_preferences': self.extract_venue_preferences(text),
            'formality': self.detect_formality_level(text),
            'budget_signal': self.detect_budget_signals(text),
            'required_services': self.extract_service_requirements(text),
            'guest_count_hint': self.extract_guest_count_hints(text),
            'special_requirements': self.extract_special_requirements(text),
            'summary': self._generate_summary(text)
        }

    def _generate_summary(self, text):
        """
        Generate a brief summary of the event description
        """
        if not text:
            return 'No description provided'
        
        # Get first sentence or first 100 characters
        sentences = sent_tokenize(text)
        if sentences:
            first_sentence = sentences[0]
            if len(first_sentence) > 150:
                return first_sentence[:147] + '...'
            return first_sentence
        
        if len(text) > 150:
            return text[:147] + '...'
        return text

    def compare_descriptions(self, text1, text2):
        """
        Compare two event descriptions for similarity
        Useful for finding similar past events
        """
        if not text1 or not text2:
            return {'similarity': 0.0}
        
        try:
            blob1 = TextBlob(text1.lower())
            blob2 = TextBlob(text2.lower())
            
            # Get word sets
            words1 = set(blob1.words)
            words2 = set(blob2.words)
            
            # Calculate Jaccard similarity
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            similarity = len(intersection) / len(union) if union else 0.0
            
            return {
                'similarity': round(similarity, 3),
                'common_words': list(intersection)[:10],
                'unique_to_first': list(words1 - words2)[:5],
                'unique_to_second': list(words2 - words1)[:5]
            }
        except Exception as e:
            return {'similarity': 0.0, 'error': str(e)} 