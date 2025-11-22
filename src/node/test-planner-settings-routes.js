/**
 * Test script to verify planner settings routes are properly registered
 * Run with: node test-planner-settings-routes.js
 */

import express from "express";
import routes from "./routes/index.js";

const app = express();

// Mount routes
app.use("/api/v1", routes);

// Get all registered routes
function getRoutes(app) {
  const routes = [];

  function extractRoutes(stack, prefix = "") {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Route middleware
        const methods = Object.keys(middleware.route.methods)
          .filter((method) => middleware.route.methods[method])
          .map((method) => method.toUpperCase());

        routes.push({
          path: prefix + middleware.route.path,
          methods: methods,
        });
      } else if (middleware.name === "router" && middleware.handle.stack) {
        // Router middleware
        const path = middleware.regexp
          .toString()
          .replace("/^", "")
          .replace("\\/?(?=\\/|$)/i", "")
          .replace(/\\\//g, "/")
          .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ":param");

        extractRoutes(middleware.handle.stack, prefix + path);
      }
    });
  }

  extractRoutes(app._router.stack);
  return routes;
}

const allRoutes = getRoutes(app);

// Filter planner settings routes
const plannerSettingsRoutes = allRoutes.filter((route) =>
  route.path.includes("/planner/settings")
);

console.log("\n=== Planner Settings Routes ===\n");

if (plannerSettingsRoutes.length === 0) {
  console.log("❌ No planner settings routes found!");
} else {
  console.log(
    `✓ Found ${plannerSettingsRoutes.length} planner settings routes:\n`
  );

  plannerSettingsRoutes.forEach((route) => {
    console.log(`  ${route.methods.join(", ")} ${route.path}`);
  });

  console.log("\n=== Expected Routes ===\n");
  const expectedRoutes = [
    "GET /api/v1/planner/settings/profile",
    "PUT /api/v1/planner/settings/profile",
    "GET /api/v1/planner/settings/preferences",
    "PUT /api/v1/planner/settings/preferences",
    "GET /api/v1/planner/settings/subscription",
    "GET /api/v1/planner/settings/export-data",
    "DELETE /api/v1/planner/settings/account",
  ];

  expectedRoutes.forEach((expected) => {
    const found = plannerSettingsRoutes.some((route) => {
      const routeStr = `${route.methods[0]} ${route.path}`;
      return routeStr === expected;
    });

    console.log(`  ${found ? "✓" : "❌"} ${expected}`);
  });
}

console.log("\n");
