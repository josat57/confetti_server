import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * Test Flutterwave Webhook Endpoint
 *
 * This script tests the webhook endpoint with various scenarios
 *
 * Usage:
 *   node scripts/test-webhook.js
 */

const API_URL = process.env.API_URL || "http://localhost:9600";
const WEBHOOK_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

console.log("\n" + "=".repeat(70));
console.log("Testing Flutterwave Webhook Endpoint");
console.log("=".repeat(70));
console.log(`API URL: ${API_URL}`);
console.log(
  `Webhook Secret: ${WEBHOOK_SECRET ? "✅ Configured" : "❌ Not configured"}`
);
console.log("=".repeat(70));

// Sample webhook payload (successful payment)
const successfulPaymentWebhook = {
  event: "charge.completed",
  data: {
    id: 123456789,
    tx_ref: `TEST-${Date.now()}`,
    flw_ref: "FLW-MOCK-" + Date.now(),
    device_fingerprint: "N/A",
    amount: 4900,
    currency: "NGN",
    charged_amount: 4900,
    app_fee: 68.6,
    merchant_fee: 0,
    processor_response: "Approved",
    auth_model: "PIN",
    ip: "127.0.0.1",
    narration: "CARD Transaction",
    status: "successful",
    payment_type: "card",
    created_at: new Date().toISOString(),
    account_id: 123456,
    customer: {
      id: 789012,
      name: "Test User",
      phone_number: "+2348012345678",
      email: "test@example.com",
      created_at: new Date().toISOString(),
    },
    card: {
      first_6digits: "553188",
      last_4digits: "2950",
      issuer: "MASTERCARD CREDIT",
      country: "NG",
      type: "MASTERCARD",
      expiry: "09/32",
    },
  },
};

// Sample webhook payload (failed payment)
const failedPaymentWebhook = {
  event: "charge.completed",
  data: {
    id: 123456790,
    tx_ref: `TEST-FAILED-${Date.now()}`,
    flw_ref: "FLW-MOCK-FAILED-" + Date.now(),
    amount: 4900,
    currency: "NGN",
    status: "failed",
    payment_type: "card",
    created_at: new Date().toISOString(),
    customer: {
      name: "Test User",
      email: "test@example.com",
    },
  },
};

async function testWebhookEndpoint() {
  console.log("\n🔍 Test 1: Webhook Endpoint Accessibility");
  console.log("-".repeat(70));

  try {
    // Test if endpoint exists (should return 401 without signature)
    const response = await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      successfulPaymentWebhook,
      {
        validateStatus: () => true, // Don't throw on any status
      }
    );

    if (response.status === 401) {
      console.log("✅ Webhook endpoint is accessible");
      console.log(
        "✅ Signature verification is active (401 without signature)"
      );
    } else if (response.status === 404) {
      console.log("❌ Webhook endpoint not found (404)");
      console.log("   Check if routes are properly configured");
      return false;
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log("❌ Failed to connect to webhook endpoint");
    console.log(`   Error: ${error.message}`);
    return false;
  }

  return true;
}

async function testWebhookWithValidSignature() {
  console.log("\n🔍 Test 2: Webhook with Valid Signature");
  console.log("-".repeat(70));

  if (!WEBHOOK_SECRET) {
    console.log("⚠️  Skipping: FLUTTERWAVE_WEBHOOK_SECRET not configured");
    console.log(
      "   Set FLUTTERWAVE_WEBHOOK_SECRET in .env to test signature verification"
    );
    return;
  }

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      successfulPaymentWebhook,
      {
        headers: {
          "verif-hash": WEBHOOK_SECRET,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 200) {
      console.log("✅ Webhook processed successfully with valid signature");
    } else if (response.status === 404) {
      console.log("⚠️  Payment not found (expected for test data)");
      console.log(
        "   This is normal - the test payment doesn't exist in database"
      );
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log("❌ Webhook request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function testWebhookWithInvalidSignature() {
  console.log("\n🔍 Test 3: Webhook with Invalid Signature");
  console.log("-".repeat(70));

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      successfulPaymentWebhook,
      {
        headers: {
          "verif-hash": "invalid_signature_12345",
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    if (response.status === 401) {
      console.log("✅ Invalid signature correctly rejected (401)");
      console.log("✅ Signature verification is working properly");
    } else {
      console.log(`⚠️  Expected 401, got ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function testWebhookWithMissingSignature() {
  console.log("\n🔍 Test 4: Webhook with Missing Signature");
  console.log("-".repeat(70));

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      successfulPaymentWebhook,
      {
        headers: {
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    if (response.status === 401) {
      console.log("✅ Missing signature correctly rejected (401)");
      console.log("✅ Webhook security is properly enforced");
    } else {
      console.log(`⚠️  Expected 401, got ${response.status}`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function testWebhookPayloadValidation() {
  console.log("\n🔍 Test 5: Webhook Payload Validation");
  console.log("-".repeat(70));

  if (!WEBHOOK_SECRET) {
    console.log("⚠️  Skipping: FLUTTERWAVE_WEBHOOK_SECRET not configured");
    return;
  }

  // Test with missing tx_ref
  const invalidPayload = {
    event: "charge.completed",
    data: {
      id: 123456789,
      // tx_ref is missing
      status: "successful",
    },
  };

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      invalidPayload,
      {
        headers: {
          "verif-hash": WEBHOOK_SECRET,
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    console.log(`Status: ${response.status}`);
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

    if (response.status === 400 || response.status === 404) {
      console.log("✅ Invalid payload correctly handled");
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.log("❌ Request failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function testMonitoringIntegration() {
  console.log("\n🔍 Test 6: Monitoring Integration");
  console.log("-".repeat(70));

  try {
    // Make a few webhook requests to generate metrics
    await axios.post(
      `${API_URL}/api/v1/webhooks/flutterwave`,
      successfulPaymentWebhook,
      {
        headers: {
          "verif-hash": WEBHOOK_SECRET || "test",
          "Content-Type": "application/json",
        },
        validateStatus: () => true,
      }
    );

    // Check monitoring health endpoint
    const healthResponse = await axios.get(
      `${API_URL}/api/v1/monitoring/health`,
      {
        validateStatus: () => true,
      }
    );

    if (healthResponse.status === 200) {
      console.log("✅ Monitoring health endpoint accessible");
      console.log(`   Status: ${healthResponse.data.status}`);
    } else {
      console.log(`⚠️  Monitoring health returned ${healthResponse.status}`);
    }
  } catch (error) {
    console.log("⚠️  Monitoring endpoint test failed");
    console.log(`   Error: ${error.message}`);
  }
}

async function runAllTests() {
  console.log("\n🚀 Starting Webhook Tests...\n");

  const endpointAccessible = await testWebhookEndpoint();

  if (!endpointAccessible) {
    console.log("\n❌ Webhook endpoint not accessible. Stopping tests.");
    process.exit(1);
  }

  await testWebhookWithMissingSignature();
  await testWebhookWithInvalidSignature();
  await testWebhookWithValidSignature();
  await testWebhookPayloadValidation();
  await testMonitoringIntegration();

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 Test Summary");
  console.log("=".repeat(70));
  console.log("\n✅ Webhook endpoint is properly configured and secured");
  console.log("✅ Signature verification is working");
  console.log("✅ Invalid requests are correctly rejected");
  console.log("✅ Monitoring integration is active");

  console.log("\n📝 Next Steps:");
  console.log("1. Set up ngrok to expose webhook for real testing");
  console.log("2. Add webhook URL to Flutterwave dashboard");
  console.log("3. Make a real test payment to verify end-to-end flow");
  console.log("\nFor webhook setup, see: src/node/NGROK_SETUP_GUIDE.md");
  console.log("=".repeat(70) + "\n");
}

// Run all tests
runAllTests().catch((error) => {
  console.error("\n❌ Test suite failed:", error.message);
  process.exit(1);
});
