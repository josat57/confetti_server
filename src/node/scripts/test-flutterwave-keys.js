import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

/**
 * Test Flutterwave API Keys
 *
 * This script tests if your Flutterwave API keys are valid
 *
 * Usage:
 *   node scripts/test-flutterwave-keys.js
 */

async function testFlutterwaveKeys() {
  console.log("\n" + "=".repeat(70));
  console.log("Testing Flutterwave API Keys");
  console.log("=".repeat(70));

  // Check if keys are configured
  const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const encryptionKey = process.env.FLUTTERWAVE_ENCRYPTION_KEY;

  console.log("\n📋 Configuration Check:");
  console.log(`Public Key: ${publicKey ? "✅ Set" : "❌ Not set"}`);
  console.log(`Secret Key: ${secretKey ? "✅ Set" : "❌ Not set"}`);
  console.log(`Encryption Key: ${encryptionKey ? "✅ Set" : "❌ Not set"}`);

  if (!secretKey) {
    console.log("\n❌ Error: FLUTTERWAVE_SECRET_KEY not configured");
    console.log("\nPlease set your Flutterwave keys in .env file:");
    console.log("FLUTTERWAVE_PUBLIC_KEY=your_public_key");
    console.log("FLUTTERWAVE_SECRET_KEY=your_secret_key");
    console.log("FLUTTERWAVE_ENCRYPTION_KEY=your_encryption_key");
    process.exit(1);
  }

  // Test 1: Check Balance (validates secret key)
  console.log("\n🔍 Test 1: Validating Secret Key...");
  try {
    const response = await axios.get(
      "https://api.flutterwave.com/v3/balances",
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      }
    );

    if (response.data.status === "success") {
      console.log("✅ Secret Key is VALID");
      console.log(`   Account: ${response.data.data[0]?.currency || "N/A"}`);
      console.log(
        `   Balance: ${response.data.data[0]?.available_balance || "N/A"}`
      );
    } else {
      console.log("❌ Secret Key validation failed");
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log("❌ Secret Key is INVALID");
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.message}`);
      console.log(`   Code: ${error.response.data.code || "N/A"}`);

      if (error.response.data.code === "invalid_Key") {
        console.log("\n⚠️  Your Flutterwave API key is invalid or expired.");
        console.log("\n📝 To fix this:");
        console.log(
          "1. Login to Flutterwave Dashboard: https://dashboard.flutterwave.com"
        );
        console.log("2. Go to Settings → API Keys");
        console.log("3. Make sure you're in TEST mode");
        console.log("4. Copy your keys and update .env file");
        console.log("5. Restart your application");
      }
    } else {
      console.log(`   Error: ${error.message}`);
    }
    process.exit(1);
  }

  // Test 2: Test Payment Initialization (validates public key)
  console.log("\n🔍 Test 2: Testing Payment Initialization...");
  try {
    const testPayment = {
      tx_ref: `TEST-${Date.now()}`,
      amount: 100,
      currency: "NGN",
      redirect_url: "https://example.com",
      customer: {
        email: "test@example.com",
        name: "Test User",
      },
      customizations: {
        title: "Test Payment",
        description: "Testing Flutterwave Integration",
      },
    };

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      testPayment,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status === "success") {
      console.log("✅ Payment initialization successful");
      console.log(`   Payment Link: ${response.data.data.link}`);
    } else {
      console.log("⚠️  Payment initialization returned unexpected status");
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log("❌ Payment initialization failed");
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("✅ Flutterwave API Keys Test Complete");
  console.log("=".repeat(70));
  console.log("\nYour Flutterwave integration is ready to use!");
  console.log("\n📝 Next Steps:");
  console.log("1. Set up ngrok to expose your webhook endpoint");
  console.log("2. Add webhook URL to Flutterwave dashboard");
  console.log("3. Test the full payment flow");
  console.log("\nFor webhook setup, see: src/node/NGROK_SETUP_GUIDE.md");
  console.log("=".repeat(70) + "\n");
}

// Run the test
testFlutterwaveKeys().catch((error) => {
  console.error("\n❌ Test failed:", error.message);
  process.exit(1);
});
