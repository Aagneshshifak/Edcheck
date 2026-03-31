const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
    title:   { type: String, required: true },
    details: { type: String, required: true },
    date:    { type: Date, required: true },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    // backward-compat alias
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },
    audience: {
        type: String,
        enum: ["students", "teachers", "parents", "all"],
        default: "all"
    },
}, { timestamps: true });

noticeSchema.pre("save", function (next) {
    if (this.schoolId && !this.school) this.school   = this.schoolId;
    if (this.school   && !this.schoolId) this.schoolId = this.school;
    next();
});

noticeSchema.index({ schoolId: 1 });
noticeSchema.index({ audience: 1 });
// Dashboard: school notices sorted newest-first
noticeSchema.index({ schoolId: 1, date: -1 });
// Audience-filtered notice list
noticeSchema.index({ schoolId: 1, audience: 1, date: -1 });

module.exports = mongoose.model("notice", noticeSchema);
