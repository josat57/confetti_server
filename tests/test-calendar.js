/**
 * Test script for Calendar/Booking endpoints
 * Run with: node tests/test-calendar.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Calendar & Booking Management Endpoints");
console.log("=".repeat(70));

const tests = [
  {
    name: "Get Calendar View",
    method: "GET",
    url: "/api/v1/vendors/calendar?view=month",
    description: "Get monthly calendar view with availability and bookings",
    auth: true,
  },
  {
    name: "Get Calendar for Date Range",
    method: "GET",
    url: "/api/v1/vendors/calendar?startDate=2024-01-01&endDate=2024-01-31",
    description: "Get calendar for specific date range",
    auth: true,
  },
  {
    name: "Check Availability",
    method: "GET",
    url: "/api/v1/vendors/calendar/availability?dates=2024-12-25,2024-12-26",
    description: "Check if vendor is available on specific dates",
    auth: true,
  },
  {
    name: "Check Availability with Time",
    method: "GET",
    url: "/api/v1/vendors/calendar/availability?dates=2024-12-25&startTime=10:00&endTime=18:00",
    description: "Check availability for specific date and time range",
    auth: true,
  },
  {
    name: "Block Dates",
    method: "POST",
    url: "/api/v1/vendors/calendar/block",
    description: "Block one or more dates",
    auth: true,
    body: {
      dates: ["2024-12-25", "2024-12-26"],
      reason: "Holiday break",
      notes: "Office closed for Christmas",
    },
  },
  {
    name: "Bulk Unblock Dates",
    method: "POST",
    url: "/api/v1/vendors/calendar/unblock",
    description: "Unblock multiple dates at once",
    auth: true,
    body: {
      dates: ["2024-12-25", "2024-12-26"],
    },
  },
  {
    name: "Unblock Single Date",
    method: "DELETE",
    url: "/api/v1/vendors/calendar/block/{availabilityId}",
    description: "Unblock a specific date by ID",
    auth: true,
  },
  {
    name: "Update Working Hours",
    method: "PUT",
    url: "/api/v1/vendors/calendar/hours",
    description: "Update business/working hours",
    auth: true,
    body: {
      businessHours: [
        { day: "monday", open: "09:00", close: "17:00", closed: false },
        { day: "tuesday", open: "09:00", close: "17:00", closed: false },
        { day: "wednesday", open: "09:00", close: "17:00", closed: false },
        { day: "thursday", open: "09:00", close: "17:00", closed: false },
        { day: "friday", open: "09:00", close: "17:00", closed: false },
        { day: "saturday", open: "10:00", close: "14:00", closed: false },
        { day: "sunday", open: "", close: "", closed: true },
      ],
    },
  },
  {
    name: "Set Time Slots",
    method: "POST",
    url: "/api/v1/vendors/calendar/timeslots",
    description: "Define specific time slots for a date",
    auth: true,
    body: {
      date: "2024-12-20",
      timeSlots: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "13:00", endTime: "17:00", isAvailable: true },
        { startTime: "18:00", endTime: "22:00", isAvailable: false },
      ],
    },
  },
  {
    name: "Get Upcoming Bookings",
    method: "GET",
    url: "/api/v1/vendors/calendar/bookings?limit=10",
    description: "Get upcoming bookings sorted by date",
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

console.log("# Get calendar view (requires auth token)");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/calendar?view=month"`
);

console.log("\n# Check availability for dates");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/calendar/availability?dates=2024-12-25,2024-12-26"`
);

console.log("\n# Block dates");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"dates":["2024-12-25","2024-12-26"],"reason":"Holiday"}' \\
  "${API_URL}/api/v1/vendors/calendar/block"`);

console.log("\n# Update working hours");
console.log(`curl -X PUT -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"businessHours":[{"day":"monday","open":"09:00","close":"17:00","closed":false}]}' \\
  "${API_URL}/api/v1/vendors/calendar/hours"`);

console.log("\n# Set time slots");
console.log(`curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \\
  -d '{"date":"2024-12-20","timeSlots":[{"startTime":"09:00","endTime":"12:00","isAvailable":true}]}' \\
  "${API_URL}/api/v1/vendors/calendar/timeslots"`);

console.log("\n# Get upcoming bookings");
console.log(
  `curl -H "Authorization: Bearer YOUR_TOKEN" "${API_URL}/api/v1/vendors/calendar/bookings?limit=10"`
);

console.log("\n" + "=".repeat(70));
console.log("\n✅ All Calendar endpoints are ready for testing!");
console.log("\n📝 Notes:");
console.log("   - All endpoints require authentication (JWT token)");
console.log("   - Replace YOUR_TOKEN with actual JWT token from login");
console.log("   - Calendar supports day, week, and month views");
console.log("   - Time slots allow granular availability control");
console.log("   - Blocked dates cannot be booked by customers");
console.log("   - Working hours define general availability");
console.log("\n" + "=".repeat(70) + "\n");
