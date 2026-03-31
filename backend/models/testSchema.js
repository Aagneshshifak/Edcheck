const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
    questionText:  { type: String, required: true },
    options:       {
        type: [String],
        validate: {
            validator: (arr) => arr.length >= 2 && arr.length <= 6,
            message: "options must have between 2 and 6 items"
        }
    },
    correctAnswer: { type: Number },
    marks:         {
        type: Number,
        validate: {
            validator: (v) => v > 0,
            message: "marks must be greater than 0"
        }
    }
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
// Subject-scoped test lookup
testSchema.index({ subject: 1 });
// Teacher: tests created by a specific teacher
testSchema.index({ createdBy: 1 });

module.exports = mongoose.model("test", testSchema);
