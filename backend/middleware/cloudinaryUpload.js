const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary from env vars
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_FORMATS = ["pdf", "ppt", "pptx", "doc", "docx", "jpg", "jpeg", "png"];

const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
        const ext = file.originalname.split(".").pop().toLowerCase();
        return {
            folder:         "school-assignments",
            resource_type:  "auto",          // handles non-image files
            format:         ext,
            public_id:      `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
            allowed_formats: ALLOWED_FORMATS,
        };
    },
});

const fileFilter = (req, file, cb) => {
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (ALLOWED_FORMATS.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed. Accepted: ${ALLOWED_FORMATS.join(", ")}`));
    }
};

const cloudinaryUpload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

module.exports = cloudinaryUpload;
