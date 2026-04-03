const cloudinary = require('../config/cloudinary');

/**
 * POST /api/upload/files
 * Accepts: multipart/form-data, field name "files" (multiple)
 * Returns: array of { fileName, fileUrl, fileType, publicId, size }
 *
 * Uses cloudinaryUpload middleware (set in route).
 */
const uploadFiles = (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded.' });
        }

        const uploaded = req.files.map(f => ({
            fileName:  f.originalname,
            fileUrl:   f.path,                                    // Cloudinary secure URL
            fileType:  f.originalname.split('.').pop().toLowerCase(),
            publicId:  f.filename,                                // Cloudinary public_id
            size:      f.size,
        }));

        return res.status(201).json({ files: uploaded });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * DELETE /api/upload/delete/:publicId
 * Deletes a file from Cloudinary by its public_id.
 * publicId may contain slashes — encode as base64 in the URL param.
 */
const deleteFile = async (req, res) => {
    try {
        // Accept either raw publicId or base64-encoded (for IDs with slashes)
        let publicId = req.params.publicId;
        try {
            const decoded = Buffer.from(publicId, 'base64').toString('utf8');
            if (decoded.includes('/') || decoded.includes('-')) publicId = decoded;
        } catch (_) {}

        const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });

        // If raw fails, try image resource type
        if (result.result === 'not found') {
            const imgResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
            return res.json({ result: imgResult.result, publicId });
        }

        return res.json({ result: result.result, publicId });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { uploadFiles, deleteFile };
