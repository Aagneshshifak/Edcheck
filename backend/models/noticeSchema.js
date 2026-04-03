const mongoose = require("mongoose");

const noticeSchema = new mongoose.Schema({
    title:   { type: String, required: true },
    details: { type: String, required: true },
    date:    { type: Date, required: true },

    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "admin", required: true },
    school:   { type: mongoose.Schema.Types.ObjectId, ref: "admin" }, // backward-compat alias

    // Who sees this notice
    audience: {
        type: String,
        enum: ["students", "teachers", "parents", "all"],
        default: "all",
    },

    // Targeted delivery — optional
    targetType: {
        type: String,
        enum: ["class", "student", "teacher", "parent", "all"],
        default: "all",
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },

    // File attachments
    attachments: [{
        fileName: { type: String, required: true },
        fileUrl:  { type: String, required: true },
        fileType: { type: String },
        publicId: { type: String },
        _id: false,
    }],
}, { timestamps: true });

noticeSchema.pre("save", function (next) {
    if (this.schoolId && !this.school)   this.school   = this.schoolId;
    if (this.school   && !this.schoolId) this.schoolId = this.school;
    next();
});

noticeSchema.index({ schoolId: 1 });
noticeSchema.index({ audience: 1 });
noticeSchema.index({ schoolId: 1, date: -1 });
noticeSchema.index({ schoolId: 1, audience: 1, date: -1 });
noticeSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("notice", noticeSchema);
