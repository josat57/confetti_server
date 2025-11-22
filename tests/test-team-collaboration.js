/**
 * Test script for Team Collaboration endpoints
 * Run with: node tests/test-team-collaboration.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Team Collaboration Endpoints");
console.log("=".repeat(70));

const tests = [
  {
    name: "Get All Team Members",
    method: "GET",
    url: "/api/v1/vendors/team",
    description: "Get list of all team members",
    auth: true,
  },
  {
    name: "Get Team Members by Status",
    method: "GET",
    url: "/api/v1/vendors/team?status=active&role=manager",
    description: "Filter team members by status and role",
    auth: true,
  },
  {
    name: "Get Single Team Member",
    method: "GET",
    url: "/api/v1/vendors/team/{memberId}",
    description: "Get details of a specific team member",
    auth: true,
  },
  {
    name: "Invite Team Member",
    method: "POST",
    url: "/api/v1/vendors/team/invite",
    description: "Send invitation to a new team member",
    auth: true,
    body: {
      email: "newmember@example.com",
      role: "manager",
      permissions: ["view_leads", "manage_leads", "view_bookings"],
      notes: "New team manager",
    },
  },
  {
    name: "Accept Invitation",
    method: "POST",
    url: "/api/v1/vendors/team/accept/{token}",
    description: "Accept team invitation using token",
    auth: true,
  },
  {
    name: "Decline Invitation",
    method: "POST",
    url: "/api/v1/vendors/team/decline/{token}",
    description: "Decline team invitation",
    auth: true,
  },
  {
    name: "Update Member Role",
    method: "PUT",
    url: "/api/v1/vendors/team/{memberId}/role",
    description: "Update team member role and permissions",
    auth: true,
    body: {
      role: "admin",
      permissions: ["view_leads", "manage_leads", "manage_team"],
    },
  },
  {
    name: "Update Member Permissions",
    method: "PUT",
    url: "/api/v1/vendors/team/{memberId}/permissions",
    description: "Update specific permissions",
    auth: true,
    body: {
      permissions: [
        "view_leads",
        "manage_leads",
        "view_bookings",
        "manage_bookings",
        "view_calendar",
      ],
    },
  },
  {
    name: "Deactivate Team Member",
    method: "POST",
    url: "/api/v1/vendors/team/{memberId}/deactivate",
    description: "Temporarily deactivate a team member",
    auth: true,
  },
  {
    name: "Reactivate Team Member",
    method: "POST",
    url: "/api/v1/vendors/team/{memberId}/reactivate",
    description: "Reactivate a deactivated team member",
    auth: true,
  },
  {
    name: "Resend Invitation",
    method: "POST",
    url: "/api/v1/vendors/team/{memberId}/resend",
    description: "Resend invitation to pending member",
    auth: true,
  },
  {
    name: "Remove Team Member",
    method: "DELETE",
    url: "/api/v1/vendors/team/{memberId}",
    description: "Permanently remove a team member",
    auth: true,
  },
  {
    name: "Get Team Activity Log",
    method: "GET",
    url: "/api/v1/vendors/team/activity?limit=50",
    description: "Get recent team activity",
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

console.log("# Get all team members");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/team"`
);

console.log("\n# Invite team member");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"email":"member@example.com","role":"manager"}' \\
  "${API_URL}/api/v1/vendors/team/invite"`);

console.log("\n# Update member role");
console.log(`curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"role":"admin","permissions":["view_leads","manage_leads"]}' \\
  "${API_URL}/api/v1/vendors/team/MEMBER_ID/role"`);

console.log("\n# Deactivate team member");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \\
  "${API_URL}/api/v1/vendors/team/MEMBER_ID/deactivate"`);

console.log("\n# Remove team member");
console.log(`curl -X DELETE -H "Authorization: Bearer YOUR_TOKEN" \\
  "${API_URL}/api/v1/vendors/team/MEMBER_ID"`);

console.log("\n# Get team activity");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/team/activity"`
);

console.log("\n" + "=".repeat(70));
console.log("\n✅ All Team Collaboration endpoints are ready for testing!");
console.log("\n📝 Notes:");
console.log("   - All endpoints require authentication (JWT token)");
console.log("   - Replace YOUR_TOKEN with actual JWT token from login");
console.log("   - Replace MEMBER_ID with actual team member ID");
console.log("   - Three roles available: admin, manager, staff");
console.log("   - Permissions are role-based with customization");
console.log("   - Invitations expire after 7 days");
console.log("   - Cannot remove or change role of vendor owner");
console.log("\n📊 Available Permissions:");
console.log("   - view_leads, manage_leads");
console.log("   - view_bookings, manage_bookings");
console.log("   - view_analytics");
console.log("   - manage_team, manage_profile, manage_payments");
console.log("   - view_calendar, manage_calendar");
console.log("   - view_portfolio, manage_portfolio");
console.log("   - view_reviews, respond_reviews");
console.log("   - view_quotes, manage_quotes");
console.log("\n" + "=".repeat(70) + "\n");
