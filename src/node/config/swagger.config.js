import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8")
);

// OpenAPI 3.0 configuration
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Confetti Event Planning Platform API",
    version: packageJson.version || "1.0.0",
    description:
      "Comprehensive API documentation for the AI-powered event planning platform. This API provides endpoints for user authentication, event management, vendor discovery, payment processing, notifications, analytics, and AI-powered event planning assistance.\n\n" +
      "## Authentication\n\n" +
      "Most endpoints require authentication using JWT Bearer tokens. To authenticate:\n\n" +
      "1. Register a new account using `POST /auth/register` or sign in with `POST /auth/signin`\n" +
      "2. Copy the JWT token from the response\n" +
      "3. Click the **Authorize** button (🔒) at the top of this page\n" +
      "4. Enter your token in the format: `Bearer <your-token-here>`\n" +
      "5. Click **Authorize** and then **Close**\n\n" +
      "The token will be automatically included in all subsequent requests to protected endpoints. Protected endpoints are marked with a lock icon (🔒).",
    contact: {
      name: "API Support",
      email: "support@confetti.com",
    },
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
  },
  servers: [
    {
      url: "http://localhost:5000/api/v1",
      description: "Development server",
    },
    {
      url: process.env.API_URL || "https://api.confetti.com/api/v1",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Enter JWT token obtained from /auth/signin or /auth/register endpoints. Format: Bearer <token>",
      },
    },
    schemas: {
      // Standard response schemas
      Error: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: false,
          },
          status: {
            type: "string",
            example: "fail",
          },
          message: {
            type: "string",
            example: "An error occurred",
          },
          statusCode: {
            type: "number",
            example: 400,
          },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            example: true,
          },
          data: {
            type: "object",
            description: "Response data",
          },
        },
      },

      // User schema
      User: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439011",
            description: "Unique user identifier",
          },
          username: {
            type: "string",
            example: "johndoe",
            description: "Unique username",
          },
          email: {
            type: "string",
            format: "email",
            example: "john.doe@example.com",
            description: "User email address",
          },
          firstName: {
            type: "string",
            example: "John",
            description: "User first name",
          },
          lastName: {
            type: "string",
            example: "Doe",
            description: "User last name",
          },
          role: {
            type: "string",
            enum: ["admin", "event-planner", "vendor"],
            example: "event-planner",
            description: "User role in the system",
          },
          phone: {
            type: "string",
            example: "+1234567890",
            description: "User phone number",
          },
          address: {
            type: "object",
            properties: {
              street: { type: "string", example: "123 Main St" },
              city: { type: "string", example: "New York" },
              state: { type: "string", example: "NY" },
              country: { type: "string", example: "USA" },
              zipCode: { type: "string", example: "10001" },
            },
          },
          preferences: {
            type: "object",
            properties: {
              notifications: {
                type: "object",
                properties: {
                  email: { type: "boolean", example: true },
                  push: { type: "boolean", example: true },
                  sms: { type: "boolean", example: false },
                },
              },
              theme: {
                type: "string",
                enum: ["light", "dark"],
                example: "light",
              },
              language: {
                type: "string",
                example: "en",
              },
            },
          },
          isEmailVerified: {
            type: "boolean",
            example: false,
            description: "Email verification status",
          },
          profilePicture: {
            type: "string",
            example: "https://example.com/profile.jpg",
            description: "URL to user profile picture",
          },
          isActive: {
            type: "boolean",
            example: true,
            description: "Account active status",
          },
          lastLogin: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
            description: "Last login timestamp",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00Z",
            description: "Account creation timestamp",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
            description: "Last update timestamp",
          },
        },
      },

      // Event schema
      Event: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439012",
            description: "Unique event identifier",
          },
          title: {
            type: "string",
            example: "Annual Tech Conference 2024",
            description: "Event title",
          },
          description: {
            type: "string",
            example:
              "A comprehensive technology conference featuring industry leaders",
            description: "Detailed event description",
          },
          eventType: {
            type: "string",
            enum: ["wedding", "birthday", "corporate", "social", "other"],
            example: "corporate",
            description: "Type of event",
          },
          startDate: {
            type: "string",
            format: "date-time",
            example: "2024-06-15T09:00:00Z",
            description: "Event start date and time",
          },
          endDate: {
            type: "string",
            format: "date-time",
            example: "2024-06-15T18:00:00Z",
            description: "Event end date and time",
          },
          location: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["Point"],
                example: "Point",
              },
              coordinates: {
                type: "array",
                items: { type: "number" },
                example: [-73.935242, 40.73061],
                description: "Longitude and latitude coordinates",
              },
              address: {
                type: "object",
                properties: {
                  street: { type: "string", example: "123 Event Plaza" },
                  city: { type: "string", example: "New York" },
                  state: { type: "string", example: "NY" },
                  country: { type: "string", example: "USA" },
                  zipCode: { type: "string", example: "10001" },
                },
              },
            },
          },
          budget: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                example: 50000,
                description: "Budget amount",
              },
              currency: {
                type: "string",
                enum: ["NGN", "USD", "EUR", "GBP"],
                example: "USD",
                description: "Currency code",
              },
            },
          },
          guestCount: {
            type: "number",
            example: 200,
            description: "Expected number of guests",
          },
          status: {
            type: "string",
            enum: ["draft", "published", "cancelled", "completed"],
            example: "published",
            description: "Event status",
          },
          organizer: {
            $ref: "#/components/schemas/User",
            description: "Event organizer user object",
          },
          vendors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                vendor: {
                  $ref: "#/components/schemas/Vendor",
                },
                role: {
                  type: "string",
                  example: "catering",
                  description: "Vendor role in the event",
                },
                status: {
                  type: "string",
                  enum: ["pending", "accepted", "rejected", "completed"],
                  example: "accepted",
                },
                contract: {
                  type: "object",
                  properties: {
                    amount: { type: "number", example: 5000 },
                    currency: {
                      type: "string",
                      enum: ["NGN", "USD", "EUR", "GBP"],
                      example: "USD",
                    },
                    status: {
                      type: "string",
                      enum: ["pending", "paid", "refunded"],
                      example: "paid",
                    },
                  },
                },
              },
            },
          },
          guests: {
            type: "array",
            items: {
              type: "object",
              properties: {
                user: {
                  $ref: "#/components/schemas/User",
                },
                status: {
                  type: "string",
                  enum: ["invited", "confirmed", "declined"],
                  example: "confirmed",
                },
                plusOne: {
                  type: "boolean",
                  example: false,
                },
              },
            },
          },
          category: {
            type: "string",
            example: "conference",
            description: "Event category",
          },
          capacity: {
            type: "number",
            example: 250,
            description: "Maximum event capacity",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            example: ["technology", "networking", "professional"],
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
        },
      },

      // Vendor schema
      Vendor: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439013",
            description: "Unique vendor identifier",
          },
          name: {
            type: "string",
            example: "Elite Catering Services",
            description: "Vendor business name",
          },
          email: {
            type: "string",
            format: "email",
            example: "contact@elitecatering.com",
            description: "Vendor contact email",
          },
          phone: {
            type: "string",
            example: "+1234567890",
            description: "Vendor contact phone",
          },
          businessType: {
            type: "string",
            enum: [
              "catering",
              "venue",
              "decoration",
              "photography",
              "music",
              "other",
            ],
            example: "catering",
            description: "Type of business",
          },
          category: {
            type: "string",
            enum: [
              "venue",
              "catering",
              "entertainment",
              "photography",
              "videography",
              "decoration",
              "florals",
              "transportation",
              "audio_visual",
              "event_planning",
              "security",
              "valet_parking",
              "rentals",
              "cake_desserts",
              "bar_services",
              "lighting",
              "invitations",
              "favors_gifts",
              "other",
            ],
            example: "catering",
            description: "Vendor category",
          },
          description: {
            type: "string",
            example: "Premium catering services for all types of events",
            description: "Vendor description",
          },
          rating: {
            type: "number",
            minimum: 0,
            maximum: 5,
            example: 4.5,
            description: "Average vendor rating",
          },
          reviewCount: {
            type: "number",
            example: 127,
            description: "Total number of reviews",
          },
          priceRange: {
            type: "object",
            properties: {
              min: {
                type: "number",
                example: 1000,
                description: "Minimum price",
              },
              max: {
                type: "number",
                example: 10000,
                description: "Maximum price",
              },
            },
          },
          location: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["Point"],
                example: "Point",
              },
              coordinates: {
                type: "array",
                items: { type: "number" },
                example: [-73.935242, 40.73061],
              },
            },
          },
          address: {
            type: "object",
            properties: {
              street: { type: "string", example: "456 Business Ave" },
              city: { type: "string", example: "New York" },
              state: { type: "string", example: "NY" },
              country: { type: "string", example: "USA" },
              zipCode: { type: "string", example: "10002" },
            },
          },
          status: {
            type: "string",
            enum: ["pending", "approved", "suspended", "rejected"],
            example: "approved",
            description: "Vendor approval status",
          },
          isVerified: {
            type: "boolean",
            example: true,
            description: "Vendor verification status",
          },
          services: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", example: "Full Course Meal" },
                description: {
                  type: "string",
                  example: "Complete meal service for events",
                },
                price: {
                  type: "object",
                  properties: {
                    amount: { type: "number", example: 50 },
                    currency: { type: "string", example: "USD" },
                  },
                },
              },
            },
          },
          images: {
            type: "array",
            items: { type: "string" },
            example: [
              "https://example.com/image1.jpg",
              "https://example.com/image2.jpg",
            ],
          },
          features: {
            type: "array",
            items: { type: "string" },
            example: [
              "Organic ingredients",
              "Custom menus",
              "Dietary accommodations",
            ],
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
        },
      },

      // Payment schema
      Payment: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439014",
            description: "Unique payment identifier",
          },
          user: {
            $ref: "#/components/schemas/User",
            description: "User who made the payment",
          },
          event: {
            $ref: "#/components/schemas/Event",
            description: "Event associated with the payment",
          },
          amount: {
            type: "number",
            example: 5000,
            description: "Payment amount",
          },
          currency: {
            type: "string",
            example: "USD",
            description: "Currency code",
          },
          status: {
            type: "string",
            enum: ["pending", "completed", "failed", "refunded"],
            example: "completed",
            description: "Payment status",
          },
          paymentMethod: {
            type: "string",
            enum: ["credit_card", "paypal", "stripe"],
            example: "credit_card",
            description: "Payment method used",
          },
          transactionId: {
            type: "string",
            example: "txn_1234567890abcdef",
            description: "Unique transaction identifier",
          },
          paymentDetails: {
            type: "object",
            properties: {
              cardLast4: {
                type: "string",
                example: "4242",
                description: "Last 4 digits of card",
              },
              cardBrand: {
                type: "string",
                example: "Visa",
                description: "Card brand",
              },
              paymentIntentId: {
                type: "string",
                example: "pi_1234567890",
                description: "Payment intent ID",
              },
              chargeId: {
                type: "string",
                example: "ch_1234567890",
                description: "Charge ID",
              },
            },
          },
          refundDetails: {
            type: "object",
            properties: {
              refundId: {
                type: "string",
                example: "re_1234567890",
                description: "Refund ID",
              },
              refundAmount: {
                type: "number",
                example: 5000,
                description: "Refunded amount",
              },
              refundReason: {
                type: "string",
                example: "Event cancelled",
                description: "Reason for refund",
              },
              refundedAt: {
                type: "string",
                format: "date-time",
                example: "2024-01-20T10:30:00Z",
                description: "Refund timestamp",
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
        },
      },

      // Notification schema
      Notification: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439015",
            description: "Unique notification identifier",
          },
          recipient: {
            $ref: "#/components/schemas/User",
            description: "Notification recipient",
          },
          type: {
            type: "string",
            enum: [
              "event_update",
              "vendor_message",
              "payment_status",
              "system_update",
              "booking_status",
              "review",
              "reminder",
              "other",
            ],
            example: "event_update",
            description: "Type of notification",
          },
          title: {
            type: "string",
            example: "Event Update",
            description: "Notification title",
          },
          message: {
            type: "string",
            example: "Your event has been confirmed by the vendor",
            description: "Notification message content",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            example: "medium",
            description: "Notification priority level",
          },
          data: {
            type: "object",
            properties: {
              event: {
                type: "string",
                example: "507f1f77bcf86cd799439012",
                description: "Related event ID",
              },
              vendor: {
                type: "string",
                example: "507f1f77bcf86cd799439013",
                description: "Related vendor ID",
              },
              payment: {
                type: "string",
                example: "507f1f77bcf86cd799439014",
                description: "Related payment ID",
              },
              metadata: {
                type: "object",
                description: "Additional notification data",
              },
            },
          },
          status: {
            type: "string",
            enum: ["pending", "sent", "delivered", "read", "failed"],
            example: "delivered",
            description: "Notification delivery status",
          },
          channels: {
            type: "object",
            properties: {
              email: {
                type: "object",
                properties: {
                  sent: { type: "boolean", example: true },
                  delivered: { type: "boolean", example: true },
                  failed: { type: "boolean", example: false },
                  error: { type: "string" },
                },
              },
              push: {
                type: "object",
                properties: {
                  sent: { type: "boolean", example: true },
                  delivered: { type: "boolean", example: true },
                  failed: { type: "boolean", example: false },
                  error: { type: "string" },
                },
              },
              sms: {
                type: "object",
                properties: {
                  sent: { type: "boolean", example: false },
                  delivered: { type: "boolean", example: false },
                  failed: { type: "boolean", example: false },
                  error: { type: "string" },
                },
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
        },
      },

      // Subscription schema
      Subscription: {
        type: "object",
        properties: {
          _id: {
            type: "string",
            example: "507f1f77bcf86cd799439016",
            description: "Unique subscription identifier",
          },
          user: {
            $ref: "#/components/schemas/User",
            description: "Subscribed user",
          },
          planType: {
            type: "string",
            enum: ["vendor", "planner"],
            example: "planner",
            description: "Type of subscription plan",
          },
          planName: {
            type: "string",
            example: "Professional",
            description: "Name of the subscription plan",
          },
          status: {
            type: "string",
            enum: ["active", "trial", "cancelled", "expired"],
            example: "active",
            description: "Subscription status",
          },
          startDate: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00Z",
            description: "Subscription start date",
          },
          endDate: {
            type: "string",
            format: "date-time",
            example: "2024-12-31T23:59:59Z",
            description: "Subscription end date",
          },
          trialEndDate: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T23:59:59Z",
            description: "Trial period end date",
          },
          paymentProvider: {
            type: "string",
            enum: ["flutterwave", "paystack"],
            example: "flutterwave",
            description: "Payment provider used",
          },
          paymentId: {
            type: "string",
            example: "pay_1234567890",
            description: "Payment provider transaction ID",
          },
          amount: {
            type: "number",
            example: 29.99,
            description: "Subscription amount",
          },
          currency: {
            type: "string",
            example: "NGN",
            description: "Currency code",
          },
          billingCycle: {
            type: "string",
            enum: ["monthly", "yearly"],
            example: "monthly",
            description: "Billing cycle frequency",
          },
          autoRenew: {
            type: "boolean",
            example: true,
            description: "Auto-renewal status",
          },
          usage: {
            type: "object",
            properties: {
              eventsCreated: {
                type: "number",
                example: 3,
                description: "Number of events created in current period",
              },
              photosUploaded: {
                type: "number",
                example: 25,
                description: "Number of photos uploaded in current period",
              },
              lastResetDate: {
                type: "string",
                format: "date-time",
                example: "2024-01-01T00:00:00Z",
                description: "Last usage reset date",
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-01T00:00:00Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            example: "2024-01-15T10:30:00Z",
          },
        },
      },
    },
  },
  tags: [
    {
      name: "Authentication",
      description:
        "User authentication and authorization endpoints including registration, login, password reset, email verification, and OAuth integration",
    },
    {
      name: "Users",
      description:
        "User management operations including profile retrieval, updates, and user administration",
    },
    {
      name: "Events",
      description:
        "Event creation and management endpoints for planning, organizing, and tracking events including budgets, schedules, guests, and vendors",
    },
    {
      name: "Vendors",
      description:
        "Vendor directory and management operations including search, filtering, and vendor profile management",
    },
    {
      name: "Payments",
      description:
        "Payment processing endpoints for handling transactions, payment verification, and payment history",
    },
    {
      name: "Notifications",
      description:
        "Notification management for user alerts, messages, and system notifications",
    },
    {
      name: "Analytics",
      description:
        "Analytics and reporting endpoints providing insights into events, vendors, revenue, and platform usage",
    },
    {
      name: "Subscriptions",
      description:
        "Subscription management for premium plans, billing, and subscription lifecycle operations",
    },
    {
      name: "Admin",
      description:
        "Administrative operations for platform management, user administration, and system configuration",
    },
    {
      name: "Health",
      description:
        "System health checks and service status monitoring endpoints",
    },
    {
      name: "AI Planner",
      description:
        "AI-powered event planning endpoints providing intelligent recommendations, vendor matching, and automated event planning assistance",
    },
  ],
};

// Swagger JSDoc options
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    join(__dirname, "../routes/*.js"),
    join(__dirname, "../controllers/*.js"),
  ],
};

// Generate OpenAPI specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Setup Swagger documentation middleware
 * @param {Express.Application} app - Express application instance
 */
export const setupSwagger = (app) => {
  // Swagger UI options
  const swaggerUiOptions = {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Confetti API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  };

  // Serve Swagger documentation with caching
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Serve OpenAPI spec as JSON with caching headers
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    // Cache for 1 hour in production, no cache in development
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Cache-Control", "public, max-age=3600");
    } else {
      res.setHeader("Cache-Control", "no-cache");
    }
    res.send(swaggerSpec);
  });

  console.log("📚 Swagger documentation available at /api-docs");
};

export default swaggerSpec;
