import Guest from "../models/guest.model.js";
import Event from "../models/event.model.js";
import { AppError } from "../utils/AppError.js";

/**
 * List guests for an event
 * GET /api/v1/events/:eventId/guests
 */
export const listEventGuests = async (req, res, next) => {
  try {
    const { rsvpStatus, tableAssignment, search } = req.query;
    const query = { event: req.params.eventId };

    if (rsvpStatus) query.rsvpStatus = rsvpStatus;
    if (tableAssignment) query.tableAssignment = tableAssignment;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const guests = await Guest.find(query).sort({ name: 1 }).lean();

    // Get statistics
    const stats = await Guest.aggregate([
      { $match: { event: req.params.eventId } },
      {
        $group: {
          _id: "$rsvpStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalGuests = guests.length;
    const totalWithPlusOne = guests.filter((g) => g.plusOne).length;

    res.status(200).json({
      status: "success",
      data: {
        guests,
        stats: {
          total: totalGuests,
          withPlusOne: totalWithPlusOne,
          estimatedAttendance: totalGuests + totalWithPlusOne,
          byStatus: stats.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add guest to event
 * POST /api/v1/events/:eventId/guests
 */
export const addGuest = async (req, res, next) => {
  try {
    // Verify event exists and user has access
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    if (event.planner.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    const guest = await Guest.create({
      ...req.body,
      event: req.params.eventId,
    });

    res.status(201).json({
      status: "success",
      data: { guest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk import guests
 * POST /api/v1/events/:eventId/guests/import
 */
export const importGuests = async (req, res, next) => {
  try {
    const { guests } = req.body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return next(new AppError("Guests array is required", 400));
    }

    // Verify event exists and user has access
    const event = await Event.findById(req.params.eventId);
    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    if (event.planner.toString() !== req.user._id.toString()) {
      return next(new AppError("Access denied", 403));
    }

    // Add event ID to each guest
    const guestsWithEvent = guests.map((g) => ({
      ...g,
      event: req.params.eventId,
    }));

    const importedGuests = await Guest.insertMany(guestsWithEvent);

    res.status(201).json({
      status: "success",
      data: {
        imported: importedGuests.length,
        guests: importedGuests,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get guest details
 * GET /api/v1/guests/:id
 */
export const getGuest = async (req, res, next) => {
  try {
    const guest = await Guest.findById(req.params.id).populate(
      "event",
      "name type"
    );

    if (!guest) {
      return next(new AppError("Guest not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { guest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update guest
 * PATCH /api/v1/guests/:id
 */
export const updateGuest = async (req, res, next) => {
  try {
    const guest = await Guest.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!guest) {
      return next(new AppError("Guest not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: { guest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete guest
 * DELETE /api/v1/guests/:id
 */
export const deleteGuest = async (req, res, next) => {
  try {
    const guest = await Guest.findByIdAndDelete(req.params.id);

    if (!guest) {
      return next(new AppError("Guest not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Guest deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update RSVP status
 * POST /api/v1/guests/:id/rsvp
 */
export const updateRSVP = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["accepted", "declined", "tentative"].includes(status)) {
      return next(new AppError("Invalid RSVP status", 400));
    }

    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      return next(new AppError("Guest not found", 404));
    }

    await guest.updateRSVP(status);

    res.status(200).json({
      status: "success",
      data: { guest },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seating chart
 * GET /api/v1/events/:eventId/seating
 */
export const getSeatingChart = async (req, res, next) => {
  try {
    const guests = await Guest.find({ event: req.params.eventId })
      .select("name tableAssignment seatNumber rsvpStatus")
      .sort({ tableAssignment: 1, seatNumber: 1 })
      .lean();

    // Group by table
    const seatingChart = guests.reduce((acc, guest) => {
      const table = guest.tableAssignment || "Unassigned";
      if (!acc[table]) {
        acc[table] = [];
      }
      acc[table].push(guest);
      return acc;
    }, {});

    res.status(200).json({
      status: "success",
      data: { seatingChart },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update seating assignments
 * POST /api/v1/events/:eventId/seating
 */
export const updateSeating = async (req, res, next) => {
  try {
    const { assignments } = req.body;

    if (!Array.isArray(assignments)) {
      return next(new AppError("Assignments array is required", 400));
    }

    // Bulk update
    const updates = assignments.map((a) =>
      Guest.findByIdAndUpdate(
        a.guestId,
        {
          tableAssignment: a.table,
          seatNumber: a.seat,
        },
        { new: true }
      )
    );

    await Promise.all(updates);

    res.status(200).json({
      status: "success",
      message: "Seating updated successfully",
    });
  } catch (error) {
    next(error);
  }
};
