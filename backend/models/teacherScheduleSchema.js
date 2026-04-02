const mongoose = require("mongoose");

const schedPeriodSchema = new mongoose.Schema({
  classId:      { type: mongoose.Schema.Types.ObjectId, ref: "sclass" },
  subjectId:    { type: mongoose.Schema.Types.ObjectId, ref: "subject" },
  periodNumber: { type: Number, required: true },
  startTime:    { type: String, required: true },
  endTime:      { type: String, required: true },
}, { _id: false });

const teacherScheduleSchema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "teacher", required: true },
  dayOfWeek: { type: String, enum: ["Mon","Tue","Wed","Thu","Fri","Sat"], required: true },
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: "admin", required: true },
  periods:   { type: [schedPeriodSchema], default: [] },
}, { timestamps: true });

teacherScheduleSchema.index({ teacherId: 1, dayOfWeek: 1 }, { unique: true });
teacherScheduleSchema.index({ schoolId: 1 });

module.exports = mongoose.model("teacherSchedule", teacherScheduleSchema);
