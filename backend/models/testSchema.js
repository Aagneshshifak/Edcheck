const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
    questionText:  { type: String, required: true },
    options: {
        type: [String],
        validate: {
            validator: function(arr) {
                if (this.questionType === 'short_answer' || this.questionType === 'file_upload' || this.questionType === 'numerical') {
                    return true;
                }
                return arr.length >= 2 && arr.length <= 6;
            },
            message: "MCQ options must have between 2 and 6 items"
        }
    },
    correctAnswer: { type: Number },
    marks:         {
        type: Number,
        validate: {
            validator: (v) => v > 0,
            message: "marks must be greater than 0"
        }
    },
    // ── Adaptive learning fields (optional, added for pipeline support) ───
    // topic: e.g. "Algebra", "Photosynthesis". Used by the mastery engine.
    topic:         { type: String, default: null },
    // subtopic: e.g. "Quadratic Equations", "Mitosis" — granular coverage tracking
    subtopic:      { type: String, default: null },
    // questionType: used by the evaluation engine for type-specific grading.
    questionType:  { type: String, enum: ['mcq', 'true_false', 'numerical', 'short_answer', 'file_upload', 'sentence_answer'], default: 'mcq' },
    // difficulty: determines mastery difficulty weighting.
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard', 'challenge'], default: 'medium' },

    // ── Sentence / Descriptive Answer fields (sentence_answer type only) ──
    // expectedAnswer: model/reference answer for AI evaluation
    expectedAnswer: { type: String, default: null },
    // keyConcepts: list of concepts the AI checks for coverage
    keyConcepts:    { type: [String], default: [] },
    // scoringRubric: configurable dimension weights for AI evaluation
    // e.g. { conceptCoverage: 0.40, correctness: 0.30, relevance: 0.15, explanationQuality: 0.15 }
    scoringRubric:  { type: mongoose.Schema.Types.Mixed, default: null },
    // source: where this question came from
    source:         { type: String, enum: ['QUESTION_BANK', 'AI_GENERATED', 'MANUAL'], default: 'AI_GENERATED' },
    // ── Validation fields (for rigorous Curriculum-Aware pipeline) ──
    validationStatus:  { type: String, enum: ['VALIDATING', 'VALID', 'INVALID', 'REQUIRES_REVIEW'], default: 'VALIDATING' },
    validationScore:   { type: Number, default: 0 },
    validationDetails: { type: mongoose.Schema.Types.Mixed, default: {} }, // AI output reasons
    
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
}, { _id: false });

const testSchema = new mongoose.Schema({
    title: { type: String, required: true },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subject"
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass"
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teacher"
    },
    // Optional: if set, only this specific student sees the test (used for personalized adaptive tests)
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student"
    },
    durationMinutes: {
        type: Number,
        validate: {
            validator: (v) => v > 0,
            message: "durationMinutes must be greater than 0"
        }
    },
    questions:        { type: [questionSchema], default: [] },
    shuffleQuestions: { type: Boolean, default: false },
    isActive:         { type: Boolean, default: true },
    
    // ── Assessment Validation Pipeline Fields ──
    status: {
        type: String,
        enum: ['DRAFT', 'VALIDATING', 'PUBLISHED', 'FAILED', 'REQUIRES_REVIEW'],
        default: 'DRAFT'
    },
    validationMetadata: {
        validQuestions:   { type: Number, default: 0 },
        invalidQuestions: { type: Number, default: 0 },
        duplicates:       { type: Number, default: 0 },
        topicsCovered:    { type: Number, default: 0 },
        topicsRequired:   { type: Number, default: 0 },
        coverageComplete: { type: Boolean, default: false }
    }
}, { timestamps: true });

testSchema.index({ classId: 1 });
testSchema.index({ school: 1 });
// Dashboard: active tests for a class (student test list query)
testSchema.index({ classId: 1, isActive: 1 });
testSchema.index({ studentId: 1 });
// Subject-scoped test lookup
testSchema.index({ subject: 1 });
// Teacher: tests created by a specific teacher
testSchema.index({ createdBy: 1 });

module.exports = mongoose.model("test", testSchema);
