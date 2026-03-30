const mongoose = require("mongoose");

const testAttemptSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student",
        required: true
    },
    testId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "test",
        required: true
    },
    answers:        { type: [Number], default: [] },
    score:          { type: Number },
    totalMarks:     { type: Number },
    submittedAt:    { type: Date },
    submissionType: { type: String, enum: ["manual", "auto"] },
    startedAt:      { type: Date },
}, { timestamps: true });

testAttemptSchema.index({ studentId: 1, testId: 1 }, { unique: true });

module.exports = mongoose.model("testAttempt", testAttemptSchema);
