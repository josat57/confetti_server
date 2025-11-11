# AI Event Planner - Quick Start for Frontend

## 🚀 TL;DR

**What:** Free AI-powered event planning tool (no auth required)
**Backend:** ✅ 100% Complete
**Your Task:** Build the form + results UI

---

## 📋 Minimum Viable Implementation

### 1. Create Event Form (15 fields)

```jsx
<EventPlannerForm>
  <Select
    name="eventType"
    options={[
      "wedding",
      "corporate",
      "birthday",
      "graduation",
      "conference",
      "other",
    ]}
  />
  <DatePicker name="eventDate" minDate={tomorrow} />
  <NumberInput name="guestCount" min={1} max={10000} />

  <TextInput name="location.city" required />
  <TextInput name="location.state" required />
  <TextInput name="location.address" required />

  <TextArea name="eventDescription" minLength={50} maxLength={1000} />

  <CheckboxGroup
    name="guestClass.ageGroups"
    options={["children", "teenagers", "young_adults", "adults", "seniors"]}
  />
  <Select
    name="guestClass.formality"
    options={["casual", "semi-formal", "formal", "black-tie"]}
  />
  <CheckboxGroup
    name="guestClass.socialStatus"
    options={["budget-conscious", "middle-class", "affluent", "luxury"]}
  />
  <CheckboxGroup
    name="guestClass.specialRequirements"
    options={[
      "dietary-restrictions",
      "accessibility-needs",
      "cultural-considerations",
      "religious-considerations",
    ]}
  />

  <NumberInput name="budget.amount" min={0} />
  <Select name="budget.currency" options={["NGN", "USD", "EUR", "GBP"]} />

  <Button type="submit" disabled={!isValid}>
    Generate Event Plan
  </Button>
</EventPlannerForm>
```

---

### 2. Call API

```javascript
async function generateEventPlan(formData) {
  const response = await fetch(
    "http://localhost:9600/api/v1/ai-planner/analyze",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}
```

---

### 3. Display Results

```jsx
<EventPlanTeaser data={eventPlan}>
  {/* Event Summary */}
  <SummaryCard>
    <h2>{eventPlan.eventSummary.eventType}</h2>
    <p>{eventPlan.eventSummary.guestCount} guests</p>
    <p>
      {eventPlan.eventSummary.totalBudget} {eventPlan.eventSummary.currency}
    </p>
    <FeasibilityBadge score={eventPlan.budgetBreakdown.feasibilityScore} />
  </SummaryCard>

  {/* Budget Breakdown */}
  <BudgetChart categories={eventPlan.budgetBreakdown.categories} />

  {/* Vendor Categories (Locked) */}
  <VendorGrid>
    {eventPlan.vendorCategories.map((category) => (
      <VendorCard key={category.category}>
        <h3>{category.name}</h3>
        <p>{category.description}</p>
        <p>{category.vendorCount} vendors available</p>
        <LockIcon /> {/* Show lock icon */}
        <BlurOverlay /> {/* Blur vendor details */}
      </VendorCard>
    ))}
  </VendorGrid>

  {/* Timeline */}
  <Timeline milestones={eventPlan.timeline.planningMilestones} />

  {/* Recommendations */}
  <RecommendationsList items={eventPlan.recommendations} />

  {/* CTA */}
  <Button onClick={handleSignup} size="large">
    Sign Up to Unlock Full Plan
  </Button>
</EventPlanTeaser>
```

---

## 🎯 Critical Features

### Must Have (MVP)

- ✅ Form with validation
- ✅ API integration
- ✅ Loading state (3-5 seconds)
- ✅ Results display
- ✅ Error handling
- ✅ Signup CTA

### Nice to Have (V2)

- 📍 Map picker for location
- 📊 Interactive budget chart
- 💾 Save draft to localStorage
- 📧 Email results
- 🔄 Edit and regenerate
- 📱 Mobile optimization

---

## ⚠️ Important Rules

### Rate Limiting

- **5 requests per IP per hour**
- Show countdown when limit reached
- Suggest signup for unlimited access

### Validation

- Event date must be in future
- Description: 50-1,000 characters
- Guest count: 1-10,000
- Budget minimums vary by currency

### Session Management

- Session tokens expire in 24 hours
- Store token to retrieve results later
- Clear expired tokens

---

## 🧪 Test with This

```javascript
const testEvent = {
  eventType: "wedding",
  eventDate: "2025-06-15",
  guestCount: 200,
  location: {
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
    address: "Victoria Island",
  },
  eventDescription:
    "Beautiful outdoor wedding with garden theme and elegant decorations for a memorable celebration with family and friends",
  guestClass: {
    ageGroups: ["adults"],
    formality: "formal",
    socialStatus: ["middle-class"],
    specialRequirements: [],
  },
  budget: {
    amount: 5000000,
    currency: "NGN",
  },
};

// Should return results in 3-5 seconds
```

---

## 🐛 Common Errors

### 400 - Validation Error

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Event description must be at least 50 characters",
  "field": "eventDescription"
}
```

**Fix:** Show inline error on the field

### 429 - Rate Limit

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "data": { "retryAfterMinutes": 60 }
}
```

**Fix:** Show "Try again in X minutes" message

### 400 - Insufficient Budget

```json
{
  "code": "INSUFFICIENT_BUDGET",
  "data": {
    "minimumBudget": 3000000,
    "alternatives": ["Reduce guest count", "Choose buffet-style catering"]
  }
}
```

**Fix:** Show suggestions, allow user to adjust

---

## 📊 What You'll Get Back

```typescript
{
  sessionToken: "abc123...", // Save this!
  eventPlan: {
    eventSummary: { /* Event details */ },
    budgetBreakdown: {
      categories: [
        {
          name: "Event Venue",
          percentage: 30,
          amount: 1380000,
          priority: "essential"
        }
        // ... more categories
      ],
      feasibilityScore: 85 // 0-100
    },
    vendorCategories: [
      {
        name: "Event Venue",
        description: "Spaces for hosting...",
        vendorCount: 5,
        locked: true // Always true for teaser
      }
      // ... more categories
    ],
    timeline: { /* Planning milestones */ },
    recommendations: [
      "Your budget is good - you have flexibility",
      "Book venue and photographer first"
    ],
    aiInsights: {
      sentiment: { score: 0.8, label: "positive" },
      keywords: ["outdoor", "wedding", "garden"],
      feasibilityScore: 85
    }
  }
}
```

---

## 🎨 UI Tips

### Loading State

```jsx
<LoadingScreen>
  <Spinner />
  <AnimatedMessage>{messages[currentIndex]}</AnimatedMessage>
  <ProgressBar value={progress} />
</LoadingScreen>

// Rotate through:
// "Analyzing your event..."
// "Searching for vendors..."
// "Optimizing budget..."
// "Creating timeline..."
```

### Locked Content

```jsx
<LockedVendorCard>
  <BlurFilter intensity={5}>
    <VendorPreview />
  </BlurFilter>
  <LockOverlay>
    <LockIcon size={48} />
    <p>Sign up to see {vendorCount} vendors</p>
    <Button>Unlock Now</Button>
  </LockOverlay>
</LockedVendorCard>
```

### Feasibility Score

```jsx
function FeasibilityBadge({ score }) {
  const color = score >= 75 ? "green" : score >= 60 ? "yellow" : "red";
  const label = score >= 75 ? "Excellent" : score >= 60 ? "Good" : "Tight";

  return (
    <Badge color={color}>
      {score}/100 - {label} Budget
    </Badge>
  );
}
```

---

## 📱 Mobile First

```css
/* Stack everything vertically on mobile */
.event-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Use native inputs */
input[type="date"] {
  /* Let mobile use native date picker */
}

/* Make touch targets big */
button,
input,
select {
  min-height: 44px;
  font-size: 16px; /* Prevents zoom on iOS */
}
```

---

## ✅ Launch Checklist

- [ ] Form validates all fields
- [ ] API call works
- [ ] Loading state shows
- [ ] Results display correctly
- [ ] Errors handled gracefully
- [ ] Rate limit message shows
- [ ] Signup CTA prominent
- [ ] Mobile responsive
- [ ] Tested on Chrome, Safari, Firefox
- [ ] Analytics tracking added

---

## 🔗 Full Documentation

- **Complete Guide:** `AI_EVENT_PLANNER_FRONTEND_GUIDE.md`
- **Backend Docs:** `src/node/AI_EVENT_PLANNER_README.md`
- **API Spec:** `.kiro/specs/ai/`

---

## 💡 Pro Tips

1. **Cache form data** in localStorage to prevent data loss
2. **Show character counter** for description field
3. **Validate in real-time** for better UX
4. **Use optimistic UI** - show loading immediately
5. **Add confetti animation** when results load 🎉
6. **Track drop-off points** to optimize conversion
7. **A/B test CTA buttons** for better signup rates

---

**Need Help?** Check the full guide or contact backend team!

**Backend Status:** ✅ Ready
**Your Turn:** 🚀 Build the UI!
