# Confetti Server Application Documentation

## Table of Contents
1. [Application Overview](#1-application-overview)
2. [Process Flow](#2-process-flow)
3. [Data Flow](#3-data-flow)
4. [User Processes](#4-user-processes)
5. [System Architecture](#5-system-architecture)
6. [Security & Performance](#6-security--performance)
7. [User Journey Example](#7-user-journey-example)
8. [Module Details](#8-module-details)

## 1. Application Overview

Confetti Server is an AI-powered event planning platform that enables users to:
- Register and manage accounts (users, vendors, admins)
- Plan and manage events (with vendors, timelines, budgets, etc.)
- Communicate (messages, notifications)
- Handle payments (multi-currency, NGN base)
- Manage documents (uploads, sharing)
- Generate reports and analytics
- Integrate with third-party services
- Support mobile devices securely

### Key Technologies
- **Node.js/Express**: Main backend for business logic, REST APIs, and integrations
- **MongoDB**: Main database for storing users, events, vendors, etc.
- **Redis**: Caching, rate limiting, session management, and security monitoring
- **Python**: AI/ML services (vendor matching, price prediction, analytics)
- **Security**: JWT, rate limiting, input sanitization, device security, etc.

## 2. Process Flow

### A. User Registration & Authentication
1. User visits frontend and chooses to register or log in
2. Frontend sends request to `/api/auth/register` or `/api/auth/login`
3. Backend validates input (Joi schemas, sanitization)
4. User is created in MongoDB (with hashed password)
5. JWT token is issued and sent as an HTTP-only cookie
6. User is now authenticated for future requests

### B. Event Planning
1. User creates an event via `/api/events` (title, date, budget, etc.)
2. Event is stored in MongoDB, linked to the user
3. User adds vendors to the event (search, invite, assign)
4. Timeline, checklist, documents are managed per event
5. Event analytics are generated and available via `/api/analytics/event/:id`

### C. Vendor Management
1. Vendors register and create profiles via `/api/vendors`
2. Vendors list services, pricing, availability
3. Users can review, rate, and book vendors for events
4. Vendor analytics and performance metrics are available

### D. Communication
1. Users and vendors exchange messages via `/api/messages`
2. Notifications (event updates, system alerts) are sent via `/api/notifications`
3. Push notifications are sent to mobile devices

### E. Payments
1. User initiates payment for vendor or event
2. Payment is processed (multi-currency, converted to NGN)
3. Payment status is tracked and updated
4. Receipts and payment analytics are available

### F. Document Management
1. Users upload documents (contracts, images, etc.) via `/api/documents`
2. Documents are stored (with metadata, permissions)
3. Documents can be shared, versioned, or archived

### G. Reporting & Analytics
1. Users/admins request reports via `/api/reports`
2. Reports are generated, scheduled, and downloadable
3. Analytics endpoints provide insights into events, vendors, users, and revenue

### H. Integrations & Mobile
1. Integrations with third-party services (calendar, email, etc.) are managed via `/api/integrations`
2. Mobile devices are registered, managed, and secured via `/api/mobile`

## 3. Data Flow

### High-Level Data Flow
```
[Frontend/Mobile]
↓ (HTTP Request)
[API Gateway/Express Server]
↓ (Authentication, Validation, Security Middleware)
[Controllers]
↓
[Services]
↓
[MongoDB/Redis]
↔ (For AI/ML) [Python Microservices]
```

### Example: Event Creation Flow
1. Frontend → API: POST `/api/events` (event data)
2. API → Validation Middleware: Validate input
3. API → EventController: Create event
4. EventController → EventService: Business logic
5. EventService → MongoDB: Store event
6. MongoDB → EventService: Confirmation
7. EventService → EventController: Return event
8. EventController → API: Respond to frontend

## 4. User Processes

### A. Register & Login
- User fills registration form → `/api/auth/register`
- Receives confirmation, logs in → `/api/auth/login`
- Receives JWT token, can now access protected endpoints

### B. Plan an Event
- User creates event → `/api/events`
- Adds vendors → `/api/events/:id/vendors`
- Uploads documents → `/api/documents`
- Manages timeline/checklist → `/api/events/:id/timeline`, `/api/events/:id/checklist`
- Views analytics → `/api/analytics/event/:id`

### C. Vendor Interaction
- Vendor registers → `/api/vendors`
- Updates profile, sets availability
- Receives booking requests, messages, and notifications
- Views performance analytics

### D. Messaging & Notifications
- User sends message → `/api/messages`
- Receives notifications (event updates, system alerts) → `/api/notifications`
- Mobile device receives push notification

### E. Payments
- User initiates payment → `/api/payments`
- Payment processed, status updated
- User/vendor views payment history and analytics

### F. Document Management
- User uploads document → `/api/documents`
- Shares with event participants or vendors
- Manages versions, permissions

### G. Reporting
- User/admin requests report → `/api/reports`
- Downloads or schedules report

### H. Mobile Device Management
- User registers device → `/api/mobile`
- Receives push notifications
- Device security checks and rate limiting enforced

## 5. System Architecture

### Key Components
1. **API Layer**
   - Express.js server
   - Route handlers
   - Middleware (auth, validation, security)
   - Error handling

2. **Service Layer**
   - Business logic
   - Data processing
   - External service integration
   - AI/ML service communication

3. **Data Layer**
   - MongoDB (main database)
   - Redis (caching, sessions)
   - File storage (documents, images)

4. **Security Layer**
   - JWT authentication
   - Rate limiting
   - Input validation
   - Device security
   - Monitoring and logging

## 6. Security & Performance

### Security Features
- JWT Authentication
- Rate Limiting
- Input Validation & Sanitization
- Device Security
- Monitoring & Logging

### Performance Optimizations
- Redis caching
- Database indexing
- Request validation
- Error handling
- Security monitoring

## 7. User Journey Example

1. **Alice registers and logs in**
2. **Alice creates an event** for her wedding
3. **Alice searches for vendors** (caterers, decorators) and adds them to her event
4. **Alice uploads documents** (venue contract, guest list)
5. **Alice sends messages** to vendors and receives notifications about updates
6. **Alice pays a vendor** using her preferred payment method
7. **Alice views analytics** about her event and vendor performance
8. **Alice downloads a report** summarizing her event
9. **Alice manages her account and preferences** via the user profile

## 8. Module Details

### Key Modules & Flows

| Module         | Main Endpoints         | Data Flow (CRUD)         | User Process Example                |
|----------------|-----------------------|--------------------------|-------------------------------------|
| Auth           | /api/auth/*           | User <-> MongoDB         | Register, login, logout             |
| Events         | /api/events/*         | Event <-> MongoDB        | Create/manage event, add vendors    |
| Vendors        | /api/vendors/*        | Vendor <-> MongoDB       | Register, update, get analytics     |
| Messages       | /api/messages/*       | Message <-> MongoDB      | Send/receive messages               |
| Notifications  | /api/notifications/*  | Notification <-> MongoDB | Receive event/system notifications  |
| Payments       | /api/payments/*       | Payment <-> MongoDB      | Pay for vendor/event, get receipts  |
| Documents      | /api/documents/*      | Document <-> MongoDB     | Upload/share documents              |
| Reports        | /api/reports/*        | Report <-> MongoDB       | Generate/download reports           |
| Integrations   | /api/integrations/*   | Integration <-> MongoDB  | Connect 3rd-party services          |
| Mobile         | /api/mobile/*         | Device <-> MongoDB       | Register device, receive push       |
| Security       | Middleware            | Redis, Logging           | Rate limiting, input validation     | 