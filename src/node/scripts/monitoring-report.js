import mongoose from "mongoose";
import dotenv from "dotenv";
import paymentMonitoringService from "../services/monitoring/payment-monitoring.service.js";
import { logger } from "../utils/logger.js";

dotenv.config();

/**
 * Generate and display monitoring report
 *
 * Usage:
 *   node scripts/monitoring-report.js [timeframe]
 *
 * Examples:
 *   node scripts/monitoring-report.js 24h
 *   node scripts/monitoring-report.js 7d
 */

async function generateReport() {
  const timeframe = process.argv[2] || "24h";

  console.log("\n" + "=".repeat(70));
  console.log("📊 Payment & Subscription Monitoring Report");
  console.log("=".repeat(70));
  console.log(`Timeframe: ${timeframe}`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  try {
    // Connect to MongoDB
    console.log("\n🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Generate comprehensive report
    const report = await paymentMonitoringService.generateMonitoringReport(
      timeframe
    );

    if (!report) {
      console.error("❌ Failed to generate report");
      process.exit(1);
    }

    // Display Webhook Statistics
    console.log("📡 Webhook Statistics");
    console.log("-".repeat(70));
    console.log(`Total Webhooks Received: ${report.webhooks.total}`);
    console.log(`Successful: ${report.webhooks.successful}`);
    console.log(`Failed: ${report.webhooks.failed}`);
    console.log(
      `Invalid Signatures: ${report.webhooks.invalidSignature} ${
        report.webhooks.invalidSignature > 0 ? "⚠️" : ""
      }`
    );
    console.log(`Success Rate: ${report.webhooks.successRate}%`);

    // Alert if webhook success rate is low
    if (parseFloat(report.webhooks.successRate) < 90) {
      console.log("⚠️  WARNING: Webhook success rate is below 90% threshold!");
    }

    // Display Payment Statistics
    console.log("\n💳 Payment Statistics");
    console.log("-".repeat(70));
    if (report.payments) {
      console.log(`Total Payments: ${report.payments.total}`);
      console.log(`Completed: ${report.payments.completed}`);
      console.log(`Failed: ${report.payments.failed}`);
      console.log(`Pending: ${report.payments.pending}`);
      console.log(`Completion Rate: ${report.payments.rate}%`);

      // Alert if payment completion rate is low
      if (parseFloat(report.payments.rate) < 80) {
        console.log(
          "⚠️  WARNING: Payment completion rate is below 80% threshold!"
        );
      }
    } else {
      console.log("No payment data available");
    }

    // Display Subscription Statistics
    console.log("\n📋 Subscription Statistics");
    console.log("-".repeat(70));
    if (report.subscriptions) {
      console.log(`Active: ${report.subscriptions.active || 0}`);
      console.log(
        `Pending Payment: ${report.subscriptions.pending_payment || 0}`
      );
      console.log(`Trial: ${report.subscriptions.trial || 0}`);
      console.log(`Cancelled: ${report.subscriptions.cancelled || 0}`);
      console.log(`Expired: ${report.subscriptions.expired || 0}`);

      const total = Object.values(report.subscriptions).reduce(
        (sum, val) => sum + val,
        0
      );
      console.log(`Total: ${total}`);
    } else {
      console.log("No subscription data available");
    }

    // Display Alerts
    console.log("\n🚨 Alerts");
    console.log("-".repeat(70));
    console.log(`Failed Payments (last 24h): ${report.alerts.failedPayments}`);
    console.log(`Stale Pending Payments: ${report.alerts.stalePayments}`);

    if (report.alerts.failedPayments > 5) {
      console.log("⚠️  WARNING: High number of failed payments detected!");
    }

    if (report.alerts.stalePayments > 10) {
      console.log(
        "⚠️  WARNING: High number of stale pending payments detected!"
      );
    }

    // Get detailed failed payments
    console.log("\n❌ Recent Failed Payments");
    console.log("-".repeat(70));
    const failedPayments =
      await paymentMonitoringService.getRecentFailedPayments(24);

    if (failedPayments.length > 0) {
      failedPayments.slice(0, 10).forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   Reference: ${payment.reference}`);
        console.log(`   Amount: ${payment.currency} ${payment.amount}`);
        console.log(`   User: ${payment.user?.email || "N/A"}`);
        console.log(
          `   Plan: ${payment.subscription?.planName || "N/A"} (${
            payment.subscription?.planType || "N/A"
          })`
        );
        console.log(`   Failed At: ${payment.updatedAt}`);
      });

      if (failedPayments.length > 10) {
        console.log(`\n... and ${failedPayments.length - 10} more`);
      }
    } else {
      console.log("No failed payments in the last 24 hours ✅");
    }

    // Get stale pending payments
    console.log("\n⏳ Stale Pending Payments (>24h)");
    console.log("-".repeat(70));
    const stalePayments =
      await paymentMonitoringService.getStalePendingPayments(24);

    if (stalePayments.length > 0) {
      stalePayments.slice(0, 10).forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment ID: ${payment._id}`);
        console.log(`   Reference: ${payment.reference}`);
        console.log(`   Amount: ${payment.currency} ${payment.amount}`);
        console.log(`   User: ${payment.user?.email || "N/A"}`);
        console.log(
          `   Plan: ${payment.subscription?.planName || "N/A"} (${
            payment.subscription?.planType || "N/A"
          })`
        );
        console.log(`   Created At: ${payment.createdAt}`);
        console.log(
          `   Age: ${Math.round(
            (Date.now() - new Date(payment.createdAt)) / (1000 * 60 * 60)
          )} hours`
        );
      });

      if (stalePayments.length > 10) {
        console.log(`\n... and ${stalePayments.length - 10} more`);
      }
    } else {
      console.log("No stale pending payments ✅");
    }

    // Summary and Recommendations
    console.log("\n" + "=".repeat(70));
    console.log("📝 Summary & Recommendations");
    console.log("=".repeat(70));

    const issues = [];

    if (parseFloat(report.webhooks.successRate) < 90) {
      issues.push(
        "- Investigate webhook failures - check payment provider dashboard"
      );
    }

    if (report.webhooks.invalidSignature > 0) {
      issues.push(
        "- CRITICAL: Invalid webhook signatures detected - verify webhook secrets"
      );
    }

    if (report.payments && parseFloat(report.payments.rate) < 80) {
      issues.push(
        "- Low payment completion rate - review payment flow and user experience"
      );
    }

    if (report.alerts.failedPayments > 5) {
      issues.push(
        "- High number of failed payments - investigate common failure reasons"
      );
    }

    if (report.alerts.stalePayments > 10) {
      issues.push(
        "- Many stale pending payments - consider automated requery or cleanup"
      );
    }

    if (issues.length > 0) {
      console.log("\n⚠️  Issues Detected:\n");
      issues.forEach((issue) => console.log(issue));
    } else {
      console.log("\n✅ All metrics within acceptable ranges!");
    }

    console.log("\n" + "=".repeat(70));
    console.log("Report generation completed successfully");
    console.log("=".repeat(70) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error generating report:", error);
    logger.error("Monitoring report generation failed", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

// Run the report
generateReport();
