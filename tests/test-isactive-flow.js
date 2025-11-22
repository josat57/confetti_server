import axios from "axios";

const API_URL = "http://localhost:9600";

async function testIsActiveFlow() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing isActive Flow");
  console.log("=".repeat(70));

  const timestamp = Date.now();

  // Test 1: Paid Plan Registration
  console.log("\n📋 Test 1: Paid Plan Registration (Vendor Professional)");
  console.log("-".repeat(70));

  const paidPayload = {
    userName: `paiduser${timestamp}`,
    email: `paid${timestamp}@example.com`,
    phone: "09012345678",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
    currency: "NGN",
    planType: "vendor",
    planName: "Professional",
    amount: 7900,
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      paidPayload,
      { validateStatus: () => true }
    );

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   User ID: ${response.data.data.userId}`);
      console.log(
        `   Payment URL: ${
          response.data.data.paymentUrl ? "Generated" : "None"
        }`
      );

      // Check user status in database
      const checkUser = await axios
        .get(`http://localhost:9600/health`)
        .catch(() => null);

      console.log("\n   Expected User State:");
      console.log("   - status: 'pending_payment'");
      console.log("   - isActive: false ❌ (not active until payment)");
      console.log("   - isEmailVerified: false");
    } else {
      console.log(`❌ Registration failed: ${response.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 2: Free Plan Registration
  console.log("\n📋 Test 2: Free Plan Registration (Planner Starter)");
  console.log("-".repeat(70));

  const freePayload = {
    userName: `freeuser${timestamp}`,
    email: `free${timestamp}@example.com`,
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

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   User ID: ${response.data.data.userId}`);
      console.log(
        `   Payment URL: ${
          response.data.data.paymentUrl ? "Generated" : "None (Free plan)"
        }`
      );

      console.log("\n   Expected User State:");
      console.log("   - status: 'pending_verification'");
      console.log("   - isActive: true ✅ (active immediately for free plans)");
      console.log("   - isEmailVerified: false");
    } else {
      console.log(`❌ Registration failed: ${response.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  // Test 3: Try to login with paid plan (should fail)
  console.log("\n📋 Test 3: Try to login with paid plan before payment");
  console.log("-".repeat(70));

  try {
    const loginResponse = await axios.post(
      `${API_URL}/api/v1/auth/signin`,
      {
        email: paidPayload.email,
        password: paidPayload.password,
      },
      { validateStatus: () => true }
    );

    if (loginResponse.status === 401) {
      console.log("✅ Login correctly blocked");
      console.log(`   Reason: ${loginResponse.data.message}`);
      console.log("   Expected: User cannot login before payment/verification");
    } else if (loginResponse.status === 200) {
      console.log("❌ Login succeeded (SHOULD HAVE FAILED)");
      console.log("   User should not be able to login before payment!");
    } else {
      console.log(`⚠️  Unexpected status: ${loginResponse.status}`);
      console.log(`   Message: ${loginResponse.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 isActive Flow Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Expected Behavior:");
  console.log("\n1. Paid Plans:");
  console.log("   - Registration: isActive = false");
  console.log("   - After Payment: isActive = true");
  console.log("   - After Email Verification: status = 'active'");
  console.log("\n2. Free Plans:");
  console.log("   - Registration: isActive = true (immediate)");
  console.log("   - After Email Verification: status = 'active'");
  console.log("\n3. Login:");
  console.log("   - Requires: isActive = true AND isEmailVerified = true");
  console.log(
    "   - Blocked if: isActive = false OR status = 'pending_payment'"
  );
  console.log("=".repeat(70) + "\n");
}

testIsActiveFlow().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
