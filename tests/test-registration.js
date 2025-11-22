import axios from "axios";

const API_URL = "http://localhost:9600";

// Test payloads
const testCases = [
  {
    name: "Original problematic payload (amount: 7536200)",
    payload: {
      userName: "josat60",
      email: "test1@gmail.com",
      phone: "09036132322",
      password: "Ginger@123",
      confirmPassword: "Ginger@123",
      currency: "NGN",
      planId: "vendor-pro",
      planName: "Professional",
      planType: "vendor",
      amount: 7536200,
    },
  },
  {
    name: "Corrected payload (amount: 4900 naira)",
    payload: {
      userName: "josat61",
      email: "test2@gmail.com",
      phone: "09036132323",
      password: "Ginger@123",
      confirmPassword: "Ginger@123",
      currency: "NGN",
      planId: "vendor-pro",
      planName: "Professional",
      planType: "vendor",
      amount: 4900,
    },
  },
  {
    name: "Amount in kobo (490000)",
    payload: {
      userName: "josat62",
      email: "test3@gmail.com",
      phone: "09036132324",
      password: "Ginger@123",
      confirmPassword: "Ginger@123",
      currency: "NGN",
      planId: "vendor-pro",
      planName: "Professional",
      planType: "vendor",
      amount: 490000,
    },
  },
];

async function testRegistration(testCase) {
  console.log(`\n🔍 Testing: ${testCase.name}`);
  console.log("-".repeat(70));
  console.log(
    `Amount: ${testCase.payload.amount} ${testCase.payload.currency}`
  );

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/auth/register`,
      testCase.payload,
      { validateStatus: () => true }
    );

    if (response.status === 200) {
      console.log("✅ Registration successful");
      console.log(`   Status: ${response.data.status}`);
      console.log(`   Message: ${response.data.message}`);
      if (response.data.data.paymentUrl) {
        console.log(`   Payment URL: ${response.data.data.paymentUrl}`);
        console.log(`   Amount: ${response.data.data.amount}`);
      }
    } else {
      console.log(`❌ Registration failed (${response.status})`);
      console.log(`   Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function runTests() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing Registration with Different Amount Formats");
  console.log("=".repeat(70));

  for (const testCase of testCases) {
    await testRegistration(testCase);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 Summary");
  console.log("=".repeat(70));
  console.log("\n💡 Expected behavior:");
  console.log("   - amount: 4900 (naira) → should work");
  console.log("   - amount: 490000 (kobo) → should work");
  console.log("   - amount: 7536200 (invalid) → should fail");
  console.log("=".repeat(70) + "\n");
}

runTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
