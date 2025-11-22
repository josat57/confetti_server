/**
 * Test script for Search & Discovery endpoints
 * Run with: node tests/test-search-discovery.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Search & Discovery Endpoints");
console.log("=".repeat(70));

const tests = [
  {
    name: "List All Vendors (with pagination)",
    method: "GET",
    url: "/api/v1/vendors?page=1&limit=10",
    description: "Get paginated list of vendors",
  },
  {
    name: "List Vendors with Filters",
    method: "GET",
    url: "/api/v1/vendors?category=catering&minRating=4&location=New York",
    description: "Filter vendors by category, rating, and location",
  },
  {
    name: "Search Vendors",
    method: "GET",
    url: "/api/v1/vendors/search?query=wedding&category=catering&minPrice=1000&maxPrice=5000",
    description: "Search vendors with text query and filters",
  },
  {
    name: "Get Featured Vendors",
    method: "GET",
    url: "/api/v1/vendors/featured?limit=5",
    description: "Get featured vendors",
  },
  {
    name: "Get Featured Vendors by Category",
    method: "GET",
    url: "/api/v1/vendors/featured?category=photography&location=Los Angeles",
    description: "Get featured vendors filtered by category and location",
  },
  {
    name: "Get Vendor Categories",
    method: "GET",
    url: "/api/v1/vendors/categories",
    description: "Get all categories with vendor counts",
  },
  {
    name: "Get Popular Locations",
    method: "GET",
    url: "/api/v1/vendors/locations",
    description: "Get popular locations where vendors operate",
  },
  {
    name: "Get Public Vendor Profile",
    method: "GET",
    url: "/api/v1/vendors/{vendorId}/public",
    description:
      "Get comprehensive public profile (replace {vendorId} with actual ID)",
  },
  {
    name: "Track Profile View",
    method: "POST",
    url: "/api/v1/vendors/{vendorId}/track-view",
    description:
      "Track profile view for analytics (replace {vendorId} with actual ID)",
  },
];

console.log("\n📋 Available Endpoints:\n");

tests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.name}`);
  console.log(`   ${test.method} ${test.url}`);
  console.log(`   ${test.description}`);
  console.log("");
});

console.log("=".repeat(70));
console.log("\n🧪 Example Test Commands:\n");

console.log("# List vendors with filters");
console.log(
  `curl "${API_URL}/api/v1/vendors?category=catering&minRating=4&page=1&limit=10"`
);

console.log("\n# Search vendors");
console.log(
  `curl "${API_URL}/api/v1/vendors/search?query=wedding&minPrice=1000&maxPrice=5000"`
);

console.log("\n# Get featured vendors");
console.log(`curl "${API_URL}/api/v1/vendors/featured?limit=5"`);

console.log("\n# Get categories");
console.log(`curl "${API_URL}/api/v1/vendors/categories"`);

console.log("\n# Get popular locations");
console.log(`curl "${API_URL}/api/v1/vendors/locations"`);

console.log("\n# Get public profile (replace VENDOR_ID)");
console.log(`curl "${API_URL}/api/v1/vendors/VENDOR_ID/public"`);

console.log("\n# Track profile view (replace VENDOR_ID)");
console.log(`curl -X POST "${API_URL}/api/v1/vendors/VENDOR_ID/track-view"`);

console.log("\n" + "=".repeat(70));
console.log("\n✅ All Search & Discovery endpoints are ready for testing!");
console.log("\n📝 Notes:");
console.log("   - All endpoints are public (no authentication required)");
console.log("   - Pagination is supported with page and limit parameters");
console.log("   - Multiple filters can be combined");
console.log("   - Profile view tracking works with or without authentication");
console.log("\n" + "=".repeat(70) + "\n");
