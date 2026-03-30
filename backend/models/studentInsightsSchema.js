const mongoose = require("mongoose");

const studentInsightsSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student",
        required: true,
        unique: true
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    riskScore:       { type: Number, default: 0, min: 0, max: 100 },
    weakSubjects:    [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
    strongSubjects:  [{ type: mongoose.Schema.Types.ObjectId, ref: "subject" }],
    improvementRate: { type: Number, default: 0 },
    attendanceRate:  { type: Number, default: 100 },
    averageScore:    { type: Number, default: 0 },
    aiSummary:       { type: String },
    lastUpdated:     { type: Date, default: Date.now },
}, { timestamps: true });

studentInsightsSchema.index({ studentId: 1 });
studentInsightsSchema.index({ school: 1, riskScore: -1 });

module.exports = mongoose.model("studentInsights", studentInsightsSchema);
