"""
Comprehensive Event Types Database
Demonstrates vast knowledge of event planning domain
"""

# Complete event types catalog with detailed specifications
EVENT_TYPES_CATALOG = {
    # WEDDINGS & CELEBRATIONS
    'wedding': {
        'category': 'wedding',
        'min_budget_per_person': 15000,
        'avg_budget_per_person': 25000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 180,
        'complexity_score': 95,
        'common_services': ['venue', 'catering', 'photography', 'videography', 'decoration', 'entertainment', 'planning'],
        'peak_seasons': [6, 7, 12],  # June, July, December
        'formality': 'formal'
    },
    'traditional_wedding': {
        'category': 'wedding',
        'min_budget_per_person': 18000,
        'avg_budget_per_person': 30000,
        'typical_duration_hours': 8,
        'planning_lead_time_days': 240,
        'complexity_score': 98,
        'common_services': ['venue', 'catering', 'photography', 'videography', 'decoration', 'entertainment', 'planning', 'cultural_coordinator'],
        'peak_seasons': [6, 7, 12],
        'formality': 'formal'
    },
    'white_wedding': {
        'category': 'wedding',
        'min_budget_per_person': 20000,
        'avg_budget_per_person': 35000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 180,
        'complexity_score': 95,
        'common_services': ['venue', 'catering', 'photography', 'videography', 'decoration', 'entertainment', 'planning'],
        'peak_seasons': [6, 7, 12],
        'formality': 'formal'
    },
    'engagement_party': {
        'category': 'wedding',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 60,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment'],
        'peak_seasons': [6, 12],
        'formality': 'semi-formal'
    },
    'bridal_shower': {
        'category': 'wedding',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 30,
        'complexity_score': 40,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [6, 7, 12],
        'formality': 'casual'
    },
    'bachelor_party': {
        'category': 'wedding',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 30,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'entertainment'],
        'peak_seasons': [6, 7, 12],
        'formality': 'casual'
    },
    'anniversary': {
        'category': 'celebration',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 65,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'photography'],
        'peak_seasons': [6, 12],
        'formality': 'semi-formal'
    },
    
    # BIRTHDAYS & MILESTONES
    'birthday': {
        'category': 'birthday',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 45,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'kids_birthday': {
        'category': 'birthday',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 30,
        'complexity_score': 55,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'activities'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'sweet_sixteen': {
        'category': 'birthday',
        'min_budget_per_person': 7000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 65,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'photography'],
        'peak_seasons': [6, 12],
        'formality': 'semi-formal'
    },
    'milestone_birthday': {
        'category': 'birthday',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 60,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'photography'],
        'peak_seasons': [6, 12],
        'formality': 'semi-formal'
    },
    'surprise_party': {
        'category': 'birthday',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 11000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 30,
        'complexity_score': 75,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    
    # GRADUATIONS & ACADEMIC
    'graduation': {
        'category': 'academic',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 55,
        'common_services': ['venue', 'catering', 'decoration', 'photography'],
        'peak_seasons': [6, 7, 11],
        'formality': 'semi-formal'
    },
    'convocation': {
        'category': 'academic',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 90,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'decoration', 'photography', 'audio_visual'],
        'peak_seasons': [6, 7, 11],
        'formality': 'formal'
    },
    'matriculation': {
        'category': 'academic',
        'min_budget_per_person': 3000,
        'avg_budget_per_person': 6000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 45,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [9, 10],
        'formality': 'semi-formal'
    },
    
    # CORPORATE EVENTS
    'corporate': {
        'category': 'corporate',
        'min_budget_per_person': 10000,
        'avg_budget_per_person': 18000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 90,
        'complexity_score': 80,
        'common_services': ['venue', 'catering', 'audio_visual', 'planning'],
        'peak_seasons': [3, 4, 9, 10, 11],
        'formality': 'formal'
    },
    'conference': {
        'category': 'corporate',
        'min_budget_per_person': 12000,
        'avg_budget_per_person': 20000,
        'typical_duration_hours': 8,
        'planning_lead_time_days': 120,
        'complexity_score': 90,
        'common_services': ['venue', 'catering', 'audio_visual', 'planning', 'registration'],
        'peak_seasons': [3, 4, 9, 10, 11],
        'formality': 'formal'
    },
    'seminar': {
        'category': 'corporate',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 60,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'audio_visual'],
        'peak_seasons': [3, 4, 9, 10],
        'formality': 'formal'
    },
    'workshop': {
        'category': 'corporate',
        'min_budget_per_person': 7000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 45,
        'complexity_score': 65,
        'common_services': ['venue', 'catering', 'audio_visual', 'materials'],
        'peak_seasons': [3, 4, 9, 10],
        'formality': 'semi-formal'
    },
    'team_building': {
        'category': 'corporate',
        'min_budget_per_person': 9000,
        'avg_budget_per_person': 16000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 60,
        'complexity_score': 75,
        'common_services': ['venue', 'catering', 'activities', 'facilitator'],
        'peak_seasons': [3, 6, 9, 12],
        'formality': 'casual'
    },
    'product_launch': {
        'category': 'corporate',
        'min_budget_per_person': 15000,
        'avg_budget_per_person': 25000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 90,
        'complexity_score': 85,
        'common_services': ['venue', 'catering', 'audio_visual', 'decoration', 'entertainment', 'media'],
        'peak_seasons': [3, 4, 9, 10],
        'formality': 'formal'
    },
    'awards_ceremony': {
        'category': 'corporate',
        'min_budget_per_person': 12000,
        'avg_budget_per_person': 22000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 90,
        'complexity_score': 85,
        'common_services': ['venue', 'catering', 'audio_visual', 'decoration', 'entertainment', 'photography'],
        'peak_seasons': [11, 12],
        'formality': 'formal'
    },
    'gala_dinner': {
        'category': 'corporate',
        'min_budget_per_person': 18000,
        'avg_budget_per_person': 30000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 120,
        'complexity_score': 90,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'photography', 'planning'],
        'peak_seasons': [11, 12],
        'formality': 'formal'
    },
    'networking_event': {
        'category': 'corporate',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 14000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 45,
        'complexity_score': 60,
        'common_services': ['venue', 'catering', 'audio_visual'],
        'peak_seasons': [3, 4, 9, 10],
        'formality': 'semi-formal'
    },
    'trade_show': {
        'category': 'corporate',
        'min_budget_per_person': 10000,
        'avg_budget_per_person': 18000,
        'typical_duration_hours': 8,
        'planning_lead_time_days': 120,
        'complexity_score': 85,
        'common_services': ['venue', 'catering', 'booth_setup', 'audio_visual', 'registration'],
        'peak_seasons': [3, 4, 9, 10],
        'formality': 'semi-formal'
    },
    'board_meeting': {
        'category': 'corporate',
        'min_budget_per_person': 15000,
        'avg_budget_per_person': 25000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 30,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'audio_visual', 'security'],
        'peak_seasons': [3, 6, 9, 12],
        'formality': 'formal'
    },
    'agm': {  # Annual General Meeting
        'category': 'corporate',
        'min_budget_per_person': 12000,
        'avg_budget_per_person': 20000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 90,
        'complexity_score': 80,
        'common_services': ['venue', 'catering', 'audio_visual', 'registration', 'security'],
        'peak_seasons': [3, 4, 11, 12],
        'formality': 'formal'
    },
    
    # SOCIAL & COMMUNITY
    'fundraiser': {
        'category': 'social',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 90,
        'complexity_score': 75,
        'common_services': ['venue', 'catering', 'audio_visual', 'decoration'],
        'peak_seasons': [11, 12],
        'formality': 'semi-formal'
    },
    'charity_event': {
        'category': 'social',
        'min_budget_per_person': 7000,
        'avg_budget_per_person': 13000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 90,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'audio_visual', 'decoration'],
        'peak_seasons': [11, 12],
        'formality': 'semi-formal'
    },
    'community_gathering': {
        'category': 'social',
        'min_budget_per_person': 3000,
        'avg_budget_per_person': 6000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 30,
        'complexity_score': 40,
        'common_services': ['venue', 'catering'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'reunion': {
        'category': 'social',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 5,
        'planning_lead_time_days': 60,
        'complexity_score': 60,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'block_party': {
        'category': 'social',
        'min_budget_per_person': 2000,
        'avg_budget_per_person': 4000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 45,
        'complexity_score': 50,
        'common_services': ['catering', 'entertainment', 'activities'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    
    # RELIGIOUS & CULTURAL
    'naming_ceremony': {
        'category': 'religious',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 30,
        'complexity_score': 65,
        'common_services': ['venue', 'catering', 'decoration', 'cultural_coordinator'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'christening': {
        'category': 'religious',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 30,
        'complexity_score': 55,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'dedication': {
        'category': 'religious',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 30,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'thanksgiving': {
        'category': 'religious',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 45,
        'complexity_score': 60,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [11, 12],
        'formality': 'semi-formal'
    },
    'church_event': {
        'category': 'religious',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 60,
        'common_services': ['venue', 'catering', 'audio_visual'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'mosque_event': {
        'category': 'religious',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 60,
        'common_services': ['venue', 'catering'],
        'peak_seasons': [6, 7],  # Ramadan period
        'formality': 'semi-formal'
    },
    'cultural_festival': {
        'category': 'cultural',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 6,
        'planning_lead_time_days': 90,
        'complexity_score': 80,
        'common_services': ['venue', 'catering', 'entertainment', 'decoration', 'cultural_coordinator'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    
    # ENTERTAINMENT & LEISURE
    'concert': {
        'category': 'entertainment',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 90,
        'complexity_score': 85,
        'common_services': ['venue', 'audio_visual', 'security', 'ticketing'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'festival': {
        'category': 'entertainment',
        'min_budget_per_person': 7000,
        'avg_budget_per_person': 13000,
        'typical_duration_hours': 8,
        'planning_lead_time_days': 120,
        'complexity_score': 90,
        'common_services': ['venue', 'catering', 'entertainment', 'security', 'ticketing'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'fashion_show': {
        'category': 'entertainment',
        'min_budget_per_person': 12000,
        'avg_budget_per_person': 20000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 90,
        'complexity_score': 85,
        'common_services': ['venue', 'audio_visual', 'decoration', 'photography', 'security'],
        'peak_seasons': [3, 9, 12],
        'formality': 'formal'
    },
    'art_exhibition': {
        'category': 'entertainment',
        'min_budget_per_person': 8000,
        'avg_budget_per_person': 15000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'decoration', 'security'],
        'peak_seasons': [3, 9, 12],
        'formality': 'semi-formal'
    },
    'movie_premiere': {
        'category': 'entertainment',
        'min_budget_per_person': 10000,
        'avg_budget_per_person': 18000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 60,
        'complexity_score': 75,
        'common_services': ['venue', 'catering', 'audio_visual', 'security', 'media'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'comedy_show': {
        'category': 'entertainment',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 12000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 45,
        'complexity_score': 65,
        'common_services': ['venue', 'audio_visual', 'security', 'ticketing'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    
    # SPECIAL OCCASIONS
    'baby_shower': {
        'category': 'celebration',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 30,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'gender_reveal': {
        'category': 'celebration',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 2,
        'planning_lead_time_days': 21,
        'complexity_score': 45,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'retirement_party': {
        'category': 'celebration',
        'min_budget_per_person': 7000,
        'avg_budget_per_person': 13000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 60,
        'complexity_score': 65,
        'common_services': ['venue', 'catering', 'decoration', 'entertainment', 'photography'],
        'peak_seasons': [12],
        'formality': 'semi-formal'
    },
    'housewarming': {
        'category': 'celebration',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 4,
        'planning_lead_time_days': 30,
        'complexity_score': 45,
        'common_services': ['catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'promotion_celebration': {
        'category': 'celebration',
        'min_budget_per_person': 6000,
        'avg_budget_per_person': 11000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 21,
        'complexity_score': 50,
        'common_services': ['venue', 'catering', 'decoration'],
        'peak_seasons': [12],
        'formality': 'casual'
    },
    'memorial_service': {
        'category': 'memorial',
        'min_budget_per_person': 5000,
        'avg_budget_per_person': 10000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 14,
        'complexity_score': 70,
        'common_services': ['venue', 'catering', 'audio_visual'],
        'peak_seasons': [],
        'formality': 'formal'
    },
    'funeral_reception': {
        'category': 'memorial',
        'min_budget_per_person': 4000,
        'avg_budget_per_person': 8000,
        'typical_duration_hours': 3,
        'planning_lead_time_days': 7,
        'complexity_score': 65,
        'common_services': ['venue', 'catering'],
        'peak_seasons': [],
        'formality': 'formal'
    },
}

# Event categories for grouping
EVENT_CATEGORIES = {
    'wedding': ['wedding', 'traditional_wedding', 'white_wedding', 'engagement_party', 'bridal_shower', 'bachelor_party'],
    'birthday': ['birthday', 'kids_birthday', 'sweet_sixteen', 'milestone_birthday', 'surprise_party'],
    'academic': ['graduation', 'convocation', 'matriculation'],
    'corporate': ['corporate', 'conference', 'seminar', 'workshop', 'team_building', 'product_launch', 'awards_ceremony', 'gala_dinner', 'networking_event', 'trade_show', 'board_meeting', 'agm'],
    'social': ['fundraiser', 'charity_event', 'community_gathering', 'reunion', 'block_party'],
    'religious': ['naming_ceremony', 'christening', 'dedication', 'thanksgiving', 'church_event', 'mosque_event'],
    'cultural': ['cultural_festival'],
    'entertainment': ['concert', 'festival', 'fashion_show', 'art_exhibition', 'movie_premiere', 'comedy_show'],
    'celebration': ['anniversary', 'baby_shower', 'gender_reveal', 'retirement_party', 'housewarming', 'promotion_celebration'],
    'memorial': ['memorial_service', 'funeral_reception']
}

def get_event_info(event_type):
    """Get detailed information for an event type"""
    event_type_lower = event_type.lower().replace(' ', '_').replace('-', '_')
    return EVENT_TYPES_CATALOG.get(event_type_lower, EVENT_TYPES_CATALOG.get('birthday'))

def get_min_budget_per_person(event_type):
    """Get minimum budget per person for event type"""
    info = get_event_info(event_type)
    return info['min_budget_per_person']

def get_avg_budget_per_person(event_type):
    """Get average budget per person for event type"""
    info = get_event_info(event_type)
    return info['avg_budget_per_person']

def get_planning_lead_time(event_type):
    """Get recommended planning lead time in days"""
    info = get_event_info(event_type)
    return info['planning_lead_time_days']

def get_event_complexity(event_type):
    """Get complexity score (0-100)"""
    info = get_event_info(event_type)
    return info['complexity_score']

def get_common_services(event_type):
    """Get list of commonly needed services"""
    info = get_event_info(event_type)
    return info['common_services']

def is_peak_season(event_type, month):
    """Check if month is peak season for event type"""
    info = get_event_info(event_type)
    return month in info['peak_seasons']

def get_all_event_types():
    """Get list of all supported event types"""
    return list(EVENT_TYPES_CATALOG.keys())

def search_event_types(query):
    """Search for event types matching query"""
    query_lower = query.lower()
    matches = []
    
    for event_type, info in EVENT_TYPES_CATALOG.items():
        if query_lower in event_type or query_lower in info['category']:
            matches.append({
                'type': event_type,
                'category': info['category'],
                'formality': info['formality'],
                'avg_budget': info['avg_budget_per_person']
            })
    
    return matches
