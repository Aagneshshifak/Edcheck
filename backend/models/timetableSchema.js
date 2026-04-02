const mongoose = require("mongoose");

const periodEntrySchema = new mongoose.Schema({
  periodNumber: { type: Number },           // 1–8 for lectures; null for breaks
  startTime:    { type: String, required: true }, // "HH:MM"
  endTime:      { type: String, required: true }, // "HH:MM"
  type:         { type: String, enum: ["lecture", "interval", "lunch"], required: true },
  subjectId:    { type: mongoose.Schema.Types.ObjectId, ref: "subject" },
  teacherId:    { type: mongoose.Schema.Types.ObjectId, ref: "teacher" },
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  classId:   { type: mongoose.Schema.Types.ObjectId, ref: "sclass", required: true },
  dayOfWeek: { type: String, enum: ["Mon","Tue","Wed","Thu","Fri","Sat"], required: true },
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: "admin", required: true },
  periods:   { type: [periodEntrySchema], required: true },
}, { timestamps: true });

timetableSchema.index({ classId: 1, dayOfWeek: 1 }, { unique: true });
timetableSchema.index({ schoolId: 1 });

module.exports = mongoose.model("timetable", timetableSchema);
