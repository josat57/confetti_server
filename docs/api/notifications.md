# Notifications API Documentation

## Overview
The Notifications API provides functionality for managing user notifications, including event updates, vendor messages, and system notifications. It supports real-time notifications, notification preferences, and notification management.

## Base URL
```
/api/notifications
```

## Endpoints

### 1. Get Notifications
Get notifications for the authenticated user.

```http
GET /
```

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `status`: Filter by notification status (pending, sent, delivered, read, failed)
- `type`: Filter by notification type (event_update, vendor_message, system_update, etc.)
- `limit`: Number of notifications to return (default: 50)
- `skip`: Number of notifications to skip (default: 0)

**Response (200 OK):**
```json
{
  "notifications": [
    {
      "id": "notification_id",
      "recipient_id": "user_id",
      "type": "event_update",
      "title": "Event Update",
      "message": "Your event has been updated",
      "priority": "medium",
      "data": {
        "event_id": "event_id",
        "update_type": "schedule_change"
      },
      "status": "delivered",
      "created_at": "2024-03-20T10:00:00Z",
      "updated_at": "2024-03-20T10:00:00Z",
      "read_at": null,
      "delivered_at": "2024-03-20T10:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "skip": 0,
    "total": 1
  }
}
```

### 2. Get Notification
Get a specific notification by ID.

```http
GET /:notification_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "notification_id",
  "recipient_id": "user_id",
  "type": "event_update",
  "title": "Event Update",
  "message": "Your event has been updated",
  "priority": "medium",
  "data": {
    "event_id": "event_id",
    "update_type": "schedule_change"
  },
  "status": "delivered",
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z",
  "read_at": null,
  "delivered_at": "2024-03-20T10:00:00Z"
}
```

### 3. Mark as Read
Mark a notification as read.

```http
POST /:notification_id/read
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "id": "notification_id",
  "status": "read",
  "read_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 4. Mark All as Read
Mark all notifications as read for the user.

```http
POST /read-all
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Marked 5 notifications as read",
  "count": 5
}
```

### 5. Delete Notification
Delete a notification.

```http
DELETE /:notification_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Notification deleted successfully"
}
```

### 6. Get Unread Count
Get count of unread notifications.

```http
GET /unread-count
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "unread_count": 5
}
```

### 7. Get Notification Stats
Get notification statistics.

```http
GET /stats
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "total": 20,
  "unread": 5,
  "read": 14,
  "failed": 1
}
```

### 8. Delete Old Notifications
Delete notifications older than specified days (admin only).

```http
POST /cleanup
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "days": 30
}
```

**Response (200 OK):**
```json
{
  "message": "Deleted 100 old notifications",
  "count": 100
}
```

### 9. Send Event Update
Send event update notifications to all participants.

```http
POST /event/:event_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "Event Update",
  "message": "The event schedule has been updated",
  "priority": "medium",
  "data": {
    "update_type": "schedule_change",
    "new_time": "2024-04-01T15:00:00Z"
  }
}
```

**Response (200 OK):**
```json
{
  "message": "Sent 3 notifications",
  "notifications": [
    {
      "id": "notification_id",
      "recipient_id": "user_id",
      "type": "event_update",
      "title": "Event Update",
      "message": "The event schedule has been updated",
      "status": "pending"
    }
  ]
}
```

### 10. Send Vendor Message
Send a message notification to a vendor.

```http
POST /vendor/:vendor_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "New Message",
  "message": "You have a new message from a client",
  "priority": "medium",
  "data": {
    "message_id": "message_id",
    "conversation_id": "conversation_id"
  }
}
```

**Response (200 OK):**
```json
{
  "id": "notification_id",
  "recipient_id": "vendor_id",
  "type": "vendor_message",
  "title": "New Message",
  "message": "You have a new message from a client",
  "status": "pending"
}
```

### 11. Send System Update
Send a system update notification to a user (admin only).

```http
POST /system/:user_id
```

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "title": "System Update",
  "message": "New features are available",
  "priority": "low",
  "data": {
    "update_type": "feature_release",
    "version": "2.0.0"
  }
}
```

**Response (200 OK):**
```json
{
  "id": "notification_id",
  "recipient_id": "user_id",
  "type": "system_update",
  "title": "System Update",
  "message": "New features are available",
  "status": "pending"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid input data",
  "details": {
    "title": "Title is required",
    "message": "Message is required"
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
  "message": "You don't have permission to perform this action"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Notification not found"
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

1. **Notification Management**
   - Implement real-time updates using WebSocket
   - Batch notifications when possible
   - Set appropriate priorities
   - Clean up old notifications regularly

2. **User Experience**
   - Show unread count in UI
   - Group notifications by type
   - Allow bulk actions
   - Provide clear notification content

3. **Performance**
   - Use pagination for large lists
   - Implement caching where appropriate
   - Optimize database queries
   - Monitor notification delivery

4. **Security**
   - Validate user permissions
   - Sanitize notification content
   - Rate limit notification creation
   - Log notification activities

## Example Usage

### React Implementation
```javascript
// Notification component
const NotificationList = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications);
    } catch (error) {
      // Handle error
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
      
      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, status: 'read' } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      // Handle error
    }
  };

  return (
    <div>
      {/* Notification UI */}
    </div>
  );
};
```

### Real-time Updates
```javascript
// WebSocket implementation
const NotificationSocket = () => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const ws = new WebSocket('ws://api.example.com/notifications');
    
    ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      // Handle new notification
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, []);

  return null;
};
```

### Notification Preferences
```javascript
// Notification preferences component
const NotificationPreferences = () => {
  const [preferences, setPreferences] = useState({
    email: true,
    push: true,
    sms: false,
    notification_types: {
      event_updates: true,
      vendor_messages: true,
      system_updates: false
    }
  });

  const updatePreferences = async (updates) => {
    try {
      const response = await fetch('/api/users/preferences', {
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