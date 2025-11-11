import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";

/**
 * Service for generating event planning timelines
 */
class TimelineService {
  /**
   * Generate timeline for event planning
   * @param {Date} eventDate - Date of the event
   * @param {string} eventType - Type of event
   * @param {Array} budgetAllocations - Budget allocations from AI
   * @returns {Promise<Object>} Generated timeline
   */
  async generateTimeline(eventDate, eventType, budgetAllocations = []) {
    try {
      const startTime = Date.now();

      // Calculate days until event
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eventDateTime = new Date(eventDate);
      eventDateTime.setHours(0, 0, 0, 0);

      if (eventDateTime <= today) {
        throw new AppError("Event date must be in the future", 400);
      }

      const daysUntilEvent = Math.ceil(
        (eventDateTime - today) / (1000 * 60 * 60 * 24)
      );

      // Generate planning milestones
      const planningMilestones = this.generatePlanningMilestones(
        eventDateTime,
        eventType,
        daysUntilEvent
      );

      // Generate event day schedule
      const eventDayHighlights = this.generateEventDaySchedule(eventType);

      const timeline = {
        planningMilestones,
        eventDayHighlights,
        detailedTimelineLocked: true,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          daysUntilEvent,
        },
      };

      logger.info("Timeline generated successfully", {
        eventType,
        eventDate: eventDateTime.toISOString(),
        daysUntilEvent,
        milestoneCount: planningMilestones.length,
      });

      return timeline;
    } catch (error) {
      logger.error("Error generating timeline:", {
        eventDate,
        eventType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate planning milestones
   * @param {Date} eventDate - Event date
   * @param {string} eventType - Event type
   * @param {number} daysUntilEvent - Days until event
   * @returns {Array} Planning milestones
   */
  generatePlanningMilestones(eventDate, eventType, daysUntilEvent) {
    const milestones = [];
    const today = new Date();

    // Determine planning phases based on time available
    if (daysUntilEvent >= 180) {
      // 6+ months: Full planning timeline
      milestones.push({
        title: "Initial Planning",
        timeframe: "6-5 months before",
        description:
          "Set budget, create guest list, book venue, and establish event vision",
        status: "active",
      });
      milestones.push({
        title: "Vendor Booking",
        timeframe: "5-4 months before",
        description:
          "Book caterer, photographer, entertainment, and other key vendors",
        status: "upcoming",
      });
      milestones.push({
        title: "Detail Planning",
        timeframe: "4-2 months before",
        description:
          "Finalize menu, decorations, timeline, and send invitations",
        status: "upcoming",
      });
    } else if (daysUntilEvent >= 90) {
      // 3-6 months: Standard timeline
      milestones.push({
        title: "Immediate Planning",
        timeframe: "Now - 2 months before",
        description:
          "Book venue and essential vendors immediately, finalize guest list",
        status: "active",
      });
      milestones.push({
        title: "Detail Planning",
        timeframe: "2-1 months before",
        description: "Finalize all details, send invitations, confirm vendors",
        status: "upcoming",
      });
    } else if (daysUntilEvent >= 30) {
      // 1-3 months: Accelerated timeline
      milestones.push({
        title: "Urgent Planning",
        timeframe: "Immediately",
        description:
          "Book all vendors NOW - venue, catering, and essentials are priority",
        status: "active",
      });
      milestones.push({
        title: "Final Preparations",
        timeframe: "Next 2-4 weeks",
        description:
          "Finalize all details, confirm headcount, coordinate with vendors",
        status: "upcoming",
      });
    } else {
      // Less than 1 month: Critical timeline
      milestones.push({
        title: "Critical Planning",
        timeframe: "This week",
        description:
          "URGENT: Book available vendors immediately, finalize all arrangements",
        status: "active",
      });
    }

    // Always add final preparations and event day
    milestones.push({
      title: "Final Preparations",
      timeframe: "1 week before",
      description:
        "Final vendor confirmations, finalize guest count, prepare day-of timeline",
      status: daysUntilEvent <= 7 ? "active" : "upcoming",
    });

    milestones.push({
      title: "Event Day",
      timeframe: "Event day",
      description:
        "Execute your perfect event! Coordinate with vendors and enjoy.",
      status: "upcoming",
    });

    return milestones;
  }

  /**
   * Generate event day schedule
   * @param {string} eventType - Event type
   * @returns {Array} Event day schedule
   */
  generateEventDaySchedule(eventType) {
    const schedules = {
      wedding: [
        { time: "08:00 AM", activity: "Vendor setup begins" },
        { time: "10:00 AM", activity: "Bridal party preparation" },
        { time: "02:00 PM", activity: "Guest arrival and seating" },
        { time: "02:30 PM", activity: "Ceremony begins" },
        { time: "03:30 PM", activity: "Cocktail hour and photos" },
        { time: "05:00 PM", activity: "Reception and dinner" },
        { time: "07:00 PM", activity: "Dancing and entertainment" },
        { time: "10:00 PM", activity: "Event concludes" },
      ],
      corporate: [
        { time: "07:00 AM", activity: "Setup and AV check" },
        { time: "08:30 AM", activity: "Registration opens" },
        { time: "09:00 AM", activity: "Opening session" },
        { time: "10:30 AM", activity: "Coffee break" },
        { time: "11:00 AM", activity: "Main presentations" },
        { time: "01:00 PM", activity: "Lunch break" },
        { time: "02:00 PM", activity: "Afternoon sessions" },
        { time: "05:00 PM", activity: "Networking reception" },
        { time: "07:00 PM", activity: "Event concludes" },
      ],
      birthday: [
        { time: "02:00 PM", activity: "Setup and decoration" },
        { time: "04:00 PM", activity: "Guest arrival" },
        { time: "04:30 PM", activity: "Activities and games" },
        { time: "06:00 PM", activity: "Dinner service" },
        { time: "07:00 PM", activity: "Cake cutting ceremony" },
        { time: "07:30 PM", activity: "Entertainment and dancing" },
        { time: "09:00 PM", activity: "Party concludes" },
      ],
      graduation: [
        { time: "03:00 PM", activity: "Setup and preparation" },
        { time: "05:00 PM", activity: "Guest arrival" },
        { time: "05:30 PM", activity: "Welcome and speeches" },
        { time: "06:00 PM", activity: "Dinner service" },
        { time: "07:30 PM", activity: "Photo session" },
        { time: "08:00 PM", activity: "Entertainment" },
        { time: "09:30 PM", activity: "Celebration concludes" },
      ],
      conference: [
        { time: "07:00 AM", activity: "Setup and preparation" },
        { time: "08:00 AM", activity: "Registration and breakfast" },
        { time: "09:00 AM", activity: "Opening keynote" },
        { time: "10:30 AM", activity: "Break and networking" },
        { time: "11:00 AM", activity: "Breakout sessions" },
        { time: "12:30 PM", activity: "Lunch" },
        { time: "02:00 PM", activity: "Afternoon sessions" },
        { time: "04:00 PM", activity: "Closing remarks" },
        { time: "05:00 PM", activity: "Networking reception" },
        { time: "07:00 PM", activity: "Conference concludes" },
      ],
    };

    return schedules[eventType] || schedules.birthday;
  }
}

export default new TimelineService();
