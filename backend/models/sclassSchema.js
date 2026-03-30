const mongoose = require("mongoose");

const sclassSchema = new mongoose.Schema({
    className: { type: String },   // spec field name
    sclassName: { type: String },  // backward-compat alias

    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },
    // backward-compat alias
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },

    students: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "student"
    }],
}, { timestamps: true });

sclassSchema.pre("save", function (next) {
    if (this.className  && !this.sclassName) this.sclassName = this.className;
    if (this.sclassName && !this.className)  this.className  = this.sclassName;
    if (this.schoolId   && !this.school)     this.school     = this.schoolId;
    if (this.school     && !this.schoolId)   this.schoolId   = this.school;
    next();
});

sclassSchema.index({ schoolId: 1 });

module.exports = mongoose.model("sclass", sclassSchema);
