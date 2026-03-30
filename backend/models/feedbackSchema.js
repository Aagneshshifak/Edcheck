const mongoose = require("mongoose");

// Replaces the old complainSchema
const feedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "userModel"
    },
    userModel: {
        type: String,
        required: true,
        enum: ["student", "teacher", "parent"]
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    category: {
        type: String,
        enum: ["academic", "behavioral", "infrastructure", "other"],
        required: true
    },
    priority: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "low"
    },
    status: {
        type: String,
        enum: ["open", "in_progress", "resolved"],
        default: "open"
    },
    message:    { type: String, required: true },
    date:       { type: Date, default: Date.now },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "admin" },
}, { timestamps: true });

feedbackSchema.index({ schoolId: 1, status: 1 });
feedbackSchema.index({ userId: 1 });
feedbackSchema.index({ priority: 1 });

module.exports = mongoose.model("feedback", feedbackSchema);
