import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  createVendor,
  getVendor,
  updateVendor,
  deleteVendor,
  listVendors,
  searchVendors,
  addOrUpdateService,
  addOrUpdatePortfolioItem,
  manageAvailability,
  addReview
} from '../controllers/vendor.controller.js';

const router = express.Router();

// Public routes
router.get('/', listVendors);
router.get('/search', searchVendors);
router.get('/:id', getVendor);

// Protected routes (require authentication)
router.use(protect);

router.post('/', createVendor);
router.patch('/:id', updateVendor);
router.delete('/:id', deleteVendor);
router.post('/:id/services', addOrUpdateService);
router.post('/:id/portfolio', addOrUpdatePortfolioItem);
router.post('/:id/availability', manageAvailability);
router.post('/:id/reviews', addReview);

export default router; 