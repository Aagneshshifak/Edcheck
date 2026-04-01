const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    title:         { type: String },
    message:       { type: String, required: true },
    recipientType: { type: String },
    type: {
        type: String,
        enum: ["assignment", "test", "marks", "feedback", "announcement"],
        required: true,
    },
    readStatus: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, readStatus: 1 });
// Bell fetch: user's notifications newest-first (most common query)
notificationSchema.index({ userId: 1, createdAt: -1 });
// Unread count query
notificationSchema.index({ userId: 1, readStatus: 1, createdAt: -1 });

module.exports = mongoose.model("notification", notificationSchema);
