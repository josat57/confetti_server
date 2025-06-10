# User Management API Documentation

## Overview
The User Management API provides comprehensive functionality for managing user accounts, preferences, and activities. It includes features for user profile management, role-based access control, and user analytics.

## Base URL
```
/api/users
```

## Endpoints

### 1. Create User
Create a new user account.

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
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  "preferences": {
    "notifications": true,
    "theme": "light",
    "language": "en"
  }
}
```

**Response (201 Created):**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  "status": "active",
  "preferences": {
    "notifications": true,
    "theme": "light",
    "language": "en"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 2. Get User
Get user details by ID.

```http
GET /:user_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "user",
  "status": "active",
  "preferences": {
    "notifications": true,
    "theme": "light",
    "language": "en"
  },
  "notification_settings": {
    "email": true,
    "push": true,
    "sms": false
  },
  "events": [
    {
      "id": "event_id",
      "title": "Summer Wedding",
      "role": "organizer",
      "status": "planning"
    }
  ],
  "vendor_id": null,
  "analytics": {
    "total_events": 5,
    "active_events": 2,
    "completed_events": 3
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 3. Update User
Update user details.

```http
PUT /:user_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "first_name": "Johnny",
  "last_name": "Doe",
  "preferences": {
    "theme": "dark"
  }
}
```

**Response (200 OK):**
```json
{
  "id": "user_id",
  "first_name": "Johnny",
  "last_name": "Doe",
  "preferences": {
    "notifications": true,
    "theme": "dark",
    "language": "en"
  },
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 4. Delete User
Delete a user account.

```http
DELETE /:user_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "User deleted successfully"
}
```

### 5. List Users
Get a list of users with filtering and pagination.

```http
GET /
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `role`: Filter by user role
- `status`: Filter by user status
- `search`: Search by name or email
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "user_id",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "user",
      "status": "active"
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

### 6. Update Preferences
Update user preferences.

```http
PUT /:user_id/preferences
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "notifications": false,
  "theme": "dark",
  "language": "es"
}
```

**Response (200 OK):**
```json
{
  "id": "user_id",
  "preferences": {
    "notifications": false,
    "theme": "dark",
    "language": "es"
  },
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 7. Update Notification Settings
Update user notification settings.

```http
PUT /:user_id/notifications
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": true,
  "push": false,
  "sms": true,
  "notification_types": {
    "event_updates": true,
    "vendor_messages": true,
    "system_updates": false
  }
}
```

**Response (200 OK):**
```json
{
  "id": "user_id",
  "notification_settings": {
    "email": true,
    "push": false,
    "sms": true,
    "notification_types": {
      "event_updates": true,
      "vendor_messages": true,
      "system_updates": false
    }
  },
  "updated_at": "2024-03-20T11:00:00Z"
}
```

### 8. Get User Events
Get events associated with a user.

```http
GET /:user_id/events
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `role`: Filter by user role in events
- `status`: Filter by event status
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
      "role": "organizer"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 10,
    "pages": 1
  }
}
```

### 9. Get User Analytics
Get analytics for a user.

```http
GET /:user_id/analytics
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "activity": {
    "total_events": 10,
    "active_events": 3,
    "completed_events": 7,
    "cancelled_events": 0
  },
  "events": {
    "by_type": {
      "wedding": 5,
      "corporate": 3,
      "social": 2
    },
    "by_status": {
      "planning": 3,
      "in_progress": 2,
      "completed": 5
    }
  },
  "preferences": {
    "most_common_event_type": "wedding",
    "average_guest_count": 150,
    "average_budget": 50000
  },
  "engagement": {
    "last_login": "2024-03-20T10:00:00Z",
    "login_frequency": "daily",
    "average_session_duration": "45 minutes"
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
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
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
  "message": "You don't have permission to access this user"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

### 409 Conflict
```json
{
  "error": "Conflict",
  "message": "Email already exists"
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

1. **User Registration**
   - Validate email format
   - Enforce strong passwords
   - Verify email addresses
   - Set default preferences

2. **Profile Management**
   - Keep information updated
   - Validate input data
   - Handle file uploads securely
   - Maintain audit logs

3. **Preferences Management**
   - Provide sensible defaults
   - Allow easy customization
   - Save preferences immediately
   - Sync across devices

4. **Notification Management**
   - Respect user preferences
   - Provide notification controls
   - Handle notification delivery
   - Track notification status

## Example Usage

### React Implementation
```javascript
// User profile component
const UserProfile = ({ userId }) => {
  const [userData, setUserData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    preferences: {
      notifications: true,
      theme: 'light',
      language: 'en'
    }
  });

  const updateProfile = async (updates) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      const data = await response.json();
      setUserData(data);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Profile UI */}
    </div>
  );
};
```

### Preferences Management
```javascript
// Preferences component
const Preferences = ({ userId }) => {
  const [preferences, setPreferences] = useState({
    notifications: true,
    theme: 'light',
    language: 'en'
  });

  const updatePreferences = async (updates) => {
    try {
      const response = await fetch(`/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }
      
      const data = await response.json();
      setPreferences(data.preferences);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Preferences UI */}
    </div>
  );
};
```

### Notification Settings
```javascript
// Notification settings component
const NotificationSettings = ({ userId }) => {
  const [settings, setSettings] = useState({
    email: true,
    push: true,
    sms: false,
    notification_types: {
      event_updates: true,
      vendor_messages: true,
      system_updates: false
    }
  });

  const updateSettings = async (updates) => {
    try {
      const response = await fetch(`/api/users/${userId}/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notification settings');
      }
      
      const data = await response.json();
      setSettings(data.notification_settings);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Notification settings UI */}
    </div>
  );
};
``` 