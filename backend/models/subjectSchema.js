const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    subjectName: { type: String },  // spec field name
    subName:     { type: String },  // backward-compat alias

    subjectCode: { type: String },  // spec field name
    subCode:     { type: String },  // backward-compat alias

    sessions: { type: Number, default: 30 },

    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },

    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass"
    },
    sclassName: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass"
    },

    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teacher"
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "teacher"
    },

    topics: [{ type: String }],

}, { timestamps: true });

subjectSchema.pre("save", function (next) {
    if (this.subjectName && !this.subName)     this.subName     = this.subjectName;
    if (this.subName     && !this.subjectName) this.subjectName = this.subName;
    if (this.subjectCode && !this.subCode)     this.subCode     = this.subjectCode;
    if (this.subCode     && !this.subjectCode) this.subjectCode = this.subCode;
    if (this.schoolId    && !this.school)      this.school      = this.schoolId;
    if (this.school      && !this.schoolId)    this.schoolId    = this.school;
    if (this.classId     && !this.sclassName)  this.sclassName  = this.classId;
    if (this.sclassName  && !this.classId)     this.classId     = this.sclassName;
    if (this.teacherId   && !this.teacher)     this.teacher     = this.teacherId;
    if (this.teacher     && !this.teacherId)   this.teacherId   = this.teacher;
    next();
});

subjectSchema.index({ schoolId: 1 });
subjectSchema.index({ classId: 1 });
subjectSchema.index({ teacherId: 1 });

module.exports = mongoose.model("subject", subjectSchema);
