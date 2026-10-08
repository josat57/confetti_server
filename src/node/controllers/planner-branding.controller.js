import PlannerBusinessProfile from "../models/planner-business-profile.model.js";
import { AppError } from "../utils/AppError.js";
import { deleteFromGridFS, fileToBase64, uploadToGridFS } from "../utils/gridfs.js";
import { getRequestPlan } from "../services/plan-access.service.js";
import { getDefaultBranding } from "../services/branding.service.js";

/**
 * Planner branding (logo and colours on proposals and exports).
 * Anyone can view it; changing it needs a plan with branded exports (Agency).
 * Mounted at /api/v1/planner/settings/branding.
 */

const BRANDING_FIELDS = ["primaryColor", "secondaryColor", "accentColor", "font"];

const shape = async (branding = {}, canCustomize) => {
  const defaults = getDefaultBranding();
  return {
    logo: branding.logoFileId ? (await fileToBase64(branding.logoFileId)) || "" : branding.logo || "",
    primaryColor: branding.primaryColor || defaults.primaryColor,
    secondaryColor: branding.secondaryColor || defaults.secondaryColor,
    accentColor: branding.accentColor || defaults.accentColor,
    font: branding.font || defaults.font,
    canCustomize,
  };
};

/** The planner's business profile, created with their name if they haven't set one up yet */
const profileFor = async (user) => {
  const existing = await PlannerBusinessProfile.findOne({ userId: user._id });
  if (existing) return existing;
  const companyName =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || user.email;
  return PlannerBusinessProfile.create({ userId: user._id, companyName });
};

export const getPlannerBranding = async (req, res, next) => {
  try {
    const { plan } = await getRequestPlan(req);
    const profile = await PlannerBusinessProfile.findOne({ userId: req.user._id }).lean();
    res.status(200).json({
      status: "success",
      data: await shape(profile?.branding, !!plan?.features?.brandedExports),
    });
  } catch (error) {
    next(error);
  }
};

export const updatePlannerBranding = async (req, res, next) => {
  try {
    const profile = await profileFor(req.user);
    for (const field of BRANDING_FIELDS) {
      if (req.body?.[field] !== undefined) profile.set(`branding.${field}`, req.body[field]);
    }
    if (typeof req.body?.logo === "string" && /^https?:\/\//.test(req.body.logo)) {
      profile.set("branding.logo", req.body.logo);
      profile.set("branding.logoFileId", undefined);
    }
    await profile.save();
    res.status(200).json({ status: "success", data: await shape(profile.branding, true) });
  } catch (error) {
    next(error);
  }
};

export const uploadPlannerLogo = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError("Logo file is required", 400));
    const profile = await profileFor(req.user);
    const previous = profile.branding?.logoFileId;

    const ext = req.file.originalname.includes(".")
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf("."))
      : "";
    const { fileId } = await uploadToGridFS(
      req.file.buffer,
      `planner-logo-${req.user._id}-${Date.now()}${ext}`,
      req.file.mimetype,
      { userId: req.user._id, type: "planner-logo" }
    );
    profile.set("branding.logoFileId", fileId);
    profile.set("branding.logo", undefined);
    await profile.save();

    if (previous) await deleteFromGridFS(previous).catch(() => {});
    const logoUrl = (await fileToBase64(fileId)) || "";
    res.status(200).json({ status: "success", data: { logoUrl } });
  } catch (error) {
    next(error);
  }
};
