/**
 * @fileoverview Type definitions for AI Event Planner
 * Using JSDoc for type safety in JavaScript
 */

/**
 * @typedef {'wedding' | 'corporate' | 'birthday' | 'graduation' | 'conference' | 'other'} EventType
 */

/**
 * @typedef {'NGN' | 'USD' | 'EUR' | 'GBP'} Currency
 */

/**
 * @typedef {'casual' | 'semi-formal' | 'formal' | 'black-tie'} FormalityLevel
 */

/**
 * @typedef {'children' | 'teenagers' | 'young_adults' | 'adults' | 'seniors'} AgeGroup
 */

/**
 * @typedef {'budget-conscious' | 'middle-class' | 'affluent' | 'luxury'} SocialStatus
 */

/**
 * @typedef {'dietary-restrictions' | 'accessibility-needs' | 'cultural-considerations' | 'religious-considerations'} SpecialRequirement
 */

/**
 * @typedef {'venue' | 'catering' | 'entertainment' | 'photography' | 'videography' | 'decoration' | 'florals' | 'transportation' | 'audio_visual' | 'event_planning' | 'security' | 'valet_parking' | 'rentals' | 'cake_desserts' | 'bar_services' | 'lighting' | 'invitations' | 'favors_gifts'} VendorCategory
 */

/**
 * @typedef {'essential' | 'recommended' | 'optional'} Priority
 */

/**
 * @typedef {'high' | 'medium' | 'low'} Availability
 */

/**
 * @typedef {Object} LocationData
 * @property {number} [latitude] - Latitude coordinate
 * @property {number} [longitude] - Longitude coordinate
 * @property {string} address - Full address
 * @property {string} city - City name
 * @property {string} state - State/province
 * @property {string} country - Country name
 * @property {[number, number]} [coordinates] - [longitude, latitude] for MongoDB
 */

/**
 * @typedef {Object} GuestClassData
 * @property {AgeGroup[]} ageGroups - Age groups of guests
 * @property {FormalityLevel} formality - Event formality level
 * @property {SocialStatus[]} socialStatus - Social status indicators
 * @property {SpecialRequirement[]} specialRequirements - Special requirements
 * @property {string} [additionalDetails] - Additional guest details
 */

/**
 * @typedef {Object} BudgetData
 * @property {number} amount - Budget amount
 * @property {Currency} currency - Currency code
 */

/**
 * @typedef {Object} EventPlanRequest
 * @property {EventType} eventType - Type of event
 * @property {Date} eventDate - Date of the event
 * @property {number} guestCount - Number of guests
 * @property {LocationData} location - Event location
 * @property {string} eventDescription - Description of the event
 * @property {GuestClassData} guestClass - Guest demographics
 * @property {BudgetData} budget - Budget information
 * @property {string} [ipAddress] - Client IP address
 * @property {string} [userAgent] - Client user agent
 */

/**
 * @typedef {Object} PriceRange
 * @property {number} min - Minimum price
 * @property {number} max - Maximum price
 * @property {number} average - Average price
 * @property {Currency} currency - Currency code
 */

/**
 * @typedef {Object} VendorCategoryData
 * @property {VendorCategory} category - Vendor category
 * @property {number} vendorCount - Number of vendors available
 * @property {PriceRange} priceRange - Price range for category
 * @property {number} averageRating - Average rating
 * @property {Availability} availability - Availability status
 */

/**
 * @typedef {Object} VendorAggregateData
 * @property {string} location - Location string
 * @property {VendorCategoryData[]} categories - Category data
 * @property {number} totalVendorsFound - Total vendors found
 * @property {Object.<string, PriceRange>} averagePricing - Average pricing by category
 */

/**
 * @typedef {Object} BudgetCategoryAllocation
 * @property {VendorCategory} category - Vendor category
 * @property {number} allocatedAmount - Amount allocated
 * @property {number} percentage - Percentage of total budget
 * @property {PriceRange} priceRange - Price range for category
 * @property {Priority} priority - Priority level
 * @property {string} rationale - Explanation for allocation
 */

/**
 * @typedef {Object} BudgetAllocation
 * @property {BudgetCategoryAllocation[]} categories - Category allocations
 * @property {number} totalAllocated - Total amount allocated
 * @property {number} contingency - Contingency amount
 * @property {number} contingencyPercentage - Contingency percentage
 */

/**
 * @typedef {Object} Recommendation
 * @property {'budget' | 'vendor' | 'timeline' | 'general'} type - Recommendation type
 * @property {string} title - Recommendation title
 * @property {string} description - Recommendation description
 * @property {'high' | 'medium' | 'low'} priority - Priority level
 */

/**
 * @typedef {Object} EventAnalysis
 * @property {VendorAggregateData} vendorData - Vendor data
 * @property {BudgetAllocation} budgetAllocation - Budget allocation
 * @property {Recommendation[]} recommendations - Recommendations
 * @property {number} feasibilityScore - Feasibility score (0-100)
 * @property {string[]} warnings - Warning messages
 */

/**
 * @typedef {Object} EventSummary
 * @property {string} eventType - Event type
 * @property {Date} eventDate - Event date
 * @property {string} location - Location string
 * @property {number} guestCount - Guest count
 * @property {number} totalBudget - Total budget
 * @property {string} currency - Currency code
 * @property {string} formality - Formality level
 */

/**
 * @typedef {Object} BudgetBreakdownTeaser
 * @property {Array<{name: string, percentage: number, amount: number, description: string, priority: string}>} categories - Budget categories
 * @property {number} totalAllocated - Total allocated
 * @property {number} contingency - Contingency amount
 */

/**
 * @typedef {Object} VendorCategoryTeaser
 * @property {string} name - Category name
 * @property {string} description - Category description
 * @property {{min: number, max: number}} estimatedCost - Estimated cost range
 * @property {string} priority - Priority level
 * @property {boolean} locked - Whether details are locked
 * @property {number} vendorCount - Number of vendors available
 */

/**
 * @typedef {Object} TimelineTeaser
 * @property {Array<{title: string, timeframe: string, description: string}>} planningMilestones - Planning milestones
 * @property {Array<{time: string, activity: string}>} eventDayHighlights - Event day highlights
 * @property {boolean} detailedTimelineLocked - Whether detailed timeline is locked
 */

/**
 * @typedef {Object} AIInsights
 * @property {{score: number, label: string}} sentiment - Sentiment analysis
 * @property {string[]} keywords - Extracted keywords
 * @property {number} feasibilityScore - Feasibility score
 */

/**
 * @typedef {Object} EventPlanTeaser
 * @property {EventSummary} eventSummary - Event summary
 * @property {BudgetBreakdownTeaser} budgetBreakdown - Budget breakdown
 * @property {VendorCategoryTeaser[]} vendorCategories - Vendor categories
 * @property {TimelineTeaser} timeline - Timeline
 * @property {string[]} recommendations - Recommendations
 * @property {AIInsights} aiInsights - AI insights
 */

/**
 * @typedef {Object} VendorRecommendation
 * @property {string} vendorId - Vendor ID
 * @property {string} name - Vendor name
 * @property {VendorCategory} category - Vendor category
 * @property {number} rating - Rating
 * @property {number} reviewCount - Review count
 * @property {PriceRange} priceRange - Price range
 * @property {Object} contactInfo - Contact information
 * @property {string[]} portfolio - Portfolio images
 * @property {boolean} availability - Availability status
 * @property {number} matchScore - Match score (0-100)
 * @property {string} whyRecommended - Recommendation reason
 */

/**
 * @typedef {Object} EventPlanFull
 * @property {EventSummary} eventSummary - Event summary
 * @property {BudgetBreakdownTeaser} budgetBreakdown - Budget breakdown
 * @property {VendorCategoryTeaser[]} vendorCategories - Vendor categories
 * @property {TimelineTeaser} timeline - Timeline
 * @property {string[]} recommendations - Recommendations
 * @property {AIInsights} aiInsights - AI insights
 * @property {VendorRecommendation[]} vendors - Vendor recommendations
 * @property {Object} detailedTimeline - Detailed timeline
 * @property {Object[]} actionItems - Action items
 * @property {Object[]} resources - Resources
 */

/**
 * @typedef {Object} EventPlanResult
 * @property {string} id - Result ID
 * @property {string} sessionToken - Session token
 * @property {EventPlanRequest} request - Original request
 * @property {EventAnalysis} analysis - Analysis results
 * @property {EventPlanTeaser} teaser - Teaser result
 * @property {EventPlanFull} [fullPlan] - Full plan (authenticated users only)
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} expiresAt - Expiration timestamp
 * @property {string} [userId] - User ID (if authenticated)
 * @property {'processing' | 'completed' | 'failed'} status - Processing status
 */

/**
 * @typedef {Object} PythonMLPayload
 * @property {Object} event_data - Event data
 * @property {Object[]} vendors - Vendor list
 * @property {Object} vendor_statistics - Vendor statistics
 */

/**
 * @typedef {Object} PythonMLResponse
 * @property {Object} nlp_analysis - NLP analysis results
 * @property {Object} budget_optimization - Budget optimization results
 * @property {Object} vendor_matches - Vendor matching results
 * @property {Object} recommendations - AI recommendations
 */

export {};
