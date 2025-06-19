import express from 'express';
import { protect } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
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
router.post('/', validateRequest('createEvent'), createEvent);
router.get('/', getEvents);
router.get('/:id', getEventById);
router.put('/:id', validateRequest('updateEvent'), updateEvent);
router.delete('/:id', deleteEvent);

// Event-specific routes
router.post('/:id/vendors', validateRequest('addVendor'), addVendor);
router.delete('/:id/vendors/:vendorId', removeVendor);
router.post('/:id/guests', validateRequest('addGuest'), addGuest);
router.delete('/:id/guests/:guestId', removeGuest);
router.post('/:id/budget', validateRequest('updateBudget'), updateBudget);
router.post('/:id/schedule', validateRequest('updateSchedule'), updateSchedule);

// Timeline and checklist routes
router.post('/:id/timeline', validateRequest('addTimelineItem'), addTimelineItem);
router.post('/:id/checklist', validateRequest('addChecklistItem'), addChecklistItem);

// Document and note routes
router.post('/:id/documents', validateRequest('addDocument'), addDocument);
router.post('/:id/notes', validateRequest('addNote'), addNote);

// New routes for AI-powered features
router.post('/plan', protect, validateRequest('planEvent'), planEvent);
router.post('/analyze-feedback', protect, validateRequest('analyzeEventFeedback'), analyzeEventFeedback);

export default router; 