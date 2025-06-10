# Vendor Management API Documentation

## Overview
The Vendor Management API provides comprehensive functionality for managing vendors, their services, availability, and performance. It includes features for vendor registration, service management, availability tracking, and performance analytics.

## Base URL
```
/api/vendors
```

## Endpoints

### 1. Register Vendor
Register a new vendor.

```http
POST /
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Catering Co",
  "description": "Premium catering services for all events",
  "business_type": "catering",
  "categories": ["wedding", "corporate", "social"],
  "location": {
    "address": "123 Business St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "service_radius": 50
  },
  "contact_info": {
    "email": "contact@cateringco.com",
    "phone": "+1-555-0123",
    "website": "https://cateringco.com"
  },
  "availability": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  },
  "pricing": {
    "base_rate": 5000,
    "currency": "USD",
    "minimum_order": 2000,
    "packages": [
      {
        "name": "Basic Package",
        "price": 5000,
        "description": "Basic catering services"
      }
    ]
  }
}
```

**Response (201 Created):**
```json
{
  "id": "vendor_id",
  "name": "Catering Co",
  "description": "Premium catering services for all events",
  "business_type": "catering",
  "categories": ["wedding", "corporate", "social"],
  "location": {
    "address": "123 Business St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "service_radius": 50
  },
  "contact_info": {
    "email": "contact@cateringco.com",
    "phone": "+1-555-0123",
    "website": "https://cateringco.com"
  },
  "availability": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  },
  "pricing": {
    "base_rate": 5000,
    "currency": "USD",
    "minimum_order": 2000,
    "packages": [
      {
        "id": "package_id",
        "name": "Basic Package",
        "price": 5000,
        "description": "Basic catering services"
      }
    ]
  },
  "rating": 0,
  "reviews": [],
  "status": "pending",
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 2. Get Vendor
Get vendor details by ID.

```http
GET /:vendor_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "vendor_id",
  "name": "Catering Co",
  "description": "Premium catering services for all events",
  "business_type": "catering",
  "categories": ["wedding", "corporate", "social"],
  "location": {
    "address": "123 Business St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "service_radius": 50
  },
  "contact_info": {
    "email": "contact@cateringco.com",
    "phone": "+1-555-0123",
    "website": "https://cateringco.com"
  },
  "availability": {
    "monday": ["09:00-17:00"],
    "tuesday": ["09:00-17:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  },
  "pricing": {
    "base_rate": 5000,
    "currency": "USD",
    "minimum_order": 2000,
    "packages": [
      {
        "id": "package_id",
        "name": "Basic Package",
        "price": 5000,
        "description": "Basic catering services"
      }
    ]
  },
  "rating": 4.5,
  "reviews": [
    {
      "id": "review_id",
      "user_id": "user_id",
      "rating": 5,
      "comment": "Excellent service!",
      "created_at": "2024-03-19T10:00:00Z"
    }
  ],
  "portfolio": [
    {
      "id": "portfolio_id",
      "title": "Summer Wedding",
      "description": "Wedding catering for 150 guests",
      "images": ["image_url_1", "image_url_2"],
      "created_at": "2024-03-18T10:00:00Z"
    }
  ],
  "status": "active",
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 3. Update Vendor
Update vendor details.

```http
PUT /:vendor_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "description": "Updated description",
  "pricing": {
    "base_rate": 5500,
    "minimum_order": 2500
  },
  "availability": {
    "monday": ["09:00-18:00"],
    "tuesday": ["09:00-18:00"]
  }
}
```

**Response (200 OK):**
```json
{
  "id": "vendor_id",
  "description": "Updated description",
  "pricing": {
    "base_rate": 5500,
    "currency": "USD",
    "minimum_order": 2500,
    "packages": [
      {
        "id": "package_id",
        "name": "Basic Package",
        "price": 5500,
        "description": "Basic catering services"
      }
    ]
  },
  "availability": {
    "monday": ["09:00-18:00"],
    "tuesday": ["09:00-18:00"],
    "wednesday": ["09:00-17:00"],
    "thursday": ["09:00-17:00"],
    "friday": ["09:00-17:00"]
  },
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 4. Delete Vendor
Delete a vendor.

```http
DELETE /:vendor_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Vendor deleted successfully"
}
```

### 5. List Vendors
Get a list of vendors with filtering and pagination.

```http
GET /
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `category`: Filter by vendor category
- `location`: Filter by location (city, state)
- `rating`: Filter by minimum rating
- `availability`: Filter by availability date
- `price_range`: Filter by price range
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response (200 OK):**
```json
{
  "vendors": [
    {
      "id": "vendor_id",
      "name": "Catering Co",
      "business_type": "catering",
      "categories": ["wedding", "corporate"],
      "location": {
        "city": "New York",
        "state": "NY"
      },
      "rating": 4.5,
      "pricing": {
        "base_rate": 5000,
        "currency": "USD"
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "pages": 10
  }
}
```

### 6. Add Review
Add a review for a vendor.

```http
POST /:vendor_id/reviews
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "rating": 5,
  "comment": "Excellent service and food quality!",
  "event_id": "event_id"
}
```

**Response (201 Created):**
```json
{
  "id": "review_id",
  "vendor_id": "vendor_id",
  "user_id": "user_id",
  "event_id": "event_id",
  "rating": 5,
  "comment": "Excellent service and food quality!",
  "created_at": "2024-03-20T10:00:00Z"
}
```

### 7. Add Portfolio Item
Add a portfolio item for a vendor.

```http
POST /:vendor_id/portfolio
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Corporate Event",
  "description": "Catering for 200-person corporate event",
  "images": ["image_url_1", "image_url_2"],
  "event_id": "event_id"
}
```

**Response (201 Created):**
```json
{
  "id": "portfolio_id",
  "vendor_id": "vendor_id",
  "title": "Corporate Event",
  "description": "Catering for 200-person corporate event",
  "images": ["image_url_1", "image_url_2"],
  "event_id": "event_id",
  "created_at": "2024-03-20T10:00:00Z"
}
```

### 8. Update Availability
Update vendor availability.

```http
PUT /:vendor_id/availability
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "availability": {
    "monday": ["09:00-18:00"],
    "tuesday": ["09:00-18:00"],
    "wednesday": ["09:00-18:00"],
    "thursday": ["09:00-18:00"],
    "friday": ["09:00-18:00"]
  },
  "blocked_dates": ["2024-04-01", "2024-04-02"]
}
```

**Response (200 OK):**
```json
{
  "id": "vendor_id",
  "availability": {
    "monday": ["09:00-18:00"],
    "tuesday": ["09:00-18:00"],
    "wednesday": ["09:00-18:00"],
    "thursday": ["09:00-18:00"],
    "friday": ["09:00-18:00"]
  },
  "blocked_dates": ["2024-04-01", "2024-04-02"],
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 9. Get Vendor Analytics
Get analytics for a vendor.

```http
GET /:vendor_id/analytics
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "performance": {
    "total_events": 50,
    "completed_events": 45,
    "cancelled_events": 5,
    "average_rating": 4.5,
    "response_time": "2.5 hours"
  },
  "revenue": {
    "total": 250000,
    "currency": "USD",
    "average_per_event": 5000,
    "monthly_trend": [
      {
        "month": "2024-01",
        "revenue": 45000
      }
    ]
  },
  "events": {
    "upcoming": 5,
    "past": 45,
    "by_category": {
      "wedding": 30,
      "corporate": 15,
      "social": 5
    }
  },
  "reviews": {
    "total": 45,
    "average_rating": 4.5,
    "rating_distribution": {
      "5": 30,
      "4": 10,
      "3": 3,
      "2": 1,
      "1": 1
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "details": {
    "pricing": "Base rate must be greater than minimum order",
    "availability": "Invalid time format"
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You don't have permission to access this vendor"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Vendor not found"
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "Vendor already exists with this email"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

## Best Practices

1. **Vendor Registration**
   - Verify business credentials
   - Validate contact information
   - Set clear pricing structure
   - Define service areas

2. **Availability Management**
   - Keep calendar updated
   - Block dates in advance
   - Set buffer times
   - Handle timezone differences

3. **Review Management**
   - Respond to reviews promptly
   - Address negative feedback
   - Encourage satisfied customers
   - Maintain professional tone

4. **Portfolio Management**
   - Regular updates
   - High-quality images
   - Detailed descriptions
   - Event categorization

## Example Usage

### React Implementation
```javascript
// Vendor registration component
const RegisterVendor = () => {
  const [vendorData, setVendorData] = useState({
    name: '',
    description: '',
    business_type: '',
    categories: [],
    location: {
      address: '',
      city: '',
      state: '',
      zip: '',
      service_radius: 0
    },
    contact_info: {
      email: '',
      phone: '',
      website: ''
    },
    availability: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: []
    },
    pricing: {
      base_rate: 0,
      currency: 'USD',
      minimum_order: 0,
      packages: []
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(vendorData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to register vendor');
      }
      
      const data = await response.json();
      // Handle successful registration
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
    </form>
  );
};
```

### Availability Management
```javascript
// Availability component
const Availability = ({ vendorId }) => {
  const [availability, setAvailability] = useState({
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: []
  });

  const updateAvailability = async (updates) => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ availability: updates })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update availability');
      }
      
      const data = await response.json();
      setAvailability(data.availability);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Availability UI */}
    </div>
  );
};
```

### Review Management
```javascript
// Review component
const Reviews = ({ vendorId }) => {
  const [reviews, setReviews] = useState([]);

  const addReview = async (review) => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(review)
      });
      
      if (!response.ok) {
        throw new Error('Failed to add review');
      }
      
      const data = await response.json();
      setReviews([...reviews, data]);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Reviews UI */}
    </div>
  );
};
``` 