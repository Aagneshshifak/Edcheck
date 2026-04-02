const mongoose = require("mongoose");

const substituteAssignmentSchema = new mongoose.Schema({
  originalTeacherId:   { type: mongoose.Schema.Types.ObjectId, ref: "teacher", required: true },
  substituteTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "teacher" }, // null if unassigned
  classId:    { type: mongoose.Schema.Types.ObjectId, ref: "sclass", required: true },
  subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: "subject", required: true },
  date:       { type: String, required: true }, // "YYYY-MM-DD"
  periodNumber: { type: Number, required: true },
  status:     { type: String, enum: ["assigned", "unassigned"], required: true },
}, { timestamps: true });

substituteAssignmentSchema.index({ originalTeacherId: 1, date: 1 });
substituteAssignmentSchema.index({ substituteTeacherId: 1, date: 1 });
substituteAssignmentSchema.index({ classId: 1, date: 1 });

module.exports = mongoose.model("substituteAssignment", substituteAssignmentSchema);
