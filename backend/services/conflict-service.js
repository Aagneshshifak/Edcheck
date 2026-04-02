const TeacherSchedule = require("../models/teacherScheduleSchema");
const Sclass = require("../models/sclassSchema");
const Subject = require("../models/subjectSchema");

/**
 * Check if a teacher has a scheduling conflict for a given day and period.
 * @param {string|ObjectId} teacherId
 * @param {string} dayOfWeek - e.g. "Mon", "Tue"
 * @param {number} periodNumber
 * @param {string|ObjectId} [excludeClassId] - skip periods for this class (for update-in-place)
 * @returns {{ conflict: false } | { conflict: true, conflictingClass: string, conflictingSubject: string, periodNumber: number }}
 */
async function checkConflict(teacherId, dayOfWeek, periodNumber, excludeClassId) {
  const schedule = await TeacherSchedule.findOne({ teacherId, dayOfWeek });

  if (!schedule) {
    return { conflict: false };
  }

  const conflictingPeriod = schedule.periods.find((p) => {
    if (p.periodNumber !== periodNumber) return false;
    if (excludeClassId && String(p.classId) === String(excludeClassId)) return false;
    return true;
  });

  if (!conflictingPeriod) {
    return { conflict: false };
  }

  const [sclass, subject] = await Promise.all([
    Sclass.findById(conflictingPeriod.classId).select("className").lean(),
    Subject.findById(conflictingPeriod.subjectId).select("subjectName").lean(),
  ]);

  return {
    conflict: true,
    conflictingClass: sclass ? sclass.className : "Unknown Class",
    conflictingSubject: subject ? subject.subjectName : "Unknown Subject",
    periodNumber: conflictingPeriod.periodNumber,
  };
}

module.exports = { checkConflict };
