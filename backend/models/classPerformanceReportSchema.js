const mongoose = require('mongoose');

const classPerformanceReportSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
        required: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    averageScore: {
        type: Number,
        min: 0,
        max: 100,
    },
    weakSubjects: [String],
    recommendations: [String],
    generatedAt: {
        type: Date,
        default: Date.now,
    },
});

classPerformanceReportSchema.index({ classId: 1 }, { unique: true });
classPerformanceReportSchema.index({ schoolId: 1 });

module.exports = mongoose.model('classPerformanceReport', classPerformanceReportSchema);
