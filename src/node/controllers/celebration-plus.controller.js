import runSheetService from "../services/run-sheet.service.js";
import giftService from "../services/gift.service.js";
import asoEbiService from "../services/aso-ebi.service.js";
import shortlistService from "../services/curated-shortlist.service.js";

/**
 * Celebration Plus screens (roadmap Phase 8): run sheet, gifts, aso-ebi and the
 * curated vendor shortlist. Mounted under /api/v1/events/:eventId/... (see
 * routes/celebration-plus.routes.js), plus public run sheet links and admin curation.
 */

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req, res);
    if (res.headersSent) return;
    res.status(status).json({ status: "success", data });
  } catch (error) {
    next(error);
  }
};
const ev = (req) => req.params.eventId;

// ---- Run sheet: /events/:eventId/run-sheet ----
export const getRunSheet = handle((req) => runSheetService.get(req.user, ev(req)));
export const updateRunSheet = handle((req) => runSheetService.updateSettings(req.user, ev(req), req.body));
export const addRunSheetVendor = handle((req) => runSheetService.addVendor(req.user, ev(req), req.body), 201);
export const importRunSheetVendors = handle((req) => runSheetService.importBookedVendors(req.user, ev(req)));
export const updateRunSheetVendor = handle((req) => runSheetService.updateVendor(req.user, ev(req), req.params.vendorKey, req.body));
export const removeRunSheetVendor = handle((req) => runSheetService.removeVendor(req.user, ev(req), req.params.vendorKey));
export const shareRunSheetVendor = handle((req) =>
  runSheetService.shareWithVendor(req.user, ev(req), req.params.vendorKey, { email: !!req.body?.email })
);
export const revokeRunSheetShare = handle((req) => runSheetService.revokeShare(req.user, ev(req), req.params.vendorKey));
export const addRunSheetItem = handle((req) => runSheetService.addItem(req.user, ev(req), req.body), 201);
export const updateRunSheetItem = handle((req) => runSheetService.updateItem(req.user, ev(req), req.params.itemId, req.body));
export const removeRunSheetItem = handle((req) => runSheetService.removeItem(req.user, ev(req), req.params.itemId));
export const runSheetPdf = async (req, res, next) => {
  try {
    await runSheetService.ownerPdf(req.user, ev(req), res);
  } catch (error) {
    next(error);
  }
};

// ---- Shared run sheet (vendor link, no login): /run-sheets/shared/:token ----
export const viewSharedRunSheet = handle((req) => runSheetService.viewShared(req.params.token));
export const sharedRunSheetPdf = async (req, res, next) => {
  try {
    await runSheetService.sharedPdf(req.params.token, res);
  } catch (error) {
    next(error);
  }
};

// ---- Gifts: /events/:eventId/gifts ----
export const listGifts = handle((req) => giftService.list(req.user, ev(req), req.query));
export const createGift = handle(async (req) => ({ gift: await giftService.create(req.user, ev(req), req.body) }), 201);
export const updateGift = handle(async (req) => ({ gift: await giftService.update(req.user, ev(req), req.params.giftId, req.body) }));
export const deleteGift = handle(async (req) => {
  await giftService.remove(req.user, ev(req), req.params.giftId);
  return null;
});
export const setGiftThankYou = handle((req) => giftService.setThankYou(req.user, ev(req), req.body || {}));

// ---- Aso-ebi: /events/:eventId/aso-ebi ----
export const getAsoEbi = handle((req) => asoEbiService.overview(req.user, ev(req), req.query));
export const addAsoEbiFabric = handle(async (req) => ({ fabric: await asoEbiService.addFabric(req.user, ev(req), req.body) }), 201);
export const updateAsoEbiFabric = handle(async (req) => ({
  fabric: await asoEbiService.updateFabric(req.user, ev(req), req.params.fabricId, req.body),
}));
export const deleteAsoEbiFabric = handle(async (req) => {
  await asoEbiService.removeFabric(req.user, ev(req), req.params.fabricId);
  return null;
});
export const addAsoEbiOrder = handle(async (req) => ({ order: await asoEbiService.addOrder(req.user, ev(req), req.body) }), 201);
export const updateAsoEbiOrder = handle(async (req) => ({
  order: await asoEbiService.updateOrder(req.user, ev(req), req.params.orderId, req.body),
}));
export const deleteAsoEbiOrder = handle(async (req) => {
  await asoEbiService.removeOrder(req.user, ev(req), req.params.orderId);
  return null;
});
export const recordAsoEbiPayment = handle(async (req) => ({
  order: await asoEbiService.recordPayment(req.user, ev(req), req.params.orderId, req.body || {}),
}));
export const removeAsoEbiPayment = handle(async (req) => ({
  order: await asoEbiService.removePayment(req.user, ev(req), req.params.orderId, req.params.paymentId),
}));
export const setAsoEbiCollection = handle((req) => asoEbiService.setCollection(req.user, ev(req), req.body || {}));
export const asoEbiCsv = async (req, res, next) => {
  try {
    const csv = await asoEbiService.ordersCsv(req.user, ev(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="aso-ebi-orders.csv"');
    res.send(`﻿${csv}`);
  } catch (error) {
    next(error);
  }
};

// ---- Curated shortlist (client): /events/:eventId/shortlist ----
export const getShortlist = handle((req) => shortlistService.get(req.user, ev(req)));
export const submitShortlistBrief = handle((req) => shortlistService.submitBrief(req.user, ev(req), req.body));
export const setShortlistItemStatus = handle((req) =>
  shortlistService.setItemStatus(req.user, ev(req), req.params.itemId, req.body?.status)
);

// ---- Curated shortlist (admin): /admin/curation ----
export const adminCurationQueue = handle((req) => shortlistService.adminQueue(req.query));
export const adminCurationVendors = handle(async (req) => ({ vendors: await shortlistService.adminSearchVendors(req.query) }));
export const adminCurationEvent = handle((req) => shortlistService.adminEvent(req.params.eventId));
export const adminCurationAdd = handle((req) => shortlistService.adminAdd(req.admin, req.params.eventId, req.body || {}), 201);
export const adminCurationNote = handle((req) => shortlistService.adminUpdateNote(req.params.eventId, req.params.itemId, req.body?.note));
export const adminCurationRemove = handle((req) => shortlistService.adminRemove(req.params.eventId, req.params.itemId));
export const adminCurationReady = handle((req) => shortlistService.adminMarkReady(req.params.eventId));
