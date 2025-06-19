import express from 'express';
import passport from 'passport';
import { validateRequest } from '../middleware/validation.js';
import { protect } from '../middleware/auth.js';
import * as authController from '../controllers/auth.controller.js';
import oauthService from '../services/oauth.service.js';
import {
  register,
  login,
  logout,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  resendOTP,
  refreshToken,
  revokeRefreshToken,
  verifyUser
} from '../controllers/auth.controller.js';

const router = express.Router();

// Public routes
router.post('/register', validateRequest('register'), register);
router.post('/signin', validateRequest('login'), login);
router.get('/verify', protect, verifyUser);
router.post('/logout', logout);
router.get('/verify-email/:token/:otp', verifyEmail);
router.post('/resend-verification', validateRequest('resendOTP'), resendVerificationEmail);
router.post('/forgot-password', validateRequest('forgotPassword'), forgotPassword);
router.post('/reset-password', validateRequest('resetPassword'), resetPassword);
router.post('/resend-otp', validateRequest('resendOTP'), resendOTP);

// Protected routes
router.post('/refresh-token', refreshToken);
router.post('/revoke-token', protect, revokeRefreshToken);

// OAuth routes
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { 
      failureRedirect: `${process.env.FRONTEND_URL}/auth/error` 
    }, (err, user, info) => {
      if (err) {
        console.error('Google OAuth Error:', err);
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }
      if (!user) {
        console.error('No user returned from Google OAuth');
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login Error:', err);
          return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
        }
        return oauthService.handleOAuthSuccess(req, res);
      });
    })(req, res, next);
  }
);

router.get('/facebook',
  passport.authenticate('facebook', { 
    scope: ['email'],
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`
  })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { 
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error` 
  }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

router.get('/twitter',
  passport.authenticate('twitter', {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`
  })
);

router.get('/twitter/callback',
  passport.authenticate('twitter', { 
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error` 
  }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

export default router; 