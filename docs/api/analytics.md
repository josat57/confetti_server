# Analytics API Documentation

## Overview
The Analytics API provides comprehensive insights into platform performance, user behavior, and business metrics. All endpoints require authentication and appropriate role-based access.

## Base URL
```
/api/analytics
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Role-Based Access
- `admin`: Full access to all analytics
- `vendor`: Access to vendor-specific analytics and market insights
- `user`: Access to event-specific analytics

## Endpoints

### 1. Platform Metrics
Get comprehensive platform-wide analytics.

```http
GET /platform
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string (e.g., "2024-01-01T00:00:00Z")
- `end_date` (optional): ISO 8601 date string (e.g., "2024-03-20T23:59:59Z")

**Required Role:** `admin`

**Response:**
```json
{
  "overview": {
    "total_events": 150,
    "total_users": 500,
    "total_vendors": 100,
    "active_events": 45,
    "completed_events": 105,
    "new_users": 50,
    "new_vendors": 10
  },
  "user_metrics": {
    "total_users": 500,
    "active_users": 450,
    "user_types": {
      "admin": 5,
      "vendor": 100,
      "user": 395
    },
    "user_retention": 0.85,
    "user_engagement": 0.72,
    "preferred_event_types": {
      "wedding": 200,
      "corporate": 150,
      "birthday": 100
    }
  },
  "event_metrics": {
    "total_events": 150,
    "event_types": {
      "wedding": 60,
      "corporate": 45,
      "birthday": 45
    },
    "event_status": {
      "planning": 30,
      "confirmed": 15,
      "completed": 105
    },
    "average_budget": 5000,
    "average_guest_count": 100,
    "event_duration": 6.5
  },
  "vendor_metrics": {
    "total_vendors": 100,
    "vendor_types": {
      "catering": 30,
      "venue": 25,
      "entertainment": 20,
      "decoration": 15,
      "photography": 10
    },
    "average_rating": 4.5,
    "vendor_categories": {
      "premium": 20,
      "standard": 60,
      "budget": 20
    },
    "vendor_performance": {
      "average_response_time": 2.5,
      "booking_rate": 0.75,
      "customer_satisfaction": 4.3
    },
    "vendor_engagement": 0.85
  },
  "revenue_metrics": {
    "total_revenue": 750000,
    "revenue_by_event_type": {
      "wedding": 300000,
      "corporate": 225000,
      "birthday": 225000
    },
    "average_event_revenue": 5000,
    "revenue_trends": {
      "daily_growth": 0.02,
      "weekly_growth": 0.15,
      "monthly_growth": 0.45
    },
    "revenue_forecast": {
      "next_month": 825000,
      "next_quarter": 2500000
    }
  },
  "trends": {
    "user_growth": {
      "daily_growth": 0.01,
      "weekly_growth": 0.08,
      "monthly_growth": 0.25
    },
    "event_growth": {
      "daily_growth": 0.015,
      "weekly_growth": 0.12,
      "monthly_growth": 0.35
    },
    "vendor_growth": {
      "daily_growth": 0.005,
      "weekly_growth": 0.04,
      "monthly_growth": 0.15
    },
    "revenue_growth": {
      "daily_growth": 0.02,
      "weekly_growth": 0.15,
      "monthly_growth": 0.45
    },
    "engagement_trends": {
      "user_engagement": 0.72,
      "vendor_engagement": 0.85,
      "event_engagement": 0.78
    },
    "market_trends": {
      "popular_event_types": {
        "wedding": 60,
        "corporate": 45,
        "birthday": 45
      },
      "popular_vendor_types": {
        "catering": 30,
        "venue": 25,
        "entertainment": 20
      },
      "market_gaps": [
        {
          "event_type": "wedding",
          "demand": 60,
          "supply": 20,
          "gap": 40
        }
      ],
      "emerging_trends": {
        "emerging_event_types": {
          "virtual": 15,
          "hybrid": 10
        },
        "emerging_vendor_types": {
          "virtual_services": 8,
          "tech_support": 5
        },
        "popular_locations": {
          "New York": 30,
          "Los Angeles": 25,
          "Chicago": 20
        },
        "price_trends": {
          "average_prices": {
            "wedding": 10000,
            "corporate": 7500,
            "birthday": 5000
          },
          "price_changes": {
            "wedding": 0.05,
            "corporate": 0.03,
            "birthday": 0.02
          }
        }
      }
    }
  }
}
```

### 2. Vendor Analytics
Get detailed analytics for a specific vendor.

```http
GET /vendor/{vendor_id}
```

**Path Parameters:**
- `vendor_id`: Vendor's unique identifier

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`, `vendor`

**Response:**
```json
{
  "performance": {
    "total_events": 25,
    "success_rate": 0.92,
    "average_rating": 4.7,
    "response_time": 2.1,
    "booking_rate": 0.85,
    "customer_satisfaction": 4.5
  },
  "revenue": {
    "total_revenue": 125000,
    "revenue_by_event_type": {
      "wedding": 75000,
      "corporate": 35000,
      "birthday": 15000
    },
    "average_revenue_per_event": 5000,
    "revenue_trends": {
      "daily_growth": 0.015,
      "weekly_growth": 0.12,
      "monthly_growth": 0.35
    },
    "revenue_forecast": {
      "next_month": 137500,
      "next_quarter": 425000
    }
  },
  "events": {
    "total_events": 25,
    "event_types": {
      "wedding": 15,
      "corporate": 7,
      "birthday": 3
    },
    "event_status": {
      "planning": 5,
      "confirmed": 3,
      "completed": 17
    },
    "average_guest_count": 120,
    "event_duration": 7.5,
    "event_trends": {
      "booking_trend": 0.85,
      "completion_trend": 0.92,
      "satisfaction_trend": 0.88
    }
  },
  "reviews": {
    "total_reviews": 17,
    "average_rating": 4.7,
    "rating_distribution": {
      "5": 12,
      "4": 4,
      "3": 1,
      "2": 0,
      "1": 0
    },
    "review_sentiment": {
      "positive": 0.85,
      "neutral": 0.10,
      "negative": 0.05
    },
    "review_trends": {
      "rating_trend": 0.05,
      "volume_trend": 0.15
    },
    "top_reviewed_aspects": {
      "service_quality": 0.95,
      "punctuality": 0.90,
      "communication": 0.85
    }
  },
  "trends": {
    "booking_trends": {
      "daily": 0.015,
      "weekly": 0.12,
      "monthly": 0.35
    },
    "revenue_trends": {
      "daily": 0.02,
      "weekly": 0.15,
      "monthly": 0.45
    },
    "rating_trends": {
      "daily": 0.01,
      "weekly": 0.05,
      "monthly": 0.15
    },
    "popularity_trends": {
      "profile_views": 0.10,
      "inquiries": 0.08,
      "bookings": 0.15
    },
    "performance_trends": {
      "response_time": -0.05,
      "satisfaction": 0.03,
      "efficiency": 0.08
    }
  }
}
```

### 3. User Analytics
Get detailed analytics for a specific user.

```http
GET /user/{user_id}
```

**Path Parameters:**
- `user_id`: User's unique identifier

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`

**Response:**
```json
{
  "activity": {
    "total_events": 10,
    "active_events": 3,
    "completed_events": 7,
    "last_activity": "2024-03-20T15:30:00Z",
    "activity_frequency": 0.85
  },
  "events": {
    "total_events": 10,
    "event_types": {
      "wedding": 4,
      "corporate": 3,
      "birthday": 3
    },
    "event_status": {
      "planning": 2,
      "confirmed": 1,
      "completed": 7
    },
    "average_budget": 4500,
    "average_guest_count": 80
  },
  "preferences": {
    "preferred_event_types": ["wedding", "corporate"],
    "preferred_vendors": ["vendor1", "vendor2"],
    "budget_range": {
      "min": 3000,
      "max": 8000
    },
    "location_preferences": ["New York", "Los Angeles"]
  },
  "engagement": {
    "login_frequency": 0.90,
    "feature_usage": {
      "event_creation": 0.85,
      "vendor_search": 0.75,
      "messaging": 0.80
    },
    "interaction_rate": 0.82
  },
  "trends": {
    "activity_trend": 0.05,
    "budget_trend": 0.10,
    "engagement_trend": 0.08
  }
}
```

### 4. Event Analytics
Get detailed analytics for a specific event.

```http
GET /event/{event_id}
```

**Path Parameters:**
- `event_id`: Event's unique identifier

**Required Role:** `admin`, `vendor`, `user`

**Response:**
```json
{
  "overview": {
    "event_type": "wedding",
    "status": "confirmed",
    "start_date": "2024-06-15T00:00:00Z",
    "end_date": "2024-06-15T23:59:59Z",
    "guest_count": 150,
    "budget": 10000
  },
  "budget": {
    "total_budget": 10000,
    "allocated_budget": 8000,
    "remaining_budget": 2000,
    "budget_utilization": 0.80,
    "budget_by_category": {
      "venue": 4000,
      "catering": 3000,
      "entertainment": 2000,
      "decoration": 1000
    }
  },
  "timeline": {
    "total_items": 15,
    "completed_items": 10,
    "pending_items": 5,
    "timeline_progress": 0.67,
    "next_milestone": {
      "title": "Final Vendor Meeting",
      "due_date": "2024-05-15T00:00:00Z"
    }
  },
  "vendors": {
    "total_vendors": 5,
    "vendor_status": {
      "confirmed": 3,
      "pending": 2
    },
    "vendor_performance": {
      "average_rating": 4.5,
      "response_time": 2.5,
      "completion_rate": 0.90
    }
  },
  "metrics": {
    "planning_progress": 0.75,
    "vendor_coverage": 0.80,
    "budget_efficiency": 0.85,
    "timeline_adherence": 0.90,
    "overall_health": 0.82
  }
}
```

### 5. Market Insights
Get market insights and trends.

```http
GET /market-insights
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`, `vendor`

**Response:**
```json
{
  "market_trends": {
    "popular_event_types": {
      "wedding": 60,
      "corporate": 45,
      "birthday": 45
    },
    "popular_vendor_types": {
      "catering": 30,
      "venue": 25,
      "entertainment": 20
    },
    "market_gaps": [
      {
        "event_type": "wedding",
        "demand": 60,
        "supply": 20,
        "gap": 40
      }
    ],
    "emerging_trends": {
      "emerging_event_types": {
        "virtual": 15,
        "hybrid": 10
      },
      "emerging_vendor_types": {
        "virtual_services": 8,
        "tech_support": 5
      },
      "popular_locations": {
        "New York": 30,
        "Los Angeles": 25,
        "Chicago": 20
      },
      "price_trends": {
        "average_prices": {
          "wedding": 10000,
          "corporate": 7500,
          "birthday": 5000
        },
        "price_changes": {
          "wedding": 0.05,
          "corporate": 0.03,
          "birthday": 0.02
        }
      }
    }
  },
  "revenue_trends": {
    "daily_growth": 0.02,
    "weekly_growth": 0.15,
    "monthly_growth": 0.45
  },
  "user_trends": {
    "daily_growth": 0.01,
    "weekly_growth": 0.08,
    "monthly_growth": 0.25
  },
  "vendor_trends": {
    "daily_growth": 0.005,
    "weekly_growth": 0.04,
    "monthly_growth": 0.15
  }
}
```

### 6. Performance Metrics
Get performance metrics for a specific entity.

```http
GET /performance/{entity_type}/{entity_id}
```

**Path Parameters:**
- `entity_type`: Type of entity (`vendor` or `user`)
- `entity_id`: Entity's unique identifier

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`, `vendor`

**Response for Vendor:**
```json
{
  "performance": {
    "total_events": 25,
    "success_rate": 0.92,
    "average_rating": 4.7,
    "response_time": 2.1,
    "booking_rate": 0.85,
    "customer_satisfaction": 4.5
  },
  "revenue": {
    "total_revenue": 125000,
    "revenue_by_event_type": {
      "wedding": 75000,
      "corporate": 35000,
      "birthday": 15000
    },
    "average_revenue_per_event": 5000
  },
  "trends": {
    "booking_trends": {
      "daily": 0.015,
      "weekly": 0.12,
      "monthly": 0.35
    },
    "revenue_trends": {
      "daily": 0.02,
      "weekly": 0.15,
      "monthly": 0.45
    },
    "rating_trends": {
      "daily": 0.01,
      "weekly": 0.05,
      "monthly": 0.15
    }
  }
}
```

**Response for User:**
```json
{
  "activity": {
    "total_events": 10,
    "active_events": 3,
    "completed_events": 7,
    "last_activity": "2024-03-20T15:30:00Z",
    "activity_frequency": 0.85
  },
  "engagement": {
    "login_frequency": 0.90,
    "feature_usage": {
      "event_creation": 0.85,
      "vendor_search": 0.75,
      "messaging": 0.80
    },
    "interaction_rate": 0.82
  },
  "trends": {
    "activity_trend": 0.05,
    "budget_trend": 0.10,
    "engagement_trend": 0.08
  }
}
```

### 7. Revenue Analytics
Get detailed revenue analytics.

```http
GET /revenue
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`

**Response:**
```json
{
  "total_revenue": 750000,
  "revenue_by_event_type": {
    "wedding": 300000,
    "corporate": 225000,
    "birthday": 225000
  },
  "average_event_revenue": 5000,
  "revenue_trends": {
    "daily_growth": 0.02,
    "weekly_growth": 0.15,
    "monthly_growth": 0.45
  },
  "revenue_forecast": {
    "next_month": 825000,
    "next_quarter": 2500000
  }
}
```

### 8. Engagement Metrics
Get user and vendor engagement metrics.

```http
GET /engagement
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 date string
- `end_date` (optional): ISO 8601 date string

**Required Role:** `admin`

**Response:**
```json
{
  "user_engagement": {
    "login_frequency": 0.90,
    "feature_usage": {
      "event_creation": 0.85,
      "vendor_search": 0.75,
      "messaging": 0.80
    },
    "interaction_rate": 0.82
  },
  "vendor_engagement": {
    "response_rate": 0.95,
    "booking_rate": 0.85,
    "profile_completion": 0.90,
    "service_quality": 4.5
  },
  "engagement_trends": {
    "user_engagement": 0.72,
    "vendor_engagement": 0.85,
    "event_engagement": 0.78
  }
}
```

## Error Responses

All endpoints may return the following error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Rate Limiting
- 100 requests per minute per IP address
- 1000 requests per hour per user

## Caching
- Platform metrics are cached for 1 hour
- Vendor and user analytics are cached for 30 minutes
- Event analytics are cached for 15 minutes

## Best Practices
1. Use appropriate date ranges to avoid large data sets
2. Implement client-side caching for frequently accessed data
3. Use pagination for large result sets
4. Handle rate limiting gracefully
5. Implement error handling for all API calls
6. Use appropriate authentication and authorization
7. Monitor API usage and performance 