const mongoose = require("mongoose");

const teacherAnalyticsSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teacher",
        required: true,
        unique: true
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    classPerformanceAverage:  { type: Number, default: 0 },
    studentImprovementRate:   { type: Number, default: 0 },
    attendanceDisciplineScore:{ type: Number, default: 0, min: 0, max: 100 },
    performanceScore:         { type: Number, default: 0, min: 0, max: 100 },
    feedbackCount:            { type: Number, default: 0 },
    aiAppraisal:              { type: String },
    lastUpdated:              { type: Date, default: Date.now },
}, { timestamps: true });

teacherAnalyticsSchema.index({ teacherId: 1 });
teacherAnalyticsSchema.index({ schoolId: 1, performanceScore: -1 });

module.exports = mongoose.model("teacherAnalytics", teacherAnalyticsSchema);
