import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  getProfile,
  updateProfile,
  changePassword,
  deactivateAccount,
  updatePreferences,
  listUsers,
  getUserById,
  setUserActiveStatus,
  setUserLockStatus,
  uploadProfileImage,
  uploadCoverPhoto,
  deleteProfileImage,
  deleteCoverPhoto,
} from "../controllers/user.controller.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// User routes (require authentication)
router.use(protect);

router.get("/me", getProfile);
router.patch("/me", updateProfile);
router.patch("/me/password", changePassword);
router.delete("/me", deactivateAccount);
router.patch("/me/preferences", updatePreferences);

// Image upload routes
router.post("/me/profile-image", upload.single("image"), uploadProfileImage);
router.post("/me/cover-photo", upload.single("image"), uploadCoverPhoto);
router.delete("/me/profile-image", deleteProfileImage);
router.delete("/me/cover-photo", deleteCoverPhoto);

// Admin routes
router.use(restrictTo("admin"));

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     description: Retrieve a list of all users in the system. This endpoint is restricted to administrators only and supports filtering and pagination through query parameters.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, event-planner, vendor]
 *         description: Filter users by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter users by active status
 *       - in: query
 *         name: isEmailVerified
 *         schema:
 *           type: boolean
 *         description: Filter users by email verification status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search users by name or email
 *     responses:
 *       200:
 *         description: Successfully retrieved list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *             example:
 *               status: success
 *               users:
 *                 - _id: "507f1f77bcf86cd799439011"
 *                   email: "john.doe@example.com"
 *                   firstName: "John"
 *                   lastName: "Doe"
 *                   role: "user"
 *                   isEmailVerified: true
 *                   isActive: true
 *                   createdAt: "2024-01-15T10:30:00.000Z"
 *                 - _id: "507f1f77bcf86cd799439012"
 *                   email: "jane.smith@example.com"
 *                   firstName: "Jane"
 *                   lastName: "Smith"
 *                   role: "vendor"
 *                   isEmailVerified: true
 *                   isActive: true
 *                   createdAt: "2024-01-16T14:20:00.000Z"
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User does not have admin privileges
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
router.get("/", listUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user by their ID. This endpoint is accessible to authenticated users but returns full details only for administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: MongoDB ObjectId of the user
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Successfully retrieved user details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               status: success
 *               user:
 *                 _id: "507f1f77bcf86cd799439011"
 *                 username: "johndoe_a3f"
 *                 email: "john.doe@example.com"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 role: "user"
 *                 phone: "+1234567890"
 *                 address:
 *                   street: "123 Main St"
 *                   city: "New York"
 *                   state: "NY"
 *                   country: "USA"
 *                   zipCode: "10001"
 *                 preferences:
 *                   notifications:
 *                     email: true
 *                     push: true
 *                     sms: false
 *                   theme: "light"
 *                   language: "en"
 *                 isEmailVerified: true
 *                 isActive: true
 *                 lastLogin: "2024-01-20T09:15:00.000Z"
 *                 createdAt: "2024-01-15T10:30:00.000Z"
 *                 updatedAt: "2024-01-20T09:15:00.000Z"
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User does not have permission to view this user
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
 *             example:
 *               success: false
 *               status: fail
 *               message: "User not found"
 *               statusCode: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update user profile
 *     description: Update a user's profile information including name, contact details, and preferences. Regular users can only update their own profile, while administrators can update any user's profile.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: MongoDB ObjectId of the user
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: "123 Main St"
 *                   city:
 *                     type: string
 *                     example: "New York"
 *                   state:
 *                     type: string
 *                     example: "NY"
 *                   country:
 *                     type: string
 *                     example: "USA"
 *                   zipCode:
 *                     type: string
 *                     example: "10001"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   notifications:
 *                     type: object
 *                     properties:
 *                       email:
 *                         type: boolean
 *                         example: true
 *                       push:
 *                         type: boolean
 *                         example: true
 *                       sms:
 *                         type: boolean
 *                         example: false
 *                   theme:
 *                     type: string
 *                     enum: [light, dark]
 *                     example: "light"
 *                   language:
 *                     type: string
 *                     example: "en"
 *           example:
 *             firstName: "John"
 *             lastName: "Doe"
 *             phone: "+1234567890"
 *             address:
 *               street: "456 Oak Avenue"
 *               city: "Los Angeles"
 *               state: "CA"
 *               country: "USA"
 *               zipCode: "90001"
 *             preferences:
 *               notifications:
 *                 email: true
 *                 push: false
 *                 sms: true
 *               theme: "dark"
 *               language: "en"
 *     responses:
 *       200:
 *         description: User profile successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               status: success
 *               user:
 *                 _id: "507f1f77bcf86cd799439011"
 *                 email: "john.doe@example.com"
 *                 firstName: "John"
 *                 lastName: "Doe"
 *                 phone: "+1234567890"
 *                 address:
 *                   street: "456 Oak Avenue"
 *                   city: "Los Angeles"
 *                   state: "CA"
 *                   country: "USA"
 *                   zipCode: "90001"
 *                 preferences:
 *                   notifications:
 *                     email: true
 *                     push: false
 *                     sms: true
 *                   theme: "dark"
 *                   language: "en"
 *                 updatedAt: "2024-01-20T10:30:00.000Z"
 *       400:
 *         description: Bad Request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User does not have permission to update this profile
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
 *   delete:
 *     summary: Delete user account
 *     description: Permanently delete a user account from the system. This endpoint is restricted to administrators only. The operation is irreversible and will remove all user data.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: MongoDB ObjectId of the user to delete
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: User account successfully deleted
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
 *                   example: "User account deleted successfully"
 *             example:
 *               status: success
 *               message: "User account deleted successfully"
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User does not have admin privileges
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: "You do not have permission to perform this action"
 *               statusCode: 403
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               status: fail
 *               message: "User not found"
 *               statusCode: 404
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/:id", getUserById);
router.patch("/:id/active", setUserActiveStatus);
router.patch("/:id/lock", setUserLockStatus);

export default router;
