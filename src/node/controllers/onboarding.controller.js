import Onboarding from "../models/onboarding.model.js";
import User from "../models/user.model.js";
import Event from "../models/event.model.js";
import Client from "../models/client.model.js";
import Task from "../models/task.model.js";
import Guest from "../models/guest.model.js";

/**
 * Get onboarding status for current user
 */
export const getOnboardingStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    let onboarding = await Onboarding.findOne({ user: userId });

    // Create onboarding record if it doesn't exist
    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    const progress = onboarding.getProgress();

    res.status(200).json({
      success: true,
      data: {
        onboarding: {
          ...onboarding.toObject(),
          progress,
        },
      },
    });
  } catch (error) {
    console.error("Get onboarding status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get onboarding status",
      error: error.message,
    });
  }
};

/**
 * Update tour step completion
 */
export const updateTourStep = async (req, res) => {
  try {
    const userId = req.user._id;
    const { step } = req.body;

    if (!step) {
      return res.status(400).json({
        success: false,
        message: "Step is required",
      });
    }

    let onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    await onboarding.markTourStepComplete(step);

    const progress = onboarding.getProgress();

    res.status(200).json({
      success: true,
      message: "Tour step updated successfully",
      data: {
        onboarding: {
          ...onboarding.toObject(),
          progress,
        },
      },
    });
  } catch (error) {
    console.error("Update tour step error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tour step",
      error: error.message,
    });
  }
};

/**
 * Skip tour
 */
export const skipTour = async (req, res) => {
  try {
    const userId = req.user._id;

    let onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    await onboarding.skipTour();

    res.status(200).json({
      success: true,
      message: "Tour skipped successfully",
      data: {
        onboarding: onboarding.toObject(),
      },
    });
  } catch (error) {
    console.error("Skip tour error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to skip tour",
      error: error.message,
    });
  }
};

/**
 * Reset tour
 */
export const resetTour = async (req, res) => {
  try {
    const userId = req.user._id;

    const onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      return res.status(404).json({
        success: false,
        message: "Onboarding record not found",
      });
    }

    await onboarding.resetTour();

    res.status(200).json({
      success: true,
      message: "Tour reset successfully",
      data: {
        onboarding: onboarding.toObject(),
      },
    });
  } catch (error) {
    console.error("Reset tour error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset tour",
      error: error.message,
    });
  }
};

/**
 * Update tutorial step completion
 */
export const updateTutorialStep = async (req, res) => {
  try {
    const userId = req.user._id;
    const { step } = req.body;

    if (!step) {
      return res.status(400).json({
        success: false,
        message: "Step is required",
      });
    }

    let onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    await onboarding.markTutorialStepComplete(step);

    const progress = onboarding.getProgress();

    res.status(200).json({
      success: true,
      message: "Tutorial step updated successfully",
      data: {
        onboarding: {
          ...onboarding.toObject(),
          progress,
        },
      },
    });
  } catch (error) {
    console.error("Update tutorial step error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update tutorial step",
      error: error.message,
    });
  }
};

/**
 * Load sample data for new users
 */
export const loadSampleData = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = req.user;

    // Check if sample data already loaded
    let onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    if (onboarding.sampleDataLoaded) {
      return res.status(400).json({
        success: false,
        message: "Sample data already loaded",
      });
    }

    // Check if user already has data
    const existingEvents = await Event.countDocuments({ planner: userId });
    const existingClients = await Client.countDocuments({ planner: userId });

    if (existingEvents > 0 || existingClients > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot load sample data when you already have events or clients",
      });
    }

    // Create sample clients
    const sampleClients = await Client.insertMany([
      {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@example.com",
        phone: "+1-555-0101",
        company: "Johnson Enterprises",
        planner: userId,
        notes: "Sample client - Planning a corporate event",
      },
      {
        firstName: "Michael",
        lastName: "Chen",
        email: "michael.chen@example.com",
        phone: "+1-555-0102",
        planner: userId,
        notes: "Sample client - Wedding planning",
      },
      {
        firstName: "Emily",
        lastName: "Rodriguez",
        email: "emily.rodriguez@example.com",
        phone: "+1-555-0103",
        planner: userId,
        notes: "Sample client - Birthday party",
      },
    ]);

    // Create sample events
    const sampleEvents = await Event.insertMany([
      {
        title: "Annual Company Gala",
        description: "Corporate annual gala event with 200 guests",
        eventType: "Corporate",
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        endDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        location: "Grand Ballroom, Downtown Convention Center",
        planner: userId,
        client: sampleClients[0]._id,
        status: "planning",
        guestCount: 200,
        budget: {
          total: 50000,
          allocated: 35000,
          spent: 15000,
        },
      },
      {
        title: "Sarah & Michael Wedding",
        description: "Beautiful outdoor wedding ceremony and reception",
        eventType: "Wedding",
        startDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        location: "Sunset Gardens, Napa Valley",
        planner: userId,
        client: sampleClients[1]._id,
        status: "planning",
        guestCount: 150,
        budget: {
          total: 75000,
          allocated: 60000,
          spent: 25000,
        },
      },
      {
        title: "Emily's 30th Birthday Bash",
        description: "Fun birthday celebration with friends and family",
        eventType: "Birthday",
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        location: "Rooftop Lounge, City Center",
        planner: userId,
        client: sampleClients[2]._id,
        status: "confirmed",
        guestCount: 50,
        budget: {
          total: 10000,
          allocated: 8000,
          spent: 3000,
        },
      },
    ]);

    // Create sample tasks
    const sampleTasks = [];
    for (const event of sampleEvents) {
      sampleTasks.push(
        {
          title: "Book venue",
          description: "Confirm venue booking and deposit",
          planner: userId,
          event: event._id,
          dueDate: new Date(
            event.startDate.getTime() - 45 * 24 * 60 * 60 * 1000
          ),
          priority: "high",
          status: "completed",
        },
        {
          title: "Send invitations",
          description: "Design and send event invitations",
          planner: userId,
          event: event._id,
          dueDate: new Date(
            event.startDate.getTime() - 30 * 24 * 60 * 60 * 1000
          ),
          priority: "high",
          status: "in-progress",
        },
        {
          title: "Finalize menu",
          description: "Confirm catering menu and dietary requirements",
          planner: userId,
          event: event._id,
          dueDate: new Date(
            event.startDate.getTime() - 14 * 24 * 60 * 60 * 1000
          ),
          priority: "medium",
          status: "pending",
        }
      );
    }

    await Task.insertMany(sampleTasks);

    // Create sample guests for first event
    const sampleGuests = [
      {
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@example.com",
        event: sampleEvents[0]._id,
        planner: userId,
        category: "vip",
        rsvpStatus: "accepted",
      },
      {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane.doe@example.com",
        event: sampleEvents[0]._id,
        planner: userId,
        category: "general",
        rsvpStatus: "pending",
      },
      {
        firstName: "Robert",
        lastName: "Williams",
        email: "robert.williams@example.com",
        event: sampleEvents[0]._id,
        planner: userId,
        category: "general",
        rsvpStatus: "accepted",
      },
    ];

    await Guest.insertMany(sampleGuests);

    // Mark sample data as loaded
    onboarding.sampleDataLoaded = true;
    onboarding.sampleDataLoadedAt = new Date();
    await onboarding.save();

    res.status(201).json({
      success: true,
      message: "Sample data loaded successfully",
      data: {
        clients: sampleClients.length,
        events: sampleEvents.length,
        tasks: sampleTasks.length,
        guests: sampleGuests.length,
      },
    });
  } catch (error) {
    console.error("Load sample data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load sample data",
      error: error.message,
    });
  }
};

/**
 * Mark keyboard shortcuts as viewed
 */
export const markKeyboardShortcutsViewed = async (req, res) => {
  try {
    const userId = req.user._id;

    let onboarding = await Onboarding.findOne({ user: userId });

    if (!onboarding) {
      onboarding = await Onboarding.create({ user: userId });
    }

    onboarding.keyboardShortcutsViewed = true;
    await onboarding.save();

    res.status(200).json({
      success: true,
      message: "Keyboard shortcuts marked as viewed",
    });
  } catch (error) {
    console.error("Mark keyboard shortcuts viewed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark keyboard shortcuts as viewed",
      error: error.message,
    });
  }
};
