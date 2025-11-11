# Email Service Fix Design Document

## Overview

This design addresses the email service failures in the Confetti application by fixing SMTP configuration issues, improving error handling, and implementing proper validation. The solution focuses on correcting environment variable mismatches, SMTP security settings, and adding robust error handling with retry mechanisms.

## Architecture

### Current Issues Identified

1. **Environment Variable Mismatch**: Code expects `SMTP_PASSWORD` but .env defines `SMTP_PASS`
2. **Missing SMTP_FROM Variable**: Code references undefined `SMTP_FROM` environment variable
3. **Incorrect Security Configuration**: Port 465 requires `secure: true` but .env sets `SMTP_SECURE=false`
4. **Poor Error Handling**: Generic error catching without specific SMTP error diagnosis
5. **No Configuration Validation**: No startup validation of required email settings

### Solution Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │───▶│  Email Service   │───▶│  SMTP Server    │
│   Controllers   │    │   (Enhanced)     │    │  (Hostinger)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Configuration   │
                       │   Validator      │
                       └──────────────────┘
```

## Components and Interfaces

### 1. Configuration Manager

**Purpose**: Validate and normalize email configuration on startup

**Interface**:

```javascript
class EmailConfig {
  static validate()
  static getTransporterConfig()
  static getFromAddress()
}
```

**Responsibilities**:

- Validate all required environment variables
- Normalize configuration values
- Provide clear error messages for missing/invalid config

### 2. Enhanced Email Service

**Purpose**: Robust email sending with proper error handling and retry logic

**Interface**:

```javascript
class EmailService {
  static async sendEmail(options)
  static async sendWelcomeEmail(user)
  static async sendVerificationEmail(user, otp, token)
  static async testConnection()
}
```

**Responsibilities**:

- Send emails with retry logic
- Provide detailed error logging
- Handle connection failures gracefully
- Support connection testing

### 3. SMTP Transporter

**Purpose**: Properly configured nodemailer transporter with correct settings

**Configuration**:

```javascript
{
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true, // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  connectionTimeout: 60000,
  greetingTimeout: 30000,
  socketTimeout: 60000
}
```

## Data Models

### Environment Variables Schema

```javascript
{
  // Required SMTP Settings
  SMTP_HOST: string,           // 'smtp.hostinger.com'
  SMTP_PORT: number,           // 465
  SMTP_SECURE: boolean,        // true
  SMTP_USER: string,           // email address
  SMTP_PASS: string,           // email password
  FROM_EMAIL: string,          // sender email
  FROM_NAME: string,           // sender name

  // Optional Settings
  SMTP_CONNECTION_TIMEOUT: number,  // default: 60000
  SMTP_GREETING_TIMEOUT: number,    // default: 30000
  SMTP_SOCKET_TIMEOUT: number       // default: 60000
}
```

### Email Options Schema

```javascript
{
  to: string,
  subject: string,
  html?: string,
  text?: string,
  template?: string,
  variables?: object
}
```

## Error Handling

### Error Categories

1. **Configuration Errors**

   - Missing environment variables
   - Invalid configuration values
   - Malformed email addresses

2. **Connection Errors**

   - SMTP server unreachable
   - Authentication failures
   - Timeout errors

3. **Sending Errors**
   - Invalid recipient addresses
   - Message size limits
   - Rate limiting

### Error Handling Strategy

```javascript
// Retry configuration
const retryConfig = {
  attempts: 3,
  delay: 1000,
  backoff: "exponential",
  maxDelay: 10000,
};

// Error classification
const isRetryableError = (error) => {
  const retryableCodes = ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND"];
  return retryableCodes.includes(error.code);
};
```

### Logging Strategy

- **Configuration Issues**: ERROR level with specific missing variables
- **Connection Failures**: ERROR level with connection details (masked credentials)
- **Sending Failures**: ERROR level with recipient and error details
- **Successful Sends**: INFO level with message ID and recipient
- **Retry Attempts**: WARN level with attempt number and delay

## Testing Strategy

### Unit Tests

- Configuration validation logic
- Error handling and retry mechanisms
- Email template processing
- Environment variable parsing

### Integration Tests

- SMTP connection testing
- Email sending with real SMTP server
- Error scenarios (invalid credentials, unreachable server)
- Template rendering with variables

### Manual Testing

- Send test emails during development
- Verify email delivery to different providers
- Test error scenarios in development environment
- Validate email content and formatting

## Implementation Plan

### Phase 1: Configuration Fix

1. Update environment variables in .env file
2. Fix variable name mismatches in email.js
3. Correct SMTP security settings for port 465

### Phase 2: Enhanced Error Handling

1. Implement configuration validation
2. Add detailed error logging
3. Implement retry logic with exponential backoff

### Phase 3: Testing and Validation

1. Add connection testing functionality
2. Implement comprehensive error scenarios
3. Add email service health checks

## Security Considerations

- **Credential Protection**: Ensure SMTP credentials are properly secured in environment variables
- **TLS/SSL**: Use secure connections (port 465 with SSL or port 587 with STARTTLS)
- **Rate Limiting**: Implement sending rate limits to prevent abuse
- **Input Validation**: Validate email addresses and content before sending
- **Error Information**: Avoid exposing sensitive information in error messages
