import mongoose from "mongoose";
import Event from "../models/event.model.js";
import { AppError } from "./AppError.js";

/** Is this user the event's owner (creator, organizer or planner)? */
export const ownsEvent = (event, user) =>
  [event?.planner, event?.createdBy, event?.organizer].some(
    (id) => id && String(id._id || id) === String(user._id || user.id)
  );

/** The event if the user owns it, otherwise 404 (no hint that it exists) */
export const findOwnedEvent = async (eventId, user, projection) => {
  if (!mongoose.isValidObjectId(eventId)) throw new AppError("Event not found", 404);
  const event = await Event.findById(eventId, projection);
  if (!event || !ownsEvent(event, user)) throw new AppError("Event not found", 404);
  return event;
};
