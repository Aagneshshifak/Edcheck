const mongoose = require('mongoose');

const aiQuestionSchema = new mongoose.Schema({
    questionText:  { type: String, required: true },
    options:       { type: [String], required: true },
    correctAnswer: { type: Number, required: true },   // 0-based index
    explanation:   { type: String, default: '' },
}, { _id: true });

const aiQuestionBankSchema = new mongoose.Schema({
    subjectId:      { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    topic:          { type: String, required: true },
    difficultyLevel:{ type: String, enum: ['easy', 'medium', 'hard'], required: true },
    questions:      { type: [aiQuestionSchema], default: [] },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', required: true },
    lastGenerated:  { type: Date, default: Date.now },
}, { timestamps: false });

// One bank per teacher+subject+topic+difficulty — upsert on re-generation
aiQuestionBankSchema.index({ subjectId: 1, topic: 1, difficultyLevel: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('aiquestionbank', aiQuestionBankSchema);
