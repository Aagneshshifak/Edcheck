const mongoose = require('mongoose');

const schoolPerformanceReportSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
        unique: true,
    },
    overallAverageScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    topClasses: [String],
    weakSubjects: [String],
    academicTrend: {
        type: String,
    },
    generatedAt: {
        type: Date,
        default: Date.now,
    },
});

schoolPerformanceReportSchema.index({ schoolId: 1 }, { unique: true });

module.exports = mongoose.model('schoolPerformanceReport', schoolPerformanceReportSchema);
