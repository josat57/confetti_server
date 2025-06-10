# Mobile API Documentation

## Overview
The Mobile API provides endpoints for managing mobile devices, handling push notifications, and tracking device analytics. This API enables seamless integration with iOS and Android applications.

## Base URL
```
/api/v1/mobile
```

## Authentication
All endpoints require authentication using a JWT token. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### Device Management

#### Register Device
```http
POST /devices
```
Register a new mobile device for the authenticated user.

**Request Body:**
```json
{
  "deviceId": "string",
  "name": "string",
  "model": "string",
  "platform": "ios|android",
  "osVersion": "string",
  "appVersion": "string",
  "pushToken": "string",
  "pushType": "fcm|apns",
  "preferences": {
    "notifications": true,
    "location": true,
    "theme": "light|dark|system"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "deviceId": "string",
    "name": "string",
    "model": "string",
    "platform": "string",
    "osVersion": "string",
    "appVersion": "string",
    "pushToken": "string",
    "pushType": "string",
    "preferences": {
      "notifications": true,
      "location": true,
      "theme": "string"
    },
    "status": "active",
    "lastActive": "2024-03-21T12:00:00Z",
    "createdAt": "2024-03-21T12:00:00Z",
    "updatedAt": "2024-03-21T12:00:00Z"
  }
}
```

#### Get User Devices
```http
GET /devices
```
Retrieve all devices registered for the authenticated user.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "string",
      "deviceId": "string",
      "name": "string",
      "model": "string",
      "platform": "string",
      "status": "string",
      "lastActive": "2024-03-21T12:00:00Z"
    }
  ]
}
```

#### Get Device
```http
GET /devices/:deviceId
```
Retrieve details for a specific device.

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "deviceId": "string",
    "name": "string",
    "model": "string",
    "platform": "string",
    "osVersion": "string",
    "appVersion": "string",
    "pushToken": "string",
    "pushType": "string",
    "preferences": {
      "notifications": true,
      "location": true,
      "theme": "string"
    },
    "status": "string",
    "lastActive": "2024-03-21T12:00:00Z",
    "location": {
      "type": "Point",
      "coordinates": [longitude, latitude]
    },
    "metadata": {
      "batteryLevel": 0.85,
      "isCharging": true,
      "networkType": "wifi"
    }
  }
}
```

#### Update Device
```http
PATCH /devices/:deviceId
```
Update device information and preferences.

**Request Body:**
```json
{
  "name": "string",
  "preferences": {
    "notifications": true,
    "location": true,
    "theme": "light|dark|system"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "name": "string",
    "preferences": {
      "notifications": true,
      "location": true,
      "theme": "string"
    },
    "updatedAt": "2024-03-21T12:00:00Z"
  }
}
```

#### Delete Device
```http
DELETE /devices/:deviceId
```
Unregister a device.

**Response:**
```json
{
  "status": "success",
  "data": null
}
```

### Location and Metadata

#### Update Location
```http
PATCH /devices/:deviceId/location
```
Update device location.

**Request Body:**
```json
{
  "coordinates": [longitude, latitude]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "location": {
      "type": "Point",
      "coordinates": [longitude, latitude]
    },
    "updatedAt": "2024-03-21T12:00:00Z"
  }
}
```

#### Update Metadata
```http
PATCH /devices/:deviceId/metadata
```
Update device metadata.

**Request Body:**
```json
{
  "batteryLevel": 0.85,
  "isCharging": true,
  "networkType": "wifi",
  "appState": "foreground|background",
  "memoryUsage": 0.65
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "metadata": {
      "batteryLevel": 0.85,
      "isCharging": true,
      "networkType": "wifi",
      "appState": "string",
      "memoryUsage": 0.65
    },
    "updatedAt": "2024-03-21T12:00:00Z"
  }
}
```

### Push Notifications

#### Update Push Token
```http
PATCH /devices/:deviceId/push-token
```
Update device push notification token.

**Request Body:**
```json
{
  "token": "string",
  "type": "fcm|apns"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "pushToken": "string",
    "pushType": "string",
    "updatedAt": "2024-03-21T12:00:00Z"
  }
}
```

#### Send Push Notification
```http
POST /notifications
```
Send a push notification to the user's devices.

**Request Body:**
```json
{
  "title": "string",
  "body": "string",
  "data": {
    "key": "value"
  },
  "sound": "default",
  "badge": 1,
  "channelId": "string",
  "clickAction": "string"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "success": true,
    "messageId": "string",
    "recipients": 1
  }
}
```

### Analytics and Discovery

#### Get Nearby Devices
```http
GET /devices/nearby?coordinates=longitude,latitude&maxDistance=1000
```
Find devices near a specific location.

**Query Parameters:**
- `coordinates`: Comma-separated longitude and latitude
- `maxDistance`: Maximum distance in meters (optional)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "id": "string",
      "name": "string",
      "model": "string",
      "platform": "string",
      "distance": 500,
      "lastActive": "2024-03-21T12:00:00Z"
    }
  ]
}
```

#### Get Device Analytics
```http
GET /analytics
```
Get analytics data for the user's devices.

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalDevices": 2,
    "activeDevices": 1,
    "platforms": {
      "ios": 1,
      "android": 1
    },
    "averageSessionDuration": 3600,
    "notificationStats": {
      "sent": 100,
      "delivered": 95,
      "opened": 80
    },
    "locationStats": {
      "totalUpdates": 1000,
      "averageAccuracy": 10
    }
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Invalid request parameters",
  "errors": [
    {
      "field": "string",
      "message": "string"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Access denied"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Device not found"
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

### Device Registration
1. Register devices as soon as the app launches
2. Include all required device information
3. Update device information when significant changes occur
4. Handle push token updates properly

### Push Notifications
1. Use meaningful titles and bodies
2. Include relevant data for deep linking
3. Set appropriate sound and badge values
4. Use notification channels for Android
5. Handle notification permissions properly

### Location Updates
1. Update location only when necessary
2. Consider battery impact
3. Use appropriate accuracy levels
4. Handle location permissions properly

### Analytics
1. Track important metrics
2. Monitor device health
3. Analyze user engagement
4. Use data for optimization

## Example Usage

### React Native Device Registration
```javascript
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import messaging from '@react-native-firebase/messaging';

const registerDevice = async () => {
  try {
    const pushToken = await messaging().getToken();
    const response = await fetch('https://api.example.com/api/v1/mobile/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        deviceId: await DeviceInfo.getUniqueId(),
        name: await DeviceInfo.getDeviceName(),
        model: DeviceInfo.getModel(),
        platform: Platform.OS,
        osVersion: Platform.Version,
        appVersion: DeviceInfo.getVersion(),
        pushToken,
        pushType: Platform.OS === 'ios' ? 'apns' : 'fcm',
        preferences: {
          notifications: true,
          location: true,
          theme: 'system'
        }
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Device registration failed:', error);
    throw error;
  }
};
```

### React Native Push Notifications
```javascript
import messaging from '@react-native-firebase/messaging';

const setupPushNotifications = async () => {
  try {
    // Request permission
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED;

    if (enabled) {
      // Get token
      const token = await messaging().getToken();
      
      // Update token on server
      await updatePushToken(token);
      
      // Handle token refresh
      messaging().onTokenRefresh(async (token) => {
        await updatePushToken(token);
      });
      
      // Handle notifications
      messaging().onMessage(async (remoteMessage) => {
        // Handle foreground messages
        console.log('Received foreground message:', remoteMessage);
      });
      
      // Handle notification open
      messaging().onNotificationOpenedApp((remoteMessage) => {
        // Handle background messages
        console.log('App opened from background:', remoteMessage);
      });
    }
  } catch (error) {
    console.error('Push notification setup failed:', error);
  }
};
```

### React Native Location Updates
```javascript
import Geolocation from '@react-native-community/geolocation';

const updateLocation = async () => {
  try {
    Geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;
        await fetch('https://api.example.com/api/v1/mobile/devices/current/location', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify({
            coordinates: [longitude, latitude]
          })
        });
      },
      (error) => console.error('Location error:', error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  } catch (error) {
    console.error('Location update failed:', error);
  }
};
``` 