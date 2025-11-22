import Task from "../models/task.model.js";
import User from "../models/user.model.js";

export class TaskReminderService {
  async sendTaskReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      const tasks = await Task.find({
        status: { $ne: "completed" },
        dueDate: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow,
        },
      })
        .populate("planner", "name email preferences")
        .populate("assignee", "name email preferences")
        .populate("event", "title startDate");

      const reminders = [];

      for (const task of tasks) {
        const alreadySent = task.reminders.some(
          (r) =>
            r.scheduledFor &&
            r.scheduledFor.toDateString() === tomorrow.toDateString() &&
            r.sentAt
        );

        if (!alreadySent) {
          const recipients = [task.planner];
          if (task.assignee && task.assignee._id.toString() !== task.planner._id.toString()) {
            recipients.push(task.assignee);
          }

          for (const recipient of recipients) {
            if (recipient.preferences?.notifications?.taskDeadlines !== false) {
              reminders.push({
                task,
                recipient,
                type: "email",
              });

              await task.addReminder("email", tomorrow);
            }
          }
        }
      }

      console.log(`Task reminders: ${reminders.length} reminders to send`);
      return reminders;
    } catch (error) {
      console.error("Error sending task reminders:", error);
      throw error;
    }
  }

  async sendOverdueAlerts() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tasks = await Task.find({
        status: { $ne: "completed" },
        dueDate: { $lt: today },
      })
        .populate("planner", "name email preferences")
        .populate("assignee", "name email preferences")
        .populate("event", "title startDate");

      const alerts = [];

      for (const task of tasks) {
        const recipients = [task.planner];
        if (task.assignee && task.assignee._id.toString() !== task.planner._id.toString()) {
          recipients.push(task.assignee);
        }

        for (const recipient of recipients) {
          if (recipient.preferences?.notifications?.taskDeadlines !== false) {
            alerts.push({
              task,
              recipient,
              type: "overdue",
            });
          }
        }
      }

      console.log(`Overdue alerts: ${alerts.length} alerts to send`);
      return alerts;
    } catch (error) {
      console.error("Error sending overdue alerts:", error);
      throw error;
    }
  }

  startReminderScheduler() {
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    setInterval(async () => {
      console.log("Running task reminder scheduler...");
      await this.sendTaskReminders();
      await this.sendOverdueAlerts();
    }, TWENTY_FOUR_HOURS);

    console.log("Task reminder scheduler started");
  }
}

export default new TaskReminderService();
