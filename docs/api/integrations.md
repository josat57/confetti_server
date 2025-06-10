# Integration API

## Overview

The Integration API provides endpoints for managing third-party integrations and API connections. It supports various integration types including payment gateways, notification services, analytics platforms, storage services, and communication tools.

## Base URL

```
/api/v1/integrations
```

## Authentication

All endpoints require authentication using a JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Create Integration

Create a new integration.

```
POST /
```

**Request Body**
```json
{
  "name": "Stripe Payment Gateway",
  "type": "payment",
  "provider": "stripe",
  "credentials": {
    "apiKey": "sk_test_...",
    "webhookSecret": "whsec_..."
  },
  "config": {
    "endpoints": {
      "api": "https://api.stripe.com/v1",
      "webhook": "https://api.example.com/webhooks/stripe"
    },
    "webhooks": [
      {
        "url": "https://api.example.com/webhooks/stripe",
        "events": ["payment_intent.succeeded", "payment_intent.failed"],
        "status": "active"
      }
    ],
    "settings": {
      "currency": "usd",
      "mode": "test"
    }
  },
  "metadata": {
    "version": "2020-08-27",
    "rateLimit": {
      "requests": 100,
      "period": 60
    },
    "features": ["payments", "refunds", "subscriptions"]
  },
  "permissions": {
    "public": false,
    "allowedUsers": ["user_id1", "user_id2"],
    "allowedRoles": ["admin", "finance"]
  }
}
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "integration_id",
    "name": "Stripe Payment Gateway",
    "type": "payment",
    "provider": "stripe",
    "status": "pending",
    "config": {
      "endpoints": {
        "api": "https://api.stripe.com/v1",
        "webhook": "https://api.example.com/webhooks/stripe"
      },
      "webhooks": [
        {
          "url": "https://api.example.com/webhooks/stripe",
          "events": ["payment_intent.succeeded", "payment_intent.failed"],
          "status": "active"
        }
      ],
      "settings": {
        "currency": "usd",
        "mode": "test"
      }
    },
    "metadata": {
      "version": "2020-08-27",
      "rateLimit": {
        "requests": 100,
        "period": 60
      },
      "features": ["payments", "refunds", "subscriptions"]
    },
    "permissions": {
      "public": false,
      "allowedUsers": ["user_id1", "user_id2"],
      "allowedRoles": ["admin", "finance"]
    },
    "owner": "user_id",
    "timestamps": {
      "created": "2024-03-20T10:00:00Z"
    }
  }
}
```

### Get Integration

Retrieve an integration by ID.

```
GET /:integrationId
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "integration_id",
    "name": "Stripe Payment Gateway",
    "type": "payment",
    "provider": "stripe",
    "status": "active",
    "config": {
      "endpoints": {
        "api": "https://api.stripe.com/v1",
        "webhook": "https://api.example.com/webhooks/stripe"
      },
      "webhooks": [
        {
          "url": "https://api.example.com/webhooks/stripe",
          "events": ["payment_intent.succeeded", "payment_intent.failed"],
          "status": "active"
        }
      ],
      "settings": {
        "currency": "usd",
        "mode": "test"
      }
    },
    "metadata": {
      "version": "2020-08-27",
      "lastSync": "2024-03-20T10:00:00Z",
      "rateLimit": {
        "requests": 100,
        "period": 60
      },
      "features": ["payments", "refunds", "subscriptions"]
    },
    "health": {
      "lastCheck": "2024-03-20T10:00:00Z",
      "status": "healthy",
      "metrics": {
        "responseTime": 150,
        "errorRate": 0.01,
        "uptime": 99.9
      }
    }
  }
}
```

### Get User Integrations

Retrieve all integrations for the authenticated user.

```
GET /
```

**Query Parameters**
- type: Filter by integration type (optional)
- status: Filter by integration status (optional)

**Response**
```json
{
  "status": "success",
  "data": [
    {
      "_id": "integration_id",
      "name": "Stripe Payment Gateway",
      "type": "payment",
      "provider": "stripe",
      "status": "active",
      "config": {
        "endpoints": {
          "api": "https://api.stripe.com/v1",
          "webhook": "https://api.example.com/webhooks/stripe"
        }
      },
      "metadata": {
        "version": "2020-08-27",
        "lastSync": "2024-03-20T10:00:00Z"
      },
      "health": {
        "status": "healthy",
        "metrics": {
          "responseTime": 150,
          "errorRate": 0.01,
          "uptime": 99.9
        }
      }
    }
  ]
}
```

### Update Integration

Update an existing integration.

```
PATCH /:integrationId
```

**Request Body**
```json
{
  "name": "Updated Integration Name",
  "status": "active",
  "config": {
    "settings": {
      "currency": "eur",
      "mode": "live"
    }
  },
  "permissions": {
    "public": true,
    "allowedRoles": ["admin"]
  }
}
```

**Response**
```json
{
  "status": "success",
  "data": {
    "_id": "integration_id",
    "name": "Updated Integration Name",
    "type": "payment",
    "provider": "stripe",
    "status": "active",
    "config": {
      "endpoints": {
        "api": "https://api.stripe.com/v1",
        "webhook": "https://api.example.com/webhooks/stripe"
      },
      "settings": {
        "currency": "eur",
        "mode": "live"
      }
    },
    "permissions": {
      "public": true,
      "allowedRoles": ["admin"]
    }
  }
}
```

### Delete Integration

Delete an integration.

```
DELETE /:integrationId
```

**Response**
```json
{
  "status": "success",
  "data": null
}
```

### Test Connection

Test the integration connection.

```
POST /:integrationId/test
```

**Response**
```json
{
  "status": "success",
  "data": {
    "connected": true,
    "responseTime": 150,
    "errorRate": 0.01,
    "uptime": 99.9
  }
}
```

### Handle Webhook

Handle incoming webhook events.

```
POST /:integrationId/webhook
```

**Request Body**
```json
{
  "event": "payment_intent.succeeded",
  "payload": {
    "id": "pi_123",
    "amount": 1000,
    "currency": "usd",
    "status": "succeeded"
  }
}
```

**Response**
```json
{
  "status": "success",
  "data": {
    "message": "Webhook processed successfully"
  }
}
```

### Refresh Tokens

Refresh integration access tokens.

```
POST /:integrationId/refresh
```

**Response**
```json
{
  "status": "success",
  "data": {
    "message": "Tokens refreshed successfully"
  }
}
```

### Get Logs

Retrieve integration logs.

```
GET /:integrationId/logs
```

**Query Parameters**
- level: Filter by log level (info, warning, error, debug)
- startDate: Filter logs after this date
- endDate: Filter logs before this date
- limit: Maximum number of logs to return (default: 50)

**Response**
```json
{
  "status": "success",
  "data": [
    {
      "timestamp": "2024-03-20T10:00:00Z",
      "level": "info",
      "message": "Integration initialized",
      "details": {
        "version": "2020-08-27"
      }
    }
  ]
}
```

### Get Health

Retrieve integration health status.

```
GET /:integrationId/health
```

**Response**
```json
{
  "status": "success",
  "data": {
    "lastCheck": "2024-03-20T10:00:00Z",
    "status": "healthy",
    "metrics": {
      "responseTime": 150,
      "errorRate": 0.01,
      "uptime": 99.9
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid integration type"
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
  "message": "Not authorized to access this integration"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Integration not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Failed to process integration request"
}
```

## Integration Types

1. **Payment Integrations**
   - Payment gateways
   - Subscription services
   - Refund processing
   - Payment analytics

2. **Notification Integrations**
   - Email services
   - SMS gateways
   - Push notification services
   - In-app notifications

3. **Analytics Integrations**
   - Usage tracking
   - Performance monitoring
   - User behavior analysis
   - Custom metrics

4. **Storage Integrations**
   - File storage
   - Media storage
   - Document management
   - Backup services

5. **Communication Integrations**
   - Chat services
   - Video conferencing
   - Email services
   - Social media

## Best Practices

1. **Security**:
   - Encrypt sensitive credentials
   - Use secure webhook endpoints
   - Implement proper access control
   - Monitor integration access

2. **Error Handling**:
   - Implement retry mechanisms
   - Log all integration errors
   - Set up error notifications
   - Monitor error rates

3. **Performance**:
   - Implement rate limiting
   - Cache frequently used data
   - Monitor response times
   - Set up performance alerts

4. **Maintenance**:
   - Regular health checks
   - Version management
   - Update credentials
   - Monitor API changes

## Example Usage

### Create Payment Integration
```javascript
const response = await fetch('/api/v1/integrations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Stripe Payment Gateway',
    type: 'payment',
    provider: 'stripe',
    credentials: {
      apiKey: 'sk_test_...',
      webhookSecret: 'whsec_...'
    },
    config: {
      endpoints: {
        api: 'https://api.stripe.com/v1',
        webhook: 'https://api.example.com/webhooks/stripe'
      },
      settings: {
        currency: 'usd',
        mode: 'test'
      }
    }
  })
});

const result = await response.json();
```

### Handle Webhook
```javascript
const response = await fetch(`/api/v1/integrations/${integrationId}/webhook`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event: 'payment_intent.succeeded',
    payload: {
      id: 'pi_123',
      amount: 1000,
      currency: 'usd',
      status: 'succeeded'
    }
  })
});

const result = await response.json();
```

### Monitor Health
```javascript
const response = await fetch(`/api/v1/integrations/${integrationId}/health`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();
``` 