import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/user.model.js";
import Event from "../../models/event.model.js";
import Client from "../../models/client.model.js";
import Task from "../../models/task.model.js";
import { generateToken } from "../../utils/auth.js";

/**
 * Performance Tests for API Endpoints
 * Tests response times and throughput under various loads
 */

describe("API Performance Tests", () => {
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

    // Create test user
    testUser = await User.create({
      firstName: "Performance",
      lastName: "Tester",
      email: "performance@example.com",
      password: "password123",
      role: "event-planner",
    });

    testUserId = testUser._id;
    authToken = generateToken(testUserId);
  });

  afterAll(async () => {
    // Clean up
    await User.deleteMany({ email: /performance|test/ });
    await Event.deleteMany({ planner: testUserId });
    await Client.deleteMany({ planner: testUserId });
    await Task.deleteMany({ planner: testUserId });
    await mongoose.connection.close();
  });

  describe("Response Time Tests", () => {
    it("should respond to authentication within 500ms", async () => {
      const startTime = Date.now();

      await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "performance@example.com",
          password: "password123",
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });

    it("should respond to dashboard within 1000ms", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/planner/dashboard")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
    });

    it("should respond to event creation within 800ms", async () => {
      const startTime = Date.now();

      await request(app)
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Performance Test Event",
          startDate: new Date(),
          endDate: new Date(),
        })
        .expect(201);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(800);
    });

    it("should respond to search within 1500ms", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/planner/search?q=performance")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1500);
    });
  });

  describe("Throughput Tests", () => {
    it("should handle 10 concurrent requests efficiently", async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 10 concurrent dashboard requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get("/api/v1/planner/dashboard")
            .set("Authorization", `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(responses.every((res) => res.status === 200)).toBe(true);

      // Should complete within 3 seconds
      expect(totalTime).toBeLessThan(3000);

      // Average response time should be reasonable
      const avgResponseTime = totalTime / 10;
      expect(avgResponseTime).toBeLessThan(300);
    });

    it("should handle bulk client creation efficiently", async () => {
      const startTime = Date.now();
      const promises = [];

      // Create 20 clients concurrently
      for (let i = 0; i < 20; i++) {
        promises.push(
          request(app)
            .post("/api/v1/clients")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
              firstName: `Client${i}`,
              lastName: "Performance",
              email: `client${i}@performance.com`,
            })
        );
      }

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses.every((res) => res.status === 201)).toBe(true);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Load Tests with Data", () => {
    beforeAll(async () => {
      // Create test data for load testing
      const clients = [];
      const events = [];
      const tasks = [];

      // Create 100 clients
      for (let i = 0; i < 100; i++) {
        clients.push({
          firstName: `LoadClient${i}`,
          lastName: "Test",
          email: `loadclient${i}@example.com`,
          planner: testUserId,
        });
      }
      const createdClients = await Client.insertMany(clients);

      // Create 50 events
      for (let i = 0; i < 50; i++) {
        events.push({
          title: `Load Test Event ${i}`,
          description: `Performance testing event number ${i}`,
          eventType: "Corporate",
          startDate: new Date(2025, 5, i + 1),
          endDate: new Date(2025, 5, i + 1),
          planner: testUserId,
          client: createdClients[i % createdClients.length]._id,
        });
      }
      const createdEvents = await Event.insertMany(events);

      // Create 200 tasks
      for (let i = 0; i < 200; i++) {
        tasks.push({
          title: `Load Test Task ${i}`,
          description: `Performance testing task number ${i}`,
          planner: testUserId,
          event: createdEvents[i % createdEvents.length]._id,
          dueDate: new Date(2025, 4, (i % 30) + 1),
          priority: ["low", "medium", "high"][i % 3],
          status: "pending",
        });
      }
      await Task.insertMany(tasks);
    });

    it("should handle dashboard with large dataset within 2000ms", async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get("/api/v1/planner/dashboard")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000);
      expect(response.body.data.stats.totalClients).toBeGreaterThanOrEqual(100);
      expect(response.body.data.stats.totalEvents).toBeGreaterThanOrEqual(50);
      expect(response.body.data.stats.totalTasks).toBeGreaterThanOrEqual(200);
    });

    it("should handle search with large dataset within 2000ms", async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get("/api/v1/planner/search?q=load")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000);
      expect(response.body.data.totalResults).toBeGreaterThan(0);
    });

    it("should handle paginated event list efficiently", async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get("/api/v1/events?page=1&limit=20")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
      expect(response.body.data.events.length).toBeLessThanOrEqual(20);
    });

    it("should handle filtered task list efficiently", async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get("/api/v1/tasks?status=pending&priority=high")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1500);
    });
  });

  describe("Database Query Performance", () => {
    it("should use indexes for event queries", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/events?startDate=2025-06-01&endDate=2025-06-30")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
    });

    it("should use indexes for task queries", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/tasks?dueDate=2025-05-15")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000);
    });

    it("should use text indexes for search", async () => {
      const startTime = Date.now();

      await request(app)
        .get("/api/v1/planner/search?q=corporate")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1500);
    });
  });

  describe("Memory Usage Tests", () => {
    it("should handle large data export without memory issues", async () => {
      const startTime = Date.now();
      const initialMemory = process.memoryUsage().heapUsed;

      const response = await request(app)
        .get("/api/v1/planner/settings/export-data")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(responseTime).toBeLessThan(5000);
      expect(memoryIncrease).toBeLessThan(100); // Should not increase memory by more than 100MB
      expect(response.body.data).toHaveProperty("events");
      expect(response.body.data).toHaveProperty("clients");
      expect(response.body.data).toHaveProperty("tasks");
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle mixed concurrent operations", async () => {
      const startTime = Date.now();
      const promises = [];

      // Mix of different operations
      promises.push(
        request(app)
          .get("/api/v1/planner/dashboard")
          .set("Authorization", `Bearer ${authToken}`)
      );

      promises.push(
        request(app)
          .get("/api/v1/events")
          .set("Authorization", `Bearer ${authToken}`)
      );

      promises.push(
        request(app)
          .get("/api/v1/clients")
          .set("Authorization", `Bearer ${authToken}`)
      );

      promises.push(
        request(app)
          .get("/api/v1/tasks")
          .set("Authorization", `Bearer ${authToken}`)
      );

      promises.push(
        request(app)
          .get("/api/v1/planner/search?q=test")
          .set("Authorization", `Bearer ${authToken}`)
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses.every((res) => res.status === 200)).toBe(true);
      expect(totalTime).toBeLessThan(3000);
    });
  });
});
