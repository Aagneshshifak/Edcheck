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
// Standalone testId: teacher fetches all attempts for a test
testAttemptSchema.index({ testId: 1 });
// Progress chart: student's attempts sorted newest-first
testAttemptSchema.index({ studentId: 1, submittedAt: -1 });
// Filter completed attempts (submittedAt exists)
testAttemptSchema.index({ studentId: 1, submittedAt: 1 });

module.exports = mongoose.model("testAttempt", testAttemptSchema);
