const Timetable = require("../models/timetableSchema");
const TeacherSchedule = require("../models/teacherScheduleSchema");
const TeacherAttendance = require("../models/teacherAttendanceSchema");
const SubstituteAssignment = require("../models/substituteAssignmentSchema");
const { checkConflict } = require("../services/conflict-service");
const { getDailySchedule } = require("../utils/scheduleConfig");
const { withCache, invalidate } = require("../utils/cache");

// ─── Helpers ────────────────────────────────────────────────────────────────

function cacheKey(classId, day) {
  return `timetable:${classId}:${day}`;
}

/**
 * Remove all period entries for a given classId+dayOfWeek from teacherSchedule.
 */
async function removeTeacherSchedulePeriods(classId, dayOfWeek) {
  await TeacherSchedule.updateMany(
    { dayOfWeek },
    { $pull: { periods: { classId } } }
  );
}

/**
 * Upsert teacher schedule entries for all lecture periods that have a teacherId.
 */
async function syncTeacherSchedule(periods, classId, dayOfWeek, schoolId) {
  const lecturePeriods = periods.filter(
    (p) => p.type === "lecture" && p.teacherId
  );
  for (const p of lecturePeriods) {
    await TeacherSchedule.findOneAndUpdate(
      { teacherId: p.teacherId, dayOfWeek },
      {
        $set: { schoolId },
        $pull: { periods: { classId, periodNumber: p.periodNumber } },
      },
      { upsert: true, new: false }
    );
    await TeacherSchedule.findOneAndUpdate(
      { teacherId: p.teacherId, dayOfWeek },
      {
        $push: {
          periods: {
            classId,
            subjectId: p.subjectId,
            periodNumber: p.periodNumber,
            startTime: p.startTime,
            endTime: p.endTime,
          },
        },
      }
    );
  }
}

// ─── GET /Timetable/config/:schoolId ────────────────────────────────────────

const getConfig = (req, res) => {
  try {
    const schedule = getDailySchedule();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /Timetable/:classId/:day ──────────────────────────────────────────

const createDayTimetable = async (req, res) => {
  try {
    const { classId, day } = req.params;
    const { schoolId, periods } = req.body;

    if (!schoolId || !periods) {
      return res.status(400).json({ message: "schoolId and periods are required" });
    }

    // Conflict check for all lecture periods with a teacher
    for (const p of periods) {
      if (p.type === "lecture" && p.teacherId) {
        const result = await checkConflict(p.teacherId, day, p.periodNumber, classId);
        if (result.conflict) {
          return res.status(409).json({
            message: `Teacher conflict on period ${result.periodNumber}`,
            conflictingClass: result.conflictingClass,
            conflictingSubject: result.conflictingSubject,
            periodNumber: result.periodNumber,
          });
        }
      }
    }

    // Remove old teacher schedule entries for this classId+dayOfWeek
    await removeTeacherSchedulePeriods(classId, day);

    // Upsert the timetable document
    const timetable = await Timetable.findOneAndUpdate(
      { classId, dayOfWeek: day },
      { classId, dayOfWeek: day, schoolId, periods },
      { upsert: true, new: true, runValidators: true }
    );

    // Sync teacher schedules for new periods
    await syncTeacherSchedule(periods, classId, day, schoolId);

    // Invalidate cache
    invalidate(cacheKey(classId, day));

    res.status(201).json(timetable);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /Timetable/:classId/:day ───────────────────────────────────────────

const getDayTimetable = async (req, res) => {
  try {
    const { classId, day } = req.params;

    const data = await withCache(cacheKey(classId, day), async () => {
      const timetable = await Timetable.findOne({ classId, dayOfWeek: day })
        .populate("periods.subjectId", "subjectName subName")
        .populate("periods.teacherId", "name")
        .lean();
      return timetable;
    });

    if (!data) {
      return res.status(404).json({
        message: `Timetable not found for class ${classId} on ${day}`,
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /Timetable/:classId ─────────────────────────────────────────────────

const getWeeklyTimetable = async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolId } = req.query;

    const query = { classId };
    if (schoolId) query.schoolId = schoolId;

    const entries = await Timetable.find(query)
      .populate("periods.subjectId", "subjectName subName")
      .populate("periods.teacherId", "name")
      .lean();

    // Group by dayOfWeek
    const grouped = {};
    for (const entry of entries) {
      grouped[entry.dayOfWeek] = entry;
    }

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── PUT /Timetable/:classId/:day/period/:periodNumber ───────────────────────

const updatePeriod = async (req, res) => {
  try {
    const { classId, day, periodNumber } = req.params;
    const periodNum = parseInt(periodNumber, 10);
    const updatedPeriod = req.body; // { subjectId, teacherId, startTime, endTime, type, ... }

    const timetable = await Timetable.findOne({ classId, dayOfWeek: day });
    if (!timetable) {
      return res.status(404).json({
        message: `Timetable not found for class ${classId} on ${day}`,
      });
    }

    const idx = timetable.periods.findIndex(
      (p) => p.periodNumber === periodNum
    );
    if (idx === -1) {
      return res.status(404).json({
        message: `Period ${periodNum} not found in timetable`,
      });
    }

    const oldPeriod = timetable.periods[idx];

    // Conflict check for new teacher (exclude this classId so update-in-place works)
    if (updatedPeriod.teacherId) {
      const result = await checkConflict(
        updatedPeriod.teacherId,
        day,
        periodNum,
        classId
      );
      if (result.conflict) {
        return res.status(409).json({
          message: `Teacher conflict on period ${result.periodNumber}`,
          conflictingClass: result.conflictingClass,
          conflictingSubject: result.conflictingSubject,
          periodNumber: result.periodNumber,
        });
      }
    }

    // Remove old period entry from old teacher's schedule
    if (oldPeriod.teacherId) {
      await TeacherSchedule.updateOne(
        { teacherId: oldPeriod.teacherId, dayOfWeek: day },
        { $pull: { periods: { classId, periodNumber: periodNum } } }
      );
    }

    // Apply update
    timetable.periods[idx] = { ...timetable.periods[idx].toObject(), ...updatedPeriod };
    await timetable.save();

    // Add new period entry to new teacher's schedule
    if (updatedPeriod.teacherId && updatedPeriod.type === "lecture") {
      await TeacherSchedule.findOneAndUpdate(
        { teacherId: updatedPeriod.teacherId, dayOfWeek: day },
        {
          $set: { schoolId: timetable.schoolId },
          $push: {
            periods: {
              classId,
              subjectId: updatedPeriod.subjectId,
              periodNumber: periodNum,
              startTime: updatedPeriod.startTime || timetable.periods[idx].startTime,
              endTime: updatedPeriod.endTime || timetable.periods[idx].endTime,
            },
          },
        },
        { upsert: true }
      );
    }

    // Invalidate cache
    invalidate(cacheKey(classId, day));

    res.json(timetable);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /Timetable/:classId/:day ─────────────────────────────────────────

const deleteDayTimetable = async (req, res) => {
  try {
    const { classId, day } = req.params;

    const timetable = await Timetable.findOneAndDelete({ classId, dayOfWeek: day });
    if (!timetable) {
      return res.status(404).json({
        message: `Timetable not found for class ${classId} on ${day}`,
      });
    }

    // Clean up teacher schedule entries for this classId+dayOfWeek
    await removeTeacherSchedulePeriods(classId, day);

    // Invalidate cache
    invalidate(cacheKey(classId, day));

    res.json({ message: `Timetable for class ${classId} on ${day} deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── POST /TeacherAttendance ──────────────────────────────────────────────────

const markTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, date, schoolId, status } = req.body;

    if (!teacherId || !date || !schoolId || !status) {
      return res.status(400).json({
        message: "teacherId, date, schoolId, and status are required",
      });
    }

    if (!["present", "absent"].includes(status)) {
      return res.status(400).json({ message: "status must be 'present' or 'absent'" });
    }

    const attendance = await TeacherAttendance.findOneAndUpdate(
      { teacherId, date },
      { teacherId, date, schoolId, status },
      { upsert: true, new: true, runValidators: true }
    );

    if (status === "absent") {
      try {
        const { allocateSubstitutes } = require("./substitute-controller");
        await allocateSubstitutes(teacherId, date, schoolId);
      } catch (err) {
        // substitute-controller may not exist yet; log and continue
        console.warn("allocateSubstitutes unavailable:", err.message);
      }
    } else if (status === "present") {
      // Cancel pending substitute assignments for this teacher on this date
      // Schema only supports "assigned"/"unassigned", so we delete them
      await SubstituteAssignment.deleteMany({ originalTeacherId: teacherId, date });
    }

    res.json(attendance);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /TeacherAttendance/:teacherId/:date ──────────────────────────────────

const getTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, date } = req.params;

    const attendance = await TeacherAttendance.findOne({ teacherId, date });
    if (!attendance) {
      return res.status(404).json({
        message: `Attendance record not found for teacher ${teacherId} on ${date}`,
      });
    }

    res.json(attendance);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── GET /TeacherSchedule/:teacherId/:day ─────────────────────────────────────
// Returns the teacher's own schedule for a given day, with class + subject populated.

const getTeacherDaySchedule = async (req, res) => {
  try {
    const { teacherId, day } = req.params;

    const schedule = await TeacherSchedule.findOne({ teacherId, dayOfWeek: day })
      .populate("periods.classId", "className sclassName")
      .populate("periods.subjectId", "subjectName subName")
      .lean();

    if (!schedule || schedule.periods.length === 0) {
      return res.json({ periods: [] });
    }

    res.json({ periods: schedule.periods, dayOfWeek: day });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getConfig,
  createDayTimetable,
  getDayTimetable,
  getWeeklyTimetable,
  updatePeriod,
  deleteDayTimetable,
  markTeacherAttendance,
  getTeacherAttendance,
  getTeacherDaySchedule,
};
