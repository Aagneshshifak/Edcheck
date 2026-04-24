const mongoose = require('mongoose');

const topicPerformanceSchema = new mongoose.Schema({
    subjectId:      { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    classId:        { type: mongoose.Schema.Types.ObjectId, ref: 'sclass',  required: true },
    topic:          { type: String, required: true },
    averageScore:   { type: Number, required: true },   // 0-100
    severity:       { type: String, enum: ['low', 'medium', 'high'], required: true },
    weakStudents:   { type: Number, default: 0 },       // count of students below 50%
    suggestion:     { type: String, default: '' },      // clarification suggestion from AI
    lastAnalyzed:   { type: Date, default: Date.now },
}, { timestamps: false });

// Unique per subject+class+topic — upsert on re-analysis
topicPerformanceSchema.index({ subjectId: 1, classId: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('topicperformance', topicPerformanceSchema);
