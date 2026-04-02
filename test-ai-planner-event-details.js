#!/usr/bin/env node

/**
 * Test AI Planner Event Details Integration
 * Tests that the AI planner includes original event details in the response
 */

import axios from "axios";

const API_BASE = "http://localhost:9600/api/v1";

// Test payload with specific details that should be reflected in response
const testPayload = {
  eventType: "wedding",
  eventDate: "2026-01-02",
  guestCount: 972,
  budget: {
    amount: 5000000,
    currency: "NGN",
  },
  location: {
    city: "Lagos",
    state: "Lagos",
    country: "Nigeria",
  },
  theme: "Traditional Nigerian Wedding",
  specialRequirements: "Outdoor ceremony with indoor reception backup",
  eventDuration: {
    startTime: "10:00 AM",
    endTime: "11:00 PM",
    isMultiDay: false,
  },
  clientProfile: {
    culturalBackground: "nigerian",
    experience: "first-time",
    personality: "traditional",
  },
};

async function testAIPlannerEventDetails() {
  try {
    console.log("🧪 Testing AI Planner Event Details Integration...\n");

    console.log("📋 Test Payload:");
    console.log(`   Event Type: ${testPayload.eventType}`);
    console.log(`   Date: ${testPayload.eventDate}`);
    console.log(`   Guest Count: ${testPayload.guestCount}`);
    console.log(
      `   Location: ${testPayload.location.city}, ${testPayload.location.state}, ${testPayload.location.country}`
    );
    console.log(
      `   Budget: ${
        testPayload.budget.currency
      } ${testPayload.budget.amount.toLocaleString()}`
    );
    console.log(`   Theme: ${testPayload.theme}\n`);

    // Generate AI plan
    console.log("🤖 Generating AI plan...");
    const response = await axios.post(
      `${API_BASE}/ai-planner/generate`,
      testPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Guest-Session": "test-session-" + Date.now(),
        },
      }
    );

    if (response.status === 200 && response.data.status === "success") {
      const eventPlan = response.data.data.eventPlan;

      console.log("✅ AI Plan Generated Successfully!\n");

      // Check if eventDetails are included
      if (eventPlan.eventDetails) {
        console.log("✅ Event Details Found in Response:");
        console.log(`   Event Type: ${eventPlan.eventDetails.eventType}`);
        console.log(`   Event Date: ${eventPlan.eventDetails.eventDate}`);
        console.log(`   Guest Count: ${eventPlan.eventDetails.guestCount}`);
        console.log(
          `   Location: ${eventPlan.eventDetails.location.fullLocation}`
        );
        console.log(
          `   Budget: ${eventPlan.eventDetails.budget.formattedAmount}`
        );
        console.log(`   Theme: ${eventPlan.eventDetails.theme}`);
        console.log(`   Duration: ${eventPlan.eventDetails.eventDuration}`);
        console.log(
          `   Special Requirements: ${eventPlan.eventDetails.specialRequirements}\n`
        );

        // Verify data matches input
        const matches = {
          eventType: eventPlan.eventDetails.eventType === testPayload.eventType,
          eventDate: eventPlan.eventDetails.eventDate === testPayload.eventDate,
          guestCount:
            eventPlan.eventDetails.guestCount === testPayload.guestCount,
          location:
            eventPlan.eventDetails.location.city === testPayload.location.city,
          budget:
            eventPlan.eventDetails.budget.amount === testPayload.budget.amount,
          theme: eventPlan.eventDetails.theme === testPayload.theme,
        };

        console.log("🔍 Data Verification:");
        Object.entries(matches).forEach(([field, isMatch]) => {
          console.log(`   ${field}: ${isMatch ? "✅ Match" : "❌ Mismatch"}`);
        });

        const allMatch = Object.values(matches).every((match) => match);
        console.log(
          `\n📊 Overall Result: ${
            allMatch
              ? "✅ All event details correctly included"
              : "❌ Some details missing or incorrect"
          }`
        );

        // Show additional plan components
        console.log("\n📋 Plan Components Generated:");
        console.log(
          `   Budget Breakdown Categories: ${
            Object.keys(eventPlan.budgetBreakdown?.breakdown || {}).length
          }`
        );
        console.log(
          `   Essential Components: ${
            eventPlan.eventComponents?.essential?.length || 0
          }`
        );
        console.log(
          `   Recommended Components: ${
            eventPlan.eventComponents?.recommended?.length || 0
          }`
        );
        console.log(
          `   Cultural Additions: ${
            eventPlan.eventComponents?.cultural_additions?.length || 0
          }`
        );
        console.log(
          `   Vendor Recommendations: ${
            eventPlan.vendorRecommendations?.recommendations?.length || 0
          }`
        );

        if (eventPlan.eventComponents?.cultural_additions?.length > 0) {
          console.log("\n🎭 Cultural Elements Detected:");
          eventPlan.eventComponents.cultural_additions
            .slice(0, 5)
            .forEach((element) => {
              console.log(`   • ${element}`);
            });
        } else {
          console.log("\n🔍 Cultural Analysis Debug:");
          console.log(
            `   Client Cultural Considerations: ${JSON.stringify(
              eventPlan.clientAnalysis?.culturalConsiderations || []
            )}`
          );
          console.log(
            `   Client Profile Background: ${testPayload.clientProfile?.culturalBackground}`
          );
        }

        if (eventPlan.vendorRecommendations?.recommendations?.length === 0) {
          console.log("\n🔍 Vendor Recommendations Debug:");
          console.log(
            `   Total Vendors Analyzed: ${
              eventPlan.vendorRecommendations?.totalVendorsAnalyzed || 0
            }`
          );
          console.log(
            `   Data Source: ${
              eventPlan.vendorRecommendations?.dataSource || "unknown"
            }`
          );
        }
      } else {
        console.log("❌ Event Details NOT found in response");
        console.log("Available response keys:", Object.keys(eventPlan));
      }
    } else {
      console.log("❌ Failed to generate AI plan");
      console.log("Response:", response.data);
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Run the test
testAIPlannerEventDetails();
