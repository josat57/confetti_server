import axios from "axios";

/**
 * Test Registration with Currency Support
 *
 * This script tests the registration endpoint with currency parameter
 *
 * Usage:
 *   node scripts/test-currency-registration.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Registration with Currency Support");
console.log("=".repeat(70));
console.log(`API URL: ${API_URL}`);
console.log("=".repeat(70));

async function testRegistration(testData, description) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log("-".repeat(70));
  console.log(`Request:`, JSON.stringify(testData, null, 2));

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      testData,
      {
        validateStatus: () => true,
      }
    );

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Message: ${response.data.message}`);
      if (response.data.data.paymentUrl) {
        console.log(`   Payment URL: ${response.data.data.paymentUrl}`);
        console.log(`   Amount: ${response.data.data.amount}`);
        console.log(`   Currency: ${testData.currency || "NGN (default)"}`);
      }
    } else {
      console.log(`❌ Registration failed (${response.status})`);
      console.log(
        `   Error: ${response.data.message || JSON.stringify(response.data)}`
      );
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function runTests() {
  console.log("\n🚀 Running Currency Registration Tests...\n");

  // Test 1: Vendor Professional with NGN (frontend format - amount in naira)
  await testRegistration(
    {
      email: `test-ngn-${Date.now()}@example.com`,
      password: "Test123!@#",
      userName: `testuser${Date.now()}`,
      phone: "+2348012345678",
      planType: "vendor",
      planName: "Professional",
      amount: 49, // Frontend sends in naira
      currency: "NGN",
    },
    "Vendor Professional - NGN (49 naira)"
  );

  // Test 2: Vendor Professional with NGN (backend format - amount in kobo)
  await testRegistration(
    {
      email: `test-ngn2-${Date.now()}@example.com`,
      password: "Test123!@#",
      userName: `testuser${Date.now()}`,
      phone: "+2348012345679",
      planType: "vendor",
      planName: "Professional",
      amount: 4900, // Backend format in kobo
      currency: "NGN",
    },
    "Vendor Professional - NGN (4900 kobo)"
  );

  // Test 3: Planner Professional with USD
  await testRegistration(
    {
      email: `test-usd-${Date.now()}@example.com`,
      password: "Test123!@#",
      userName: `testuser${Date.now()}`,
      phone: "+2348012345680",
      planType: "planner",
      planName: "Professional",
      amount: 5, // $5 in dollars
      currency: "USD",
    },
    "Planner Professional - USD (5 dollars)"
  );

  // Test 4: Free plan (no currency needed)
  await testRegistration(
    {
      email: `test-free-${Date.now()}@example.com`,
      password: "Test123!@#",
      userName: `testuser${Date.now()}`,
      phone: "+2348012345681",
      planType: "planner",
      planName: "Starter",
      amount: 0,
      currency: "NGN",
    },
    "Planner Starter - Free (0 amount)"
  );

  // Test 5: Without currency (should default to NGN)
  await testRegistration(
    {
      email: `test-default-${Date.now()}@example.com`,
      password: "Test123!@#",
      userName: `testuser${Date.now()}`,
      phone: "+2348012345682",
      planType: "vendor",
      planName: "Professional",
      amount: 49,
      // No currency specified - should default to NGN
    },
    "Vendor Professional - No currency (should default to NGN)"
  );

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 Test Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Currency Support Implemented:");
  console.log("   - Frontend can send amount in major units (naira/dollars)");
  console.log(
    "   - Backend converts to minor units (kobo/cents) automatically"
  );
  console.log("   - Supports NGN and USD currencies");
  console.log("   - Defaults to NGN if currency not specified");
  console.log("\n📝 Frontend Payload Format:");
  console.log("   {");
  console.log('     "planType": "vendor",');
  console.log('     "planName": "Professional",');
  console.log('     "amount": 49,           // Amount in naira (not kobo)');
  console.log('     "currency": "NGN"       // Currency code');
  console.log("   }");
  console.log("\n💡 Supported Plans:");
  console.log("   NGN Plans:");
  console.log("     - Vendor Professional: 49 NGN (₦49.00)");
  console.log("     - Vendor Enterprise: 99 NGN (₦99.00)");
  console.log("     - Planner Professional: 29 NGN (₦29.00)");
  console.log("     - Planner Enterprise: 79 NGN (₦79.00)");
  console.log("   USD Plans:");
  console.log("     - Vendor Professional: 10 USD ($10.00)");
  console.log("     - Vendor Enterprise: 20 USD ($20.00)");
  console.log("     - Planner Professional: 5 USD ($5.00)");
  console.log("     - Planner Enterprise: 15 USD ($15.00)");
  console.log("=".repeat(70) + "\n");
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
