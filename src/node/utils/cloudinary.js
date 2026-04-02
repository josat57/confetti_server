// Temporary mock implementation for cloudinary utilities
// This allows the document routes to work without actual cloudinary integration

export const upload = {
  single: (fieldName) => (req, res, next) => {
    // Mock multer middleware
    req.file = {
      originalname: "mock-file.pdf",
      mimetype: "application/pdf",
      size: 1024,
      path: "/tmp/mock-file.pdf",
    };
    next();
  },
};

export const uploadToCloudinary = async (
  file,
  folder = "confetti-documents"
) => {
  // Mock cloudinary upload
  return {
    public_id: `mock_${Date.now()}`,
    secure_url: `https://mock-cloudinary.com/${folder}/mock-file.pdf`,
    resource_type: "auto",
    format: "pdf",
    bytes: file.size || 1024,
  };
};

export const deleteFromCloudinary = async (publicId) => {
  // Mock cloudinary delete
  return {
    result: "ok",
  };
};

// Mock cloudinary default export
export default {
  config: () => {},
  uploader: {
    upload: uploadToCloudinary,
    destroy: deleteFromCloudinary,
  },
};
