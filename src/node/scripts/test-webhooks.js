/**
 * Webhook Testing Script
 *
 * This script tests webhook endpoints with sample payloads to verify:
 * 1. Webhook endpoints are accessible
 * 2. Signature verification works correctly
 * 3. Webhook processing handles various scenarios
 *
 * Usage:
 *   node scripts/test-webhooks.js [provider] [scenario]
 *
 * Examples:
 *   node scripts/test-webhooks.js flutterwave success
 *   node scripts/test-webhooks.js paystack failed
 *   node scripts/test-webhooks.js all
 */

import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Generate Flutterwave signature
function generateFlutterwaveSignature(payload) {
  if (!FLUTTERWAVE_SECRET) {
    throw new Error("FLUTTERWAVE_WEBHOOK_SECRET not configured");
  }
  return crypto
    .createHmac("sha256", FLUTTERWAVE_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

// Generate Paystack signature
function generatePaystackSignature(payload) {
  if (!PAYSTACK_SECRET) {
    throw new Error("PAYSTACK_SECRET_KEY not configured");
  }
  return crypto
    .createHmac("sha512", PAYSTACK_SECRET)
    .update(JSON.stringify(payload))
    .digest("hex");
}

// Sample Flutterwave webhook payloads
const flutterwavePayloads = {
  success: {
    event: "charge.completed",
    data: {
      id: 12345678,
      tx_ref: "SUB-1699999999999-test123",
      flw_ref: "FLW-MOCK-123456",
      amount: 4900,
      currency: "NGN",
      status: "successful",
      payment_type: "card",
      customer: {
        email: "test@example.com",
        name: "Test User",
      },
      card: {
        last4digits: "4081",
        type: "VISA",
      },
      created_at: new Date().toISOString(),
    },
  },
  failed: {
    event: "charge.completed",
    data: {
      id: 12345679,
      tx_ref: "SUB-1699999999999-test124",
      flw_ref: "FLW-MOCK-123457",
      amount: 4900,
      currency: "NGN",
      status: "failed",
      payment_type: "card",
      customer: {
        email: "test@example.com",
        name: "Test User",
      },
      created_at: new Date().toISOString(),
    },
  },
};

// Sample Paystack webhook payloads
const paystackPayloads = {
  success: {
    event: "charge.success",
    data: {
      id: 987654321,
      reference: "SUB-1699999999999-test123",
      amount: 490000, // Amount in kobo (NGN)
      currency: "NGN",
      status: "success",
      channel: "card",
      customer: {
        email: "test@example.com",
        customer_code: "CUS_xxxxx",
      },
      authorization: {
        last4: "4081",
        brand: "visa",
      },
      paid_at: new Date().toISOString(),
    },
  },
  failed: {
    event: "charge.failed",
    data: {
      id: 987654322,
      reference: "SUB-1699999999999-test124",
      amount: 490000,
      currency: "NGN",
      status: "failed",
      channel: "card",
      customer: {
        email: "test@example.com",
      },
      gateway_response: "Insufficient funds",
    },
  },
};

// Test webhook endpoint
async function testWebhook(provider, scenario, useInvalidSignature = false) {
  const isFlutterwave = provider === "flutterwave";
  const url = `${BASE_URL}/api/v1/webhooks/${provider}`;

  const payload = isFlutterwave
    ? flutterwavePayloads[scenario]
    : paystackPayloads[scenario];

  if (!payload) {
    log(`❌ Unknown scenario: ${scenario}`, "red");
    return false;
  }

  let signature;
  let headerName;

  try {
    if (isFlutterwave) {
      signature = useInvalidSignature
        ? "invalid_signature_12345"
        : generateFlutterwaveSignature(payload);
      headerName = "verif-hash";
    } else {
      signature = useInvalidSignature
        ? "invalid_signature_12345"
        : generatePaystackSignature(payload);
      headerName = "x-paystack-signature";
    }
  } catch (error) {
    log(`❌ Error generating signature: ${error.message}`, "red");
    return false;
  }

  const headers = {
    "Content-Type": "application/json",
    [headerName]: signature,
  };

  log(`\n${"=".repeat(60)}`, "cyan");
  log(
    `Testing ${provider.toUpperCase()} - ${scenario} ${
      useInvalidSignature ? "(Invalid Signature)" : ""
    }`,
    "cyan"
  );
  log(`${"=".repeat(60)}`, "cyan");
  log(`URL: ${url}`, "blue");
  log(`Signature Header: ${headerName}`, "blue");
  log(
    `Payload Reference: ${
      isFlutterwave ? payload.data.tx_ref : payload.data.reference
    }`,
    "blue"
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    log(`\nResponse Status: ${response.status}`, response.ok ? "green" : "red");
    log(`Response Body: ${JSON.stringify(responseData, null, 2)}`, "yellow");

    // Validate response
    if (useInvalidSignature) {
      if (response.status === 401) {
        log(
          "✅ Signature verification working correctly (rejected invalid signature)",
          "green"
        );
        return true;
      } else {
        log(
          "❌ Signature verification failed (accepted invalid signature)",
          "red"
        );
        return false;
      }
    } else {
      if (response.ok) {
        log("✅ Webhook processed successfully", "green");
        return true;
      } else {
        log("❌ Webhook processing failed", "red");
        return false;
      }
    }
  } catch (error) {
    log(`❌ Request failed: ${error.message}`, "red");
    return false;
  }
}

// Run all tests
async function runAllTests() {
  log("\n🚀 Starting Webhook Tests", "cyan");
  log(`Base URL: ${BASE_URL}\n`, "blue");

  const results = {
    passed: 0,
    failed: 0,
  };

  // Test Flutterwave
  log("\n📡 FLUTTERWAVE TESTS", "cyan");
  log("─".repeat(60), "cyan");

  if (await testWebhook("flutterwave", "success")) results.passed++;
  else results.failed++;

  if (await testWebhook("flutterwave", "failed")) results.passed++;
  else results.failed++;

  if (await testWebhook("flutterwave", "success", true)) results.passed++;
  else results.failed++;

  // Test Paystack
  log("\n\n📡 PAYSTACK TESTS", "cyan");
  log("─".repeat(60), "cyan");

  if (await testWebhook("paystack", "success")) results.passed++;
  else results.failed++;

  if (await testWebhook("paystack", "failed")) results.passed++;
  else results.failed++;

  if (await testWebhook("paystack", "success", true)) results.passed++;
  else results.failed++;

  // Summary
  log("\n\n" + "=".repeat(60), "cyan");
  log("TEST SUMMARY", "cyan");
  log("=".repeat(60), "cyan");
  log(`Total Tests: ${results.passed + results.failed}`, "blue");
  log(`Passed: ${results.passed}`, "green");
  log(`Failed: ${results.failed}`, results.failed > 0 ? "red" : "green");
  log("=".repeat(60) + "\n", "cyan");

  return results.failed === 0;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const provider = args[0];
  const scenario = args[1];

  // Validate environment
  if (!FLUTTERWAVE_SECRET) {
    log("⚠️  Warning: FLUTTERWAVE_WEBHOOK_SECRET not configured", "yellow");
  }
  if (!PAYSTACK_SECRET) {
    log("⚠️  Warning: PAYSTACK_SECRET_KEY not configured", "yellow");
  }

  if (!provider || provider === "all") {
    const success = await runAllTests();
    process.exit(success ? 0 : 1);
  } else if (provider === "flutterwave" || provider === "paystack") {
    if (!scenario) {
      log("❌ Please specify a scenario: success, failed", "red");
      log(
        "Usage: node scripts/test-webhooks.js [provider] [scenario]",
        "yellow"
      );
      process.exit(1);
    }
    const success = await testWebhook(provider, scenario);
    process.exit(success ? 0 : 1);
  } else {
    log("❌ Invalid provider. Use: flutterwave, paystack, or all", "red");
    log("Usage: node scripts/test-webhooks.js [provider] [scenario]", "yellow");
    process.exit(1);
  }
}

main();
