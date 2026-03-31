const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
    title:       { type: String, required: true },
    description: { type: String },
    topic:       { type: String, required: true },
    dueDate:     { type: Date, required: true },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subject",
        required: true
    },
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass",
        required: true
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teacher"
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

assignmentSchema.index({ subject: 1 });
assignmentSchema.index({ sclassName: 1 });
assignmentSchema.index({ school: 1 });
// Compound: dashboard query — active assignments for a class sorted by due date
assignmentSchema.index({ sclassName: 1, isActive: 1, dueDate: 1 });
// Compound: subject-scoped assignment list
assignmentSchema.index({ subject: 1, isActive: 1 });

module.exports = mongoose.model("assignment", assignmentSchema);
