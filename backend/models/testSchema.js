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
    // questionType: used by the evaluation engine for type-specific grading.
    questionType:  { type: String, enum: ['mcq', 'true_false', 'numerical', 'short_answer', 'file_upload'], default: 'mcq' },
    // difficulty: determines mastery difficulty weighting.
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard', 'challenge'], default: 'medium' },
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
