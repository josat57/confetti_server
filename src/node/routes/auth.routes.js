import express from "express";
import passport from "passport";
import { validateRequest } from "../middleware/validation.js";
import { protect } from "../middleware/auth.js";
import oauthService from "../services/oauth.service.js";
import { handleSuperAdminLogin } from "../middleware/superAdmin.js";
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
  verifyUser,
  disableAccount,
} from "../controllers/auth.controller.js";

const router = express.Router();

// Public routes

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user account
 *     description: Create a new user account with email, password, and profile information. Returns a JWT token upon successful registration.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: User email address (must be unique)
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *                 description: User password (minimum 8 characters)
 *               firstName:
 *                 type: string
 *                 example: John
 *                 description: User first name
 *               lastName:
 *                 type: string
 *                 example: Doe
 *                 description: User last name
 *               username:
 *                 type: string
 *                 example: johndoe
 *                 description: Unique username (optional)
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *                 description: User phone number (optional)
 *     responses:
 *       201:
 *         description: User successfully registered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Registration successful. Please check your email to verify your account.
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImlhdCI6MTYxODg0MjAwMCwiZXhwIjoxNjE4OTI4NDAwfQ.abc123
 *                       description: JWT authentication token
 *       400:
 *         description: Invalid input data or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid email format
 *               statusCode: 400
 *       409:
 *         description: User already exists with this email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: User with this email already exists
 *               statusCode: 409
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", validateRequest("register"), register);

/**
 * @swagger
 * /auth/signin:
 *   post:
 *     summary: Sign in to user account
 *     description: Authenticate user with email and password credentials. Returns a JWT token for accessing protected endpoints.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: User email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *                 description: User password
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImlhdCI6MTYxODg0MjAwMCwiZXhwIjoxNjE4OTI4NDAwfQ.abc123
 *                       description: JWT authentication token
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNjE4ODQyMDAwfQ.xyz789
 *                       description: Refresh token for obtaining new access tokens
 *       400:
 *         description: Invalid credentials or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid email or password
 *               statusCode: 400
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid credentials
 *               statusCode: 401
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/signin", validateRequest("login"), handleSuperAdminLogin, login);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verify JWT token and get current user
 *     description: Verify the validity of the JWT token and return the authenticated user's information. This endpoint requires a valid Bearer token.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid and user information returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Not authorized, token missing or invalid
 *               statusCode: 401
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/verify", protect, verifyUser);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Logout the current user by invalidating their session and refresh token.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully logged out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/logout", logout);

/**
 * @swagger
 * /auth/signout:
 *   post:
 *     summary: Sign out user (alias for logout)
 *     description: Sign out the current user by invalidating their session and refresh token. This is an alias for the /logout endpoint.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Successfully signed out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logout successful
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/signout", logout);

/**
 * @swagger
 * /auth/verify-email/{token}/{otp}:
 *   get:
 *     summary: Verify user email address
 *     description: Verify user email address using the verification token and OTP sent to the user's email. This completes the email verification process.
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.abc123
 *       - in: path
 *         name: otp
 *         required: true
 *         schema:
 *           type: string
 *         description: One-time password sent to user's email
 *         example: "123456"
 *     responses:
 *       200:
 *         description: Email successfully verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid or expired token/OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid or expired verification token
 *               statusCode: 400
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/verify-email/:token/:otp", verifyEmail);

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify user email address (query parameters)
 *     description: Alternative endpoint for email verification using query parameters instead of path parameters. Accepts token and OTP as query strings.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.abc123
 *       - in: query
 *         name: otp
 *         required: true
 *         schema:
 *           type: string
 *         description: One-time password sent to user's email
 *         example: "123456"
 *     responses:
 *       200:
 *         description: Email successfully verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Email verified successfully
 *       400:
 *         description: Invalid or expired token/OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/verify-email", verifyEmail); // Support query parameters

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend email verification OTP
 *     description: Resend the email verification OTP to the user's registered email address. Use this when the original verification email was not received or has expired.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: User email address to resend verification to
 *     responses:
 *       200:
 *         description: Verification email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Verification email sent successfully
 *       400:
 *         description: Invalid email or user already verified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Email is already verified
 *               statusCode: 400
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/resend-verification",
  validateRequest("resendOTP"),
  resendVerificationEmail
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Initiate the password reset process by sending a password reset link and OTP to the user's registered email address.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: User email address for password reset
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset email sent successfully
 *       400:
 *         description: Invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found with this email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: No user found with this email address
 *               statusCode: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/forgot-password",
  validateRequest("forgotPassword"),
  forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Reset the user's password using the reset token and OTP received via email. Requires the new password to be provided.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - otp
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEifQ.abc123
 *                 description: Password reset token from email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *                 description: One-time password from email
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePass123!
 *                 description: New password (minimum 8 characters)
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePass123!
 *                 description: Confirm new password (must match password)
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password reset successful
 *       400:
 *         description: Invalid token, OTP, or password validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid or expired reset token
 *               statusCode: 400
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/reset-password", validateRequest("resetPassword"), resetPassword);
router.post("/resend-otp", validateRequest("resendOTP"), resendOTP);

// Protected routes

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     description: Obtain a new access token using a valid refresh token. Use this endpoint when the access token has expired.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNjE4ODQyMDAwfQ.xyz789
 *                 description: Valid refresh token obtained during login
 *     responses:
 *       200:
 *         description: New access token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsImlhdCI6MTYxODg0MjAwMCwiZXhwIjoxNjE4OTI4NDAwfQ.new123
 *                       description: New JWT access token
 *                     refreshToken:
 *                       type: string
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNjE4ODQyMDAwfQ.new789
 *                       description: New refresh token (optional, may be rotated)
 *       400:
 *         description: Invalid or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Refresh token is required
 *               statusCode: 400
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: Invalid or expired refresh token
 *               statusCode: 401
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /auth/revoke-token:
 *   post:
 *     summary: Revoke refresh token
 *     description: Revoke a refresh token to prevent it from being used to generate new access tokens. This is useful for logout or security purposes. Requires authentication.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjYwN2YxZjc3YmNmODZjZDc5OTQzOTAxMSIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNjE4ODQyMDAwfQ.xyz789
 *                 description: Refresh token to revoke
 *     responses:
 *       200:
 *         description: Refresh token revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Refresh token revoked successfully
 *       400:
 *         description: Invalid or missing refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Refresh token not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/revoke-token", protect, revokeRefreshToken);

/**
 * @swagger
 * /auth/disable-account:
 *   post:
 *     summary: Disable user account
 *     description: Disable the authenticated user's account. This is a soft delete that marks the account as inactive. The account data will be retained for 30 days. Requires password confirmation for security.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MySecurePass123!
 *                 description: User's current password for verification
 *               reason:
 *                 type: string
 *                 example: No longer need the service
 *                 description: Optional reason for disabling the account
 *     responses:
 *       200:
 *         description: Account disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Account disabled successfully. Your data will be retained for 30 days.
 *       400:
 *         description: Password is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Incorrect password or unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/disable-account", protect, disableAccount);

// OAuth routes

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     description: Redirect user to Google OAuth consent screen for authentication. After successful authentication, user will be redirected to the callback URL.
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth consent screen
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Callback endpoint for Google OAuth authentication. Google redirects to this endpoint after user grants or denies permission. On success, user is authenticated and redirected to the frontend with a JWT token.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication token or error
 *       400:
 *         description: OAuth authentication failed
 *       500:
 *         description: Internal server error
 */
router.get("/google/callback", (req, res, next) => {
  passport.authenticate(
    "google",
    {
      failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
    },
    (err, user, info) => {
      if (err) {
        console.error("Google OAuth Error:", err);
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }
      if (!user) {
        console.error("No user returned from Google OAuth");
        return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("Login Error:", err);
          return res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
        }
        return oauthService.handleOAuthSuccess(req, res);
      });
    }
  )(req, res, next);
});

/**
 * @swagger
 * /auth/facebook:
 *   get:
 *     summary: Initiate Facebook OAuth authentication
 *     description: Redirect user to Facebook OAuth consent screen for authentication. After successful authentication, user will be redirected to the callback URL.
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Facebook OAuth consent screen
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/facebook",
  passport.authenticate("facebook", {
    scope: ["email"],
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  })
);

/**
 * @swagger
 * /auth/facebook/callback:
 *   get:
 *     summary: Facebook OAuth callback
 *     description: Callback endpoint for Facebook OAuth authentication. Facebook redirects to this endpoint after user grants or denies permission. On success, user is authenticated and redirected to the frontend with a JWT token.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Facebook
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State parameter for CSRF protection
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication token or error
 *       400:
 *         description: OAuth authentication failed
 *       500:
 *         description: Internal server error
 */
router.get(
  "/facebook/callback",
  passport.authenticate("facebook", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

/**
 * @swagger
 * /auth/twitter:
 *   get:
 *     summary: Initiate Twitter OAuth authentication
 *     description: Redirect user to Twitter OAuth consent screen for authentication. After successful authentication, user will be redirected to the callback URL.
 *     tags: [Authentication]
 *     responses:
 *       302:
 *         description: Redirect to Twitter OAuth consent screen
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/twitter",
  passport.authenticate("twitter", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  })
);

/**
 * @swagger
 * /auth/twitter/callback:
 *   get:
 *     summary: Twitter OAuth callback
 *     description: Callback endpoint for Twitter OAuth authentication. Twitter redirects to this endpoint after user grants or denies permission. On success, user is authenticated and redirected to the frontend with a JWT token.
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: oauth_token
 *         schema:
 *           type: string
 *         description: OAuth token from Twitter
 *       - in: query
 *         name: oauth_verifier
 *         schema:
 *           type: string
 *         description: OAuth verifier from Twitter
 *     responses:
 *       302:
 *         description: Redirect to frontend with authentication token or error
 *       400:
 *         description: OAuth authentication failed
 *       500:
 *         description: Internal server error
 */
router.get(
  "/twitter/callback",
  passport.authenticate("twitter", {
    failureRedirect: `${process.env.FRONTEND_URL}/auth/error`,
  }),
  oauthService.handleOAuthSuccess.bind(oauthService)
);

export default router;
