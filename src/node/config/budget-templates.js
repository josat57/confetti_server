/**
 * Budget allocation templates by event type
 * Percentages represent the portion of total budget allocated to each category
 */

export const budgetTemplates = {
  wedding: [
    { category: "venue", percentage: 0.3, priority: "essential" },
    { category: "catering", percentage: 0.35, priority: "essential" },
    { category: "photography", percentage: 0.1, priority: "essential" },
    { category: "videography", percentage: 0.05, priority: "recommended" },
    { category: "decoration", percentage: 0.08, priority: "recommended" },
    { category: "florals", percentage: 0.04, priority: "recommended" },
    { category: "entertainment", percentage: 0.05, priority: "recommended" },
    { category: "transportation", percentage: 0.03, priority: "optional" },
  ],
  corporate: [
    { category: "venue", percentage: 0.35, priority: "essential" },
    { category: "catering", percentage: 0.3, priority: "essential" },
    { category: "audio_visual", percentage: 0.15, priority: "essential" },
    { category: "event_planning", percentage: 0.1, priority: "recommended" },
    { category: "transportation", percentage: 0.05, priority: "recommended" },
    { category: "security", percentage: 0.05, priority: "optional" },
  ],
  birthday: [
    { category: "venue", percentage: 0.25, priority: "essential" },
    { category: "catering", percentage: 0.4, priority: "essential" },
    { category: "entertainment", percentage: 0.15, priority: "recommended" },
    { category: "decoration", percentage: 0.1, priority: "recommended" },
    { category: "photography", percentage: 0.05, priority: "optional" },
    { category: "cake_desserts", percentage: 0.05, priority: "recommended" },
  ],
  graduation: [
    { category: "venue", percentage: 0.3, priority: "essential" },
    { category: "catering", percentage: 0.35, priority: "essential" },
    { category: "photography", percentage: 0.1, priority: "recommended" },
    { category: "decoration", percentage: 0.1, priority: "recommended" },
    { category: "entertainment", percentage: 0.1, priority: "optional" },
    { category: "favors_gifts", percentage: 0.05, priority: "optional" },
  ],
  conference: [
    { category: "venue", percentage: 0.35, priority: "essential" },
    { category: "catering", percentage: 0.25, priority: "essential" },
    { category: "audio_visual", percentage: 0.2, priority: "essential" },
    { category: "event_planning", percentage: 0.1, priority: "recommended" },
    { category: "transportation", percentage: 0.05, priority: "recommended" },
    { category: "security", percentage: 0.05, priority: "optional" },
  ],
  other: [
    { category: "venue", percentage: 0.3, priority: "essential" },
    { category: "catering", percentage: 0.35, priority: "essential" },
    { category: "entertainment", percentage: 0.15, priority: "recommended" },
    { category: "decoration", percentage: 0.1, priority: "recommended" },
    { category: "photography", percentage: 0.1, priority: "optional" },
  ],
};

/**
 * Minimum budget per person by event type (in NGN)
 */
export const minBudgetPerPerson = {
  wedding: 15000,
  corporate: 10000,
  birthday: 5000,
  graduation: 4000,
  conference: 12000,
  other: 5000,
};

/**
 * Category display names and descriptions
 */
export const categoryInfo = {
  venue: {
    displayName: "Event Venue",
    description:
      "Space rental for your event including halls, outdoor venues, or conference centers",
  },
  catering: {
    displayName: "Catering Services",
    description:
      "Food and beverage services including meals, buffets, and specialty cuisine",
  },
  entertainment: {
    displayName: "Entertainment",
    description:
      "DJs, live bands, performers, MCs, and other entertainment services",
  },
  photography: {
    displayName: "Photography",
    description: "Professional photography services to capture your event",
  },
  videography: {
    displayName: "Videography",
    description: "Professional video recording and editing services",
  },
  decoration: {
    displayName: "Decoration",
    description: "Event decoration including themes, backdrops, and styling",
  },
  florals: {
    displayName: "Florals",
    description: "Flower arrangements, bouquets, and floral decorations",
  },
  transportation: {
    displayName: "Transportation",
    description: "Vehicle rentals and transportation services for guests",
  },
  audio_visual: {
    displayName: "Audio/Visual Equipment",
    description: "Sound systems, projectors, screens, and lighting equipment",
  },
  event_planning: {
    displayName: "Event Planning",
    description: "Professional event planning and coordination services",
  },
  security: {
    displayName: "Security Services",
    description: "Professional security personnel for your event",
  },
  valet_parking: {
    displayName: "Valet Parking",
    description: "Valet parking services for guests",
  },
  rentals: {
    displayName: "Equipment Rentals",
    description: "Tables, chairs, linens, and other equipment rentals",
  },
  cake_desserts: {
    displayName: "Cake & Desserts",
    description: "Wedding cakes, birthday cakes, and dessert services",
  },
  bar_services: {
    displayName: "Bar Services",
    description: "Bartending and beverage services",
  },
  lighting: {
    displayName: "Lighting",
    description: "Professional lighting design and equipment",
  },
  invitations: {
    displayName: "Invitations",
    description: "Invitation design and printing services",
  },
  favors_gifts: {
    displayName: "Favors & Gifts",
    description: "Party favors and guest gifts",
  },
};

/**
 * Get budget template for event type
 * @param {string} eventType - Event type
 * @returns {Array} Budget allocation template
 */
export function getBudgetTemplate(eventType) {
  return budgetTemplates[eventType] || budgetTemplates.other;
}

/**
 * Get minimum budget for event
 * @param {string} eventType - Event type
 * @param {number} guestCount - Number of guests
 * @returns {number} Minimum budget in NGN
 */
export function getMinimumBudget(eventType, guestCount) {
  const perPerson = minBudgetPerPerson[eventType] || minBudgetPerPerson.other;
  return perPerson * guestCount;
}

/**
 * Get category information
 * @param {string} category - Category name
 * @returns {Object} Category info
 */
export function getCategoryInfo(category) {
  return (
    categoryInfo[category] || {
      displayName: category,
      description: `Services related to ${category}`,
    }
  );
}
