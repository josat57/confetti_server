# Authentication API Documentation

## Overview

The Authentication API provides user registration, login, and OAuth integration functionality. It handles user authentication, session management, and social login capabilities.

## Base URL

```
/api/auth
```

## Endpoints

### 1. Register User

Register a new user account with optional subscription plan selection.

```http
POST /register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "userName": "johndoe",
  "phone": "+2348012345678",
  "planType": "planner",
  "planName": "Professional",
  "amount": 2900
}
```

**Request Parameters:**

- `email` (required): User's email address
- `password` (required): User's password (min 8 characters)
- `userName` (required): User's display name
- `phone` (optional): User's phone number
- `planType` (optional): Subscription plan type - "planner" or "vendor"
- `planName` (optional): Subscription plan name - "Starter", "Professional", "Enterprise"
- `amount` (optional): Plan amount in NGN (must match plan price)

**Response for Free Plan (200 OK):**

```json
{
  "status": "success",
  "message": "Registration successful. Please check your email to verify your account.",
  "data": {
    "userId": "user_id",
    "email": "user@example.com",
    "subscriptionId": "subscription_id"
  }
}
```

**Response for Paid Plan (200 OK):**

```json
{
  "status": "success",
  "message": "Registration successful. Please complete payment to activate your account.",
  "data": {
    "userId": "user_id",
    "email": "user@example.com",
    "subscriptionId": "subscription_id",
    "paymentUrl": "https://checkout.flutterwave.com/...",
    "reference": "SUB-1234567890-user_id",
    "amount": 2900
  }
}
```

**User Roles:**

- `admin`: System administrator
- `event-planner`: Event planning user (default for planner subscriptions)
- `vendor`: Vendor user (for vendor subscriptions)

**User Status:**

- `pending_payment`: User registered with paid plan, awaiting payment
- `pending_verification`: User registered, awaiting email verification
- `active`: User account is active and verified
- `suspended`: User account is suspended

### 2. Login

Authenticate a user and get access token.

```http
POST /login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

### 3. Logout

Logout the current user.

```http
POST /logout
```

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "message": "Successfully logged out"
}
```

### 4. Get Current User

Get the current authenticated user's information.

```http
GET /me
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
    "theme": "light"
  },
  "created_at": "2024-03-20T10:00:00Z",
  "updated_at": "2024-03-20T10:00:00Z"
}
```

### 5. Google OAuth

Authenticate with Google.

```http
GET /google
```

**Response:**
Redirects to Google OAuth consent screen.

### 6. Google OAuth Callback

Handle Google OAuth callback.

```http
GET /google/callback
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

### 7. Facebook OAuth

Authenticate with Facebook.

```http
GET /facebook
```

**Response:**
Redirects to Facebook OAuth consent screen.

### 8. Facebook OAuth Callback

Handle Facebook OAuth callback.

```http
GET /facebook/callback
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

### 9. Twitter OAuth

Authenticate with Twitter.

```http
GET /twitter
```

**Response:**
Redirects to Twitter OAuth consent screen.

### 10. Twitter OAuth Callback

Handle Twitter OAuth callback.

```http
GET /twitter/callback
```

**Response (200 OK):**

```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "user"
  },
  "token": "jwt_token_here"
}
```

### 11. Verify Email

Verify user's email address after registration.

```http
POST /verify-email
```

**Request Body:**

```json
{
  "token": "verification_token_here",
  "otp": "123456"
}
```

**Response (200 OK):**

```json
{
  "status": "success",
  "message": "Email verified successfully",
  "data": {
    "userId": "user_id",
    "email": "user@example.com",
    "status": "active"
  }
}
```

### 12. Refresh Token

Get a new access token using refresh token.

```http
POST /refresh
```

**Headers:**

```
Authorization: Bearer <refresh_token>
```

**Response (200 OK):**

```json
{
  "token": "new_jwt_token_here"
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
  "message": "Invalid credentials"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Account is disabled"
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

## Security Considerations

1. **Password Requirements**

   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character

2. **Token Security**

   - JWT tokens expire after 1 hour
   - Refresh tokens expire after 7 days
   - Tokens are stored in HTTP-only cookies
   - CSRF protection enabled

3. **Rate Limiting**

   - 5 login attempts per minute
   - 3 registration attempts per hour
   - 10 OAuth attempts per hour

4. **OAuth Security**
   - State parameter for CSRF protection
   - PKCE for mobile applications
   - Secure callback URLs
   - Email verification for OAuth accounts

## Best Practices

1. **Client Implementation**

   - Store tokens securely
   - Implement token refresh logic
   - Handle OAuth redirects properly
   - Implement proper error handling
   - Use HTTPS for all requests

2. **Error Handling**

   - Implement proper error messages
   - Handle network errors
   - Handle token expiration
   - Handle OAuth errors

3. **User Experience**

   - Show loading states
   - Provide clear error messages
   - Implement remember me functionality
   - Handle session timeouts gracefully

4. **Security**
   - Implement proper password validation
   - Use secure password storage
   - Implement proper session management
   - Handle OAuth security properly

## OAuth Configuration

### Google OAuth

```javascript
{
  "client_id": "your_google_client_id",
  "client_secret": "your_google_client_secret",
  "callback_url": "https://your-domain.com/api/auth/google/callback",
  "scopes": ["email", "profile"]
}
```

### Facebook OAuth

```javascript
{
  "client_id": "your_facebook_client_id",
  "client_secret": "your_facebook_client_secret",
  "callback_url": "https://your-domain.com/api/auth/facebook/callback",
  "scopes": ["email", "public_profile"]
}
```

### Twitter OAuth

```javascript
{
  "client_id": "your_twitter_client_id",
  "client_secret": "your_twitter_client_secret",
  "callback_url": "https://your-domain.com/api/auth/twitter/callback",
  "scopes": ["tweet.read", "users.read"]
}
```

## Example Usage

### React Implementation

```javascript
// Login component
const Login = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      // Handle successful login
      localStorage.setItem("token", data.token);
    } catch (error) {
      // Handle error
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={credentials.email}
        onChange={(e) =>
          setCredentials({
            ...credentials,
            email: e.target.value,
          })
        }
      />
      <input
        type="password"
        value={credentials.password}
        onChange={(e) =>
          setCredentials({
            ...credentials,
            password: e.target.value,
          })
        }
      />
      <button type="submit">Login</button>
    </form>
  );
};
```

### OAuth Implementation

```javascript
// OAuth login component
const OAuthLogin = () => {
  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google";
  };

  const handleFacebookLogin = () => {
    window.location.href = "/api/auth/facebook";
  };

  const handleTwitterLogin = () => {
    window.location.href = "/api/auth/twitter";
  };

  return (
    <div>
      <button onClick={handleGoogleLogin}>Login with Google</button>
      <button onClick={handleFacebookLogin}>Login with Facebook</button>
      <button onClick={handleTwitterLogin}>Login with Twitter</button>
    </div>
  );
};
```

### Token Refresh Implementation

```javascript
// Token refresh utility
const refreshToken = async () => {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("refreshToken")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    localStorage.setItem("token", data.token);
    return data.token;
  } catch (error) {
    // Handle error
    return null;
  }
};
```
