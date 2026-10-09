import venueService from "../services/venue.service.js";

/** Venue plan tools (roadmap Phase 9): /api/v1/vendors/venue */

const handle = (fn, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json({ status: "success", data: await fn(req) });
  } catch (error) {
    next(error);
  }
};

export const listSpaces = handle(async (req) => ({ spaces: await venueService.listSpaces(req.user) }));
export const createSpace = handle(async (req) => ({ space: await venueService.createSpace(req.user, req.body) }), 201);
export const updateSpace = handle(async (req) => ({ space: await venueService.updateSpace(req.user, req.params.id, req.body) }));
export const deleteSpace = handle((req) => venueService.deleteSpace(req.user, req.params.id));

export const getCalendar = handle((req) => venueService.calendar(req.user, req.query));
export const checkAvailability = handle((req) => venueService.availability(req.user, req.query));

export const listReservations = handle(async (req) => ({ reservations: await venueService.listReservations(req.user, req.query) }));
export const createReservation = handle(async (req) => ({ reservation: await venueService.createReservation(req.user, req.body) }), 201);
export const updateReservation = handle(async (req) => ({
  reservation: await venueService.updateReservation(req.user, req.params.id, req.body),
}));
export const extendHold = handle(async (req) => ({ reservation: await venueService.extendHold(req.user, req.params.id, req.body || {}) }));
export const convertHold = handle(async (req) => ({ reservation: await venueService.convertHold(req.user, req.params.id, req.body || {}) }));
export const releaseReservation = handle(async (req) => ({
  reservation: await venueService.release(req.user, req.params.id, req.body || {}),
}));
