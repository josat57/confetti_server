import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "user_created",
        "user_updated",
        "user_deleted",
        "user_status_changed",
        "content_created",
        "content_updated",
        "content_deleted",
        "content_moderated",
        "system_config_updated",
        "system_config_created",
        "system_config_deleted",
        "admin_created",
        "admin_updated",
        "admin_deleted",
        "admin_permissions_updated",
        "vendor_approved",
        "vendor_rejected",
        "payment_processed",
        "ticket_responded",
        "announcement_sent",
        "security_event",
        "financial_report_generated",
        // Phase 10: System Configuration
        "subscription_plan_created",
        "subscription_plan_updated",
        "subscription_plan_deleted",
        "create_subscription_plan",
        "update_subscription_plan",
        "delete_subscription_plan",
        "feature_flag_created",
        "feature_flag_updated",
        "feature_flag_deleted",
        "feature_flag_toggled",
        "email_template_created",
        "email_template_updated",
        "email_template_deleted",
        "payment_gateway_config_updated",
        "security_setting_updated",
        // Phase 11: Notification Management
        "notification_sent",
        "notification_deleted",
        "notification_template_created",
        "notification_template_updated",
        "notification_template_deleted",
        // Phase 12: Audit & Compliance
        "compliance_report_generated",
        "data_retention_policy_created",
        "data_retention_policy_updated",
        "data_retention_policy_deleted",
        "data_retention_policy_applied",
        "gdpr_request_created",
        "gdpr_request_processed",
        "gdpr_request_rejected",
        // Phase 13: Advanced Search
        "saved_search_created",
        "saved_search_updated",
        "saved_search_deleted",
        // Phase 14: Bulk Operations
        "bulk_user_update",
        "bulk_user_delete",
        "bulk_vendor_update",
        "bulk_content_moderation",
        "bulk_notification_sent",
        "bulk_ticket_update",
        // Phase 16: Advanced Reporting
        "report_template_created",
        "report_template_updated",
        "report_template_deleted",
        "scheduled_report_created",
        "scheduled_report_updated",
        "scheduled_report_deleted",
        "report_generated",
        // Phase 17: System Monitoring
        "system_alert_created",
        "system_alert_resolved",
        "error_resolved",
      ],
    },
    resourceType: {
      type: String,
      required: true,
      enum: [
        "user",
        "content",
        "admin",
        "vendor",
        "payment",
        "ticket",
        "announcement",
        "system",
        "security",
        "financial",
        "subscription_plan",
        "feature_flag",
        "email_template",
        "notification",
        "notification_template",
        "compliance_report",
        "data_retention_policy",
        "gdpr_request",
        "saved_search",
        "report_template",
        "scheduled_report",
        "generated_report",
        "system_alert",
        "error_log",
      ],
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    userAgent: {
      type: String,
      required: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
auditLogSchema.index({ admin: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function (data) {
  try {
    const log = new this(data);
    await log.save();
    return log;
  } catch (error) {
    console.error("Error creating audit log:", error);
    // Don't throw error to prevent breaking main functionality
    return null;
  }
};

// Method to get logs with pagination
auditLogSchema.statics.getLogs = async function (
  query = {},
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  const logs = await this.find(query)
    .populate("admin", "email firstName lastName")
    .sort("-timestamp")
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
