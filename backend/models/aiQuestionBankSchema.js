const mongoose = require('mongoose');

const aiQuestionSchema = new mongoose.Schema({
    questionText:   { type: String, required: true },
    options:        { type: [String], default: [] },
    correctAnswer:  { type: mongoose.Schema.Types.Mixed },   // Number (MCQ index) or String (short_answer)
    explanation:    { type: String, default: '' },
    questionType:   { type: String, enum: ['mcq', 'true_false', 'numerical', 'short_answer', 'sentence_answer'], default: 'mcq' },
    subtopic:       { type: String, default: null },
    // sentence_answer specific fields
    expectedAnswer: { type: String, default: null },
    keyConcepts:    { type: [String], default: [] },
    scoringRubric:  { type: mongoose.Schema.Types.Mixed, default: null },
    // question metadata
    validationStatus:  { type: String, enum: ['VALIDATING', 'VALID', 'INVALID', 'REQUIRES_REVIEW'], default: 'VALIDATING' },
    validationScore:   { type: Number, default: 0 },
    validationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    // ── Curriculum mapping fields ──
    curriculumMeta: {
        classId:       { type: mongoose.Schema.Types.ObjectId, ref: 'sclass' },
        subjectId:     { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
        domain:        { type: String },
        chapter:       { type: String },
        subtopic:      { type: String },
        concept:       { type: String },
        source:        { type: String, default: 'CBSE' },
        academicYear:  { type: String, default: '2026-27' },
        curriculumVersion: { type: String, default: '1.0' }
    },
    
    // ── Teacher manual override validation ──
    teacherValidation: {
        validatedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'admin' }, // admin or teacher
        validatedAt:    { type: Date },
        teacherComment: { type: String }
    },
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
