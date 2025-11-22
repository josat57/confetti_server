import Webhook from "../models/webhook.model.js";
import WebhookLog from "../models/webhook-log.model.js";
import webhookService from "../services/webhook.service.js";

/**
 * Get all webhooks for current user
 */
export const getWebhooks = async (req, res) => {
  try {
    const userId = req.user._id;

    const webhooks = await Webhook.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: {
        webhooks,
        total: webhooks.length,
      },
    });
  } catch (error) {
    console.error("Get webhooks error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get webhooks",
      error: error.message,
    });
  }
};

/**
 * Get single webhook
 */
export const getWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const webhook = await Webhook.findOne({ _id: id, user: userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        webhook,
      },
    });
  } catch (error) {
    console.error("Get webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get webhook",
      error: error.message,
    });
  }
};

/**
 * Create new webhook
 */
export const createWebhook = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, url, events } = req.body;

    // Validate required fields
    if (!name || !url || !events || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name, URL, and at least one event are required",
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL format",
      });
    }

    // Create webhook
    const webhook = await Webhook.create({
      user: userId,
      name,
      url,
      events,
    });

    res.status(201).json({
      success: true,
      message: "Webhook created successfully",
      data: {
        webhook,
      },
    });
  } catch (error) {
    console.error("Create webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create webhook",
      error: error.message,
    });
  }
};

/**
 * Update webhook
 */
export const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { name, url, events, active } = req.body;

    const webhook = await Webhook.findOne({ _id: id, user: userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    // Update fields
    if (name) webhook.name = name;
    if (url) {
      try {
        new URL(url);
        webhook.url = url;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid URL format",
        });
      }
    }
    if (events) webhook.events = events;
    if (typeof active === "boolean") webhook.active = active;

    await webhook.save();

    res.status(200).json({
      success: true,
      message: "Webhook updated successfully",
      data: {
        webhook,
      },
    });
  } catch (error) {
    console.error("Update webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update webhook",
      error: error.message,
    });
  }
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const webhook = await Webhook.findOneAndDelete({ _id: id, user: userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Webhook deleted successfully",
    });
  } catch (error) {
    console.error("Delete webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete webhook",
      error: error.message,
    });
  }
};

/**
 * Test webhook
 */
export const testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const webhook = await Webhook.findOne({ _id: id, user: userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    const result = await webhookService.testWebhook(
      webhook.url,
      webhook.secret
    );

    res.status(200).json({
      success: true,
      message: result.success
        ? "Webhook test successful"
        : "Webhook test failed",
      data: result,
    });
  } catch (error) {
    console.error("Test webhook error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test webhook",
      error: error.message,
    });
  }
};

/**
 * Get webhook logs
 */
export const getWebhookLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 20, success } = req.query;

    // Verify webhook ownership
    const webhook = await Webhook.findOne({ _id: id, user: userId });

    if (!webhook) {
      return res.status(404).json({
        success: false,
        message: "Webhook not found",
      });
    }

    const query = { webhook: id };
    if (success !== undefined) {
      query.success = success === "true";
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await WebhookLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await WebhookLog.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get webhook logs error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get webhook logs",
      error: error.message,
    });
  }
};

/**
 * Get available webhook events
 */
export const getWebhookEvents = async (req, res) => {
  try {
    const events = [
      {
        name: "event.created",
        description: "Triggered when a new event is created",
        category: "Events",
      },
      {
        name: "event.updated",
        description: "Triggered when an event is updated",
        category: "Events",
      },
      {
        name: "event.deleted",
        description: "Triggered when an event is deleted",
        category: "Events",
      },
      {
        name: "client.created",
        description: "Triggered when a new client is created",
        category: "Clients",
      },
      {
        name: "client.updated",
        description: "Triggered when a client is updated",
        category: "Clients",
      },
      {
        name: "client.deleted",
        description: "Triggered when a client is deleted",
        category: "Clients",
      },
      {
        name: "task.created",
        description: "Triggered when a new task is created",
        category: "Tasks",
      },
      {
        name: "task.updated",
        description: "Triggered when a task is updated",
        category: "Tasks",
      },
      {
        name: "task.completed",
        description: "Triggered when a task is marked as completed",
        category: "Tasks",
      },
      {
        name: "task.deleted",
        description: "Triggered when a task is deleted",
        category: "Tasks",
      },
      {
        name: "guest.created",
        description: "Triggered when a new guest is added",
        category: "Guests",
      },
      {
        name: "guest.updated",
        description: "Triggered when a guest is updated",
        category: "Guests",
      },
      {
        name: "guest.rsvp",
        description: "Triggered when a guest RSVPs",
        category: "Guests",
      },
      {
        name: "guest.deleted",
        description: "Triggered when a guest is deleted",
        category: "Guests",
      },
      {
        name: "booking.created",
        description: "Triggered when a vendor booking is created",
        category: "Bookings",
      },
      {
        name: "booking.confirmed",
        description: "Triggered when a vendor booking is confirmed",
        category: "Bookings",
      },
      {
        name: "booking.cancelled",
        description: "Triggered when a vendor booking is cancelled",
        category: "Bookings",
      },
      {
        name: "payment.received",
        description: "Triggered when a payment is received",
        category: "Payments",
      },
      {
        name: "payment.failed",
        description: "Triggered when a payment fails",
        category: "Payments",
      },
    ];

    res.status(200).json({
      success: true,
      data: {
        events,
      },
    });
  } catch (error) {
    console.error("Get webhook events error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get webhook events",
      error: error.message,
    });
  }
};
