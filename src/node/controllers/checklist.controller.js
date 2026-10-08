import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Event checklist (stored as event.tasks).
 * Mounted at /api/v1/events/:eventId/checklist
 */

const STATUSES = ["pending", "in_progress", "completed"];
const PRIORITIES = ["low", "medium", "high"];

// [title, days before the event, category, priority]
const COMMON = [
  ["Set your total budget", 120, "Planning", "high"],
  ["Draft the guest list", 110, "Guests", "high"],
  ["Book the venue", 100, "Venue", "high"],
  ["Choose and book a caterer", 90, "Food", "high"],
  ["Book a photographer", 80, "Vendors", "medium"],
  ["Book a decorator", 75, "Vendors", "medium"],
  ["Book an MC or DJ", 70, "Entertainment", "medium"],
  ["Send invitations", 60, "Guests", "high"],
  ["Confirm every vendor and their arrival times", 14, "Vendors", "high"],
  ["Final guest count to caterer and venue", 10, "Guests", "high"],
  ["Finish the seating plan", 7, "Guests", "medium"],
  ["Prepare the day-of schedule", 3, "Planning", "medium"],
  ["Pay outstanding vendor balances", 2, "Budget", "high"],
];
const BY_TYPE = {
  wedding: [
    ["Book the registry or court date", 90, "Ceremony", "high"],
    ["Plan the traditional engagement list", 60, "Ceremony", "medium"],
    ["Choose aso-ebi fabric and share it with family", 60, "Attire", "medium"],
    ["Book a makeup artist", 60, "Vendors", "medium"],
    ["Order the cake", 45, "Food", "medium"],
    ["Buy the rings", 45, "Ceremony", "high"],
  ],
  birthday: [
    ["Pick a theme", 30, "Planning", "medium"],
    ["Book entertainment", 21, "Entertainment", "medium"],
    ["Order the cake", 14, "Food", "high"],
    ["Get party favours", 10, "Guests", "low"],
  ],
  corporate: [
    ["Confirm speakers", 60, "Programme", "high"],
    ["Write the agenda", 45, "Programme", "high"],
    ["Open registration", 30, "Guests", "high"],
    ["Book audio-visual equipment", 21, "Vendors", "medium"],
  ],
  social: [["Plan the programme of the day", 30, "Planning", "medium"]],
  other: [],
};

const shape = (task) => ({
  _id: task._id,
  title: task.title,
  description: task.description,
  dueDate: task.dueDate,
  status: task.status,
  category: task.category,
  priority: task.priority || "medium",
  completedAt: task.completedAt,
});

const findTask = (event, taskId) => {
  if (!mongoose.isValidObjectId(taskId)) throw new AppError("Checklist item not found", 404);
  const task = event.tasks.id(taskId);
  if (!task) throw new AppError("Checklist item not found", 404);
  return task;
};

const summary = (tasks) => ({
  total: tasks.length,
  completed: tasks.filter((t) => t.status === "completed").length,
  overdue: tasks.filter((t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < new Date()).length,
});

/** GET / */
export const getChecklist = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const items = [...event.tasks]
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate) : Infinity) - (b.dueDate ? new Date(b.dueDate) : Infinity))
      .map(shape);
    res.status(200).json({ status: "success", data: { items, summary: summary(items) } });
  } catch (error) {
    next(error);
  }
};

/** POST / { title, description, dueDate, category, priority } */
export const addChecklistItem = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const { title, description, dueDate, category, priority } = req.body || {};
    if (typeof title !== "string" || !title.trim()) throw new AppError("A title is required", 400);
    if (event.tasks.length >= 500) throw new AppError("A checklist can have up to 500 items", 400);
    event.tasks.push({
      title: title.trim().slice(0, 200),
      description: typeof description === "string" ? description.trim().slice(0, 2000) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      category: typeof category === "string" ? category.trim().slice(0, 60) : undefined,
      priority: PRIORITIES.includes(priority) ? priority : "medium",
    });
    await event.save({ validateModifiedOnly: true });
    res.status(201).json({ status: "success", data: { item: shape(event.tasks.at(-1)) } });
  } catch (error) {
    next(error);
  }
};

/** PATCH /:taskId { title, description, dueDate, category, priority, status } */
export const updateChecklistItem = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const task = findTask(event, req.params.taskId);
    const { title, description, dueDate, category, priority, status } = req.body || {};
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) throw new AppError("A title is required", 400);
      task.title = title.trim().slice(0, 200);
    }
    if (typeof description === "string") task.description = description.trim().slice(0, 2000);
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (typeof category === "string") task.category = category.trim().slice(0, 60);
    if (PRIORITIES.includes(priority)) task.priority = priority;
    if (STATUSES.includes(status)) {
      task.status = status;
      task.completedAt = status === "completed" ? task.completedAt || new Date() : undefined;
    }
    await event.save({ validateModifiedOnly: true });
    res.status(200).json({ status: "success", data: { item: shape(task) } });
  } catch (error) {
    next(error);
  }
};

/** DELETE /:taskId */
export const deleteChecklistItem = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    findTask(event, req.params.taskId).deleteOne();
    await event.save({ validateModifiedOnly: true });
    res.status(200).json({ status: "success", message: "Checklist item deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /generate — add a starter checklist for the event type, with due dates
 * counted back from the event date. Items already on the list are skipped.
 */
export const generateChecklist = async (req, res, next) => {
  try {
    const event = await findOwnedEvent(req.params.eventId, req.user);
    const eventDate = event.startDate ? new Date(event.startDate) : null;
    const today = new Date();
    today.setHours(9, 0, 0, 0);
    const existing = new Set(event.tasks.map((t) => t.title.toLowerCase()));

    const template = [...COMMON, ...(BY_TYPE[event.eventType] || [])].sort((a, b) => b[1] - a[1]);
    let added = 0;
    for (const [title, daysBefore, category, priority] of template) {
      if (existing.has(title.toLowerCase())) continue;
      let dueDate;
      if (eventDate) {
        dueDate = new Date(eventDate.getTime() - daysBefore * 86400000);
        if (dueDate < today) dueDate = new Date(today); // already late: due today
      }
      event.tasks.push({ title, category, priority, dueDate });
      added += 1;
    }
    await event.save({ validateModifiedOnly: true });
    res.status(201).json({ status: "success", data: { added, items: event.tasks.map(shape) } });
  } catch (error) {
    next(error);
  }
};
