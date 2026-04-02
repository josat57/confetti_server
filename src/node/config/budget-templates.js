export const budgetTemplates = {
  wedding: {
    name: "Wedding",
    categories: [
      { name: "venue", percentage: 30, allocated: 0, priority: "high" },
      { name: "catering", percentage: 25, allocated: 0, priority: "high" },
      { name: "photography", percentage: 10, allocated: 0, priority: "high" },
      { name: "videography", percentage: 8, allocated: 0, priority: "medium" },
      { name: "decoration", percentage: 8, allocated: 0, priority: "medium" },
      {
        name: "entertainment",
        percentage: 5,
        allocated: 0,
        priority: "medium",
      },
      { name: "attire", percentage: 5, allocated: 0, priority: "high" },
      { name: "flowers", percentage: 3, allocated: 0, priority: "medium" },
      { name: "cake", percentage: 2, allocated: 0, priority: "medium" },
      { name: "invitations", percentage: 2, allocated: 0, priority: "low" },
      { name: "wedding_favors", percentage: 2, allocated: 0, priority: "low" },
    ],
  },
  birthday: {
    name: "Birthday",
    categories: [
      { name: "venue", percentage: 25, allocated: 0, priority: "high" },
      { name: "catering", percentage: 30, allocated: 0, priority: "high" },
      { name: "entertainment", percentage: 15, allocated: 0, priority: "high" },
      { name: "decoration", percentage: 15, allocated: 0, priority: "medium" },
      { name: "cake", percentage: 5, allocated: 0, priority: "high" },
      { name: "photography", percentage: 5, allocated: 0, priority: "medium" },
      { name: "party_favors", percentage: 3, allocated: 0, priority: "low" },
      { name: "event_supplies", percentage: 2, allocated: 0, priority: "low" },
    ],
  },
  corporate: {
    name: "Corporate Event",
    categories: [
      { name: "venue", percentage: 35, allocated: 0, priority: "high" },
      { name: "catering", percentage: 25, allocated: 0, priority: "high" },
      { name: "av_equipment", percentage: 15, allocated: 0, priority: "high" },
      {
        name: "entertainment",
        percentage: 10,
        allocated: 0,
        priority: "medium",
      },
      { name: "event_staff", percentage: 8, allocated: 0, priority: "medium" },
      { name: "transportation", percentage: 4, allocated: 0, priority: "low" },
      {
        name: "branding_materials",
        percentage: 3,
        allocated: 0,
        priority: "medium",
      },
    ],
  },
  social: {
    name: "Social Event",
    categories: [
      { name: "venue", percentage: 30, allocated: 0, priority: "high" },
      { name: "catering", percentage: 30, allocated: 0, priority: "high" },
      { name: "entertainment", percentage: 15, allocated: 0, priority: "high" },
      { name: "decoration", percentage: 10, allocated: 0, priority: "medium" },
      { name: "photography", percentage: 8, allocated: 0, priority: "medium" },
      {
        name: "event_coordination",
        percentage: 4,
        allocated: 0,
        priority: "medium",
      },
      { name: "guest_amenities", percentage: 3, allocated: 0, priority: "low" },
    ],
  },
  other: {
    name: "Custom Event",
    categories: [
      { name: "venue", percentage: 25, allocated: 0, priority: "high" },
      { name: "catering", percentage: 25, allocated: 0, priority: "high" },
      {
        name: "entertainment",
        percentage: 15,
        allocated: 0,
        priority: "medium",
      },
      { name: "decoration", percentage: 10, allocated: 0, priority: "medium" },
      { name: "event_staff", percentage: 10, allocated: 0, priority: "medium" },
      {
        name: "equipment_rentals",
        percentage: 10,
        allocated: 0,
        priority: "medium",
      },
      {
        name: "event_coordination",
        percentage: 5,
        allocated: 0,
        priority: "low",
      },
    ],
  },
};

export function applyBudgetTemplate(eventType, totalBudget) {
  const template = budgetTemplates[eventType] || budgetTemplates.other;

  return template.categories.map((category) => ({
    category: category.name,
    name: category.name,
    percentage: category.percentage / 100, // Convert to decimal for calculations
    allocated: Math.round((totalBudget * category.percentage) / 100),
    spent: 0,
    priority: category.priority || "medium",
  }));
}

export default budgetTemplates;
