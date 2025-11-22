import request from "supertest";
import mongoose from "mongoose";
import app from "../../../app.js";
import User from "../../../models/user.model.js";
import Event from "../../../models/event.model.js";
import Client from "../../../models/client.model.js";
import Task from "../../../models/task.model.js";
import Guest from "../../../models/guest.model.js";
import Document from "../../../models/document.model.js";
import { generateToken } from "../../../utils/auth.js";

/**
 * Unit Tests for Planner Settings Controller
 */

describe("Planner Settings Controller", () => {
  let testUser;
  let authToken;
  let testUserId;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(
        process.env.MONGODB_TEST_URI || process.env.MONGODB_URI
      );
    }
  });

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      firstName: "Test",
      lastName: "Planner",
      email: "test.planner@example.com",
      password: "password123",
      role: "event-planner",
      isActive: true,
      preferences: {
        theme: "light",
        language: "en",
        timezone: "America/New_York",
        currency: "USD",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      },
    });

    testUserId = testUser._id;
    authToken = generateToken(testUserId);
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({ email: /test/ });
    await Event.deleteMany({ planner: testUserId });
    await Client.deleteMany({ planner: testUserId });
    await Task.deleteMany({ planner: testUserId });
    await Guest.deleteMany({ planner: testUserId });
    await Document.deleteMany({ uploadedBy: testUserId });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe("GET /api/v1/planner/settings/profile", () => {
    it("should get planner profile successfully", async () => {
      const response = await request(app)
        .get("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.profile).toHaveProperty("firstName", "Test");
      expect(response.body.data.profile).toHaveProperty("lastName", "Planner");
      expect(response.body.data.profile).toHaveProperty(
        "email",
        "test.planner@example.com"
      );
      expect(response.body.data.profile.businessInfo).toBeDefined();
    });

    it("should return 401 without authentication", async () => {
      await request(app).get("/api/v1/planner/settings/profile").expect(401);
    });

    it("should return 403 for non-planner users", async () => {
      // Create non-planner user
      const clientUser = await User.create({
        firstName: "Client",
        lastName: "User",
        email: "client@example.com",
        password: "password123",
        role: "client",
      });

      const clientToken = generateToken(clientUser._id);

      await request(app)
        .get("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${clientToken}`)
        .expect(403);

      await User.findByIdAndDelete(clientUser._id);
    });
  });

  describe("PUT /api/v1/planner/settings/profile", () => {
    it("should update planner profile successfully", async () => {
      const updateData = {
        firstName: "Updated",
        lastName: "Planner",
        phone: "+1234567890",
        businessName: "Updated Events",
        businessType: "Event Planning",
        website: "https://updatedevents.com",
        bio: "Updated bio",
        address: {
          street: "123 Updated St",
          city: "Updated City",
          state: "UC",
          country: "USA",
          zipCode: "12345",
        },
      };

      const response = await request(app)
        .put("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Profile updated successfully");
      expect(response.body.data.profile.firstName).toBe("Updated");
      expect(response.body.data.profile.businessInfo.businessName).toBe(
        "Updated Events"
      );
    });

    it("should not allow email updates", async () => {
      const updateData = {
        email: "newemail@example.com",
        firstName: "Updated",
      };

      const response = await request(app)
        .put("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.message).toContain("Email cannot be updated");
    });

    it("should validate input data", async () => {
      const invalidData = {
        firstName: "", // Empty string
        phone: "invalid-phone",
      };

      await request(app)
        .put("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe("GET /api/v1/planner/settings/preferences", () => {
    it("should get planner preferences successfully", async () => {
      const response = await request(app)
        .get("/api/v1/planner/settings/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.preferences).toHaveProperty("theme", "light");
      expect(response.body.data.preferences).toHaveProperty("language", "en");
      expect(response.body.data.preferences).toHaveProperty(
        "timezone",
        "America/New_York"
      );
      expect(response.body.data.preferences.notifications).toBeDefined();
    });
  });

  describe("PUT /api/v1/planner/settings/preferences", () => {
    it("should update preferences successfully", async () => {
      const updateData = {
        theme: "dark",
        language: "es",
        timezone: "America/Los_Angeles",
        currency: "EUR",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        notifications: {
          email: false,
          push: true,
          sms: true,
        },
      };

      const response = await request(app)
        .put("/api/v1/planner/settings/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Preferences updated successfully");
      expect(response.body.data.preferences.theme).toBe("dark");
      expect(response.body.data.preferences.notifications.email).toBe(false);
    });

    it("should validate theme values", async () => {
      const invalidData = {
        theme: "invalid-theme",
      };

      await request(app)
        .put("/api/v1/planner/settings/preferences")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe("GET /api/v1/planner/settings/subscription", () => {
    it("should get subscription details and usage", async () => {
      // Create test data for usage calculation
      await Event.create({
        title: "Test Event",
        planner: testUserId,
        startDate: new Date(),
        endDate: new Date(),
      });

      await Client.create({
        firstName: "Test",
        lastName: "Client",
        email: "testclient@example.com",
        planner: testUserId,
      });

      const response = await request(app)
        .get("/api/v1/planner/settings/subscription")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("usage");
      expect(response.body.data).toHaveProperty("tierLimits");
      expect(response.body.data.usage.events.current).toBeGreaterThanOrEqual(1);
      expect(response.body.data.usage.clients.current).toBeGreaterThanOrEqual(
        1
      );
    });
  });

  describe("GET /api/v1/planner/settings/export-data", () => {
    it("should export planner data successfully", async () => {
      // Create test data
      await Event.create({
        title: "Test Event",
        planner: testUserId,
        startDate: new Date(),
        endDate: new Date(),
      });

      const response = await request(app)
        .get("/api/v1/planner/settings/export-data")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toBe("Data exported successfully");
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("events");
      expect(response.body.data).toHaveProperty("clients");
      expect(response.body.data).toHaveProperty("tasks");
      expect(response.body.data).toHaveProperty("guests");
      expect(response.body.data).toHaveProperty("documents");
      expect(response.body.data).toHaveProperty("exportDate");
      expect(response.body.data).toHaveProperty("exportVersion");
    });
  });

  describe("DELETE /api/v1/planner/settings/account", () => {
    it("should schedule account deletion with correct password", async () => {
      const response = await request(app)
        .delete("/api/v1/planner/settings/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "password123" })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.message).toContain("Account deletion scheduled");

      // Verify user is marked as suspended
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser.status).toBe("suspended");
      expect(updatedUser.isActive).toBe(false);
      expect(updatedUser.deletionScheduledAt).toBeDefined();
    });

    it("should reject deletion with incorrect password", async () => {
      const response = await request(app)
        .delete("/api/v1/planner/settings/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ password: "wrongpassword" })
        .expect(401);

      expect(response.body.message).toBe("Incorrect password");
    });

    it("should require password for deletion", async () => {
      const response = await request(app)
        .delete("/api/v1/planner/settings/account")
        .set("Authorization", `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.message).toBe(
        "Password is required to delete account"
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      // Mock database error
      jest
        .spyOn(User, "findById")
        .mockRejectedValueOnce(new Error("Database error"));

      await request(app)
        .get("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(500);

      // Restore mock
      User.findById.mockRestore();
    });

    it("should handle invalid user ID", async () => {
      const invalidToken = generateToken("507f1f77bcf86cd799439011"); // Valid ObjectId but non-existent user

      await request(app)
        .get("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${invalidToken}`)
        .expect(404);
    });
  });

  describe("Performance", () => {
    it("should respond within acceptable time limits", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/planner/settings/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });
});
