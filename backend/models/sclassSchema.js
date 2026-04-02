const mongoose = require("mongoose");

const sclassSchema = new mongoose.Schema({
    // Primary field (required)
    className: { type: String, required: true },
    // Backward-compat alias — kept in sync via pre-save hook
    sclassName: { type: String },

    section: { type: String, default: '' },

    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "admin", required: true },
    // Backward-compat alias
    school:   { type: mongoose.Schema.Types.ObjectId, ref: "admin" },

    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', default: null },

    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'subject' }],

    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'student' }],

    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

}, { timestamps: true });

// Keep aliases in sync
sclassSchema.pre("save", function (next) {
    if (this.className  && !this.sclassName) this.sclassName = this.className;
    if (this.sclassName && !this.className)  this.className  = this.sclassName;
    if (this.schoolId   && !this.school)     this.school     = this.schoolId;
    if (this.school     && !this.schoolId)   this.schoolId   = this.school;
    next();
});

// Indexes
sclassSchema.index({ className: 1 });
sclassSchema.index({ schoolId: 1 });
// Unique class name + section per school
sclassSchema.index({ className: 1, section: 1, schoolId: 1 }, { unique: true });

module.exports = mongoose.model("sclass", sclassSchema);
