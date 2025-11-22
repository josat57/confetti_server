export const budgetTemplates = {
  wedding: {
    name: "Wedding",
    categories: [
      { name: "venue", percentage: 30, allocated: 0 },
      { name: "catering", percentage: 25, allocated: 0 },
      { name: "photography", percentage: 10, allocated: 0 },
      { name: "videography", percentage: 8, allocated: 0 },
      { name: "decoration", percentage: 8, allocated: 0 },
      { name: "entertainment", percentage: 5, allocated: 0 },
      { name: "attire", percentage: 5, allocated: 0 },
      { name: "flowers", percentage: 3, allocated: 0 },
      { name: "cake", percentage: 2, allocated: 0 },
      { name: "invitations", percentage: 2, allocated: 0 },
      { name: "other", percentage: 2, allocated: 0 },
    ],
  },
  birthday: {
    name: "Birthday",
    categories: [
      { name: "venue", percentage: 25, allocated: 0 },
      { name: "catering", percentage: 30, allocated: 0 },
      { name: "entertainment", percentage: 15, allocated: 0 },
      { name: "decoration", percentage: 15, allocated: 0 },
      { name: "cake", percentage: 5, allocated: 0 },
      { name: "photography", percentage: 5, allocated: 0 },
      { name: "favors", percentage: 3, allocated: 0 },
      { name: "other", percentage: 2, allocated: 0 },
    ],
  },
  corporate: {
    name: "Corporate Event",
    categories: [
      { name: "venue", percentage: 35, allocated: 0 },
      { name: "catering", percentage: 25, allocated: 0 },
      { name: "rentals", percentage: 15, allocated: 0 },
      { name: "entertainment", percentage: 10, allocated: 0 },
      { name: "staff", percentage: 8, allocated: 0 },
      { name: "transportation", percentage: 4, allocated: 0 },
      { name: "other", percentage: 3, allocated: 0 },
    ],
  },
  social: {
    name: "Social Event",
    categories: [
      { name: "venue", percentage: 30, allocated: 0 },
      { name: "catering", percentage: 30, allocated: 0 },
      { name: "entertainment", percentage: 15, allocated: 0 },
      { name: "decoration", percentage: 10, allocated: 0 },
      { name: "photography", percentage: 8, allocated: 0 },
      { name: "other", percentage: 7, allocated: 0 },
    ],
  },
  other: {
    name: "Custom Event",
    categories: [
      { name: "venue", percentage: 25, allocated: 0 },
      { name: "catering", percentage: 25, allocated: 0 },
      { name: "entertainment", percentage: 15, allocated: 0 },
      { name: "decoration", percentage: 10, allocated: 0 },
      { name: "staff", percentage: 10, allocated: 0 },
      { name: "rentals", percentage: 10, allocated: 0 },
      { name: "other", percentage: 5, allocated: 0 },
    ],
  },
};

export function applyBudgetTemplate(eventType, totalBudget) {
  const template = budgetTemplates[eventType] || budgetTemplates.other;
  
  return template.categories.map((category) => ({
    name: category.name,
    percentage: category.percentage,
    allocated: Math.round((totalBudget * category.percentage) / 100),
    spent: 0,
  }));
}

export default budgetTemplates;
