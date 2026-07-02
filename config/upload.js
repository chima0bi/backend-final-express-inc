import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

// Switched from local disk storage to Cloudinary. Render's filesystem is
// ephemeral - any file written to disk gets wiped whenever the service
// restarts/redeploys/spins down from idle, which is why uploaded images
// could work immediately after upload but vanish later with no code or
// data change. Cloudinary stores files on persistent cloud storage and
// returns a permanent, absolute URL, so this can't happen again regardless
// of how often Render restarts the backend.
//
// req.file.path / req.files[field][i].path now contains the full Cloudinary
// URL directly, not a local filename - controllers read .path instead of
// building a path from .filename + a "/uploads/..." prefix. The frontend's
// resolveMediaUrl() helper already passes absolute URLs straight through
// unchanged, so no frontend change is needed beyond what's already there.

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const ALLOWED_DOCUMENT_TYPES = ["application/pdf", ...ALLOWED_IMAGE_TYPES]; // certificates can be PDF or image

const serviceStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "express-inc/services",
    resource_type: file.mimetype.startsWith("video") ? "video" : "image",
    public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  }),
});

const portfolioStorage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => ({
    folder: "express-inc/portfolio",
    resource_type: file.mimetype.startsWith("video")
      ? "video"
      : file.mimetype === "application/pdf"
        ? "raw"
        : "image",
    public_id: `${file.fieldname}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  }),
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "images" && !ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, WEBP, or AVIF images are allowed"));
  }
  if (file.fieldname === "videos" && !ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only MP4, WEBM, or MOV videos are allowed"));
  }
  cb(null, true);
};

export const uploadServiceMedia = multer({
  storage: serviceStorage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 8, // total files (images + videos combined) per request
  },
});

// Provider portfolio (certificates, past-work photos/videos) - one file per
// request, used by user_route.js's portfolio endpoint.
export const uploadPortfolioItem = multer({
  storage: portfolioStorage,
  fileFilter: (req, file, cb) => {
    const allTypes = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES, ...ALLOWED_DOCUMENT_TYPES];
    if (!allTypes.includes(file.mimetype)) {
      return cb(new Error("Only images, videos, or PDF certificates are allowed"));
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
