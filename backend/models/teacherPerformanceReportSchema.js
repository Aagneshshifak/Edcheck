const mongoose = require('mongoose');

const teacherPerformanceReportSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'teacher',
        required: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    performanceScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    subjectPerformanceTrend: {
        type: String,
    },
    recommendations: [String],
    generatedAt: {
        type: Date,
        default: Date.now,
    },
});

teacherPerformanceReportSchema.index({ teacherId: 1 }, { unique: true });
teacherPerformanceReportSchema.index({ schoolId: 1 });

module.exports = mongoose.model('teacherPerformanceReport', teacherPerformanceReportSchema);
