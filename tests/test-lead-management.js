/**
 * Test script for Lead Management endpoints
 * Run with: node tests/test-lead-management.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Lead Management Endpoints");
console.log("=".repeat(70));

const tests = [
  {
    name: "Get All Leads",
    method: "GET",
    url: "/api/v1/vendors/leads",
    description: "Get list of all leads with pagination",
    auth: true,
  },
  {
    name: "Get Leads with Filters",
    method: "GET",
    url: "/api/v1/vendors/leads?status=new&priority=high&page=1&limit=10",
    description: "Filter leads by status and priority",
    auth: true,
  },
  {
    name: "Search Leads",
    method: "GET",
    url: "/api/v1/vendors/leads?search=wedding",
    description: "Search leads by customer name, email, or event type",
    auth: true,
  },
  {
    name: "Get Lead Statistics",
    method: "GET",
    url: "/api/v1/vendors/leads/stats",
    description: "Get comprehensive lead statistics",
    auth: true,
  },
  {
    name: "Get Follow-up Leads",
    method: "GET",
    url: "/api/v1/vendors/leads/followup",
    description: "Get leads needing follow-up today",
    auth: true,
  },
  {
    name: "Get Single Lead",
    method: "GET",
    url: "/api/v1/vendors/leads/{leadId}",
    description: "Get detailed information about a lead",
    auth: true,
  },
  {
    name: "Create Lead",
    method: "POST",
    url: "/api/v1/vendors/leads",
    description: "Create a new lead from inquiry",
    auth: true,
    body: {
      customer: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
      },
      eventDetails: {
        type: "wedding",
        date: "2024-12-25",
        location: "New York",
        guestCount: 150,
        budget: 10000,
        description: "Looking for catering services",
      },
      priority: "high",
      source: "website",
      estimatedValue: 10000,
      tags: ["wedding", "high-budget"],
      initialNote: "Customer contacted via website form",
    },
  },
  {
    name: "Update Lead",
    method: "PUT",
    url: "/api/v1/vendors/leads/{leadId}",
    description: "Update lead information",
    auth: true,
    body: {
      priority: "urgent",
      estimatedValue: 12000,
      tags: ["wedding", "high-budget", "vip"],
    },
  },
  {
    name: "Update Lead Status",
    method: "PUT",
    url: "/api/v1/vendors/leads/{leadId}/status",
    description: "Update lead status",
    auth: true,
    body: {
      status: "contacted",
      note: "Called customer and discussed requirements",
    },
  },
  {
    name: "Add Note to Lead",
    method: "POST",
    url: "/api/v1/vendors/leads/{leadId}/notes",
    description: "Add a note to a lead",
    auth: true,
    body: {
      text: "Customer prefers outdoor venue",
      isPrivate: false,
    },
  },
  {
    name: "Assign Lead",
    method: "PUT",
    url: "/api/v1/vendors/leads/{leadId}/assign",
    description: "Assign lead to team member",
    auth: true,
    body: {
      userId: "USER_ID_HERE",
    },
  },
  {
    name: "Set Follow-up Date",
    method: "PUT",
    url: "/api/v1/vendors/leads/{leadId}/followup",
    description: "Set follow-up date for lead",
    auth: true,
    body: {
      date: "2024-12-20T10:00:00Z",
      note: "Follow up to discuss quote",
    },
  },
  {
    name: "Mark Lead as Won",
    method: "POST",
    url: "/api/v1/vendors/leads/{leadId}/won",
    description: "Mark lead as won",
    auth: true,
    body: {
      bookingId: "BOOKING_ID_HERE",
    },
  },
  {
    name: "Mark Lead as Lost",
    method: "POST",
    url: "/api/v1/vendors/leads/{leadId}/lost",
    description: "Mark lead as lost with reason",
    auth: true,
    body: {
      reason: "Customer chose another vendor",
    },
  },
  {
    name: "Delete Lead",
    method: "DELETE",
    url: "/api/v1/vendors/leads/{leadId}",
    description: "Permanently delete a lead",
    auth: true,
  },
];

console.log("\n📋 Available Endpoints:\n");

tests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   ${test.method} ${test.url}`);
  console.log(`   ${test.description}`);
  console.log(`   Auth Required: ${test.auth ? "Yes" : "No"}`);
  if (test.body) {
    console.log(
      `   Body: ${JSON.stringify(test.body, null, 2).substring(0, 100)}...`
    );
  }
  console.log("");
});

console.log("=".repeat(70));
console.log("\n🧪 Example Test Commands:\n");

console.log("# Get all leads");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/leads"`
);

console.log("\n# Get lead statistics");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/leads/stats"`
);

console.log("\n# Create lead");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"customer":{"name":"John Doe","email":"john@example.com"},"eventDetails":{"type":"wedding","date":"2024-12-25"}}' \\
  "${API_URL}/api/v1/vendors/leads"`);

console.log("\n# Update lead status");
console.log(`curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"status":"contacted","note":"Called customer"}' \\
  "${API_URL}/api/v1/vendors/leads/LEAD_ID/status"`);

console.log("\n# Add note");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"text":"Customer prefers outdoor venue"}' \\
  "${API_URL}/api/v1/vendors/leads/LEAD_ID/notes"`);

console.log("\n# Mark as won");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"bookingId":"BOOKING_ID"}' \\
  "${API_URL}/api/v1/vendors/leads/LEAD_ID/won"`);

console.log("\n" + "=".repeat(70));
console.log("\n✅ All Lead Management endpoints are ready for testing!");
console.log("\n📝 Notes:");
console.log("   - All endpoints require authentication (JWT token)");
console.log("   - Replace YOUR_TOKEN with actual JWT token from login");
console.log("   - Replace LEAD_ID with actual lead ID");
console.log(
  "   - Leads automatically get follow-up date (3 days from creation)"
);
console.log(
  '   - Response time is calculated when status changes to "contacted"'
);
console.log("\n📊 Lead Statuses:");
console.log("   - new: Initial inquiry");
console.log("   - contacted: Vendor has contacted customer");
console.log("   - quoted: Quote has been sent");
console.log("   - negotiating: In negotiation phase");
console.log("   - won: Converted to booking");
console.log("   - lost: Lost to competitor or declined");
console.log("\n🎯 Lead Priorities:");
console.log("   - low, medium, high, urgent");
console.log("\n📍 Lead Sources:");
console.log("   - website, referral, social, direct, other");
console.log("\n" + "=".repeat(70) + "\n");
