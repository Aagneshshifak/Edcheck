const mongoose = require("mongoose");

const teacherAttendanceSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "teacher", required: true },
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: "admin", required: true },
  date:      { type: String, required: true }, // "YYYY-MM-DD"
  status:    { type: String, enum: ["present", "absent"], required: true },
}, { timestamps: true });

teacherAttendanceSchema.index({ teacherId: 1, date: 1 }, { unique: true });
teacherAttendanceSchema.index({ schoolId: 1 });

module.exports = mongoose.model("teacherAttendance", teacherAttendanceSchema);
