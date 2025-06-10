import express from 'express';
import { protect, restrictTo } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  updatePreferences,
  listUsers,
  getUserById,
  setUserActiveStatus,
  setUserLockStatus
} from '../controllers/user.controller.js';

const router = express.Router();

// User routes (require authentication)
router.use(protect);

router.get('/me', getProfile);
router.patch('/me', updateProfile);
router.patch('/me/password', changePassword);
router.delete('/me', deactivateAccount);
router.patch('/me/preferences', updatePreferences);

// Admin routes
router.use(restrictTo('admin'));
router.get('/', listUsers);
router.get('/:id', getUserById);
router.patch('/:id/active', setUserActiveStatus);
router.patch('/:id/lock', setUserLockStatus);

export default router; 