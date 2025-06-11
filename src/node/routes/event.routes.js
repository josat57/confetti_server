import express from 'express';
import { protect } from '../middleware/auth.js';
import { validateCreateEvent } from '../middleware/validation.js';
import {
    planEvent,
    analyzeEventFeedback,
    createEvent,
    getEvents,
    updateEvent,
    deleteEvent,
    addVendor,
    removeVendor,
    addGuest,
    removeGuest,
    updateBudget,
    updateSchedule,
    addTimelineItem,
    addChecklistItem,
    addDocument,
    addNote,
    getEventById
} from '../controllers/event.controller.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// Event routes
router.post('/', validateCreateEvent, createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

// Event-specific routes
router.post('/:id/vendors', addVendor);
router.delete('/:id/vendors/:vendorId', removeVendor);
router.post('/:id/guests', addGuest);
router.delete('/:id/guests/:guestId', removeGuest);
router.post('/:id/budget', updateBudget);
router.post('/:id/schedule', updateSchedule);

// Timeline and checklist routes
router.post('/:id/timeline', addTimelineItem);
router.post('/:id/checklist', addChecklistItem);

// Document and note routes
router.post('/:id/documents', addDocument);
router.post('/:id/notes', addNote);

// New routes for AI-powered features
router.post('/plan', protect, planEvent);
router.post('/analyze-feedback', protect, analyzeEventFeedback);

export default router; 