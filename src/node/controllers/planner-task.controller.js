import Task from "../models/task.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";

export const createTask = async (req, res) => {
  try {
    const { title, description, assignee, dueDate, priority, category } = req.body;

    const event = await Event.findOne({
      _id: req.body.event,
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
      const taskCount = await Task.countDocuments({
        event: req.body.event,
      });

      const tierLimits = {
        starter: 50,
        professional: Infinity,
        business: Infinity,
        enterprise: Infinity,
      };

      const limit = tierLimits[subscription.tier] || 50;

      if (taskCount >= limit) {
        return res.status(403).json({
          success: false,
          message: `Task limit reached for ${subscription.tier} tier (${limit} tasks per event)`,
          upgrade: subscription.tier === "starter",
        });
      }
    }

    const task = await Task.create({
      event: req.body.event,
      planner: req.user._id,
      title,
      description,
      assignee,
      dueDate,
      priority,
      category,
    });

    await task.populate([
      { path: "assignee", select: "name email" },
      { path: "event", select: "title startDate" },
    ]);

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating task",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getTasks = async (req, res) => {
  try {
    const {
      event,
      assignee,
      status,
      priority,
      page = 1,
      limit = 50,
      sortBy = "dueDate",
    } = req.query;

    const query = { planner: req.user._id };

    if (event) query.event = event;
    if (assignee) query.assignee = assignee;
    if (status) query.status = status;
    if (priority) query.priority = priority;

    let sortOptions = {};
    switch (sortBy) {
      case "dueDate":
        sortOptions = { dueDate: 1, priority: -1 };
        break;
      case "priority":
        sortOptions = { priority: -1, dueDate: 1 };
        break;
      case "status":
        sortOptions = { status: 1, dueDate: 1 };
        break;
      default:
        sortOptions = { dueDate: 1 };
    }

    const skip = (page - 1) * limit;

    const tasks = await Task.find(query)
      .populate("assignee", "name email")
      .populate("event", "title startDate")
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sortOptions);

    const total = await Task.countDocuments(query);

    const completedCount = await Task.countDocuments({
      ...query,
      status: "completed",
    });
    const overdueCount = tasks.filter((task) => task.isOverdue).length;

    res.status(200).json({
      success: true,
      data: tasks,
      stats: {
        total,
        completed: completedCount,
        overdue: overdueCount,
        completionPercentage:
          total > 0 ? ((completedCount / total) * 100).toFixed(1) : 0,
      },
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
      message: "Error fetching tasks",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      planner: req.user._id,
    })
      .populate("assignee", "name email")
      .populate("event", "title startDate")
      .populate("comments.createdBy", "name email")
      .populate("dependencies");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching task",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const updateTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const allowedUpdates = [
      "title",
      "description",
      "assignee",
      "dueDate",
      "priority",
      "status",
      "category",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();

    await task.populate([
      { path: "assignee", select: "name email" },
      { path: "event", select: "title startDate" },
    ]);

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating task",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await task.deleteOne();

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting task",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const completeTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await task.markComplete(req.user._id);

    res.status(200).json({
      success: true,
      message: "Task marked as complete",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error completing task",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const addComment = async (req, res) => {
  try {
    const { content } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      planner: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await task.addComment(content, req.user._id);
    await task.populate("comments.createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: task,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding comment",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getUpcomingTasks = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const tasks = await Task.find({
      planner: req.user._id,
      status: { $ne: "completed" },
      dueDate: {
        $gte: new Date(),
        $lte: futureDate,
      },
    })
      .limit(200)
      .populate("assignee", "name email")
      .populate("event", "title startDate")
      .sort({ dueDate: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching upcoming tasks",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};

export const getOverdueTasks = async (req, res) => {
  try {
    const tasks = await Task.find({
      planner: req.user._id,
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
    })
      .limit(200)
      .populate("assignee", "name email")
      .populate("event", "title startDate")
      .sort({ dueDate: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching overdue tasks",
      error: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
};
