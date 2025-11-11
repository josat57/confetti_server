# AI Event Planner - Backend Design Document

## Overview

The backend for the AI Event Planner provides the intelligence layer that processes user inputs, analyzes vendor data, generates budget allocations, and creates personalized event plans. The system is designed for scalability, performance, and integration with AI/ML services for intelligent recommendations.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST API
┌────────────────────────┴────────────────────────────────────┐
│                     API Gateway / Load Balancer             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Node.js AI Event Planner Service                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Request Handler & Validation               │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────┴─────────────────────────────────┐  │
│  │              AI Analysis Orchestrator                 │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  1. Vendor Data Aggregator (Node.js)          │  │  │
│  │  │  2. Timeline Generator (Node.js)              │  │  │
│  │  │  3. Currency Converter (Node.js)              │  │  │
│  │  │  4. Plan Synthesizer (Node.js)                │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬──────────────────┐
        │                │                │                  │
┌───────┴────────┐ ┌────┴─────┐ ┌───────┴────────┐ ┌───────┴────────┐
│   Vendor DB    │ │ Cache    │ │  Session Store │ │  Python ML API │
│  (MongoDB)     │ │ (Redis)  │ │    (Redis)     │ │   (Port 5600)  │
└────────────────┘ └──────────┘ └────────────────┘ └───────┬────────┘
                                                            │
                                    ┌───────────────────────┼───────────────────────┐
                                    │                       │                       │
                            ┌───────┴────────┐  ┌──────────┴──────────┐  ┌────────┴────────┐
                            │  NLP Analyzer  │  │  Budget Optimizer   │  │  Vendor Matcher │
                            │  (Sentiment,   │  │  (ML-based budget   │  │  (ML-based      │
                            │   Keywords)    │  │   allocation)       │  │   matching)     │
                            └───────┬────────┘  └──────────┬──────────┘  └────────┬────────┘
                                    │                       │                       │
                                    └───────────────────────┴───────────────────────┘
                                                            │
                                                    ┌───────┴────────┐
                                                    │  OpenAI API    │
                                                    │  (Data Source) │
                                                    └────────────────┘
```

### Service Layer Architecture

```
AIEventPlannerController
├── validateRequest()
├── analyzeEvent()
└── getResult()
        ↓
AIAnalysisService
├── processEventRequest()
├── aggregateVendorData()
├── optimizeBudget()
├── generateRecommendations()
└── synthesizePlan()
        ↓
┌──────────────┬──────────────┬──────────────┬──────────────┐
│   Vendor     │   Budget     │  Category    │   Timeline   │
│   Service    │   Service    │  Service     │   Service    │
└──────────────┴──────────────┴──────────────┴──────────────┘
        ↓              ↓              ↓              ↓
┌──────────────┬──────────────┬──────────────┬──────────────┐
│  Vendor DB   │  Pricing     │  AI/ML       │  Template    │
│  Repository  │  Calculator  │  Service     │  Engine      │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

## Data Models

### EventPlanRequest Model

```typescript
interface EventPlanRequest {
  eventType: EventType;
  eventDate: Date;
  guestCount: number;
  location: LocationData;
  eventDescription: string;
  guestClass: GuestClassData;
  budget: BudgetData;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

interface LocationData {
  latitude?: number;
  longitude?: number;
  address: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
}

interface GuestClassData {
  ageGroups: AgeGroup[];
  formality: FormalityLevel;
  socialStatus: SocialStatus[];
  specialRequirements: SpecialRequirement[];
  additionalDetails: string;
}

interface BudgetData {
  amount: number;
  currency: Currency;
}
```

### EventPlanResult Model

```typescript
interface EventPlanResult {
  id: string;
  sessionToken: string;
  request: EventPlanRequest;
  analysis: EventAnalysis;
  teaser: EventPlanTeaser;
  fullPlan?: EventPlanFull; // Only for authenticated users
  createdAt: Date;
  expiresAt: Date;
  userId?: string; // Set after user signs up
  status: "processing" | "completed" | "failed";
}

interface EventAnalysis {
  vendorData: VendorAggregateData;
  budgetAllocation: BudgetAllocation;
  recommendations: Recommendation[];
  feasibilityScore: number; // 0-100
  warnings: string[];
}

interface VendorAggregateData {
  location: string;
  categories: VendorCategoryData[];
  totalVendorsFound: number;
  averagePricing: Record<string, PriceRange>;
}

interface VendorCategoryData {
  category: VendorCategory;
  vendorCount: number;
  priceRange: PriceRange;
  averageRating: number;
  availability: "high" | "medium" | "low";
}

interface PriceRange {
  min: number;
  max: number;
  average: number;
  currency: Currency;
}

interface BudgetAllocation {
  categories: BudgetCategoryAllocation[];
  totalAllocated: number;
  contingency: number;
  contingencyPercentage: number;
}

interface BudgetCategoryAllocation {
  category: VendorCategory;
  allocatedAmount: number;
  percentage: number;
  priceRange: PriceRange;
  priority: "essential" | "recommended" | "optional";
  rationale: string;
}

interface Recommendation {
  type: "budget" | "vendor" | "timeline" | "general";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}
```

### Vendor Category Enum

```typescript
enum VendorCategory {
  VENUE = "venue",
  CATERING = "catering",
  ENTERTAINMENT = "entertainment",
  PHOTOGRAPHY = "photography",
  VIDEOGRAPHY = "videography",
  DECORATION = "decoration",
  FLORALS = "florals",
  TRANSPORTATION = "transportation",
  CAR_RENTAL = "car_rental",
  AUDIO_VISUAL = "audio_visual",
  EVENT_PLANNING = "event_planning",
  SECURITY = "security",
  VALET_PARKING = "valet_parking",
  RENTALS = "rentals", // Tables, chairs, linens
  CAKE_DESSERTS = "cake_desserts",
  BAR_SERVICES = "bar_services",
  LIGHTING = "lighting",
  INVITATIONS = "invitations",
  FAVORS_GIFTS = "favors_gifts",
}
```

### EventPlanTeaser Model (Public)

```typescript
interface EventPlanTeaser {
  eventSummary: EventSummary;
  budgetBreakdown: BudgetBreakdownTeaser;
  vendorCategories: VendorCategoryTeaser[];
  timeline: TimelineTeaser;
  recommendations: string[]; // Generic recommendations
  aiInsights: string; // AI-generated summary
}

interface EventSummary {
  eventType: string;
  eventDate: Date;
  location: string; // City, State only
  guestCount: number;
  totalBudget: number;
  currency: string;
  formality: string;
}

interface BudgetBreakdownTeaser {
  categories: {
    name: string;
    percentage: number;
    amount: number;
    description: string;
    priority: string;
  }[];
  totalAllocated: number;
  contingency: number;
}

interface VendorCategoryTeaser {
  name: string;
  description: string;
  estimatedCost: { min: number; max: number };
  priority: string;
  locked: true; // Always true for teaser
  vendorCount: number; // Number of vendors available
}

interface TimelineTeaser {
  planningMilestones: {
    title: string;
    timeframe: string;
    description: string;
  }[];
  eventDayHighlights: {
    time: string;
    activity: string;
  }[];
  detailedTimelineLocked: true;
}
```

### EventPlanFull Model (Authenticated Users)

```typescript
interface EventPlanFull extends EventPlanTeaser {
  vendors: VendorRecommendation[];
  detailedTimeline: DetailedTimeline;
  actionItems: ActionItem[];
  resources: Resource[];
}

interface VendorRecommendation {
  vendorId: string;
  name: string;
  category: VendorCategory;
  rating: number;
  reviewCount: number;
  priceRange: PriceRange;
  contactInfo: ContactInfo;
  portfolio: string[]; // Image URLs
  availability: boolean;
  matchScore: number; // 0-100
  whyRecommended: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  website: string;
  address: string;
}

interface DetailedTimeline {
  planningPhases: PlanningPhase[];
  eventDaySchedule: EventDaySchedule;
}

interface PlanningPhase {
  phase: string;
  startDate: Date;
  endDate: Date;
  tasks: Task[];
}

interface Task {
  title: string;
  description: string;
  deadline: Date;
  priority: "high" | "medium" | "low";
  category: VendorCategory;
  completed: boolean;
}

interface EventDaySchedule {
  activities: ScheduleActivity[];
  totalDuration: number;
}

interface ScheduleActivity {
  time: string;
  endTime: string;
  activity: string;
  description: string;
  vendor?: string;
  location?: string;
  notes: string;
}

interface ActionItem {
  title: string;
  description: string;
  deadline: Date;
  category: VendorCategory;
  priority: "high" | "medium" | "low";
}

interface Resource {
  title: string;
  description: string;
  type: "checklist" | "template" | "guide" | "tool";
  url: string;
}
```

## API Endpoints

### POST /api/v1/ai-planner/analyze

**Purpose:** Process event details and generate AI-powered event plan

**Authentication:** Not required (public endpoint)

**Rate Limiting:** 5 requests per IP per hour

**Request Body:**

```typescript
{
  eventType: string;
  eventDate: string; // ISO 8601
  guestCount: number;
  location: {
    latitude?: number;
    longitude?: number;
    address: string;
    city: string;
    state: string;
    country: string;
  };
  eventDescription: string;
  guestClass: {
    ageGroups: string[];
    formality: string;
    socialStatus: string[];
    specialRequirements: string[];
    additionalDetails: string;
  };
  budget: {
    amount: number;
    currency: string;
  };
}
```

**Response (Success):**

```typescript
{
  status: "success";
  data: {
    sessionToken: string;
    eventPlan: EventPlanTeaser;
    expiresAt: string; // ISO 8601
  }
  message: "Event plan generated successfully";
}
```

**Response (Error - Insufficient Budget):**

```typescript
{
  status: 'error';
  code: 'INSUFFICIENT_BUDGET';
  message: 'The budget is too low for this event type';
  data: {
    minimumBudget: number;
    suggestedBudget: number;
    alternatives: string[];
  };
}
```

**Response (Error - Location Not Supported):**

```typescript
{
  status: 'error';
  code: 'LOCATION_NOT_SUPPORTED';
  message: 'Limited vendor data available for this location';
  data: {
    nearestSupportedCities: string[];
    notifyWhenAvailable: boolean;
  };
}
```

### GET /api/v1/ai-planner/result/:sessionToken

**Purpose:** Retrieve saved event plan teaser

**Authentication:** Not required

**Response:**

```typescript
{
  status: "success";
  data: {
    eventPlan: EventPlanTeaser;
    expiresAt: string;
    canUpgrade: boolean; // true if user can sign up to see full plan
  }
}
```

### POST /api/v1/ai-planner/save

**Purpose:** Associate event plan with user account after signup

**Authentication:** Required (JWT token)

**Request Body:**

```typescript
{
  sessionToken: string;
}
```

**Response:**

```typescript
{
  status: "success";
  data: {
    eventId: string;
    fullPlan: EventPlanFull;
  }
  message: "Event plan saved to your account";
}
```

### GET /api/v1/ai-planner/full/:eventId

**Purpose:** Retrieve full event plan for authenticated users

**Authentication:** Required (JWT token)

**Response:**

```typescript
{
  status: "success";
  data: {
    fullPlan: EventPlanFull;
  }
}
```

## Python ML Services Integration

### Architecture Overview

The AI Event Planner uses a **hybrid architecture** where:

- **Node.js** serves as the single entry point and orchestrator
- **Python ML services** handle all AI/ML processing (NLP, budget optimization, vendor matching)
- **OpenAI API** is used by Python services as a supplementary data source

### Python ML Service Endpoints

```python
# Python API Base URL: http://python-api:5600

POST /analyze-event-plan
- Input: Complete event data + vendor list
- Output: Comprehensive AI analysis (NLP + budget + vendor matching + recommendations)
- Processing: Calls all ML services and OpenAI, returns unified result

POST /optimize-budget
- Input: Budget amount, event type, guest count, vendor pricing data
- Output: Optimized budget allocation across categories

POST /match-vendors
- Input: Event requirements, vendor list, budget allocations
- Output: Scored and ranked vendor matches per category

POST /generate-recommendations
- Input: Event analysis, budget feasibility, vendor availability
- Output: AI-generated recommendations and insights

GET /health/ai
- Output: Health status of all AI/ML services
```

### Data Flow

```
1. User submits form → Node.js API
2. Node.js validates input
3. Node.js aggregates vendor data from MongoDB
4. Node.js sends {event_data + vendors} → Python ML API
5. Python ML API:
   - Runs NLP analysis on event description
   - Calls OpenAI for additional insights
   - Optimizes budget using ML models
   - Matches vendors using ML scoring
   - Generates recommendations
6. Python returns complete analysis → Node.js
7. Node.js synthesizes teaser/full plan
8. Node.js returns result to user
```

### Currency Support

The system supports multiple currencies with real-time conversion:

**Supported Currencies:**

- NGN (Nigerian Naira) - Default
- USD (US Dollar)
- EUR (Euro)
- GBP (British Pound)

**Currency Conversion Strategy:**

1. All vendor pricing stored in NGN (base currency)
2. User selects currency in form
3. Node.js converts budget to NGN for processing
4. Python ML processes in NGN
5. Node.js converts results back to user's currency
6. Exchange rates cached for 1 hour

```typescript
interface CurrencyService {
  convert(amount: number, from: Currency, to: Currency): Promise<number>;
  getExchangeRate(from: Currency, to: Currency): Promise<number>;
  convertBudgetAllocation(
    allocation: BudgetAllocation,
    toCurrency: Currency
  ): BudgetAllocation;
}
```

## Core Services

### 1. AIAnalysisService

**Purpose:** Orchestrate the AI analysis process

**Methods:**

```typescript
class AIAnalysisService {
  async processEventRequest(
    request: EventPlanRequest
  ): Promise<EventPlanResult> {
    // 1. Validate request
    this.validateRequest(request);

    // 2. Convert budget to base currency (NGN) if needed
    const budgetInNGN = await this.currencyService.convert(
      request.budget.amount,
      request.budget.currency,
      "NGN"
    );

    // 3. Aggregate vendor data from MongoDB
    const vendorData = await this.vendorService.aggregateVendorData(
      request.location,
      request.eventType
    );

    // 4. Prepare data for Python ML API
    const pythonPayload = {
      event_data: {
        eventType: request.eventType,
        eventDate: request.eventDate,
        guestCount: request.guestCount,
        location: request.location,
        eventDescription: request.eventDescription,
        guestClass: request.guestClass,
        budget: budgetInNGN,
        currency: "NGN",
      },
      vendors: vendorData.vendors,
      vendor_statistics: vendorData.statistics,
    };

    // 5. Call Python ML API for complete AI analysis
    const pythonAnalysis = await this.pythonService.analyzeEventPlan(
      pythonPayload
    );

    // Python returns:
    // - nlp_analysis: { sentiment, keywords, event_insights }
    // - budget_optimization: { allocations, feasibility_score, recommendations }
    // - vendor_matches: { category_matches, scored_vendors }
    // - recommendations: { budget_tips, vendor_tips, timeline_tips }

    // 6. Generate timeline (Node.js service)
    const timeline = await this.timelineService.generateTimeline(
      request.eventDate,
      request.eventType,
      pythonAnalysis.budget_optimization.allocations
    );

    // 7. Convert budget allocations back to user's currency
    const budgetAllocation = await this.currencyService.convertBudgetAllocation(
      pythonAnalysis.budget_optimization,
      request.budget.currency
    );

    // 8. Synthesize plan combining Python ML results + Node.js timeline
    const eventPlan = this.synthesizePlan({
      request,
      vendorData,
      pythonAnalysis,
      budgetAllocation,
      timeline,
    });

    // 9. Save to session store
    const sessionToken = this.generateSessionToken();
    await this.sessionStore.save(sessionToken, eventPlan, 24 * 60 * 60); // 24 hours

    return {
      sessionToken,
      eventPlan: this.createTeaser(eventPlan),
    };
  }

  private validateRequest(request: EventPlanRequest): void {
    // Validate all required fields
    // Check budget minimums
    // Validate date is in future
    // Validate guest count
  }

  private synthesizePlan(data: any): EventPlanResult {
    // Combine all analysis results into cohesive plan
  }

  private createTeaser(fullPlan: EventPlanResult): EventPlanTeaser {
    // Create limited preview without vendor details
  }

  private generateSessionToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
```

### 2. VendorService

**Purpose:** Aggregate and analyze vendor data

**Methods:**

```typescript
class VendorService {
  async aggregateVendorData(
    location: LocationData,
    eventType: EventType
  ): Promise<VendorAggregateData> {
    // 1. Query vendors by location (within radius)
    const vendors = await this.vendorRepository.findByLocation(
      location.latitude,
      location.longitude,
      50 // 50 mile radius
    );

    // 2. Filter by event type compatibility
    const compatibleVendors = vendors.filter((v) =>
      v.eventTypes.includes(eventType)
    );

    // 3. Group by category
    const categorizedVendors = this.groupByCategory(compatibleVendors);

    // 4. Calculate statistics per category
    const categoryData = Object.entries(categorizedVendors).map(
      ([category, vendors]) => ({
        category,
        vendorCount: vendors.length,
        priceRange: this.calculatePriceRange(vendors),
        averageRating: this.calculateAverageRating(vendors),
        availability: this.assessAvailability(vendors),
      })
    );

    return {
      location: `${location.city}, ${location.state}`,
      categories: categoryData,
      totalVendorsFound: compatibleVendors.length,
      averagePricing: this.calculateAveragePricing(categoryData),
    };
  }

  private calculatePriceRange(vendors: Vendor[]): PriceRange {
    const prices = vendors.map((v) => v.averagePrice);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length,
      currency: vendors[0].currency,
    };
  }

  private calculateAverageRating(vendors: Vendor[]): number {
    const ratings = vendors.map((v) => v.rating);
    return ratings.reduce((a, b) => a + b, 0) / ratings.length;
  }

  private assessAvailability(vendors: Vendor[]): "high" | "medium" | "low" {
    const count = vendors.length;
    if (count >= 10) return "high";
    if (count >= 5) return "medium";
    return "low";
  }
}
```

### 3. BudgetService

**Purpose:** Optimize budget allocation across categories

**Methods:**

```typescript
class BudgetService {
  async optimizeBudget(
    budget: BudgetData,
    eventType: EventType,
    guestCount: number,
    vendorData: VendorAggregateData
  ): Promise<BudgetAllocation> {
    // 1. Get base allocation percentages for event type
    const baseAllocations = this.getBaseAllocations(eventType);

    // 2. Adjust based on guest count
    const adjustedAllocations = this.adjustForGuestCount(
      baseAllocations,
      guestCount
    );

    // 3. Adjust based on vendor pricing in location
    const optimizedAllocations = this.adjustForVendorPricing(
      adjustedAllocations,
      vendorData
    );

    // 4. Reserve contingency (5-10%)
    const contingencyPercentage = 0.08; // 8%
    const contingency = budget.amount * contingencyPercentage;
    const allocatableBudget = budget.amount - contingency;

    // 5. Calculate final allocations
    const categories = optimizedAllocations.map((allocation) => ({
      category: allocation.category,
      allocatedAmount: allocatableBudget * allocation.percentage,
      percentage: allocation.percentage * 100,
      priceRange: this.getVendorPriceRange(allocation.category, vendorData),
      priority: allocation.priority,
      rationale: this.generateRationale(allocation, eventType),
    }));

    return {
      categories,
      totalAllocated: allocatableBudget,
      contingency,
      contingencyPercentage: contingencyPercentage * 100,
    };
  }

  private getBaseAllocations(eventType: EventType): AllocationTemplate[] {
    const templates = {
      wedding: [
        {
          category: VendorCategory.VENUE,
          percentage: 0.3,
          priority: "essential",
        },
        {
          category: VendorCategory.CATERING,
          percentage: 0.35,
          priority: "essential",
        },
        {
          category: VendorCategory.PHOTOGRAPHY,
          percentage: 0.1,
          priority: "essential",
        },
        {
          category: VendorCategory.VIDEOGRAPHY,
          percentage: 0.05,
          priority: "recommended",
        },
        {
          category: VendorCategory.DECORATION,
          percentage: 0.08,
          priority: "recommended",
        },
        {
          category: VendorCategory.FLORALS,
          percentage: 0.05,
          priority: "recommended",
        },
        {
          category: VendorCategory.ENTERTAINMENT,
          percentage: 0.07,
          priority: "recommended",
        },
      ],
      corporate: [
        {
          category: VendorCategory.VENUE,
          percentage: 0.35,
          priority: "essential",
        },
        {
          category: VendorCategory.CATERING,
          percentage: 0.3,
          priority: "essential",
        },
        {
          category: VendorCategory.AUDIO_VISUAL,
          percentage: 0.15,
          priority: "essential",
        },
        {
          category: VendorCategory.EVENT_PLANNING,
          percentage: 0.1,
          priority: "recommended",
        },
        {
          category: VendorCategory.TRANSPORTATION,
          percentage: 0.1,
          priority: "optional",
        },
      ],
      // ... other event types
    };

    return templates[eventType] || templates.wedding;
  }

  private adjustForGuestCount(
    allocations: AllocationTemplate[],
    guestCount: number
  ): AllocationTemplate[] {
    // Increase catering percentage for larger events
    // Adjust venue percentage based on size
    return allocations;
  }

  private adjustForVendorPricing(
    allocations: AllocationTemplate[],
    vendorData: VendorAggregateData
  ): AllocationTemplate[] {
    // Adjust allocations based on actual vendor pricing in area
    return allocations;
  }
}
```

### 4. CategoryService

**Purpose:** Recommend vendor categories based on event requirements

**Methods:**

```typescript
class CategoryService {
  async recommendCategories(
    eventType: EventType,
    guestClass: GuestClassData,
    budgetAllocation: BudgetAllocation
  ): Promise<VendorCategoryTeaser[]> {
    // 1. Get required categories for event type
    const requiredCategories = this.getRequiredCategories(eventType);

    // 2. Get recommended categories based on guest class
    const recommendedCategories = this.getRecommendedCategories(
      eventType,
      guestClass
    );

    // 3. Get optional categories based on budget
    const optionalCategories = this.getOptionalCategories(
      eventType,
      budgetAllocation
    );

    // 4. Combine and format
    const allCategories = [
      ...requiredCategories.map((c) => ({ ...c, priority: "essential" })),
      ...recommendedCategories.map((c) => ({ ...c, priority: "recommended" })),
      ...optionalCategories.map((c) => ({ ...c, priority: "optional" })),
    ];

    return allCategories.map((category) => ({
      name: this.getCategoryDisplayName(category.category),
      description: this.getCategoryDescription(category.category, eventType),
      estimatedCost: this.getEstimatedCost(category.category, budgetAllocation),
      priority: category.priority,
      locked: true,
      vendorCount: this.getVendorCount(category.category),
    }));
  }

  private getRequiredCategories(eventType: EventType): VendorCategory[] {
    const required = {
      wedding: [
        VendorCategory.VENUE,
        VendorCategory.CATERING,
        VendorCategory.PHOTOGRAPHY,
      ],
      corporate: [
        VendorCategory.VENUE,
        VendorCategory.CATERING,
        VendorCategory.AUDIO_VISUAL,
      ],
      // ... other event types
    };

    return required[eventType] || [];
  }

  private getRecommendedCategories(
    eventType: EventType,
    guestClass: GuestClassData
  ): VendorCategory[] {
    const categories: VendorCategory[] = [];

    // Add entertainment for certain age groups
    if (guestClass.ageGroups.includes(AgeGroup.CHILDREN)) {
      categories.push(VendorCategory.ENTERTAINMENT);
    }

    // Add luxury categories for affluent guests
    if (guestClass.socialStatus.includes(SocialStatus.LUXURY)) {
      categories.push(VendorCategory.VALET_PARKING);
      categories.push(VendorCategory.VIDEOGRAPHY);
    }

    // Add transportation for formal events
    if (guestClass.formality === FormalityLevel.BLACK_TIE) {
      categories.push(VendorCategory.TRANSPORTATION);
    }

    return categories;
  }
}
```

### 5. TimelineService

**Purpose:** Generate planning and event day timelines

**Methods:**

```typescript
class TimelineService {
  async generateTimeline(
    eventDate: Date,
    eventType: EventType,
    categories: VendorCategoryTeaser[]
  ): Promise<TimelineTeaser> {
    // 1. Calculate planning milestones
    const planningMilestones = this.generatePlanningMilestones(
      eventDate,
      eventType
    );

    // 2. Generate event day schedule
    const eventDayHighlights = this.generateEventDaySchedule(
      eventType,
      categories
    );

    return {
      planningMilestones,
      eventDayHighlights,
      detailedTimelineLocked: true,
    };
  }

  private generatePlanningMilestones(
    eventDate: Date,
    eventType: EventType
  ): Milestone[] {
    const now = new Date();
    const monthsUntilEvent = this.getMonthsDifference(now, eventDate);

    const milestones: Milestone[] = [];

    if (monthsUntilEvent >= 12) {
      milestones.push({
        title: "Initial Planning",
        timeframe: "12-9 months before",
        description: "Set budget, create guest list, book venue",
      });
    }

    if (monthsUntilEvent >= 6) {
      milestones.push({
        title: "Vendor Booking",
        timeframe: "9-6 months before",
        description: "Book caterer, photographer, entertainment",
      });
    }

    if (monthsUntilEvent >= 3) {
      milestones.push({
        title: "Detail Planning",
        timeframe: "6-3 months before",
        description: "Finalize menu, decorations, timeline",
      });
    }

    milestones.push({
      title: "Final Preparations",
      timeframe: "3-1 months before",
      description: "Confirm all vendors, finalize guest count",
    });

    milestones.push({
      title: "Week Before",
      timeframe: "1 week before",
      description: "Final vendor confirmations, rehearsal",
    });

    milestones.push({
      title: "Event Day",
      timeframe: "Event day",
      description: "Execute your perfect event!",
    });

    return milestones;
  }

  private generateEventDaySchedule(
    eventType: EventType,
    categories: VendorCategoryTeaser[]
  ): ScheduleHighlight[] {
    const schedules = {
      wedding: [
        { time: "2:00 PM", activity: "Guest arrival and seating" },
        { time: "2:30 PM", activity: "Ceremony begins" },
        { time: "3:00 PM", activity: "Cocktail hour" },
        { time: "4:00 PM", activity: "Reception and dinner" },
        { time: "6:00 PM", activity: "Dancing and entertainment" },
        { time: "9:00 PM", activity: "Event concludes" },
      ],
      corporate: [
        { time: "8:00 AM", activity: "Registration and breakfast" },
        { time: "9:00 AM", activity: "Opening session" },
        { time: "12:00 PM", activity: "Lunch break" },
        { time: "1:00 PM", activity: "Afternoon sessions" },
        { time: "5:00 PM", activity: "Networking reception" },
        { time: "7:00 PM", activity: "Event concludes" },
      ],
      // ... other event types
    };

    return schedules[eventType] || schedules.wedding;
  }

  private getMonthsDifference(start: Date, end: Date): number {
    return (
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    );
  }
}
```

### 6. AIService

**Purpose:** Generate AI-powered insights and recommendations

**Methods:**

```typescript
class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateInsights(
    request: EventPlanRequest,
    vendorData: VendorAggregateData,
    budgetAllocation: BudgetAllocation
  ): Promise<string> {
    const prompt = this.buildPrompt(request, vendorData, budgetAllocation);

    const completion = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are an expert event planner providing personalized recommendations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  }

  private buildPrompt(
    request: EventPlanRequest,
    vendorData: VendorAggregateData,
    budgetAllocation: BudgetAllocation
  ): string {
    return `
      Generate personalized event planning insights for the following event:
      
      Event Type: ${request.eventType}
      Date: ${request.eventDate}
      Location: ${request.location.city}, ${request.location.state}
      Guest Count: ${request.guestCount}
      Budget: ${request.budget.amount} ${request.budget.currency}
      Formality: ${request.guestClass.formality}
      
      Event Description: ${request.eventDescription}
      Guest Details: ${request.guestClass.additionalDetails}
      
      Available Vendors: ${vendorData.totalVendorsFound}
      Budget Allocation: ${JSON.stringify(
        budgetAllocation.categories.map((c) => ({
          category: c.category,
          percentage: c.percentage,
        }))
      )}
      
      Provide 3-5 personalized recommendations that will make this event special,
      considering the guest demographics, location, and budget. Be specific and actionable.
      Focus on unique touches that match the event's style and the guests' preferences.
    `;
  }

  async generateRecommendations(
    request: EventPlanRequest,
    analysis: EventAnalysis
  ): Promise<Recommendation[]> {
    // Generate specific recommendations based on analysis
    const recommendations: Recommendation[] = [];

    // Budget recommendations
    if (analysis.feasibilityScore < 70) {
      recommendations.push({
        type: "budget",
        title: "Consider Budget Adjustments",
        description:
          "Your budget may be tight for this event type. Consider increasing by 15-20% or reducing guest count.",
        priority: "high",
      });
    }

    // Vendor recommendations
    if (analysis.vendorData.categories.some((c) => c.availability === "low")) {
      recommendations.push({
        type: "vendor",
        title: "Book Vendors Early",
        description:
          "Some vendor categories have limited availability in your area. Book as soon as possible.",
        priority: "high",
      });
    }

    // Timeline recommendations
    const monthsUntilEvent = this.getMonthsUntilEvent(request.eventDate);
    if (monthsUntilEvent < 3) {
      recommendations.push({
        type: "timeline",
        title: "Accelerated Planning Needed",
        description:
          "Your event is less than 3 months away. Prioritize booking essential vendors immediately.",
        priority: "high",
      });
    }

    return recommendations;
  }
}
```

## Database Schema

### event_plan_requests Table

```sql
CREATE TABLE event_plan_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_date TIMESTAMP NOT NULL,
  guest_count INTEGER NOT NULL,
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_address TEXT NOT NULL,
  location_city VARCHAR(100) NOT NULL,
  location_state VARCHAR(100) NOT NULL,
  location_country VARCHAR(100) NOT NULL,
  event_description TEXT NOT NULL,
  guest_class_data JSONB NOT NULL,
  budget_amount DECIMAL(12, 2) NOT NULL,
  budget_currency VARCHAR(3) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_session_token (session_token),
  INDEX idx_user_id (user_id),
  INDEX idx_location (location_latitude, location_longitude),
  INDEX idx_created_at (created_at),
  INDEX idx_expires_at (expires_at)
);
```

### event_plan_results Table

```sql
CREATE TABLE event_plan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES event_plan_requests(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  teaser_data JSONB NOT NULL,
  full_plan_data JSONB,
  feasibility_score INTEGER,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_request_id (request_id)
);
```

### vendor_categories Table

```sql
CREATE TABLE vendor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### vendors Table (Existing, with additions)

```sql
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS event_types VARCHAR(50)[];
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS average_price DECIMAL(10, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_range_min DECIMAL(10, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS price_range_max DECIMAL(10, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS availability_status VARCHAR(20) DEFAULT 'available';

CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors USING GIST (
  ll_to_earth(latitude, longitude)
);
CREATE INDEX IF NOT EXISTS idx_vendors_event_types ON vendors USING GIN (event_types);
```

## Seed Data Requirements

### Vendor Seed Data

For testing and demonstration, the system requires seed data for vendors across multiple categories and locations:

**Required Vendor Categories (minimum 5 vendors each):**

- Venue (wedding halls, conference centers, outdoor spaces)
- Catering (full service, buffet, specialty cuisine)
- Entertainment (DJs, live bands, performers, MCs)
- Photography (wedding, corporate, event photographers)
- Videography (cinematic, documentary style)
- Decoration (full service, specialty themes)
- Florals (bouquets, centerpieces, full venue decoration)
- Transportation (luxury cars, buses, limousines)
- Audio/Visual (sound systems, projectors, lighting)
- Event Planning (full service, day-of coordination)

**Required Locations (minimum 20 vendors per location):**

- Lagos, Nigeria (Victoria Island, Lekki, Ikeja)
- Abuja, Nigeria (Maitama, Wuse, Asokoro)
- Port Harcourt, Nigeria (GRA, Trans Amadi)
- Ibadan, Nigeria (Bodija, Dugbe)
- Kano, Nigeria (Nassarawa, Sabon Gari)

**Vendor Data Structure:**

```typescript
{
  name: string;
  category: VendorCategory;
  subcategory: string;
  description: string;
  location: {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  address: {
    street: string;
    city: string;
    state: string;
    country: 'Nigeria'
  };
  eventTypes: EventType[]; // ['wedding', 'corporate', etc.]
  pricing: {
    averagePrice: number; // in NGN
    priceRange: { min: number; max: number };
    currency: 'NGN'
  };
  rating: number; // 1-5
  reviewCount: number;
  capacity: { min: number; max: number }; // guest capacity
  availabilityStatus: 'high' | 'medium' | 'low';
  features: string[]; // ['outdoor space', 'parking', 'AC', etc.]
  images: string[]; // URLs to sample images
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  isVerified: boolean;
  status: 'active';
}
```

**Pricing Guidelines (in NGN):**

- Venue: ₦50,000 - ₦5,000,000
- Catering (per person): ₦2,000 - ₦15,000
- Entertainment: ₦30,000 - ₦500,000
- Photography: ₦50,000 - ₦800,000
- Videography: ₦80,000 - ₦1,200,000
- Decoration: ₦40,000 - ₦600,000
- Florals: ₦20,000 - ₦400,000
- Transportation: ₦15,000 - ₦200,000
- Audio/Visual: ₦25,000 - ₦300,000
- Event Planning: ₦100,000 - ₦2,000,000

### Vendor Category Seed Data

```typescript
const vendorCategories = [
  {
    name: "venue",
    displayName: "Event Venue",
    description:
      "Spaces for hosting your event including halls, outdoor venues, and conference centers",
    icon: "building",
  },
  {
    name: "catering",
    displayName: "Catering Services",
    description:
      "Food and beverage services including full meals, buffets, and specialty cuisine",
    icon: "utensils",
  },
  // ... (all 18 categories)
];
```

## Caching Strategy

### Redis Cache Structure

```typescript
// Session data (24 hour TTL)
Key: `session:${sessionToken}`
Value: EventPlanResult (JSON)
TTL: 86400 seconds (24 hours)

// Vendor data cache (1 hour TTL)
Key: `vendors:${city}:${state}:${eventType}`
Value: VendorAggregateData (JSON)
TTL: 3600 seconds (1 hour)

// Budget templates cache (24 hour TTL)
Key: `budget:template:${eventType}`
Value: AllocationTemplate[] (JSON)
TTL: 86400 seconds (24 hours)

// Rate limiting (1 hour window)
Key: `ratelimit:${ipAddress}`
Value: request count
TTL: 3600 seconds (1 hour)
```

### Cache Implementation

```typescript
class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT),
      password: process.env.REDIS_PASSWORD,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async increment(key: string, ttl: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, ttl);
    }
    return count;
  }
}
```

## Error Handling

### Error Types

```typescript
class InsufficientBudgetError extends Error {
  constructor(
    public minimumBudget: number,
    public suggestedBudget: number,
    public alternatives: string[]
  ) {
    super("Insufficient budget for event requirements");
    this.name = "InsufficientBudgetError";
  }
}

class LocationNotSupportedError extends Error {
  constructor(public location: string, public nearestCities: string[]) {
    super("Limited vendor data for this location");
    this.name = "LocationNotSupportedError";
  }
}

class ProcessingTimeoutError extends Error {
  constructor() {
    super("Event plan processing timed out");
    this.name = "ProcessingTimeoutError";
  }
}

class ValidationError extends Error {
  constructor(public field: string, public message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = "ValidationError";
  }
}
```

### Error Handler Middleware

```typescript
const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);

  if (err instanceof InsufficientBudgetError) {
    return res.status(400).json({
      status: "error",
      code: "INSUFFICIENT_BUDGET",
      message: err.message,
      data: {
        minimumBudget: err.minimumBudget,
        suggestedBudget: err.suggestedBudget,
        alternatives: err.alternatives,
      },
    });
  }

  if (err instanceof LocationNotSupportedError) {
    return res.status(400).json({
      status: "error",
      code: "LOCATION_NOT_SUPPORTED",
      message: err.message,
      data: {
        nearestSupportedCities: err.nearestCities,
        notifyWhenAvailable: true,
      },
    });
  }

  if (err instanceof ProcessingTimeoutError) {
    return res.status(504).json({
      status: "error",
      code: "PROCESSING_TIMEOUT",
      message: err.message,
    });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({
      status: "error",
      code: "VALIDATION_ERROR",
      message: err.message,
      field: err.field,
    });
  }

  // Generic error
  return res.status(500).json({
    status: "error",
    code: "INTERNAL_ERROR",
    message: "An unexpected error occurred",
  });
};
```

## Security Considerations

### Rate Limiting

```typescript
class RateLimiter {
  private cache: CacheService;

  async checkLimit(ipAddress: string, limit: number = 5): Promise<boolean> {
    const key = `ratelimit:${ipAddress}`;
    const count = await this.cache.increment(key, 3600); // 1 hour window

    if (count > limit) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    return true;
  }
}
```

### Input Sanitization

```typescript
class InputSanitizer {
  sanitizeEventRequest(request: any): EventPlanRequest {
    return {
      eventType: this.sanitizeEnum(request.eventType, EventType),
      eventDate: this.sanitizeDate(request.eventDate),
      guestCount: this.sanitizeNumber(request.guestCount, 1, 10000),
      location: this.sanitizeLocation(request.location),
      eventDescription: this.sanitizeText(request.eventDescription, 50, 1000),
      guestClass: this.sanitizeGuestClass(request.guestClass),
      budget: this.sanitizeBudget(request.budget),
    };
  }

  private sanitizeText(
    text: string,
    minLength: number,
    maxLength: number
  ): string {
    // Remove HTML tags
    const cleaned = text.replace(/<[^>]*>/g, "");
    // Trim whitespace
    const trimmed = cleaned.trim();
    // Validate length
    if (trimmed.length < minLength || trimmed.length > maxLength) {
      throw new ValidationError(
        "text",
        `Length must be between ${minLength} and ${maxLength}`
      );
    }
    return trimmed;
  }

  private sanitizeDate(dateString: string): Date {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new ValidationError("date", "Invalid date format");
    }
    if (date < new Date()) {
      throw new ValidationError("date", "Date must be in the future");
    }
    return date;
  }
}
```

### Data Privacy

```typescript
class PrivacyService {
  anonymizeRequest(request: EventPlanRequest): EventPlanRequest {
    // Remove PII before logging or caching
    return {
      ...request,
      eventDescription: this.redactPII(request.eventDescription),
      guestClass: {
        ...request.guestClass,
        additionalDetails: this.redactPII(request.guestClass.additionalDetails),
      },
    };
  }

  private redactPII(text: string): string {
    // Redact email addresses
    text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]");
    // Redact phone numbers
    text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[PHONE]");
    // Redact names (basic pattern)
    text = text.replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[NAME]");
    return text;
  }

  async scheduleDataDeletion(sessionToken: string): Promise<void> {
    // Schedule deletion after 24 hours
    const deleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.scheduleJob("deleteSession", { sessionToken }, deleteAt);
  }
}
```

## Performance Optimization

### Query Optimization

```typescript
class VendorRepository {
  async findByLocation(
    latitude: number,
    longitude: number,
    radiusMiles: number
  ): Promise<Vendor[]> {
    // Use PostGIS for efficient geospatial queries
    const query = `
      SELECT *
      FROM vendors
      WHERE earth_box(ll_to_earth($1, $2), $3 * 1609.34) @> ll_to_earth(latitude, longitude)
      AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) <= $3 * 1609.34
      AND availability_status = 'available'
      ORDER BY earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude))
      LIMIT 100
    `;

    return await this.db.query(query, [latitude, longitude, radiusMiles]);
  }
}
```

### Async Processing

```typescript
class AsyncProcessor {
  private queue: Queue;

  constructor() {
    this.queue = new Queue("event-analysis", {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT),
      },
    });

    this.setupWorker();
  }

  async enqueueAnalysis(request: EventPlanRequest): Promise<string> {
    const job = await this.queue.add("analyze", request, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      timeout: 30000, // 30 seconds
    });

    return job.id;
  }

  private setupWorker(): void {
    this.queue.process("analyze", async (job) => {
      const analysisService = new AIAnalysisService();
      return await analysisService.processEventRequest(job.data);
    });
  }
}
```

## Monitoring and Logging

### Metrics to Track

```typescript
interface Metrics {
  requestsTotal: Counter;
  requestDuration: Histogram;
  analysisSuccess: Counter;
  analysisFailure: Counter;
  conversionRate: Gauge;
  averageBudget: Gauge;
  vendorDataCacheHits: Counter;
  vendorDataCacheMisses: Counter;
}

class MetricsService {
  private metrics: Metrics;

  trackRequest(duration: number, success: boolean): void {
    this.metrics.requestsTotal.inc();
    this.metrics.requestDuration.observe(duration);

    if (success) {
      this.metrics.analysisSuccess.inc();
    } else {
      this.metrics.analysisFailure.inc();
    }
  }

  trackConversion(sessionToken: string, converted: boolean): void {
    // Track if user signed up after seeing teaser
    if (converted) {
      this.metrics.conversionRate.inc();
    }
  }
}
```

### Logging Strategy

```typescript
class Logger {
  info(message: string, context?: any): void {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        context,
        timestamp: new Date().toISOString(),
      })
    );
  }

  error(message: string, error: Error, context?: any): void {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        context,
        timestamp: new Date().toISOString(),
      })
    );
  }

  trackAnalysis(
    request: EventPlanRequest,
    result: EventPlanResult,
    duration: number
  ): void {
    this.info("Event analysis completed", {
      eventType: request.eventType,
      location: `${request.location.city}, ${request.location.state}`,
      guestCount: request.guestCount,
      budget: request.budget.amount,
      feasibilityScore: result.analysis.feasibilityScore,
      vendorsFound: result.analysis.vendorData.totalVendorsFound,
      processingTime: duration,
    });
  }
}
```

## Testing Strategy

### Unit Tests

- Test budget allocation algorithms
- Test vendor data aggregation
- Test timeline generation
- Test input validation
- Test error handling

### Integration Tests

- Test API endpoints
- Test database queries
- Test cache operations
- Test AI service integration

### Load Tests

- Test concurrent request handling
- Test rate limiting
- Test cache performance
- Test database query performance

## Deployment Considerations

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# AI Service
OPENAI_API_KEY=sk-...

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_HOUR=5

# Session
SESSION_TTL_HOURS=24

# Monitoring
SENTRY_DSN=https://...
```

### Scaling Strategy

- Horizontal scaling of API servers
- Redis cluster for caching
- Database read replicas
- CDN for static assets
- Queue workers for async processing
