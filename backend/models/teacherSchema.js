const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, unique: true, required: true },
    password: { type: String, required: true }, // bcrypt hashed
    phone:    { type: String },
    role:     { type: String, default: "Teacher" },

    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
    // alias kept for backward compatibility
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },

    teachSubjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "subject"
    }],
    teachClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass"
    }],

    // kept for backward compatibility with existing controllers
    teachSubject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "subject"
    },
    teachSclass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "sclass"
    },

    attendance: [{
        date:         { type: Date, required: true },
        presentCount: { type: Number, default: 0 },
        absentCount:  { type: Number, default: 0 },
    }],
}, { timestamps: true });

teacherSchema.pre("save", function (next) {
    if (this.schoolId && !this.school) this.school   = this.schoolId;
    if (this.school   && !this.schoolId) this.schoolId = this.school;
    next();
});

teacherSchema.index({ schoolId: 1 });
teacherSchema.index({ email: 1 });

module.exports = mongoose.model("teacher", teacherSchema);
