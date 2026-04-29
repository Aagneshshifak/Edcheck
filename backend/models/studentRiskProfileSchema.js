const mongoose = require('mongoose');

const studentRiskProfileSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    },
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'test',
    },
    riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        required: true,
    },
    weakSubjects: [String],
    suggestedActions: [String],
    generatedAt: {
        type: Date,
        default: Date.now,
    },
});

studentRiskProfileSchema.index({ studentId: 1, testId: 1 }, { unique: true });
studentRiskProfileSchema.index({ schoolId: 1 });

module.exports = mongoose.model('studentRiskProfile', studentRiskProfileSchema);
