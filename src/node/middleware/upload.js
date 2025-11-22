import multer from "multer";
import path from "path";
import { AppError } from "../utils/AppError.js";

// Use memory storage for GridFS uploads
const storage = multer.memoryStorage();

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new AppError(
        "Only image files are allowed (jpeg, jpg, png, gif, webp)",
        400
      )
    );
  }
};

// File filter for media (images and videos)
const mediaFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|wmv/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = /image|video/.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(
      new AppError(
        "Only image and video files are allowed (jpeg, jpg, png, gif, webp, mp4, mov, avi, wmv)",
        400
      )
    );
  }
};

// Upload middleware for logo
export const uploadLogo = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single("logo");

// Upload middleware for media
export const uploadMedia = multer({
  storage: storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
}).single("media");

// Upload middleware for multiple media files
export const uploadMultipleMedia = multer({
  storage: storage,
  fileFilter: mediaFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  },
}).array("media", 10); // Max 10 files

// General upload middleware for single image
export const upload = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Upload middleware for profile image
export const uploadProfileImage = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
}).single("profileImage");

// Upload middleware for cover photo
export const uploadCoverPhoto = multer({
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for cover photos
  },
}).single("coverPhoto");
