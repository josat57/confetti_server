import Guest from "../models/guest.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";

export const createGuest = async (req, res) => {
  try {
    const {
      event: eventId,
      name,
      email,
      phone,
      plusOne,
      plusOneName,
      category,
      dietaryRestrictions,
      specialRequirements,
    } = req.body;

    const event = await Event.findOne({
      _id: eventId,
      planner: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const user = await User.findById(req.user._id).populate("subscription");
    const subscription = user.subscription;

    if (subscription) {
      const guestCount = await Guest.countDocuments({ event: eventId });

      const tierLimits = {
        starter: 100,
        professional: Infinity,
        business: Infinity,
        enterprise: Infinity,
      };

      const limit = tierLimits[subscription.tier] || 100;

      if (guestCount >= limit) {
        return res.status(403).json({
          success: false,
          message: `Guest limit reached for ${subscription.tier} tier (${limit} guests per event)`,
          upgrade: subscription.tier === "starter",
        });
      }
    }

    const guest = await Guest.create({
      event: eventId,
      planner: req.user._id,
      name,
      email,
      phone,
      plusOne,
      plusOneName,
      category,
      dietaryRestrictions,
      specialRequirements,
    });

    res.status(201).json({
      success: true,
      message: "Guest added successfully",
      data: guest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating guest",
      error: error.message,
    });
  }
};

export const getGuests = async (req, res) => {
  try {
    const { event, category, rsvpStatus, search, page = 1, limit = 50 } = req.query;

    const query = { planner: req.user._id };

    if (event) query.event = event;
    if (category) query.category = category;
    if (rsvpStatus) query.rsvpStatus = rsvpStatus;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const guests = await Guest.find(query)
      .populate("event", "title startDate")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ name: 1 });

    const total = await Guest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: guests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching guests",
      error: error.message,
    });
  }
};

export const getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findOne({
      _id: req.params.id,
      planner: req.user._id,
    }).populate("event", "title startDate");

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found",
      });
    }

    res.status(200).json({
      success: true,
      data: guest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching guest",
      error: error.message,
    });
  }
};

export const updateGuest = async (req, res) => {
  try {
    const guest = await Guest.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found",
      });
    }

    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "plusOne",
      "plusOneName",
      "category",
      "dietaryRestrictions",
      "specialRequirements",
      "tableAssignment",
      "seatNumber",
      "notes",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        guest[field] = req.body[field];
      }
    });

    await guest.save();

    res.status(200).json({
      success: true,
      message: "Guest updated successfully",
      data: guest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating guest",
      error: error.message,
    });
  }
};

export const deleteGuest = async (req, res) => {
  try {
    const guest = await Guest.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found",
      });
    }

    await guest.deleteOne();

    res.status(200).json({
      success: true,
      message: "Guest deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting guest",
      error: error.message,
    });
  }
};

export const updateRSVP = async (req, res) => {
  try {
    const { status } = req.body;

    const guest = await Guest.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found",
      });
    }

    await guest.updateRSVP(status);

    res.status(200).json({
      success: true,
      message: "RSVP updated successfully",
      data: guest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating RSVP",
      error: error.message,
    });
  }
};

export const checkInGuest = async (req, res) => {
  try {
    const guest = await Guest.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: "Guest not found",
      });
    }

    await guest.checkIn(req.user._id);

    res.status(200).json({
      success: true,
      message: "Guest checked in successfully",
      data: guest,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error checking in guest",
      error: error.message,
    });
  }
};

export const getGuestStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({
      _id: eventId,
      planner: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const guests = await Guest.find({ event: eventId });

    const stats = {
      total: guests.length,
      totalWithPlusOnes: guests.reduce((sum, g) => sum + g.guestCount, 0),
      rsvp: {
        pending: guests.filter((g) => g.rsvpStatus === "pending").length,
        accepted: guests.filter((g) => g.rsvpStatus === "accepted").length,
        declined: guests.filter((g) => g.rsvpStatus === "declined").length,
        tentative: guests.filter((g) => g.rsvpStatus === "tentative").length,
      },
      checkedIn: guests.filter((g) => g.attended).length,
      byCategory: {},
    };

    guests.forEach((guest) => {
      if (guest.category) {
        if (!stats.byCategory[guest.category]) {
          stats.byCategory[guest.category] = 0;
        }
        stats.byCategory[guest.category]++;
      }
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching guest statistics",
      error: error.message,
    });
  }
};

export const importGuests = async (req, res) => {
  try {
    const { eventId, guests: guestData } = req.body;

    const event = await Event.findOne({
      _id: eventId,
      planner: req.user._id,
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    if (!Array.isArray(guestData) || guestData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid guest data format",
      });
    }

    const user = await User.findById(req.user._id).populate("subscription");
    const subscription = user.subscription;

    if (subscription) {
      const currentGuestCount = await Guest.countDocuments({ event: eventId });
      const tierLimits = {
        starter: 100,
        professional: Infinity,
        business: Infinity,
        enterprise: Infinity,
      };

      const limit = tierLimits[subscription.tier] || 100;

      if (currentGuestCount + guestData.length > limit) {
        return res.status(403).json({
          success: false,
          message: `Import would exceed guest limit for ${subscription.tier} tier (${limit} guests per event)`,
          upgrade: subscription.tier === "starter",
        });
      }
    }

    const results = {
      success: [],
      errors: [],
    };

    for (let i = 0; i < guestData.length; i++) {
      try {
        const guestInfo = guestData[i];

        if (!guestInfo.name || guestInfo.name.trim() === "") {
          results.errors.push({
            row: i + 1,
            data: guestInfo,
            error: "Name is required",
          });
          continue;
        }

        const guest = await Guest.create({
          event: eventId,
          planner: req.user._id,
          name: guestInfo.name,
          email: guestInfo.email || "",
          phone: guestInfo.phone || "",
          category: guestInfo.category || "",
          plusOne: guestInfo.plusOne === "true" || guestInfo.plusOne === true,
          plusOneName: guestInfo.plusOneName || "",
          dietaryRestrictions: guestInfo.dietaryRestrictions
            ? guestInfo.dietaryRestrictions.split(",").map((d) => d.trim())
            : [],
          specialRequirements: guestInfo.specialRequirements || "",
        });

        results.success.push({
          row: i + 1,
          guest,
        });
      } catch (error) {
        results.errors.push({
          row: i + 1,
          data: guestData[i],
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Import completed: ${results.success.length} guests added, ${results.errors.length} errors`,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error importing guests",
      error: error.message,
    });
  }
};
