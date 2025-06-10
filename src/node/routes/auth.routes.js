import express from 'express';
import passport from 'passport';
import { validateRegistration, validateLogin } from '../middleware/validation.js';
import { protect } from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';
import oauthService from '../services/oauth.service.js';

const router = express.Router();

// Regular authentication routes
router.post('/register', validateRegistration, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', protect, authController.logout);
router.get('/me', protect, authController.getCurrentUser);

// Email verification routes
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification-email', validateLogin, authController.resendVerificationEmail);

// Password management routes
router.post('/forgot-password', validateLogin, authController.forgotPassword);
router.post('/reset-password', validateLogin, authController.resetPassword);
router.post('/resend-otp', validateLogin, authController.resendOTP);

// OAuth routes
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/auth/error' }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

router.get('/twitter',
  passport.authenticate('twitter')
);

router.get('/twitter/callback',
  passport.authenticate('twitter', { failureRedirect: '/auth/error' }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

export default router; 