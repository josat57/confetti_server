import SystemConfig from "../models/systemConfig.model.js";
import FeatureFlag from "../models/featureFlag.model.js";
import EmailTemplate from "../models/emailTemplate.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import { createError } from "../utils/error.js";
import AuditLog from "../models/auditLog.model.js";

class AdminSystemConfigService {
  // ==================== System Configuration ====================

  async getSystemConfigs(filters = {}) {
    const { category, search, isPublic, isEditable } = filters;

    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { key: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (isPublic !== undefined) query.isPublic = isPublic;
    if (isEditable !== undefined) query.isEditable = isEditable;

    const configs = await SystemConfig.find(query)
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ category: 1, key: 1 })
      .lean();

    return configs;
  }

  async getSystemConfigByKey(key) {
    const config = await SystemConfig.findOne({ key })
      .populate("lastModifiedBy", "firstName lastName email")
      .lean();

    if (!config) {
      throw createError("Configuration not found", 404);
    }

    return config;
  }

  async createSystemConfig(configData, adminId) {
    const {
      key,
      value,
      category,
      description,
      dataType,
      isPublic,
      isEditable,
    } = configData;

    // Check if config already exists
    const existingConfig = await SystemConfig.findOne({ key });
    if (existingConfig) {
      throw createError("Configuration with this key already exists", 409);
    }

    const config = await SystemConfig.create({
      key,
      value,
      category,
      description,
      dataType,
      isPublic,
      isEditable,
      lastModifiedBy: adminId,
      lastModifiedAt: new Date(),
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_system_config",
      resourceType: "system",
      resourceId: config._id,
      details: { key, category },
    });

    return config;
  }

  async updateSystemConfig(key, updates, adminId) {
    const config = await SystemConfig.findOne({ key });

    if (!config) {
      throw createError("Configuration not found", 404);
    }

    if (!config.isEditable) {
      throw createError("This configuration is not editable", 403);
    }

    const oldValue = config.value;

    // Update fields
    if (updates.value !== undefined) config.value = updates.value;
    if (updates.description !== undefined)
      config.description = updates.description;
    if (updates.isPublic !== undefined) config.isPublic = updates.isPublic;

    config.lastModifiedBy = adminId;
    config.lastModifiedAt = new Date();

    await config.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_system_config",
      resourceType: "system",
      resourceId: config._id,
      details: { key, oldValue, newValue: config.value },
    });

    return config;
  }

  async deleteSystemConfig(key, adminId) {
    const config = await SystemConfig.findOne({ key });

    if (!config) {
      throw createError("Configuration not found", 404);
    }

    if (!config.isEditable) {
      throw createError("This configuration cannot be deleted", 403);
    }

    await SystemConfig.deleteOne({ key });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_system_config",
      resourceType: "system",
      resourceId: config._id,
      details: { key, category: config.category },
    });

    return { message: "Configuration deleted successfully" };
  }

  // ==================== Feature Flags ====================

  async getFeatureFlags(filters = {}) {
    const { search, isEnabled, environment } = filters;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { key: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }
    if (isEnabled !== undefined) query.isEnabled = isEnabled;
    if (environment) query.environment = { $in: [environment, "all"] };

    const flags = await FeatureFlag.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ name: 1 })
      .lean();

    return flags;
  }

  async getFeatureFlagByKey(key) {
    const flag = await FeatureFlag.findOne({ key })
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .populate("targetUsers", "firstName lastName email")
      .lean();

    if (!flag) {
      throw createError("Feature flag not found", 404);
    }

    return flag;
  }

  async createFeatureFlag(flagData, adminId) {
    const {
      name,
      key,
      description,
      isEnabled,
      enabledFor,
      targetUsers,
      targetRoles,
      rolloutPercentage,
      environment,
      startDate,
      endDate,
    } = flagData;

    // Check if flag already exists
    const existingFlag = await FeatureFlag.findOne({ key });
    if (existingFlag) {
      throw createError("Feature flag with this key already exists", 409);
    }

    const flag = await FeatureFlag.create({
      name,
      key,
      description,
      isEnabled,
      enabledFor,
      targetUsers,
      targetRoles,
      rolloutPercentage,
      environment,
      startDate,
      endDate,
      createdBy: adminId,
      lastModifiedBy: adminId,
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_feature_flag",
      resourceType: "feature_flag",
      resourceId: flag._id,
      details: { key, isEnabled },
    });

    return flag;
  }

  async updateFeatureFlag(key, updates, adminId) {
    const flag = await FeatureFlag.findOne({ key });

    if (!flag) {
      throw createError("Feature flag not found", 404);
    }

    const oldEnabled = flag.isEnabled;

    // Update fields
    Object.keys(updates).forEach((field) => {
      if (updates[field] !== undefined && field !== "key") {
        flag[field] = updates[field];
      }
    });

    flag.lastModifiedBy = adminId;
    await flag.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_feature_flag",
      resourceType: "feature_flag",
      resourceId: flag._id,
      details: { key, oldEnabled, newEnabled: flag.isEnabled, updates },
    });

    return flag;
  }

  async toggleFeatureFlag(key, adminId) {
    const flag = await FeatureFlag.findOne({ key });

    if (!flag) {
      throw createError("Feature flag not found", 404);
    }

    flag.isEnabled = !flag.isEnabled;
    flag.lastModifiedBy = adminId;
    await flag.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "toggle_feature_flag",
      resourceType: "feature_flag",
      resourceId: flag._id,
      details: { key, isEnabled: flag.isEnabled },
    });

    return flag;
  }

  async deleteFeatureFlag(key, adminId) {
    const flag = await FeatureFlag.findOne({ key });

    if (!flag) {
      throw createError("Feature flag not found", 404);
    }

    await FeatureFlag.deleteOne({ key });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_feature_flag",
      resourceType: "feature_flag",
      resourceId: flag._id,
      details: { key, name: flag.name },
    });

    return { message: "Feature flag deleted successfully" };
  }

  // ==================== Email Templates ====================

  async getEmailTemplates(filters = {}) {
    const { category, search, isActive } = filters;

    const query = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { key: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }
    if (isActive !== undefined) query.isActive = isActive;

    const templates = await EmailTemplate.find(query)
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .sort({ category: 1, name: 1 })
      .lean();

    return templates;
  }

  async getEmailTemplateByKey(key) {
    const template = await EmailTemplate.findOne({ key })
      .populate("createdBy", "firstName lastName email")
      .populate("lastModifiedBy", "firstName lastName email")
      .lean();

    if (!template) {
      throw createError("Email template not found", 404);
    }

    return template;
  }

  async createEmailTemplate(templateData, adminId) {
    const {
      name,
      key,
      subject,
      htmlContent,
      textContent,
      category,
      variables,
      isActive,
    } = templateData;

    // Check if template already exists
    const existingTemplate = await EmailTemplate.findOne({ key });
    if (existingTemplate) {
      throw createError("Email template with this key already exists", 409);
    }

    const template = await EmailTemplate.create({
      name,
      key,
      subject,
      htmlContent,
      textContent,
      category,
      variables,
      isActive,
      createdBy: adminId,
      lastModifiedBy: adminId,
    });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_email_template",
      resourceType: "email_template",
      resourceId: template._id,
      details: { key, name, category },
    });

    return template;
  }

  async updateEmailTemplate(key, updates, adminId) {
    const template = await EmailTemplate.findOne({ key });

    if (!template) {
      throw createError("Email template not found", 404);
    }

    if (template.isSystem && !updates.allowSystemUpdate) {
      throw createError("System templates cannot be modified", 403);
    }

    // Update fields
    Object.keys(updates).forEach((field) => {
      if (
        updates[field] !== undefined &&
        field !== "key" &&
        field !== "allowSystemUpdate"
      ) {
        template[field] = updates[field];
      }
    });

    template.lastModifiedBy = adminId;
    await template.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_email_template",
      resourceType: "email_template",
      resourceId: template._id,
      details: { key, updates },
    });

    return template;
  }

  async deleteEmailTemplate(key, adminId) {
    const template = await EmailTemplate.findOne({ key });

    if (!template) {
      throw createError("Email template not found", 404);
    }

    if (template.isSystem) {
      throw createError("System templates cannot be deleted", 403);
    }

    await EmailTemplate.deleteOne({ key });

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_email_template",
      resourceType: "email_template",
      resourceId: template._id,
      details: { key, name: template.name },
    });

    return { message: "Email template deleted successfully" };
  }

  async previewEmailTemplate(key, variables = {}) {
    const template = await EmailTemplate.findOne({ key });

    if (!template) {
      throw createError("Email template not found", 404);
    }

    let htmlContent = template.htmlContent;
    let textContent = template.textContent || "";
    let subject = template.subject;

    // Replace variables
    Object.keys(variables).forEach((varName) => {
      const regex = new RegExp(`{{${varName}}}`, "g");
      htmlContent = htmlContent.replace(regex, variables[varName]);
      textContent = textContent.replace(regex, variables[varName]);
      subject = subject.replace(regex, variables[varName]);
    });

    return {
      subject,
      htmlContent,
      textContent,
      variables: template.variables,
    };
  }

  // ==================== Subscription Plans ====================

  async getSubscriptionPlans(filters = {}) {
    const { planType, isActive } = filters;

    const query = {};
    if (planType) query.planType = planType;
    if (isActive !== undefined) query.isActive = isActive;

    const plans = await SubscriptionPlan.find(query)
      .sort({ planType: 1, price: 1 })
      .lean();

    return plans;
  }

  async getSubscriptionPlanById(planId) {
    const plan = await SubscriptionPlan.findById(planId).lean();

    if (!plan) {
      throw createError("Subscription plan not found", 404);
    }

    return plan;
  }

  async createSubscriptionPlan(planData, adminId) {
    const plan = await SubscriptionPlan.create(planData);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "create_subscription_plan",
      resourceType: "subscription_plan",
      resourceId: plan._id,
      details: { name: plan.name, planType: plan.planType, price: plan.price },
    });

    return plan;
  }

  async updateSubscriptionPlan(planId, updates, adminId) {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      throw createError("Subscription plan not found", 404);
    }

    // Update fields
    Object.keys(updates).forEach((field) => {
      if (updates[field] !== undefined) {
        plan[field] = updates[field];
      }
    });

    await plan.save();

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_subscription_plan",
      resourceType: "subscription_plan",
      resourceId: plan._id,
      details: { name: plan.name, updates },
    });

    return plan;
  }

  async deleteSubscriptionPlan(planId, adminId) {
    const plan = await SubscriptionPlan.findById(planId);

    if (!plan) {
      throw createError("Subscription plan not found", 404);
    }

    // Check if plan is in use
    const Subscription = mongoose.model("Subscription");
    const activeSubscriptions = await Subscription.countDocuments({
      plan: planId,
      status: "active",
    });

    if (activeSubscriptions > 0) {
      throw createError(
        `Cannot delete plan with ${activeSubscriptions} active subscriptions`,
        400
      );
    }

    await SubscriptionPlan.findByIdAndDelete(planId);

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "delete_subscription_plan",
      resourceType: "subscription_plan",
      resourceId: planId,
      details: { name: plan.name, planType: plan.planType },
    });

    return { message: "Subscription plan deleted successfully" };
  }

  // ==================== Payment Gateway Configuration ====================

  async getPaymentGatewayConfig(gateway) {
    const config = await SystemConfig.findOne({
      key: `payment_gateway_${gateway}`,
      category: "payment",
    }).lean();

    if (!config) {
      throw createError("Payment gateway configuration not found", 404);
    }

    // Mask sensitive data
    if (config.value.secretKey) {
      config.value.secretKey = "***" + config.value.secretKey.slice(-4);
    }
    if (config.value.encryptionKey) {
      config.value.encryptionKey = "***" + config.value.encryptionKey.slice(-4);
    }

    return config;
  }

  async updatePaymentGatewayConfig(gateway, configData, adminId) {
    let config = await SystemConfig.findOne({
      key: `payment_gateway_${gateway}`,
      category: "payment",
    });

    if (!config) {
      // Create new config
      config = await SystemConfig.create({
        key: `payment_gateway_${gateway}`,
        value: configData,
        category: "payment",
        description: `${gateway} payment gateway configuration`,
        dataType: "object",
        isPublic: false,
        isEditable: true,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      });
    } else {
      config.value = { ...config.value, ...configData };
      config.lastModifiedBy = adminId;
      config.lastModifiedAt = new Date();
      await config.save();
    }

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_payment_gateway_config",
      resourceType: "system",
      resourceId: config._id,
      details: { gateway },
    });

    return config;
  }

  async testPaymentGatewayConnection(gateway) {
    // This would integrate with actual payment gateway APIs
    // For now, return mock response
    return {
      gateway,
      status: "connected",
      message: "Payment gateway connection successful",
      timestamp: new Date(),
    };
  }

  // ==================== Security Settings ====================

  async getSecuritySettings() {
    const settings = await SystemConfig.find({ category: "security" })
      .sort({ key: 1 })
      .lean();

    return settings;
  }

  async updateSecuritySetting(key, value, adminId) {
    let setting = await SystemConfig.findOne({ key, category: "security" });

    if (!setting) {
      setting = await SystemConfig.create({
        key,
        value,
        category: "security",
        dataType: typeof value,
        isPublic: false,
        isEditable: true,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      });
    } else {
      setting.value = value;
      setting.lastModifiedBy = adminId;
      setting.lastModifiedAt = new Date();
      await setting.save();
    }

    // Audit log
    await AuditLog.create({
      admin: adminId,
      action: "update_security_setting",
      resourceType: "system",
      resourceId: setting._id,
      details: { key, value },
    });

    return setting;
  }
}

export default new AdminSystemConfigService();
