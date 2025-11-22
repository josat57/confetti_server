import axios from "axios";

/**
 * Test Registration with Different Plans
 *
 * This script tests the registration endpoint with various plan configurations
 *
 * Usage:
 *   node scripts/test-registration.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";

console.log("\n" + "=".repeat(70));
console.log("Testing Registration with Subscription Plans");
console.log("=".repeat(70));
console.log(`API URL: ${API_URL}`);
console.log("=".repeat(70));

// Valid subscription plans
const VALID_PLANS = {
  planner: [
    { name: "Starter", price: 0, description: "Free plan for event planners" },
    {
      name: "Professional",
      price: 2900,
      description: "Professional plan - ₦2,900",
    },
    {
      name: "Enterprise",
      price: 7900,
      description: "Enterprise plan - ₦7,900",
    },
  ],
  vendor: [
    { name: "Basic", price: 0, description: "Free plan for vendors" },
    {
      name: "Professional",
      price: 4900,
      description: "Professional plan - ₦4,900",
    },
    {
      name: "Enterprise",
      price: 9900,
      description: "Enterprise plan - ₦9,900",
    },
  ],
};

async function testRegistration(planType, planName, amount, description) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log("-".repeat(70));

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Test123!@#",
    userName: `testuser${Date.now()}`,
    phone: "+2348012345678",
    planType,
    planName,
    amount,
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      testUser,
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
        console.log(`   Amount: ₦${response.data.data.amount}`);
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

async function displayValidPlans() {
  console.log("\n📋 Valid Subscription Plans");
  console.log("=".repeat(70));

  console.log("\n🎯 Event Planner Plans (planType: 'planner'):");
  VALID_PLANS.planner.forEach((plan) => {
    console.log(`   - ${plan.name}: ₦${plan.price} - ${plan.description}`);
  });

  console.log("\n🏪 Vendor Plans (planType: 'vendor'):");
  VALID_PLANS.vendor.forEach((plan) => {
    console.log(`   - ${plan.name}: ₦${plan.price} - ${plan.description}`);
  });

  console.log("\n" + "=".repeat(70));
}

async function runTests() {
  await displayValidPlans();

  console.log("\n🚀 Running Registration Tests...\n");

  // Test 1: Free planner plan
  await testRegistration(
    "planner",
    "Starter",
    0,
    "Event Planner - Starter (Free)"
  );

  // Test 2: Paid planner plan
  await testRegistration(
    "planner",
    "Professional",
    2900,
    "Event Planner - Professional (₦2,900)"
  );

  // Test 3: Free vendor plan
  await testRegistration("vendor", "Basic", 0, "Vendor - Basic (Free)");

  // Test 4: Paid vendor plan
  await testRegistration(
    "vendor",
    "Professional",
    4900,
    "Vendor - Professional (₦4,900)"
  );

  // Test 5: Invalid plan name
  await testRegistration(
    "planner",
    "Premium",
    5000,
    "Invalid Plan Name (should fail)"
  );

  // Test 6: Wrong amount for plan
  await testRegistration(
    "planner",
    "Professional",
    5000,
    "Wrong Amount (should fail - price manipulation)"
  );

  // Test 7: Invalid plan type
  await testRegistration(
    "invalid",
    "Starter",
    0,
    "Invalid Plan Type (should fail)"
  );

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 Test Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Valid registrations should succeed");
  console.log(
    "❌ Invalid plans/amounts should fail with 'Invalid subscription plan'"
  );
  console.log("\n📝 Common Issues:");
  console.log("   1. Plan name must match exactly (case-sensitive)");
  console.log("   2. Amount must match the plan price exactly");
  console.log("   3. Plan type must be 'planner' or 'vendor'");
  console.log("\n💡 Valid Plan Combinations:");
  console.log("   Planner Plans:");
  console.log("     - planType: 'planner', planName: 'Starter', amount: 0");
  console.log(
    "     - planType: 'planner', planName: 'Professional', amount: 2900"
  );
  console.log(
    "     - planType: 'planner', planName: 'Enterprise', amount: 7900"
  );
  console.log("   Vendor Plans:");
  console.log("     - planType: 'vendor', planName: 'Basic', amount: 0");
  console.log(
    "     - planType: 'vendor', planName: 'Professional', amount: 4900"
  );
  console.log(
    "     - planType: 'vendor', planName: 'Enterprise', amount: 9900"
  );
  console.log("=".repeat(70) + "\n");
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
