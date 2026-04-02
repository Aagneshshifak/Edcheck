const TeacherSchedule = require("../models/teacherScheduleSchema");
const SubstituteAssignment = require("../models/substituteAssignmentSchema");
const Teacher = require("../models/teacherSchema");
const Sclass = require("../models/sclassSchema");
const Subject = require("../models/subjectSchema");
const { createNotifications } = require("./notification-controller");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Allocate substitute teachers for all periods of an absent teacher on a given date.
 * @param {string|ObjectId} teacherId
 * @param {string} date - "YYYY-MM-DD"
 * @param {string|ObjectId} schoolId
 * @returns {Promise<Array>} array of created SubstituteAssignment docs
 */
async function allocateSubstitutes(teacherId, date, schoolId) {
  const dayOfWeek = DAYS[new Date(date + "T00:00:00").getDay()];

  // 1. Get all periods for the absent teacher on this day
  const schedule = await TeacherSchedule.findOne({ teacherId, dayOfWeek });
  if (!schedule || schedule.periods.length === 0) return [];

  const results = [];

  // 7. Process each period independently
  for (const period of schedule.periods) {
    const { classId, subjectId, periodNumber } = period;

    // 2. Find candidate teachers in the same school who teach the same subject
    const candidates = await Teacher.find({
      schoolId,
      teachSubjects: subjectId,
      _id: { $ne: teacherId },
    }).lean();

    let assignedCandidate = null;

    // 3. Check each candidate is free during this period
    for (const candidate of candidates) {
      const candidateSchedule = await TeacherSchedule.findOne({
        teacherId: candidate._id,
        dayOfWeek,
      }).lean();

      const busyInSchedule =
        candidateSchedule &&
        candidateSchedule.periods.some((p) => p.periodNumber === periodNumber);

      if (busyInSchedule) continue;

      const existingAssignment = await SubstituteAssignment.findOne({
        substituteTeacherId: candidate._id,
        date,
        periodNumber,
      }).lean();

      if (existingAssignment) continue;

      assignedCandidate = candidate;
      break;
    }

    // 4. Create SubstituteAssignment
    if (assignedCandidate) {
      const assignment = await SubstituteAssignment.create({
        originalTeacherId: teacherId,
        substituteTeacherId: assignedCandidate._id,
        classId,
        subjectId,
        date,
        periodNumber,
        status: "assigned",
      });

      // 5. Notify the substitute teacher
      const [cls, subject] = await Promise.all([
        Sclass.findById(classId).lean(),
        Subject.findById(subjectId).lean(),
      ]);

      const className = cls ? cls.className : String(classId);
      const subjectName = subject
        ? subject.subjectName || subject.subName
        : String(subjectId);

      const message = `You have been assigned as substitute for Period ${periodNumber} in class ${className} for ${subjectName} on ${date}.`;
      await createNotifications(
        [String(assignedCandidate._id)],
        message,
        "substitute"
      );

      results.push(assignment);
    } else {
      // 6. No substitute available — create unassigned record, no notification
      const assignment = await SubstituteAssignment.create({
        originalTeacherId: teacherId,
        substituteTeacherId: null,
        classId,
        subjectId,
        date,
        periodNumber,
        status: "unassigned",
      });

      results.push(assignment);
    }
  }

  return results;
}

/**
 * GET /Substitute/:classId/:date
 * Returns all substitute assignments for a class on a given date.
 */
async function getSubstitutesByClassDate(req, res) {
  try {
    const { classId, date } = req.params;
    const assignments = await SubstituteAssignment.find({ classId, date })
      .populate("originalTeacherId", "name email")
      .populate("substituteTeacherId", "name email")
      .populate("subjectId", "subjectName subName")
      .lean();

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * GET /Substitute/teacher/:teacherId/:date
 * Returns substitute assignments where this teacher is the substitute.
 */
async function getSubstitutesByTeacher(req, res) {
  try {
    const { teacherId, date } = req.params;
    const assignments = await SubstituteAssignment.find({
      substituteTeacherId: teacherId,
      date,
      status: "assigned",
    })
      .populate("classId", "className sclassName")
      .populate("subjectId", "subjectName subName")
      .lean();

    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { allocateSubstitutes, getSubstitutesByClassDate, getSubstitutesByTeacher };
