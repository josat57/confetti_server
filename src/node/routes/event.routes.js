import express from 'express';
import { protect } from '../middleware/auth.js';
import { validateCreateEvent } from '../middleware/validation.js';
import * as eventController from '../controllers/event.controller.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Event routes
router.post('/', validateCreateEvent, eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);
router.patch('/:id', validateCreateEvent, eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

// Event-specific routes
router.post('/:id/vendors', eventController.addVendor);
router.delete('/:id/vendors/:vendorId', eventController.removeVendor);
router.post('/:id/guests', eventController.addGuest);
router.delete('/:id/guests/:guestId', eventController.removeGuest);
router.post('/:id/budget', eventController.updateBudget);
router.post('/:id/schedule', eventController.updateSchedule);

// Timeline and checklist routes
router.post('/:id/timeline', eventController.addTimelineItem);
router.post('/:id/checklist', eventController.addChecklistItem);

// Document and note routes
router.post('/:id/documents', eventController.addDocument);
router.post('/:id/notes', eventController.addNote);

export default router; 