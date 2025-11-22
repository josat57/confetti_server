import express from "express";
import { protect, restrictTo } from "../middleware/auth.js";
import {
  uploadLogo as uploadLogoMiddleware,
  uploadMedia as uploadMediaMiddleware,
} from "../middleware/upload.js";
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
  addReview,
  // Profile management endpoints
  getOwnProfile,
  updateProfile,
  uploadLogo,
  uploadMedia,
  deleteMedia,
  updateBranding,
  getProfileStats,
  // Search & Discovery endpoints
  getFeaturedVendors,
  trackProfileView,
  getPublicProfile,
  getCategories,
  getPopularLocations,
} from "../controllers/vendor.controller.js";

// Portfolio management endpoints
import {
  getPortfolioItems,
  getPortfolioItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  publishPortfolioItem,
  archivePortfolioItem,
  addPhotos,
  deletePhoto,
} from "../controllers/portfolio.controller.js";

const router = express.Router();

// Public routes

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: List all vendors
 *     description: Retrieve a paginated list of vendors with optional filtering by category, location, price range, and rating. This endpoint is publicly accessible and does not require authentication.
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [venue, catering, entertainment, photography, videography, decoration, florals, transportation, audio_visual, event_planning, security, valet_parking, rentals, cake_desserts, bar_services, lighting, invitations, favors_gifts, other]
 *         description: Filter vendors by category
 *         example: catering
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter vendors by city or location
 *         example: New York
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price range filter
 *         example: 1000
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price range filter
 *         example: 10000
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter (0-5)
 *         example: 4.0
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of vendors per page
 *         example: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [rating, -rating, name, -name, createdAt, -createdAt]
 *         description: Sort order (prefix with - for descending)
 *         example: -rating
 *     responses:
 *       200:
 *         description: Successfully retrieved vendor list
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
 *                     vendors:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vendor'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 45
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         pages:
 *                           type: integer
 *                           example: 5
 *                         limit:
 *                           type: integer
 *                           example: 10
 *       400:
 *         description: Invalid query parameters
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
router.get("/", listVendors);

/**
 * @swagger
 * /vendors/search:
 *   get:
 *     summary: Search vendors with advanced filters
 *     description: Search for vendors using text query and multiple filters including category, location, price range, rating, and more
 *     tags: [Vendors - Search & Discovery]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Text search query
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location (city or state)
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *         description: Minimum rating (0-5)
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: features
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by features
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -stats.averageRating
 *     responses:
 *       200:
 *         description: Search results with pagination
 */
router.get("/search", searchVendors);

/**
 * @swagger
 * /vendors/featured:
 *   get:
 *     summary: Get featured vendors
 *     description: Retrieve a list of featured vendors with active featured status
 *     tags: [Vendors - Search & Discovery]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Successfully retrieved featured vendors
 */
router.get("/featured", getFeaturedVendors);

/**
 * @swagger
 * /vendors/categories:
 *   get:
 *     summary: Get vendor categories with counts
 *     description: Retrieve all vendor categories with vendor counts and average ratings
 *     tags: [Vendors - Search & Discovery]
 *     responses:
 *       200:
 *         description: Successfully retrieved categories
 */
router.get("/categories", getCategories);

/**
 * @swagger
 * /vendors/locations:
 *   get:
 *     summary: Get popular locations
 *     description: Retrieve popular locations where vendors are available
 *     tags: [Vendors - Search & Discovery]
 *     responses:
 *       200:
 *         description: Successfully retrieved locations
 */
router.get("/locations", getPopularLocations);

/**
 * @swagger
 * /vendors/{id}/public:
 *   get:
 *     summary: Get public vendor profile
 *     description: Retrieve comprehensive public profile including portfolio and reviews
 *     tags: [Vendors - Search & Discovery]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Successfully retrieved public profile
 *       404:
 *         description: Vendor not found
 */
router.get("/:id/public", getPublicProfile);

/**
 * @swagger
 * /vendors/{id}/track-view:
 *   post:
 *     summary: Track profile view
 *     description: Increment profile view counter for analytics
 *     tags: [Vendors - Search & Discovery]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Profile view tracked successfully
 *       404:
 *         description: Vendor not found
 */
router.post("/:id/track-view", trackProfileView);

// Note: /:id route moved to end of file to avoid conflicts with specific routes like /leads, /profile, etc.

// Protected routes (require authentication)
router.use(protect);

// ============================================
// VENDOR DASHBOARD - PROFILE MANAGEMENT
// ============================================

/**
 * @swagger
 * /vendors/profile:
 *   get:
 *     summary: Get own vendor profile
 *     description: Retrieve the authenticated vendor's own profile with subscription details
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved vendor profile
 *       404:
 *         description: Vendor profile not found
 */
router.get("/profile", getOwnProfile);

/**
 * @swagger
 * /vendors/profile:
 *   put:
 *     summary: Update vendor profile
 *     description: Update the authenticated vendor's profile information
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessName:
 *                 type: string
 *               displayName:
 *                 type: string
 *               tagline:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               category:
 *                 type: string
 *               businessType:
 *                 type: string
 *               eventTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *               address:
 *                 type: object
 *               serviceArea:
 *                 type: object
 *               businessHours:
 *                 type: array
 *               socialMedia:
 *                 type: object
 *               priceRange:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       404:
 *         description: Vendor profile not found
 */
router.put("/profile", updateProfile);

/**
 * @swagger
 * /vendors/profile/logo:
 *   post:
 *     summary: Upload vendor logo
 *     description: Upload or update the vendor's logo
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - logoUrl
 *             properties:
 *               logoUrl:
 *                 type: string
 *                 description: URL of the uploaded logo
 *     responses:
 *       200:
 *         description: Logo uploaded successfully
 *       400:
 *         description: Logo URL is required
 *       404:
 *         description: Vendor profile not found
 */
router.post("/profile/logo", uploadLogoMiddleware, uploadLogo);

/**
 * @swagger
 * /vendors/profile/media:
 *   post:
 *     summary: Upload media (photos/videos)
 *     description: Upload photos or videos to vendor profile
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - url
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [photo, video]
 *               url:
 *                 type: string
 *               caption:
 *                 type: string
 *               thumbnail:
 *                 type: string
 *               title:
 *                 type: string
 *               duration:
 *                 type: number
 *     responses:
 *       200:
 *         description: Media uploaded successfully
 *       400:
 *         description: Invalid media type or missing required fields
 *       404:
 *         description: Vendor profile not found
 */
router.post("/profile/media", uploadMediaMiddleware, uploadMedia);

/**
 * @swagger
 * /vendors/profile/media/{id}:
 *   delete:
 *     summary: Delete media
 *     description: Delete a photo or video from vendor profile
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Media item ID
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [photo, video]
 *         description: Type of media to delete
 *     responses:
 *       200:
 *         description: Media deleted successfully
 *       400:
 *         description: Invalid media type
 *       404:
 *         description: Vendor profile not found
 */
router.delete("/profile/media/:id", deleteMedia);

/**
 * @swagger
 * /vendors/profile/branding:
 *   put:
 *     summary: Update branding (Professional+ only)
 *     description: Update vendor branding customization. Requires Professional plan or higher.
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primaryColor:
 *                 type: string
 *                 example: "#FF5733"
 *               secondaryColor:
 *                 type: string
 *                 example: "#33FF57"
 *               font:
 *                 type: string
 *                 example: "Roboto"
 *               customCSS:
 *                 type: string
 *     responses:
 *       200:
 *         description: Branding updated successfully
 *       403:
 *         description: Requires Professional plan or higher
 *       404:
 *         description: Vendor profile not found
 */
router.put("/profile/branding", updateBranding);

/**
 * @swagger
 * /vendors/profile/stats:
 *   get:
 *     summary: Get profile statistics
 *     description: Get vendor profile statistics including views, bookings, and ratings
 *     tags: [Vendor Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved profile statistics
 *       404:
 *         description: Vendor profile not found
 */
router.get("/profile/stats", getProfileStats);

// ============================================
// PORTFOLIO MANAGEMENT
// ============================================

/**
 * @swagger
 * /vendors/portfolio:
 *   get:
 *     summary: Get all portfolio items
 *     description: Retrieve all portfolio items for the authenticated vendor with filtering and pagination
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by portfolio status
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *         description: Filter by event type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Successfully retrieved portfolio items
 *       404:
 *         description: Vendor profile not found
 */
router.get("/portfolio", getPortfolioItems);

/**
 * @swagger
 * /vendors/portfolio:
 *   post:
 *     summary: Create portfolio item
 *     description: Create a new portfolio item for the authenticated vendor
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - eventType
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date
 *               location:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isFeatured:
 *                 type: boolean
 *               coverPhoto:
 *                 type: string
 *     responses:
 *       201:
 *         description: Portfolio item created successfully
 *       404:
 *         description: Vendor profile not found
 */
router.post("/portfolio", createPortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}:
 *   get:
 *     summary: Get single portfolio item
 *     description: Retrieve a specific portfolio item by ID
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Successfully retrieved portfolio item
 *       404:
 *         description: Portfolio item not found
 */
router.get("/portfolio/:id", getPortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}:
 *   put:
 *     summary: Update portfolio item
 *     description: Update an existing portfolio item
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               eventType:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date
 *               location:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               isFeatured:
 *                 type: boolean
 *               coverPhoto:
 *                 type: string
 *     responses:
 *       200:
 *         description: Portfolio item updated successfully
 *       404:
 *         description: Portfolio item not found
 */
router.put("/portfolio/:id", updatePortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}:
 *   delete:
 *     summary: Delete portfolio item
 *     description: Delete a portfolio item permanently
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Portfolio item deleted successfully
 *       404:
 *         description: Portfolio item not found
 */
router.delete("/portfolio/:id", deletePortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}/publish:
 *   post:
 *     summary: Publish portfolio item
 *     description: Change portfolio item status to published
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Portfolio item published successfully
 *       404:
 *         description: Portfolio item not found
 */
router.post("/portfolio/:id/publish", publishPortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}/archive:
 *   post:
 *     summary: Archive portfolio item
 *     description: Change portfolio item status to archived
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     responses:
 *       200:
 *         description: Portfolio item archived successfully
 *       404:
 *         description: Portfolio item not found
 */
router.post("/portfolio/:id/archive", archivePortfolioItem);

/**
 * @swagger
 * /vendors/portfolio/{id}/photos:
 *   post:
 *     summary: Add photos to portfolio item
 *     description: Add one or more photos to a portfolio item
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - photos
 *             properties:
 *               photos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     caption:
 *                       type: string
 *     responses:
 *       200:
 *         description: Photos added successfully
 *       400:
 *         description: Photos array is required
 *       404:
 *         description: Portfolio item not found
 */
router.post("/portfolio/:id/photos", addPhotos);

/**
 * @swagger
 * /vendors/portfolio/{id}/photos/{photoId}:
 *   delete:
 *     summary: Delete photo from portfolio item
 *     description: Remove a specific photo from a portfolio item
 *     tags: [Vendor Dashboard - Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Portfolio item ID
 *       - in: path
 *         name: photoId
 *         required: true
 *         schema:
 *           type: string
 *         description: Photo ID
 *     responses:
 *       200:
 *         description: Photo deleted successfully
 *       404:
 *         description: Portfolio item not found
 */
router.delete("/portfolio/:id/photos/:photoId", deletePhoto);

// ============================================
// VENDOR CRUD OPERATIONS
// ============================================

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create a new vendor
 *     description: Create a new vendor profile. This endpoint requires authentication and admin privileges. Only administrators can create vendor profiles in the system.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - category
 *               - description
 *             properties:
 *               name:
 *                 type: string
 *                 example: Elite Catering Services
 *                 description: Vendor business name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@elitecatering.com
 *                 description: Vendor contact email
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *                 description: Vendor contact phone
 *               businessType:
 *                 type: string
 *                 enum: [catering, venue, decoration, photography, music, other]
 *                 example: catering
 *                 description: Type of business
 *               category:
 *                 type: string
 *                 enum: [venue, catering, entertainment, photography, videography, decoration, florals, transportation, audio_visual, event_planning, security, valet_parking, rentals, cake_desserts, bar_services, lighting, invitations, favors_gifts, other]
 *                 example: catering
 *                 description: Vendor category
 *               description:
 *                 type: string
 *                 example: Premium catering services for all types of events
 *                 description: Vendor description
 *               priceRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 1000
 *                   max:
 *                     type: number
 *                     example: 10000
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: 456 Business Ave
 *                   city:
 *                     type: string
 *                     example: New York
 *                   state:
 *                     type: string
 *                     example: NY
 *                   country:
 *                     type: string
 *                     example: USA
 *                   zipCode:
 *                     type: string
 *                     example: 10002
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Full Course Meal
 *                     description:
 *                       type: string
 *                       example: Complete meal service for events
 *                     price:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                           example: 50
 *                         currency:
 *                           type: string
 *                           example: USD
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [Organic ingredients, Custom menus, Dietary accommodations]
 *     responses:
 *       201:
 *         description: Vendor successfully created
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
 *                     vendor:
 *                       $ref: '#/components/schemas/Vendor'
 *       400:
 *         description: Invalid input data
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
 *         description: Forbidden - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Vendor with this email already exists
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
router.post("/", createVendor);

/**
 * @swagger
 * /vendors/{id}:
 *   patch:
 *     summary: Update vendor information
 *     description: Update an existing vendor's profile information. This endpoint requires authentication. Vendors can update their own profiles, while administrators can update any vendor profile.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique vendor identifier
 *         example: 507f1f77bcf86cd799439013
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Elite Catering Services
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@elitecatering.com
 *               phone:
 *                 type: string
 *                 example: +1234567890
 *               description:
 *                 type: string
 *                 example: Premium catering services for all types of events
 *               priceRange:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 1000
 *                   max:
 *                     type: number
 *                     example: 10000
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: 456 Business Ave
 *                   city:
 *                     type: string
 *                     example: New York
 *                   state:
 *                     type: string
 *                     example: NY
 *                   country:
 *                     type: string
 *                     example: USA
 *                   zipCode:
 *                     type: string
 *                     example: 10002
 *               services:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     price:
 *                       type: object
 *                       properties:
 *                         amount:
 *                           type: number
 *                         currency:
 *                           type: string
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: [https://example.com/image1.jpg, https://example.com/image2.jpg]
 *     responses:
 *       200:
 *         description: Vendor successfully updated
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
 *                     vendor:
 *                       $ref: '#/components/schemas/Vendor'
 *       400:
 *         description: Invalid input data
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
 *         description: Forbidden - Insufficient permissions to update this vendor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Vendor not found
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
router.patch("/:id", updateVendor);

/**
 * @swagger
 * /vendors/{id}:
 *   delete:
 *     summary: Delete a vendor
 *     description: Delete a vendor profile from the system. This endpoint requires authentication and admin privileges. Only administrators can delete vendor profiles. This action is permanent and cannot be undone.
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique vendor identifier
 *         example: 507f1f77bcf86cd799439013
 *     responses:
 *       200:
 *         description: Vendor successfully deleted
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
 *                   example: Vendor successfully deleted
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Vendor not found
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
router.delete("/:id", deleteVendor);

router.post("/:id/services", addOrUpdateService);
router.post("/:id/portfolio", addOrUpdatePortfolioItem);
router.post("/:id/availability", manageAvailability);
router.post("/:id/reviews", addReview);

/**
 * @swagger
 * /vendors/{id}:
 *   get:
 *     summary: Get vendor details
 *     description: Retrieve detailed information about a specific vendor by their ID. This endpoint is publicly accessible and returns comprehensive vendor information including services, portfolio, and reviews.
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique vendor identifier
 *         example: 507f1f77bcf86cd799439013
 *     responses:
 *       200:
 *         description: Successfully retrieved vendor details
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
 *                     vendor:
 *                       $ref: '#/components/schemas/Vendor'
 *       404:
 *         description: Vendor not found
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
router.get("/:id", getVendor);

export default router;
