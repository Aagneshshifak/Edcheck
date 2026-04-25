const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    studentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true },
    testId:       { type: mongoose.Schema.Types.ObjectId, ref: 'test',    required: true },
    revisionPlan: { type: Object, required: true },
    generatedAt:  { type: Date, default: Date.now },
}, { timestamps: false });
schema.index({ studentId: 1, testId: 1 }, { unique: true });
module.exports = mongoose.model('studenttestprep', schema);
