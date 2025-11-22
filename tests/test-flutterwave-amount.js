import axios from "axios";

const API_URL = "http://localhost:9600";

async function testFlutterwaveAmount() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing Flutterwave Amount Display");
  console.log("=".repeat(70));

  const timestamp = Date.now();

  // Test with Vendor Professional (₦7,900)
  console.log("\n📋 Test: Vendor Professional Plan");
  console.log("-".repeat(70));
  console.log("Expected Display: NGN 7,900 (₦7,900)");
  console.log("Database Amount: 790,000 kobo");
  console.log("");

  const testPayload = {
    userName: `testvendor${timestamp}`,
    email: `vendor${timestamp}@example.com`,
    phone: "09012345678",
    password: "SecurePass123!",
    confirmPassword: "SecurePass123!",
    currency: "NGN",
    planType: "vendor",
    planName: "Professional",
    amount: 7900, // Frontend sends in naira
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      testPayload,
      { validateStatus: () => true }
    );

    if (response.status === 200 && response.data.data.paymentUrl) {
      console.log("✅ Registration successful");
      console.log(`   Payment URL: ${response.data.data.paymentUrl}`);
      console.log(`   Reference: ${response.data.data.reference}`);
      console.log(`   Amount returned: ${response.data.data.amount}`);
      console.log("");
      console.log("🔍 What Flutterwave should display:");
      console.log("   Amount: NGN 7,900");
      console.log("   Total: NGN 7,900");
      console.log("");
      console.log(
        "💡 Please check the payment URL to verify the amount displayed."
      );
      console.log("   If it shows NGN 790,000, the conversion is wrong.");
      console.log("   If it shows NGN 7,900, the conversion is correct!");
    } else {
      console.log(`❌ Registration failed: ${response.data.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 Amount Conversion Logic");
  console.log("=".repeat(70));
  console.log("\n1. Frontend sends: amount: 7900 (naira)");
  console.log("2. Backend validates: 790000 (kobo) from database");
  console.log("3. Backend converts: 790000 / 100 = 7900 (naira)");
  console.log("4. Flutterwave receives: 7900 (naira)");
  console.log("5. Flutterwave displays: NGN 7,900");
  console.log("=".repeat(70) + "\n");
}

testFlutterwaveAmount().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  process.exit(1);
});
