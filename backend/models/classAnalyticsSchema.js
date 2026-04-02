const mongoose = require("mongoose");

const classAnalyticsSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass",
        required: true,
        unique: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    averageMarks:     { type: Number, default: 0, min: 0, max: 100 },
    attendanceRate:   { type: Number, default: 100, min: 0, max: 100 },
    weakSubjects:     [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
    performanceScore: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdated:      { type: Date, default: Date.now },
}, { timestamps: true });

classAnalyticsSchema.index({ classId: 1 }, { unique: true });
classAnalyticsSchema.index({ schoolId: 1 });

module.exports = mongoose.model("classAnalytics", classAnalyticsSchema);
