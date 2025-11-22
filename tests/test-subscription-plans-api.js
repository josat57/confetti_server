import axios from "axios";

const API_URL = "http://localhost:9600";

async function testSubscriptionPlansAPI() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing Subscription Plans API Endpoints");
  console.log("=".repeat(70));

  // Test 1: Get all plans
  console.log("\n📋 Test 1: Get all subscription plans");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(`${API_URL}/api/v1/subscription-plans`);
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Total plans: ${response.data.results}`);
    console.log(`   Plans found:`);
    response.data.data.plans.forEach((plan) => {
      console.log(
        `   - ${plan.planType}: ${plan.planName} (${plan.displayName})`
      );
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 2: Get vendor plans only
  console.log("\n📋 Test 2: Get vendor plans only");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans?planType=vendor`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Vendor plans: ${response.data.results}`);
    response.data.data.plans.forEach((plan) => {
      console.log(`   - ${plan.planName}: ${plan.displayName}`);
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 3: Get planner plans only
  console.log("\n📋 Test 3: Get planner plans only");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans?planType=planner`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Planner plans: ${response.data.results}`);
    response.data.data.plans.forEach((plan) => {
      console.log(`   - ${plan.planName}: ${plan.displayName}`);
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 4: Get plans with NGN currency
  console.log("\n📋 Test 4: Get plans with NGN pricing");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans?currency=NGN`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Plans with NGN pricing: ${response.data.results}`);
    response.data.data.plans.forEach((plan) => {
      const price = plan.selectedPricing;
      console.log(
        `   - ${plan.planName}: ₦${price.amount} (${price.amountInMinorUnits} kobo)`
      );
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 5: Get plans with USD currency
  console.log("\n📋 Test 5: Get plans with USD pricing");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans?currency=USD`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Plans with USD pricing: ${response.data.results}`);
    response.data.data.plans.forEach((plan) => {
      const price = plan.selectedPricing;
      console.log(
        `   - ${plan.planName}: $${price.amount} (${price.amountInMinorUnits} cents)`
      );
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 6: Get specific plan by type and name
  console.log("\n📋 Test 6: Get specific plan (vendor/Professional)");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans/find/vendor/Professional?currency=NGN`
    );
    console.log(`✅ Status: ${response.status}`);
    const plan = response.data.data.plan;
    console.log(`   Plan: ${plan.displayName}`);
    console.log(`   Description: ${plan.description}`);
    console.log(`   Price: ₦${plan.selectedPricing.amount}`);
    console.log(`   Features: ${plan.features.length} features`);
    plan.features.forEach((feature) => {
      console.log(`     - ${feature}`);
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  // Test 7: Get vendor plans with NGN currency (combined filters)
  console.log("\n📋 Test 7: Get vendor plans with NGN pricing");
  console.log("-".repeat(70));
  try {
    const response = await axios.get(
      `${API_URL}/api/v1/subscription-plans?planType=vendor&currency=NGN`
    );
    console.log(`✅ Status: ${response.status}`);
    console.log(`   Vendor plans with NGN: ${response.data.results}`);
    response.data.data.plans.forEach((plan) => {
      const price = plan.selectedPricing;
      console.log(
        `   - ${plan.planName}: ₦${price.amount} (${plan.billingCycle})`
      );
    });
  } catch (error) {
    console.log(`❌ Error: ${error.response?.data?.message || error.message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 API Endpoints Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Available Endpoints:");
  console.log("   GET /api/v1/subscription-plans");
  console.log("       - Get all plans");
  console.log("       - Query params: planType, currency, activeOnly");
  console.log("");
  console.log("   GET /api/v1/subscription-plans/find/:planType/:planName");
  console.log("       - Get specific plan by type and name");
  console.log("       - Query params: currency");
  console.log("");
  console.log("   GET /api/v1/subscription-plans/:id");
  console.log("       - Get plan by ID");
  console.log("");
  console.log("💡 Frontend Usage Examples:");
  console.log("   - Get all vendor plans: ?planType=vendor");
  console.log("   - Get plans in NGN: ?currency=NGN");
  console.log("   - Get vendor plans in NGN: ?planType=vendor&currency=NGN");
  console.log("   - Get specific plan: /find/vendor/Professional?currency=NGN");
  console.log("=".repeat(70) + "\n");
}

testSubscriptionPlansAPI().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
