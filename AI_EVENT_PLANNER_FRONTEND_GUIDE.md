# AI Event Planner - Frontend Integration Guide

## 📋 Overview

The AI Event Planner is a free, public-facing lead generation tool that generates comprehensive event plans using AI/ML. Users can get budget breakdowns, vendor recommendations, and timelines without authentication.

**Backend Status:** ✅ 100% Complete and Production Ready

---

## 🎯 User Flow

```
1. User fills event planning form (no auth required)
   ↓
2. Submit to API → Get session token + teaser result
   ↓
3. Display teaser with "locked" vendor details
   ↓
4. CTA: "Sign up to unlock full plan"
   ↓
5. After signup → Associate plan with user account
   ↓
6. Show full plan with vendor contact info
```

---

## 🔌 API Integration

### Base URL

```
Development: http://localhost:9600/api/v1/ai-planner
Production: https://your-domain.com/api/v1/ai-planner
```

### Rate Limiting

- **5 requests per IP per hour** for `/analyze` endpoint
- Headers returned:
  - `X-RateLimit-Limit: 5`
  - `X-RateLimit-Remaining: 4`
  - `X-RateLimit-Reset: <timestamp>`

---

## 📡 API Endpoints

### 1. Generate Event Plan (Public)

**Endpoint:** `POST /analyze`

**Rate Limited:** Yes (5 requests/hour)

**Request Body:**

```typescript
interface EventPlanRequest {
  eventType:
    | "wedding"
    | "corporate"
    | "birthday"
    | "graduation"
    | "conference"
    | "other";
  eventDate: string; // ISO 8601 format: "2025-06-15"
  guestCount: number; // 1-10000
  location: {
    city: string; // Required
    state: string; // Required
    country: string; // Default: "Nigeria"
    address: string; // Required
    coordinates?: [number, number]; // Optional: [longitude, latitude]
  };
  eventDescription: string; // 50-1000 characters
  guestClass: {
    ageGroups: Array<
      "children" | "teenagers" | "young_adults" | "adults" | "seniors"
    >;
    formality: "casual" | "semi-formal" | "formal" | "black-tie";
    socialStatus: Array<
      "budget-conscious" | "middle-class" | "affluent" | "luxury"
    >;
    specialRequirements: Array<
      | "dietary-restrictions"
      | "accessibility-needs"
      | "cultural-considerations"
      | "religious-considerations"
    >;
    additionalDetails?: string; // Max 500 characters
  };
  budget: {
    amount: number; // Minimum varies by currency
    currency: "NGN" | "USD" | "EUR" | "GBP";
  };
}
```

**Example Request:**

```javascript
const response = await fetch(
  "http://localhost:9600/api/v1/ai-planner/analyze",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventType: "wedding",
      eventDate: "2025-06-15",
      guestCount: 200,
      location: {
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        address: "Victoria Island",
        coordinates: [3.4219, 6.4281], // Optional
      },
      eventDescription:
        "Beautiful outdoor wedding with garden theme and elegant decorations for a memorable celebration",
      guestClass: {
        ageGroups: ["adults", "seniors"],
        formality: "formal",
        socialStatus: ["middle-class", "affluent"],
        specialRequirements: ["dietary-restrictions"],
        additionalDetails:
          "Prefer vegetarian options and wheelchair accessibility",
      },
      budget: {
        amount: 5000000,
        currency: "NGN",
      },
    }),
  }
);

const data = await response.json();
```

**Success Response (200):**

```typescript
{
  status: "success";
  message: "Event plan generated successfully";
  data: {
    sessionToken: string; // 64-character hex string
    eventPlan: EventPlanTeaser; // See structure below
    expiresAt: string; // ISO 8601 timestamp
  }
  meta: {
    processingTime: number; // milliseconds
  }
}
```

**Error Responses:**

**400 - Insufficient Budget:**

```json
{
  "status": "error",
  "code": "INSUFFICIENT_BUDGET",
  "message": "The budget is too low for this event type",
  "data": {
    "minimumBudget": 3000000,
    "suggestedBudget": 3600000,
    "alternatives": [
      "Reduce guest count",
      "Choose a more budget-friendly venue",
      "Opt for buffet-style catering"
    ]
  }
}
```

**400 - Validation Error:**

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "Validation failed for eventDescription: Event description must be at least 50 characters",
  "field": "eventDescription"
}
```

**429 - Rate Limit Exceeded:**

```json
{
  "status": "error",
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Please try again later.",
  "data": {
    "retryAfter": 3600,
    "retryAfterMinutes": 60
  }
}
```

**408 - Processing Timeout:**

```json
{
  "status": "error",
  "code": "PROCESSING_TIMEOUT",
  "message": "Event plan processing timed out. Please try again.",
  "data": {
    "retryable": true,
    "suggestion": "Please try again in a few moments"
  }
}
```

---

### 2. Retrieve Event Plan (Public)

**Endpoint:** `GET /result/:sessionToken`

**No Authentication Required**

**Example Request:**

```javascript
const response = await fetch(
  `http://localhost:9600/api/v1/ai-planner/result/${sessionToken}`
);
const data = await response.json();
```

**Success Response (200):**

```typescript
{
  status: "success";
  data: {
    eventPlan: EventPlanTeaser;
    canUpgrade: boolean; // true if user can sign up to unlock
  }
}
```

**Error Response (404):**

```json
{
  "status": "error",
  "code": "INVALID_SESSION",
  "message": "Session token not found or has expired",
  "data": {
    "suggestion": "Please generate a new event plan"
  }
}
```

---

### 3. Save Event Plan (Private)

**Endpoint:** `POST /save`

**Authentication:** Required (Bearer token)

**Request Body:**

```typescript
{
  sessionToken: string;
}
```

**Example Request:**

```javascript
const response = await fetch("http://localhost:9600/api/v1/ai-planner/save", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  },
  body: JSON.stringify({
    sessionToken: sessionToken,
  }),
});
```

**Success Response (200):**

```json
{
  "status": "success",
  "message": "Event plan saved successfully",
  "data": {
    "eventId": "507f1f77bcf86cd799439011",
    "message": "Sign up complete! Your event plan has been saved."
  }
}
```

---

### 4. Get Full Event Plan (Private)

**Endpoint:** `GET /full/:eventId`

**Authentication:** Required (Bearer token)

**Example Request:**

```javascript
const response = await fetch(
  `http://localhost:9600/api/v1/ai-planner/full/${eventId}`,
  {
    headers: {
      Authorization: `Bearer ${userToken}`,
    },
  }
);
```

---

### 5. Health Check (Public)

**Endpoint:** `GET /health`

**Example Request:**

```javascript
const response = await fetch("http://localhost:9600/api/v1/ai-planner/health");
const data = await response.json();
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "services": {
      "nlp": "operational",
      "budget_optimizer": "operational",
      "vendor_matcher": "operational",
      "recommendation_engine": "operational"
    },
    "version": "1.0.0",
    "timestamp": "2025-01-11T10:00:00Z"
  }
}
```

---

## 📦 Data Structures

### EventPlanTeaser (Public Preview)

```typescript
interface EventPlanTeaser {
  eventSummary: {
    eventType: string;
    eventDate: string; // ISO 8601
    location: string; // "City, State"
    guestCount: number;
    totalBudget: number;
    currency: string;
    formality: string;
  };

  budgetBreakdown: {
    categories: Array<{
      name: string; // Display name
      category: string; // Internal category name
      percentage: number; // 0-100
      amount: number; // In user's currency
      priority: "essential" | "recommended" | "optional";
      confidence: number; // 0-100
      description: string; // Rationale
    }>;
    totalAllocated: number;
    contingency: number;
    feasibilityScore: number; // 0-100
  };

  vendorCategories: Array<{
    name: string; // Display name
    category: string; // Internal name
    description: string;
    estimatedCost: {
      min: number;
      max: number;
    };
    allocatedAmount: number;
    priority: "essential" | "recommended" | "optional";
    locked: true; // Always true for teaser
    vendorCount: number; // Number of vendors available
  }>;

  timeline: {
    planningMilestones: Array<{
      title: string;
      timeframe: string;
      description: string;
      status: "active" | "upcoming" | "overdue";
    }>;
    eventDayHighlights: Array<{
      time: string; // "02:00 PM"
      activity: string;
    }>;
    detailedTimelineLocked: true; // Always true for teaser
    metadata: {
      generatedAt: string;
      processingTime: number;
      daysUntilEvent: number;
    };
  };

  recommendations: string[]; // Array of recommendation strings

  aiInsights: {
    sentiment: {
      score: number; // 0-1
      label: "positive" | "neutral" | "negative";
    };
    keywords: string[];
    feasibilityScore: number; // 0-100
  };
}
```

---

## 🎨 UI/UX Guidelines

### Form Design

**Required Fields:**

- Event Type (dropdown)
- Event Date (date picker - future dates only)
- Guest Count (number input: 1-10,000)
- Location (city, state, address)
- Event Description (textarea: 50-1,000 chars)
- Guest Class (checkboxes + dropdown)
- Budget Amount (number input)
- Currency (dropdown: NGN, USD, EUR, GBP)

**Validation:**

- Real-time validation as user types
- Show character counter for text fields
- Highlight invalid fields with red border
- Display inline error messages
- Disable submit button until all fields valid
- Show loading state during submission (3-5 seconds)

**Example Validation Messages:**

```javascript
const validationMessages = {
  eventDescription: {
    tooShort: "Please provide at least 50 characters describing your event",
    tooLong: "Description cannot exceed 1,000 characters",
  },
  eventDate: {
    pastDate: "Event date must be in the future",
    invalid: "Please select a valid date",
  },
  budget: {
    tooLow: "Minimum budget for this event type is ₦{amount}",
    invalid: "Please enter a valid budget amount",
  },
};
```

---

### Teaser Result Display

**Layout Sections:**

1. **Event Summary Card**

   - Event type icon
   - Date, location, guest count
   - Total budget with currency
   - Feasibility score (color-coded: <60 red, 60-75 yellow, >75 green)

2. **Budget Breakdown**

   - Pie chart or bar chart
   - List of categories with percentages and amounts
   - Priority badges (Essential, Recommended, Optional)
   - Confidence indicators

3. **Vendor Categories**

   - Grid or list view
   - Each category shows:
     - Icon
     - Name
     - Estimated cost range
     - Number of vendors available
     - 🔒 Lock icon with "Sign up to unlock"
   - Blur effect on vendor details

4. **Timeline**

   - Vertical timeline with milestones
   - Event day schedule preview
   - 🔒 "Sign up for detailed timeline"

5. **AI Insights**

   - Sentiment indicator
   - Keywords as tags
   - Feasibility score with explanation

6. **Recommendations**
   - List of 5-8 recommendations
   - Icons for different types (budget, vendor, timeline)

**Call-to-Action Buttons:**

```html
<!-- Primary CTA -->
<button class="cta-primary">Sign Up to Unlock Full Plan</button>

<!-- Secondary CTA -->
<button class="cta-secondary">Save & Continue Later</button>

<!-- Tertiary -->
<a href="#" class="cta-link"> Email Me This Plan </a>
```

---

### Loading States

**During Analysis (3-5 seconds):**

```javascript
const loadingMessages = [
  "Analyzing your event requirements...",
  "Searching for vendors in your area...",
  "Optimizing your budget allocation...",
  "Generating personalized recommendations...",
  "Creating your event timeline...",
  "Finalizing your event plan...",
];

// Rotate messages every 800ms
```

**Visual:**

- Progress bar or spinner
- Animated messages
- Estimated time remaining
- "This usually takes 3-5 seconds"

---

### Error Handling

**Rate Limit Exceeded:**

```jsx
<ErrorMessage type="warning">
  <h3>You've reached your limit</h3>
  <p>You can generate 5 event plans per hour.</p>
  <p>
    Try again in {minutesRemaining} minutes, or sign up for unlimited access.
  </p>
  <button>Sign Up Now</button>
</ErrorMessage>
```

**Insufficient Budget:**

```jsx
<ErrorMessage type="info">
  <h3>Budget Adjustment Needed</h3>
  <p>
    Your budget of {amount} {currency} is below the recommended minimum of{" "}
    {minBudget} {currency} for a {eventType} with {guestCount} guests.
  </p>
  <h4>Suggestions:</h4>
  <ul>
    {alternatives.map((alt) => (
      <li>{alt}</li>
    ))}
  </ul>
  <button>Adjust Budget</button>
  <button>Continue Anyway</button>
</ErrorMessage>
```

**Processing Timeout:**

```jsx
<ErrorMessage type="error">
  <h3>Taking Longer Than Expected</h3>
  <p>Our AI is working hard on your event plan. Please try again.</p>
  <button>Retry</button>
</ErrorMessage>
```

---

## 💾 State Management

### Recommended State Structure

```typescript
interface AIEventPlannerState {
  // Form state
  formData: EventPlanRequest | null;
  formErrors: Record<string, string>;
  isFormValid: boolean;

  // API state
  isLoading: boolean;
  loadingMessage: string;
  error: ApiError | null;

  // Result state
  sessionToken: string | null;
  eventPlan: EventPlanTeaser | null;
  expiresAt: string | null;

  // Rate limiting
  rateLimitRemaining: number;
  rateLimitReset: number;

  // UI state
  currentStep: "form" | "loading" | "result" | "error";
  showSignupModal: boolean;
}
```

### Example React Hook

```typescript
import { useState, useCallback } from "react";

export function useAIEventPlanner() {
  const [state, setState] = useState<AIEventPlannerState>({
    formData: null,
    formErrors: {},
    isFormValid: false,
    isLoading: false,
    loadingMessage: "",
    error: null,
    sessionToken: null,
    eventPlan: null,
    expiresAt: null,
    rateLimitRemaining: 5,
    rateLimitReset: 0,
    currentStep: "form",
    showSignupModal: false,
  });

  const generateEventPlan = useCallback(async (formData: EventPlanRequest) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      currentStep: "loading",
      error: null,
    }));

    try {
      const response = await fetch("/api/v1/ai-planner/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      // Update rate limit info from headers
      const rateLimitRemaining = parseInt(
        response.headers.get("X-RateLimit-Remaining") || "5"
      );
      const rateLimitReset = parseInt(
        response.headers.get("X-RateLimit-Reset") || "0"
      );

      if (!response.ok) {
        const error = await response.json();
        throw error;
      }

      const data = await response.json();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentStep: "result",
        sessionToken: data.data.sessionToken,
        eventPlan: data.data.eventPlan,
        expiresAt: data.data.expiresAt,
        rateLimitRemaining,
        rateLimitReset,
      }));

      return data;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentStep: "error",
        error: error,
      }));
      throw error;
    }
  }, []);

  return {
    ...state,
    generateEventPlan,
  };
}
```

---

## 🎯 Conversion Optimization

### Key Metrics to Track

```typescript
// Analytics events to implement
const trackingEvents = {
  // Form interactions
  form_started: { eventType: string },
  form_field_completed: { field: string },
  form_abandoned: { lastField: string, progress: number },
  form_submitted: { eventType: string, guestCount: number, budget: number },

  // Results
  teaser_viewed: { sessionToken: string, feasibilityScore: number },
  category_expanded: { category: string },
  recommendation_viewed: { index: number },

  // Conversion
  signup_clicked: { source: "primary_cta" | "secondary_cta" | "vendor_unlock" },
  plan_saved: { sessionToken: string },
  full_plan_viewed: { eventId: string },
};
```

### A/B Testing Opportunities

1. **CTA Button Text:**

   - "Sign Up to Unlock" vs "See Full Plan" vs "Get Vendor Contacts"

2. **Teaser Reveal:**

   - Show 3 vendors blurred vs Show category only vs Show count only

3. **Pricing Display:**

   - Show ranges vs Show exact amounts vs Show "from X"

4. **Social Proof:**
   - "Join 10,000+ event planners" vs "Trusted by 500+ vendors"

---

## 🔒 Security Considerations

### Client-Side

1. **Input Sanitization:**

   - Strip HTML tags from text inputs
   - Validate all fields before submission
   - Limit file uploads (if adding image support)

2. **Rate Limit Handling:**

   - Store rate limit info in localStorage
   - Show countdown timer when limit reached
   - Disable form submission when rate limited

3. **Session Management:**
   - Store session token securely (not in localStorage for sensitive data)
   - Clear session token after 24 hours
   - Handle expired sessions gracefully

### Example Security Implementation

```typescript
// Sanitize user input
function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .trim()
    .slice(0, 1000); // Limit length
}

// Check rate limit before submission
function canSubmitForm(): boolean {
  const rateLimitReset = localStorage.getItem("ai_planner_rate_limit_reset");
  if (rateLimitReset && Date.now() < parseInt(rateLimitReset)) {
    return false;
  }
  return true;
}

// Handle session expiry
function isSessionValid(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}
```

---

## 📱 Responsive Design

### Breakpoints

```css
/* Mobile First */
.event-planner-form {
  /* Base styles for mobile */
}

/* Tablet */
@media (min-width: 768px) {
  .event-planner-form {
    /* Tablet styles */
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .event-planner-form {
    /* Desktop styles */
  }
}
```

### Mobile Considerations

- Use native date picker on mobile
- Stack form fields vertically
- Make touch targets at least 44x44px
- Use bottom sheet for modals
- Optimize map picker for touch
- Show simplified budget breakdown on mobile

---

## 🧪 Testing Checklist

### Functional Testing

- [ ] Form validation works for all fields
- [ ] Submit button disabled when form invalid
- [ ] Loading state shows during API call
- [ ] Success state displays teaser correctly
- [ ] Error states handled gracefully
- [ ] Rate limiting works correctly
- [ ] Session token stored and retrieved
- [ ] Currency conversion displays correctly
- [ ] Timeline renders properly
- [ ] Recommendations display
- [ ] CTA buttons work
- [ ] Signup flow completes

### Edge Cases

- [ ] Very long event descriptions (1000 chars)
- [ ] Very large guest counts (10,000)
- [ ] Very small budgets (minimum)
- [ ] Past event dates (should error)
- [ ] Invalid coordinates
- [ ] Special characters in text fields
- [ ] Network timeout
- [ ] API errors
- [ ] Expired session tokens
- [ ] Rate limit exceeded

### Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## 📊 Sample Data for Testing

### Test Event 1: Wedding (Lagos)

```json
{
  "eventType": "wedding",
  "eventDate": "2025-06-15",
  "guestCount": 200,
  "location": {
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "address": "Victoria Island",
    "coordinates": [3.4219, 6.4281]
  },
  "eventDescription": "Beautiful outdoor wedding with garden theme and elegant decorations for a memorable celebration with family and friends",
  "guestClass": {
    "ageGroups": ["adults", "seniors"],
    "formality": "formal",
    "socialStatus": ["middle-class", "affluent"],
    "specialRequirements": ["dietary-restrictions"],
    "additionalDetails": "Prefer vegetarian options"
  },
  "budget": {
    "amount": 5000000,
    "currency": "NGN"
  }
}
```

### Test Event 2: Corporate (Abuja)

```json
{
  "eventType": "corporate",
  "eventDate": "2025-03-20",
  "guestCount": 150,
  "location": {
    "city": "Abuja",
    "state": "FCT",
    "country": "Nigeria",
    "address": "Maitama District"
  },
  "eventDescription": "Annual company conference with keynote speakers, breakout sessions, and networking opportunities for our team and partners",
  "guestClass": {
    "ageGroups": ["young_adults", "adults"],
    "formality": "semi-formal",
    "socialStatus": ["middle-class"],
    "specialRequirements": ["accessibility-needs"],
    "additionalDetails": "Need wheelchair access and AV equipment"
  },
  "budget": {
    "amount": 3000000,
    "currency": "NGN"
  }
}
```

### Test Event 3: Birthday (Small Budget)

```json
{
  "eventType": "birthday",
  "eventDate": "2025-02-14",
  "guestCount": 50,
  "location": {
    "city": "Lagos",
    "state": "Lagos",
    "country": "Nigeria",
    "address": "Ikeja"
  },
  "eventDescription": "Fun birthday party for my daughter with games, entertainment, and delicious food for kids and adults to enjoy together",
  "guestClass": {
    "ageGroups": ["children", "adults"],
    "formality": "casual",
    "socialStatus": ["budget-conscious"],
    "specialRequirements": [],
    "additionalDetails": "Kid-friendly entertainment needed"
  },
  "budget": {
    "amount": 500000,
    "currency": "NGN"
  }
}
```

---

## 🚀 Deployment Checklist

### Before Launch

- [ ] Environment variables configured
- [ ] API endpoints tested in production
- [ ] Rate limiting verified
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Analytics tracking implemented
- [ ] Performance monitoring enabled
- [ ] SSL certificate installed
- [ ] CORS configured correctly
- [ ] CDN setup for static assets
- [ ] Database backups configured

### Post-Launch Monitoring

- [ ] Monitor API response times
- [ ] Track conversion rates
- [ ] Monitor error rates
- [ ] Check rate limit effectiveness
- [ ] Review user feedback
- [ ] Analyze drop-off points
- [ ] A/B test results

---

## 📞 Support & Resources

### Backend Documentation

- Full API docs: `src/node/AI_EVENT_PLANNER_README.md`
- Spec documents: `.kiro/specs/ai/`

### Common Issues

**Issue:** "Rate limit exceeded"
**Solution:** User has made 5 requests in the last hour. Show countdown timer and suggest signup.

**Issue:** "Session expired"
**Solution:** Session tokens expire after 24 hours. Prompt user to generate a new plan.

**Issue:** "Insufficient budget"
**Solution:** Show minimum budget requirements and alternatives. Allow user to adjust.

**Issue:** "No vendors found"
**Solution:** Expand search radius or suggest nearby cities with better coverage.

---

## 🎨 Design Assets Needed

### Icons

- Event type icons (wedding, corporate, birthday, etc.)
- Vendor category icons (18 categories)
- Timeline milestone icons
- Priority badges (essential, recommended, optional)
- Lock icon for locked content
- Loading spinner/animation

### Illustrations

- Empty state (no results)
- Error states
- Success celebration
- Loading animation

### Colors

- Feasibility score colors:
  - High (>75): Green (#10B981)
  - Medium (60-75): Yellow (#F59E0B)
  - Low (<60): Red (#EF4444)
- Priority badges:
  - Essential: Blue (#3B82F6)
  - Recommended: Purple (#8B5CF6)
  - Optional: Gray (#6B7280)

---

## 📈 Success Metrics

### Key Performance Indicators

1. **Form Completion Rate:** % of users who complete the form
2. **API Success Rate:** % of successful API calls
3. **Teaser View Rate:** % of users who view results
4. **Signup Conversion Rate:** % of users who sign up after viewing teaser
5. **Average Processing Time:** Time to generate plan
6. **User Satisfaction:** Feasibility scores distribution

### Target Metrics

- Form completion: >70%
- API success: >95%
- Teaser view: >90%
- Signup conversion: >15%
- Processing time: <5 seconds
- Feasibility score: >70 average

---

**Backend Status:** ✅ Production Ready
**Frontend Status:** 🚧 Ready for Implementation

**Questions?** Contact the backend team or refer to `AI_EVENT_PLANNER_README.md`
