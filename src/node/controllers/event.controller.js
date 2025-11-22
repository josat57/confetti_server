import Event from "../models/event.model.js";
import { handleError } from "../utils/error.js";
import { logger } from "../utils/logger.js";
import pythonService from "../services/python.service.js";
import {
  uploadToGridFS,
  deleteFromGridFS,
  fileToBase64,
} from "../utils/gridfs.js";
import { AppError } from "../utils/AppError.js";

/**
 * Helper function to check if user has access to event
 */
const hasEventAccess = (event, userId) => {
  if (!event.createdBy) return true; // Allow access if createdBy not set (legacy events)
  if (event.createdBy.toString() === userId.toString()) return true;
  if (event.organizer && event.organizer.toString() === userId.toString())
    return true;
  if (event.planner && event.planner.toString() === userId.toString())
    return true;
  return false;
};

export const createEvent = async (req, res) => {
  try {
    const event = new Event({
      ...req.body,
      createdBy: req.user.id,
      organizer: req.body.organizer || req.user.id, // Use createdBy as organizer if not provided
    });
    await event.save();
    res.status(201).json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const getEvents = async (req, res) => {
  try {
    const {
      type,
      status,
      startDate,
      endDate,
      location,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate && endDate) {
      query.startDate = { $gte: new Date(startDate) };
      query.endDate = { $lte: new Date(endDate) };
    }
    if (location) {
      query["location.city"] = new RegExp(location, "i");
    }

    const events = await Event.find(query)
      .populate("createdBy", "name email")
      .populate("planner", "name email")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ startDate: 1 });

    const total = await Event.countDocuments(query);

    // Convert events to plain objects and add base64 images
    const eventsWithBase64 = await Promise.all(
      events.map(async (event) => {
        const eventData = event.toObject();

        // Convert cover image to base64 if stored in GridFS
        if (eventData.imageFileId) {
          eventData.image = await fileToBase64(eventData.imageFileId);
        }

        // Convert media images to base64 if stored in GridFS
        if (eventData.media && eventData.media.length > 0) {
          eventData.media = await Promise.all(
            eventData.media.map(async (mediaItem) => {
              if (mediaItem.fileId && mediaItem.type === "image") {
                return {
                  ...mediaItem,
                  url: await fileToBase64(mediaItem.fileId),
                  isGridFS: true,
                };
              }
              return mediaItem;
            })
          );
        }

        return eventData;
      })
    );

    res.json({
      events: eventsWithBase64,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("planner", "name email")
      .populate("vendors.vendor", "name category rating");

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has access to the event
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);
    const isVendor = event.vendors.some(
      (v) => v.vendor && v.vendor.equals(req.user.id)
    );

    if (event.createdBy && !isCreator && !isPlanner && !isVendor) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Convert event to plain object
    const eventData = event.toObject();

    // Convert cover image to base64 if stored in GridFS
    if (eventData.imageFileId) {
      eventData.image = await fileToBase64(eventData.imageFileId);
    }

    // Convert media images to base64 if stored in GridFS
    if (eventData.media && eventData.media.length > 0) {
      eventData.media = await Promise.all(
        eventData.media.map(async (mediaItem) => {
          if (mediaItem.fileId && mediaItem.type === "image") {
            return {
              ...mediaItem,
              url: await fileToBase64(mediaItem.fileId),
              isGridFS: true,
            };
          }
          return mediaItem;
        })
      );
    }

    res.json(eventData);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to update
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (event.createdBy && !isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    Object.assign(event, req.body);
    await event.save();

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Only creator can delete the event
    if (!hasEventAccess(event, req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    handleError(res, error);
  }
};

export const addVendor = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add vendors
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { vendorId, category } = req.body;
    await event.addVendor(vendorId, category);

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateVendorStatus = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to update vendor status
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { status } = req.body;
    await event.updateVendorStatus(req.params.vendorId, status);

    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addTimelineItem = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add timeline items
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    await event.addTimelineItem(req.body);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addChecklistItem = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add checklist items
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { category, item } = req.body;
    await event.addChecklistItem(category, item);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addDocument = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add documents
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    await event.addDocument({
      ...req.body,
      uploadedBy: req.user.id,
    });
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addNote = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add notes
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);
    const isVendor = event.vendors.some(
      (v) => v.vendor && v.vendor.equals(req.user.id)
    );

    if (!isCreator && !isPlanner && !isVendor) {
      return res.status(403).json({ message: "Access denied" });
    }

    await event.addNote(req.body.content, req.user.id);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const removeVendor = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to remove vendors
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    await event.removeVendor(req.params.vendorId);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const removeGuest = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to remove guests
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    await event.removeGuest(req.params.guestId);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const addGuest = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to add guests
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId, plusOne } = req.body;
    await event.addGuest(userId, plusOne);
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateBudget = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to update budget
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { amount, currency } = req.body;
    event.budget = { amount, currency };
    await event.save();
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user has permission to update schedule
    const isCreator = event.createdBy && event.createdBy.equals(req.user.id);
    const isPlanner = event.planner && event.planner.equals(req.user.id);

    if (!isCreator && !isPlanner) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { timeline } = req.body;
    event.timeline = timeline;
    await event.save();
    res.json(event);
  } catch (error) {
    handleError(res, error);
  }
};

// Export individual controller functions
export const planEvent = async (req, res) => {
  try {
    const { budget, preferences, requirements } = req.body;

    // Step 1: Optimize budget allocation
    const optimizedBudget = await pythonService.optimizeBudget(
      budget,
      preferences
    );

    // Step 2: Predict prices for required items
    const pricePredictions = await pythonService.predictPrices(
      requirements.items
    );

    // Step 3: Match vendors based on requirements
    const matchedVendors = await pythonService.matchVendors(requirements);

    // Step 4: Get personalized recommendations
    const recommendations = await pythonService.getRecommendations(preferences);

    // Step 5: Simulate the event with the gathered information
    const eventSimulation = await pythonService.simulateEvent({
      budget: optimizedBudget,
      vendors: matchedVendors,
      items: pricePredictions,
      recommendations,
    });

    // Combine all results into a comprehensive response
    const response = {
      success: true,
      data: {
        optimizedBudget,
        pricePredictions,
        matchedVendors,
        recommendations,
        simulation: eventSimulation,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error("Error in planEvent:", error);
    res.status(500).json({
      success: false,
      error: "Failed to plan event",
      details: error.message,
    });
  }
};

export const analyzeEventFeedback = async (req, res) => {
  try {
    const { feedback } = req.body;

    // Use NLP service to analyze feedback
    const analysis = await pythonService.analyzeText(feedback);

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error("Error in analyzeEventFeedback:", error);
    res.status(500).json({
      success: false,
      error: "Failed to analyze feedback",
      details: error.message,
    });
  }
};

export default { planEvent, analyzeEventFeedback };

/**
 * Upload event cover image
 * POST /api/v1/events/:id/image
 */
export const uploadEventImage = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check if user is event organizer
    if (
      event.createdBy &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return next(new AppError("Not authorized to update this event", 403));
    }

    // Check if file was uploaded
    if (!req.file && !req.body.imageUrl) {
      return next(new AppError("Image file or URL is required", 400));
    }

    // Delete old image from GridFS if it exists
    if (event.imageFileId) {
      try {
        await deleteFromGridFS(event.imageFileId);
      } catch (error) {
        console.error("Error deleting old image:", error);
      }
    }

    // If file was uploaded, store in GridFS
    if (req.file) {
      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `event-image-${
          event._id
        }-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          eventId: event._id,
          type: "cover-image",
        }
      );

      event.imageFileId = uploadResult.fileId;
      event.image = null; // Clear URL if switching from URL to GridFS
    } else {
      // Otherwise use the provided URL
      event.image = req.body.imageUrl;
      event.imageFileId = null; // Clear GridFS ID if switching from GridFS to URL
    }

    await event.save();

    // Return base64 if GridFS file
    let imageData = event.image;
    if (event.imageFileId) {
      imageData = await fileToBase64(event.imageFileId);
    }

    res.status(200).json({
      status: "success",
      message: "Event image uploaded successfully",
      data: {
        image: imageData,
        isGridFS: !!event.imageFileId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload event media (photos/videos)
 * POST /api/v1/events/:id/media
 */
export const uploadEventMedia = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check if user is event organizer
    if (
      event.createdBy &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return next(new AppError("Not authorized to update this event", 403));
    }

    const { type, caption } = req.body;

    // Check if file was uploaded or URL provided
    if (!req.file && !req.body.url) {
      return next(new AppError("Media file or URL is required", 400));
    }

    let mediaFileId = null;
    let mediaUrl = null;
    let mediaType = type;

    // If file was uploaded, store in GridFS
    if (req.file) {
      // Auto-detect type from mimetype if not provided
      if (!mediaType) {
        mediaType = req.file.mimetype.startsWith("video") ? "video" : "image";
      }

      const uploadResult = await uploadToGridFS(
        req.file.buffer,
        `event-${mediaType}-${
          event._id
        }-${Date.now()}${req.file.originalname.substring(
          req.file.originalname.lastIndexOf(".")
        )}`,
        req.file.mimetype,
        {
          eventId: event._id,
          type: mediaType,
        }
      );

      mediaFileId = uploadResult.fileId;
    } else {
      mediaUrl = req.body.url;
    }

    if (!mediaType) {
      return next(new AppError("Media type is required", 400));
    }

    // Add media to event
    event.media.push({
      type: mediaType,
      url: mediaUrl,
      fileId: mediaFileId,
      caption,
      uploadedBy: req.user._id,
    });

    await event.save();

    res.status(200).json({
      status: "success",
      message: "Media uploaded successfully",
      data: {
        media: event.media,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload multiple event photos
 * POST /api/v1/events/:id/photos
 */
export const uploadEventPhotos = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check if user is event organizer
    if (
      event.createdBy &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return next(new AppError("Not authorized to update this event", 403));
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return next(new AppError("At least one photo file is required", 400));
    }

    const uploadedPhotos = [];

    // Upload each file to GridFS
    for (const file of req.files) {
      const uploadResult = await uploadToGridFS(
        file.buffer,
        `event-photo-${event._id}-${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}${file.originalname.substring(
          file.originalname.lastIndexOf(".")
        )}`,
        file.mimetype,
        {
          eventId: event._id,
          type: "photo",
        }
      );

      const photoData = {
        type: "image",
        fileId: uploadResult.fileId,
        caption: req.body.caption || "",
        uploadedBy: req.user._id,
      };

      event.media.push(photoData);
      uploadedPhotos.push(photoData);
    }

    await event.save();

    res.status(200).json({
      status: "success",
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
      data: {
        photos: uploadedPhotos,
        totalMedia: event.media.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete event media
 * DELETE /api/v1/events/:id/media/:mediaId
 */
export const deleteEventMedia = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return next(new AppError("Event not found", 404));
    }

    // Check if user is event organizer
    if (
      event.createdBy &&
      event.createdBy.toString() !== req.user._id.toString()
    ) {
      return next(new AppError("Not authorized to update this event", 403));
    }

    const mediaItem = event.media.id(req.params.mediaId);

    if (!mediaItem) {
      return next(new AppError("Media not found", 404));
    }

    // Delete from GridFS if it's a GridFS file
    if (mediaItem.fileId) {
      try {
        await deleteFromGridFS(mediaItem.fileId);
      } catch (error) {
        console.error("Error deleting media from GridFS:", error);
      }
    }

    // Remove from event
    mediaItem.remove();
    await event.save();

    res.status(200).json({
      status: "success",
      message: "Media deleted successfully",
      data: {
        media: event.media,
      },
    });
  } catch (error) {
    next(error);
  }
};
