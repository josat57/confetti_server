import axios from "axios";

const API_URL = "http://localhost:9600";

async function testPaymentIntegration() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing Payment Integration with Flutterwave");
  console.log("=".repeat(70));

  // Test 1: Register with Professional plan (paid)
  console.log("\n📋 Test 1: Register with Professional plan (NGN)");
  console.log("-".repeat(70));

  const timestamp = Date.now();
  const testPayload = {
    userName: `testuser${timestamp}`,
    email: `test${timestamp}@example.com`,
    phone: "09012345678",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
    currency: "NGN",
    planType: "planner",
    planName: "Professional",
    amount: 5900, // NGN amount in major units
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      testPayload,
      { validateStatus: () => true }
    );

    console.log(`Status: ${response.status}`);

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   Message: ${response.data.message}`);

      if (response.data.data.paymentUrl) {
        console.log(
          `   ✅ Payment URL generated: ${response.data.data.paymentUrl.substring(
            0,
            50
          )}...`
        );
        console.log(`   Reference: ${response.data.data.reference}`);
        console.log(`   Amount: ${response.data.data.amount}`);
        console.log(`   User ID: ${response.data.data.userId}`);
      } else {
        console.log("   ⚠️  No payment URL (might be free plan)");
      }
    } else {
      console.log(`❌ Registration failed`);
      console.log(`   Error: ${response.data.message}`);
      if (response.data.error) {
        console.log(
          `   Details: ${JSON.stringify(response.data.error, null, 2)}`
        );
      }
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.log(
        `   Response: ${JSON.stringify(error.response.data, null, 2)}`
      );
    }
  }

  // Test 2: Register with free plan
  console.log("\n📋 Test 2: Register with Starter plan (Free)");
  console.log("-".repeat(70));

  const timestamp2 = Date.now() + 1;
  const freePayload = {
    userName: `freeuser${timestamp2}`,
    email: `free${timestamp2}@example.com`,
    phone: "09012345679",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
    currency: "NGN",
    planType: "planner",
    planName: "Starter",
    amount: 0,
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      freePayload,
      { validateStatus: () => true }
    );

    console.log(`Status: ${response.status}`);

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   Message: ${response.data.message}`);

      if (response.data.data.paymentUrl) {
        console.log(`   ⚠️  Payment URL generated (unexpected for free plan)`);
      } else {
        console.log(`   ✅ No payment required (free plan)`);
        console.log(`   User ID: ${response.data.data.userId}`);
      }
    } else {
      console.log(`❌ Registration failed`);
      console.log(`   Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }

  // Test 3: Register with Business plan (USD)
  console.log("\n📋 Test 3: Register with Business plan (USD)");
  console.log("-".repeat(70));

  const timestamp3 = Date.now() + 2;
  const usdPayload = {
    userName: `usduser${timestamp3}`,
    email: `usd${timestamp3}@example.com`,
    phone: "09012345680",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
    currency: "USD",
    planType: "planner",
    planName: "Business",
    amount: 19.99, // USD amount
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      usdPayload,
      { validateStatus: () => true }
    );

    console.log(`Status: ${response.status}`);

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   Message: ${response.data.message}`);

      if (response.data.data.paymentUrl) {
        console.log(`   ✅ Payment URL generated`);
        console.log(`   Amount: $${response.data.data.amount / 100}`);
      }
    } else {
      console.log(`❌ Registration failed`);
      console.log(`   Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Tests completed!");
  console.log("\n💡 Expected Results:");
  console.log("   - Paid plans should generate payment URL");
  console.log("   - Free plans should not require payment");
  console.log("   - Payment URL should be from Flutterwave");
  console.log("=".repeat(70) + "\n");
}

testPaymentIntegration().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
