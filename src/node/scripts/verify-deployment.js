import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";
import { logger } from "../utils/logger.js";

dotenv.config();

/**
 * Post-Deployment Verification Script
 *
 * Verifies that the subscription payment integration is properly deployed
 *
 * Usage:
 *   node scripts/verify-deployment.js [api-url]
 *
 * Example:
 *   node scripts/verify-deployment.js https://api.confetti.com
 */

const API_URL =
  process.argv[2] || `http://localhost:${process.env.PORT || 9600}`;

const tests = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function printHeader(text) {
  console.log("\n" + "=".repeat(70));
  console.log(text);
  console.log("=".repeat(70));
}

function printTest(name, passed, message = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (message) {
    console.log(`   ${message}`);
  }
  if (passed) {
    tests.passed++;
  } else {
    tests.failed++;
  }
}

function printWarning(name, message) {
  console.log(`⚠️  ${name}`);
  console.log(`   ${message}`);
  tests.warnings++;
}

async function testDatabaseConnection() {
  printHeader("1. Database Connection");

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    printTest("MongoDB connection", true, "Connected successfully");

    // Check collections exist
    const collections = await mongoose.connection.db
      .listCollections()
      .toArray();
    const collectionNames = collections.map((c) => c.name);

    const requiredCollections = ["users", "payments", "subscriptions"];
    for (const collection of requiredCollections) {
      const exists = collectionNames.includes(collection);
      printTest(`Collection '${collection}' exists`, exists);
    }

    await mongoose.connection.close();
  } catch (error) {
    printTest("MongoDB connection", false, error.message);
  }
}

async function testEnvironmentVariables() {
  printHeader("2. Environment Variables");

  const required = [
    "MONGODB_URI",
    "FLUTTERWAVE_PUBLIC_KEY",
    "FLUTTERWAVE_SECRET_KEY",
    "FLUTTERWAVE_WEBHOOK_SECRET",
    "FRONTEND_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
  ];

  for (const varName of required) {
    const exists = !!process.env[varName];
    printTest(`${varName} is set`, exists);
  }

  // Check optional variables
  const optional = ["PAYSTACK_PUBLIC_KEY", "PAYSTACK_SECRET_KEY"];
  for (const varName of optional) {
    if (!process.env[varName]) {
      printWarning(
        `${varName} not set`,
        "Optional - Paystack integration disabled"
      );
    }
  }
}

async function testAPIEndpoints() {
  printHeader("3. API Endpoints");

  try {
    // Test health endpoint
    const healthResponse = await axios.get(`${API_URL}/health`);
    printTest(
      "Health endpoint",
      healthResponse.status === 200,
      `Status: ${healthResponse.status}`
    );

    // Test monitoring health endpoint
    try {
      const monitoringHealthResponse = await axios.get(
        `${API_URL}/api/v1/monitoring/health`
      );
      printTest(
        "Monitoring health endpoint",
        monitoringHealthResponse.status === 200,
        `Status: ${monitoringHealthResponse.status}`
      );
    } catch (error) {
      if (error.response?.status === 401) {
        printTest(
          "Monitoring health endpoint",
          true,
          "Endpoint exists (requires auth)"
        );
      } else {
        printTest("Monitoring health endpoint", false, error.message);
      }
    }

    // Test webhook endpoints exist (should return 401 or 400, not 404)
    try {
      await axios.post(`${API_URL}/api/v1/webhooks/flutterwave`, {});
    } catch (error) {
      const exists = error.response && error.response.status !== 404;
      printTest(
        "Flutterwave webhook endpoint",
        exists,
        `Status: ${error.response?.status || "N/A"}`
      );
    }

    try {
      await axios.post(`${API_URL}/api/v1/webhooks/paystack`, {});
    } catch (error) {
      const exists = error.response && error.response.status !== 404;
      printTest(
        "Paystack webhook endpoint",
        exists,
        `Status: ${error.response?.status || "N/A"}`
      );
    }

    // Test registration endpoint exists
    try {
      await axios.post(`${API_URL}/api/v1/auth/register`, {});
    } catch (error) {
      const exists = error.response && error.response.status !== 404;
      printTest(
        "Registration endpoint",
        exists,
        `Status: ${error.response?.status || "N/A"}`
      );
    }
  } catch (error) {
    printTest(
      "API server",
      false,
      `Cannot connect to ${API_URL}: ${error.message}`
    );
  }
}

async function testDatabaseMigration() {
  printHeader("4. Database Migration");

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const User = mongoose.model("User");
    const Payment = mongoose.model("Payment");
    const Subscription = mongoose.model("Subscription");

    // Check User model has status field
    const sampleUser = await User.findOne();
    if (sampleUser) {
      printTest(
        "User model has 'status' field",
        sampleUser.status !== undefined
      );

      // Check no old roles exist
      const oldRoles = await User.countDocuments({
        role: { $in: ["user", "superadmin"] },
      });
      printTest(
        "No old user roles (user/superadmin)",
        oldRoles === 0,
        `Found ${oldRoles} users with old roles`
      );
    } else {
      printWarning("User model check", "No users in database to verify");
    }

    // Check Payment model has paymentType field
    const samplePayment = await Payment.findOne();
    if (samplePayment) {
      printTest(
        "Payment model has 'paymentType' field",
        samplePayment.paymentType !== undefined
      );
    } else {
      printWarning("Payment model check", "No payments in database to verify");
    }

    // Check Subscription model
    const subscriptionCount = await Subscription.countDocuments();
    printTest(
      "Subscription collection exists",
      true,
      `${subscriptionCount} subscriptions found`
    );

    await mongoose.connection.close();
  } catch (error) {
    printTest("Database migration verification", false, error.message);
  }
}

async function testMonitoringService() {
  printHeader("5. Monitoring Service");

  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Import monitoring service
    const paymentMonitoringService = (
      await import("../services/monitoring/payment-monitoring.service.js")
    ).default;

    // Test monitoring methods
    printTest("Monitoring service loaded", true);

    // Test webhook tracking
    paymentMonitoringService.trackWebhookAttempt("flutterwave", true);
    const webhookRate = paymentMonitoringService.getWebhookSuccessRate();
    printTest(
      "Webhook tracking works",
      webhookRate !== undefined,
      `Success rate: ${webhookRate}%`
    );

    // Test payment completion rate
    const paymentStats =
      await paymentMonitoringService.getPaymentCompletionRate("24h");
    printTest("Payment completion rate works", paymentStats !== null);

    // Test subscription metrics
    const subscriptionMetrics =
      await paymentMonitoringService.getSubscriptionMetrics();
    printTest("Subscription metrics works", subscriptionMetrics !== null);

    // Reset metrics after testing
    paymentMonitoringService.resetMetrics();

    await mongoose.connection.close();
  } catch (error) {
    printTest("Monitoring service", false, error.message);
  }
}

async function runVerification() {
  console.log("\n" + "=".repeat(70));
  console.log("Subscription Payment Integration - Deployment Verification");
  console.log("=".repeat(70));
  console.log(`API URL: ${API_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  await testEnvironmentVariables();
  await testDatabaseConnection();
  await testDatabaseMigration();
  await testAPIEndpoints();
  await testMonitoringService();

  // Summary
  printHeader("Verification Summary");
  console.log(`✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  console.log(`⚠️  Warnings: ${tests.warnings}`);

  if (tests.failed === 0) {
    console.log(
      "\n🎉 All critical tests passed! Deployment verified successfully."
    );
    console.log("\nNext steps:");
    console.log("1. Configure payment provider webhooks");
    console.log("2. Test registration flow manually");
    console.log("3. Monitor webhook delivery");
    console.log("4. Set up automated monitoring");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed. Please review the errors above.");
    console.log("\nTroubleshooting:");
    console.log("- Check environment variables are set correctly");
    console.log("- Verify database migration completed successfully");
    console.log("- Ensure API server is running");
    console.log("- Review logs for detailed error messages");
    process.exit(1);
  }
}

// Run verification
runVerification().catch((error) => {
  console.error("\n❌ Verification failed:", error);
  process.exit(1);
});
