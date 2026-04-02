const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
    actorId:    { type: mongoose.Schema.Types.ObjectId },          // who did it
    actorName:  { type: String, required: true },
    actorRole:  { type: String, enum: ['Admin', 'Teacher', 'System'], default: 'Admin' },
    action:     { type: String, required: true },                  // e.g. "added student"
    target:     { type: String },                                  // e.g. "Rahul Sharma"
    targetType: { type: String },                                  // e.g. "student", "assignment"
    details:    { type: String },                                  // extra context
    ip:         { type: String },
}, { timestamps: true });

activityLogSchema.index({ schoolId: 1, createdAt: -1 });

module.exports = mongoose.model('activityLog', activityLogSchema);
