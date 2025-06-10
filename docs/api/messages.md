# Message API Documentation

## Overview
The Message API provides endpoints for managing real-time messaging between users, including text messages, media sharing, location sharing, and message interactions like reactions and replies.

## Base URL
```
/api/messages
```

## Authentication
All endpoints require authentication using a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Create Message
```
POST /
```
Create a new message.

**Request Body:**
```json
{
  "recipient": "user_id",
  "type": "text",
  "content": {
    "text": "Hello, how are you?",
    "media": [{
      "type": "image",
      "url": "https://example.com/image.jpg",
      "name": "image.jpg",
      "size": 1024,
      "mimeType": "image/jpeg",
      "thumbnail": "https://example.com/thumbnail.jpg"
    }],
    "location": {
      "coordinates": [longitude, latitude],
      "address": "123 Main St"
    }
  },
  "event": "event_id",
  "vendor": "vendor_id",
  "booking": "booking_id"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "sender": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar_url"
    },
    "recipient": {
      "id": "user_id",
      "firstName": "Jane",
      "lastName": "Smith",
      "avatar": "avatar_url"
    },
    "type": "text",
    "content": {
      "text": "Hello, how are you?"
    },
    "status": "sent",
    "timestamps": {
      "created": "2024-03-20T10:00:00Z",
      "updated": "2024-03-20T10:00:00Z"
    }
  }
}
```

### Get Conversation
```
GET /conversation/:userId
```
Get messages between the authenticated user and another user.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)
- `before` (optional): Get messages before this timestamp
- `after` (optional): Get messages after this timestamp

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "message_id",
      "sender": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "avatar_url"
      },
      "recipient": {
        "id": "user_id",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "avatar_url"
      },
      "type": "text",
      "content": {
        "text": "Hello, how are you?"
      },
      "status": "read",
      "timestamps": {
        "created": "2024-03-20T10:00:00Z",
        "updated": "2024-03-20T10:00:00Z",
        "delivered": "2024-03-20T10:00:01Z",
        "read": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Get Event Messages
```
GET /event/:eventId
```
Get messages for a specific event.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)
- `before` (optional): Get messages before this timestamp
- `after` (optional): Get messages after this timestamp

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "message_id",
      "sender": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "avatar_url"
      },
      "recipient": {
        "id": "user_id",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "avatar_url"
      },
      "type": "text",
      "content": {
        "text": "Event update: New venue confirmed"
      },
      "event": "event_id",
      "status": "read",
      "timestamps": {
        "created": "2024-03-20T10:00:00Z",
        "updated": "2024-03-20T10:00:00Z",
        "delivered": "2024-03-20T10:00:01Z",
        "read": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Get Vendor Messages
```
GET /vendor/:vendorId
```
Get messages for a specific vendor.

**Query Parameters:**
- `limit` (optional): Number of messages to return (default: 50)
- `before` (optional): Get messages before this timestamp
- `after` (optional): Get messages after this timestamp

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "message_id",
      "sender": {
        "id": "user_id",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "avatar_url"
      },
      "recipient": {
        "id": "user_id",
        "firstName": "Jane",
        "lastName": "Smith",
        "avatar": "avatar_url"
      },
      "type": "text",
      "content": {
        "text": "Vendor update: New menu available"
      },
      "vendor": "vendor_id",
      "status": "read",
      "timestamps": {
        "created": "2024-03-20T10:00:00Z",
        "updated": "2024-03-20T10:00:00Z",
        "delivered": "2024-03-20T10:00:01Z",
        "read": "2024-03-20T10:00:05Z"
      }
    }
  ]
}
```

### Get Single Message
```
GET /:messageId
```
Get a specific message by ID.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "sender": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar_url"
    },
    "recipient": {
      "id": "user_id",
      "firstName": "Jane",
      "lastName": "Smith",
      "avatar": "avatar_url"
    },
    "type": "text",
    "content": {
      "text": "Hello, how are you?"
    },
    "status": "read",
    "timestamps": {
      "created": "2024-03-20T10:00:00Z",
      "updated": "2024-03-20T10:00:00Z",
      "delivered": "2024-03-20T10:00:01Z",
      "read": "2024-03-20T10:00:05Z"
    }
  }
}
```

### Update Message Status
```
PATCH /:messageId/status
```
Update the status of a message.

**Request Body:**
```json
{
  "status": "read"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "status": "read",
    "timestamps": {
      "created": "2024-03-20T10:00:00Z",
      "updated": "2024-03-20T10:00:05Z",
      "delivered": "2024-03-20T10:00:01Z",
      "read": "2024-03-20T10:00:05Z"
    }
  }
}
```

### Edit Message
```
PATCH /:messageId
```
Edit a message's content.

**Request Body:**
```json
{
  "content": {
    "text": "Updated message content"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "content": {
      "text": "Updated message content"
    },
    "metadata": {
      "isEdited": true,
      "editedAt": "2024-03-20T10:05:00Z"
    },
    "timestamps": {
      "created": "2024-03-20T10:00:00Z",
      "updated": "2024-03-20T10:05:00Z"
    }
  }
}
```

### Delete Message
```
DELETE /:messageId
```
Delete a message.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "metadata": {
      "isDeleted": true,
      "deletedAt": "2024-03-20T10:10:00Z"
    }
  }
}
```

### Forward Message
```
POST /:messageId/forward
```
Forward a message to another user.

**Request Body:**
```json
{
  "recipientId": "user_id"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "recipient": {
      "id": "user_id",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "avatar_url"
    },
    "metadata": {
      "isForwarded": true,
      "forwardedFrom": "original_message_id"
    }
  }
}
```

### Reply to Message
```
POST /:messageId/reply
```
Reply to a message.

**Request Body:**
```json
{
  "content": {
    "text": "Reply message"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "content": {
      "text": "Reply message"
    },
    "metadata": {
      "isReply": true,
      "replyTo": "original_message_id"
    }
  }
}
```

### Add Reaction
```
POST /:messageId/reaction
```
Add or remove a reaction to a message.

**Request Body:**
```json
{
  "emoji": "👍"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "message_id",
    "reactions": [
      {
        "user": {
          "id": "user_id",
          "firstName": "John",
          "lastName": "Doe"
        },
        "emoji": "👍",
        "createdAt": "2024-03-20T10:15:00Z"
      }
    ]
  }
}
```

### Get Unread Count
```
GET /unread/count
```
Get the count of unread messages.

**Response:**
```json
{
  "status": "success",
  "data": {
    "count": 5
  }
}
```

### Get Message Statistics
```
GET /stats
```
Get message statistics for the authenticated user.

**Response:**
```json
{
  "status": "success",
  "data": {
    "total": 100,
    "sent": 50,
    "received": 50,
    "read": 45,
    "unread": 5
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid request data",
  "errors": [
    {
      "field": "content",
      "message": "Content is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Please log in to access this resource"
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Not authorized to perform this action"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Message not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## Best Practices

### Message Creation
1. Always validate message content before sending
2. Use appropriate message types for different content
3. Include relevant metadata for better context
4. Handle media uploads separately from message creation

### Message Retrieval
1. Use pagination to limit response size
2. Implement proper caching strategies
3. Use appropriate indexes for efficient queries
4. Consider implementing real-time updates

### Message Management
1. Implement proper authorization checks
2. Maintain message history for audit purposes
3. Handle message deletion carefully
4. Implement proper error handling

### Performance
1. Use appropriate indexes for frequent queries
2. Implement caching for frequently accessed data
3. Use pagination for large result sets
4. Optimize media handling and storage

### Security
1. Validate all input data
2. Implement proper authorization checks
3. Sanitize message content
4. Handle sensitive data appropriately

## Example Usage

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const MessageList = ({ userId }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const response = await axios.get(`/api/messages/conversation/${userId}`);
        setMessages(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching messages');
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="message-list">
      {messages.map(message => (
        <div key={message.id} className="message">
          <div className="message-header">
            <img src={message.sender.avatar} alt="Avatar" />
            <span>{message.sender.firstName} {message.sender.lastName}</span>
          </div>
          <div className="message-content">
            {message.content.text}
          </div>
          <div className="message-footer">
            <span>{new Date(message.timestamps.created).toLocaleString()}</span>
            {message.metadata.isEdited && <span>(edited)</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageList;
```

### Message Creation Example
```jsx
const sendMessage = async (recipientId, content) => {
  try {
    const response = await axios.post('/api/messages', {
      recipient: recipientId,
      type: 'text',
      content: {
        text: content
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};
```

### Real-time Updates Example
```jsx
import { useEffect } from 'react';
import io from 'socket.io-client';

const useMessageUpdates = (userId) => {
  useEffect(() => {
    const socket = io('/messages');

    socket.on('new_message', (message) => {
      // Handle new message
      console.log('New message:', message);
    });

    socket.on('message_status', (update) => {
      // Handle message status update
      console.log('Message status:', update);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);
};
``` 