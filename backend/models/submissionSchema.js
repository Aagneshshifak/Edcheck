const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student",
        required: true
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "assignment",
        required: true
    },
    fileUrl:      { type: String, required: true },  // local path: /uploads/filename
    fileName:     { type: String, required: true },
    fileType:     { type: String },                  // pdf, pptx, docx, jpg, png
    submittedAt:  { type: Date, default: Date.now },
    grade:        { type: String },
    feedback:     { type: String },
    status: {
        type: String,
        enum: ["submitted", "graded", "late"],
        default: "submitted"
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
}, { timestamps: true });

submissionSchema.index({ studentId: 1, assignmentId: 1 }, { unique: true });
submissionSchema.index({ assignmentId: 1 });

module.exports = mongoose.model("submission", submissionSchema);
