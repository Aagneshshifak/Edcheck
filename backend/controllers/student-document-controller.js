const StudentDocument = require('../models/studentDocumentSchema');
const cloudinary      = require('../config/cloudinary');

/**
 * GET /api/student-docs/:studentId
 * Returns all documents for a student.
 */
const getStudentDocuments = async (req, res) => {
    try {
        const record = await StudentDocument.findOne({ studentId: req.params.studentId });
        return res.json(record?.documents || []);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * POST /api/student-docs/:studentId
 * Upload one or more documents for a student.
 * Uses cloudinaryUpload middleware (set in route).
 */
const uploadStudentDocuments = async (req, res) => {
    try {
        const { studentId } = req.params;
        const rawFiles = req.files?.length ? req.files : req.file ? [req.file] : [];

        if (!rawFiles.length) return res.status(400).json({ message: 'No files uploaded.' });

        const newDocs = rawFiles.map(f => ({
            documentName: f.originalname,
            fileUrl:      f.path || `/uploads/${f.filename}`,
            fileType:     f.originalname.split('.').pop().toLowerCase(),
            publicId:     f.filename || null,
            size:         f.size || null,
            uploadedAt:   new Date(),
        }));

        const record = await StudentDocument.findOneAndUpdate(
            { studentId },
            { $push: { documents: { $each: newDocs } } },
            { upsert: true, new: true }
        );

        return res.status(201).json(record.documents);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * DELETE /api/student-docs/:studentId/:publicId
 * Remove a specific document (by publicId) from student's list and Cloudinary.
 */
const deleteStudentDocument = async (req, res) => {
    try {
        const { studentId, publicId } = req.params;
        const decodedId = decodeURIComponent(publicId);

        // Remove from Cloudinary
        try {
            await cloudinary.uploader.destroy(decodedId, { resource_type: 'raw' });
        } catch (_) {
            try { await cloudinary.uploader.destroy(decodedId, { resource_type: 'image' }); } catch (_) {}
        }

        // Remove from DB
        const record = await StudentDocument.findOneAndUpdate(
            { studentId },
            { $pull: { documents: { publicId: decodedId } } },
            { new: true }
        );

        return res.json(record?.documents || []);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getStudentDocuments, uploadStudentDocuments, deleteStudentDocument };
