const mongoose = require("mongoose");

// Individual file entry within a submission
const fileEntrySchema = new mongoose.Schema({
    fileName:  { type: String, required: true },
    fileUrl:   { type: String, required: true },  // Cloudinary secure URL or local path
    fileType:  { type: String },                  // pdf, pptx, docx, jpg, png …
    publicId:  { type: String },                  // Cloudinary public_id for deletion
    size:      { type: Number },                  // bytes
}, { _id: false });

const submissionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student",
        required: true,
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "assignment",
        required: true,
    },

    // ── Multi-file support ────────────────────────────────────────────────────
    files: { type: [fileEntrySchema], default: [] },

    // ── Legacy single-file fields (kept for backward compat) ─────────────────
    fileUrl:  { type: String },
    fileName: { type: String },
    fileType: { type: String },

    submittedAt: { type: Date, default: Date.now },
    grade:       { type: String },
    feedback:    { type: String },
    status: {
        type: String,
        enum: ["submitted", "graded", "late"],
        default: "submitted",
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true,
    },
}, { timestamps: true });

submissionSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });
submissionSchema.index({ assignmentId: 1 });
submissionSchema.index({ studentId: 1, status: 1 });
submissionSchema.index({ assignmentId: 1, submittedAt: -1 });

module.exports = mongoose.model("submission", submissionSchema);
