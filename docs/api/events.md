# Event Management API Documentation

## Overview
The Event Management API provides comprehensive functionality for creating, managing, and tracking events. It includes features for event planning, vendor management, timeline tracking, and budget management.

## Base URL
```
/api/events
```

## Endpoints

### 1. Create Event
Create a new event.

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
  "title": "Summer Wedding",
  "description": "A beautiful summer wedding celebration",
  "event_type": "wedding",
  "start_date": "2024-07-15T14:00:00Z",
  "end_date": "2024-07-15T22:00:00Z",
  "location": {
    "venue": "Grand Ballroom",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "budget": {
    "total": 50000,
    "currency": "USD"
  },
  "guest_count": 150,
  "preferences": {
    "theme": "rustic",
    "color_scheme": ["ivory", "sage", "blush"]
  }
}
```

**Response (201 Created):**
```json
{
  "id": "event_id",
  "title": "Summer Wedding",
  "description": "A beautiful summer wedding celebration",
  "event_type": "wedding",
  "start_date": "2024-07-15T14:00:00Z",
  "end_date": "2024-07-15T22:00:00Z",
  "location": {
    "venue": "Grand Ballroom",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "budget": {
    "total": 50000,
    "currency": "USD",
    "allocated": 0,
    "spent": 0
  },
  "guest_count": 150,
  "status": "planning",
  "organizer_id": "user_id",
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 2. Get Event
Get event details by ID.

```http
GET /:event_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "event_id",
  "title": "Summer Wedding",
  "description": "A beautiful summer wedding celebration",
  "event_type": "wedding",
  "start_date": "2024-07-15T14:00:00Z",
  "end_date": "2024-07-15T22:00:00Z",
  "location": {
    "venue": "Grand Ballroom",
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "budget": {
    "total": 50000,
    "currency": "USD",
    "allocated": 25000,
    "spent": 15000
  },
  "guest_count": 150,
  "status": "planning",
  "organizer_id": "user_id",
  "vendors": [
    {
      "id": "vendor_id",
      "name": "Catering Co",
      "category": "catering",
      "status": "confirmed",
      "contract": {
        "amount": 15000,
        "deposit_paid": true
      }
    }
  ],
  "timeline": [
    {
      "id": "timeline_id",
      "title": "Venue Setup",
      "start_time": "2024-07-15T12:00:00Z",
      "end_time": "2024-07-15T14:00:00Z",
      "status": "pending"
    }
  ],
  "checklist": [
    {
      "id": "checklist_id",
      "title": "Book Caterer",
      "status": "completed",
      "due_date": "2024-04-15T00:00:00Z"
    }
  ],
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 3. Update Event
Update event details.

```http
PUT /:event_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Summer Wedding Celebration",
  "description": "Updated description",
  "budget": {
    "total": 55000
  },
  "guest_count": 175
}
```

**Response (200 OK):**
```json
{
  "id": "event_id",
  "title": "Summer Wedding Celebration",
  "description": "Updated description",
  "budget": {
    "total": 55000,
    "currency": "USD",
    "allocated": 25000,
    "spent": 15000
  },
  "guest_count": 175,
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 4. Delete Event
Delete an event.

```http
DELETE /:event_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Event deleted successfully"
}
```

### 5. List Events
Get a list of events with filtering and pagination.

```http
GET /
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filter by event status (planning, in_progress, completed, cancelled)
- `type`: Filter by event type
- `start_date`: Filter by start date
- `end_date`: Filter by end date
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response (200 OK):**
```json
{
  "events": [
    {
      "id": "event_id",
      "title": "Summer Wedding",
      "event_type": "wedding",
      "start_date": "2024-07-15T14:00:00Z",
      "status": "planning",
      "budget": {
        "total": 50000,
        "allocated": 25000,
        "spent": 15000
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

### 6. Add Vendor to Event
Add a vendor to an event.

```http
POST /:event_id/vendors
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "vendor_id": "vendor_id",
  "role": "catering",
  "contract": {
    "amount": 15000,
    "deposit_required": true,
    "deposit_amount": 5000
  }
}
```

**Response (201 Created):**
```json
{
  "id": "vendor_assignment_id",
  "vendor_id": "vendor_id",
  "event_id": "event_id",
  "role": "catering",
  "status": "pending",
  "contract": {
    "amount": 15000,
    "deposit_required": true,
    "deposit_amount": 5000,
    "deposit_paid": false
  },
  "created_at": "2024-03-20T10:00:00Z"
}
```

### 7. Update Vendor Status
Update vendor status for an event.

```http
PUT /:event_id/vendors/:vendor_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "status": "confirmed",
  "contract": {
    "deposit_paid": true
  }
}
```

**Response (200 OK):**
```json
{
  "id": "vendor_assignment_id",
  "status": "confirmed",
  "contract": {
    "amount": 15000,
    "deposit_required": true,
    "deposit_amount": 5000,
    "deposit_paid": true
  },
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 8. Add Timeline Item
Add an item to the event timeline.

```http
POST /:event_id/timeline
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Venue Setup",
  "description": "Setup tables, chairs, and decorations",
  "start_time": "2024-07-15T12:00:00Z",
  "end_time": "2024-07-15T14:00:00Z",
  "assigned_to": "vendor_id"
}
```

**Response (201 Created):**
```json
{
  "id": "timeline_id",
  "title": "Venue Setup",
  "description": "Setup tables, chairs, and decorations",
  "start_time": "2024-07-15T12:00:00Z",
  "end_time": "2024-07-15T14:00:00Z",
  "status": "pending",
  "assigned_to": "vendor_id",
  "created_at": "2024-03-20T10:00:00Z"
}
```

### 9. Add Checklist Item
Add an item to the event checklist.

```http
POST /:event_id/checklist
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Book Caterer",
  "description": "Finalize menu and contract",
  "due_date": "2024-04-15T00:00:00Z",
  "priority": "high",
  "assigned_to": "user_id"
}
```

**Response (201 Created):**
```json
{
  "id": "checklist_id",
  "title": "Book Caterer",
  "description": "Finalize menu and contract",
  "due_date": "2024-04-15T00:00:00Z",
  "priority": "high",
  "status": "pending",
  "assigned_to": "user_id",
  "created_at": "2024-03-20T10:00:00Z"
}
```

### 10. Get Event Analytics
Get analytics for an event.

```http
GET /:event_id/analytics
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "budget": {
    "total": 50000,
    "allocated": 25000,
    "spent": 15000,
    "remaining": 25000,
    "utilization": 30
  },
  "timeline": {
    "total_items": 10,
    "completed": 3,
    "pending": 7,
    "on_track": true
  },
  "checklist": {
    "total_items": 20,
    "completed": 8,
    "pending": 12,
    "overdue": 2
  },
  "vendors": {
    "total": 5,
    "confirmed": 3,
    "pending": 2,
    "cancelled": 0
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
    "start_date": "Start date must be before end date",
    "budget": "Budget must be a positive number"
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
  "message": "You don't have permission to access this event"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Event not found"
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "Vendor already assigned to this event"
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

1. **Event Creation**
   - Set realistic budgets
   - Plan timeline with buffer time
   - Assign clear responsibilities
   - Set up regular check-ins

2. **Vendor Management**
   - Verify vendor credentials
   - Get written contracts
   - Track payments and deposits
   - Maintain communication logs

3. **Timeline Management**
   - Create detailed schedules
   - Include setup and cleanup time
   - Plan for contingencies
   - Regular status updates

4. **Budget Management**
   - Track all expenses
   - Maintain payment records
   - Regular budget reviews
   - Plan for unexpected costs

## Example Usage

### React Implementation
```javascript
// Event creation component
const CreateEvent = () => {
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    event_type: '',
    start_date: '',
    end_date: '',
    location: {
      venue: '',
      address: '',
      city: '',
      state: '',
      zip: ''
    },
    budget: {
      total: 0,
      currency: 'USD'
    },
    guest_count: 0
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create event');
      }
      
      const data = await response.json();
      // Handle successful event creation
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

### Timeline Management
```javascript
// Timeline component
const Timeline = ({ eventId }) => {
  const [timelineItems, setTimelineItems] = useState([]);

  const addTimelineItem = async (item) => {
    try {
      const response = await fetch(`/api/events/${eventId}/timeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(item)
      });
      
      if (!response.ok) {
        throw new Error('Failed to add timeline item');
      }
      
      const data = await response.json();
      setTimelineItems([...timelineItems, data]);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Timeline UI */}
    </div>
  );
};
```

### Budget Tracking
```javascript
// Budget component
const Budget = ({ eventId }) => {
  const [budget, setBudget] = useState({
    total: 0,
    allocated: 0,
    spent: 0,
    remaining: 0
  });

  const updateBudget = async (updates) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ budget: updates })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update budget');
      }
      
      const data = await response.json();
      setBudget(data.budget);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Budget UI */}
    </div>
  );
};
``` 