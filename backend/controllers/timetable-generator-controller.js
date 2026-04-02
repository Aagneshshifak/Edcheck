const Timetable = require("../models/timetableSchema");
const TeacherSchedule = require("../models/teacherScheduleSchema");
const Subject = require("../models/subjectSchema");
const Sclass = require("../models/sclassSchema");
const { getDailySchedule } = require("../utils/scheduleConfig");
const { invalidate } = require("../utils/cache");

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Shuffle an array in-place (Fisher-Yates).
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * POST /Timetable/auto-generate/:schoolId
 *
 * Auto-generates a full weekly timetable for every class in the school.
 * - Each class gets subjects from its own subject list.
 * - Subjects are rotated across days so each day's schedule is distinct.
 * - Teacher conflicts are avoided: a teacher is never assigned to two classes
 *   at the same period on the same day.
 * - Existing timetables for the school are replaced.
 *
 * Query params:
 *   ?overwrite=true  (default true) — replace existing timetables
 *   ?days=Mon,Tue,Wed,Thu,Fri  — which days to generate (default all 6)
 */
const autoGenerateTimetables = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const overwrite = req.query.overwrite !== "false";
    const requestedDays = req.query.days
      ? req.query.days.split(",").filter((d) => DAYS.includes(d))
      : DAYS;

    const schedule = getDailySchedule();
    const lectureSlots = schedule.filter((s) => s.type === "lecture");
    const PERIODS_PER_DAY = lectureSlots.length; // 8

    // ── 1. Load all classes for this school ──────────────────────────────────
    const classes = await Sclass.find({
      $or: [{ schoolId }, { school: schoolId }]
    }).lean();
    if (classes.length === 0) {
      return res.status(400).json({ message: "No classes found for this school." });
    }

    // ── 2. Load all subjects for this school, grouped by classId ─────────────
    const allSubjects = await Subject.find({
      $or: [{ schoolId }, { school: schoolId }]
    }).lean();

    // Resolve teacherId from either field
    const resolveTeacherId = (s) =>
      s.teacherId || s.teacher || null;

    const subjectsByClass = {};
    for (const cls of classes) {
      subjectsByClass[String(cls._id)] = allSubjects
        .filter((s) => {
          const cid = String(s.classId || s.sclassName || "");
          return cid === String(cls._id);
        })
        .map((s) => ({ ...s, _resolvedTeacherId: resolveTeacherId(s) }));
    }

    // ── 3. Track teacher usage: teacherUsage[day][periodNumber] = Set<teacherId> ──
    const teacherUsage = {};
    for (const day of requestedDays) {
      teacherUsage[day] = {};
      for (const slot of lectureSlots) {
        teacherUsage[day][slot.periodNumber] = new Set();
      }
    }

    const results = { created: 0, skipped: 0, errors: [] };

    // ── 4. Process each class ────────────────────────────────────────────────
    for (const cls of classes) {
      const classId = String(cls._id);
      const subjects = subjectsByClass[classId] || [];

      if (subjects.length === 0) {
        results.skipped++;
        results.errors.push(`Class "${cls.className}" has no subjects — skipped.`);
        continue;
      }

      // ── 5. For each day, build a distinct period assignment ────────────────
      for (let dayIdx = 0; dayIdx < requestedDays.length; dayIdx++) {
        const day = requestedDays[dayIdx];

        // Check if timetable already exists
        if (!overwrite) {
          const existing = await Timetable.findOne({ classId, dayOfWeek: day });
          if (existing) {
            results.skipped++;
            continue;
          }
        }

        // Rotate subjects differently per day to ensure distinct schedules.
        // Offset = (classIndex * 2 + dayIndex) mod subjects.length
        const classIdx = classes.findIndex((c) => String(c._id) === classId);
        const offset = (classIdx * 3 + dayIdx * 2) % subjects.length;
        const rotated = [
          ...subjects.slice(offset),
          ...subjects.slice(0, offset),
        ];

        // Build the full periods array from the schedule template
        const periods = [];
        let lectureCount = 0;

        for (const slot of schedule) {
          if (slot.type !== "lecture") {
            periods.push({
              periodNumber: null,
              startTime: slot.startTime,
              endTime: slot.endTime,
              type: slot.type,
            });
            continue;
          }

          // Pick a subject for this lecture slot, trying to avoid teacher conflicts
          let assigned = null;
          const tried = new Set();

          for (let attempt = 0; attempt < rotated.length; attempt++) {
            const subIdx = (lectureCount + attempt) % rotated.length;
            if (tried.has(subIdx)) continue;
            tried.add(subIdx);

            const subject = rotated[subIdx];
            const teacherId = subject._resolvedTeacherId
              ? String(subject._resolvedTeacherId)
              : null;

            // Skip if this teacher is already used at this period on this day
            if (
              teacherId &&
              teacherUsage[day][slot.periodNumber].has(String(teacherId))
            ) {
              continue;
            }

            assigned = { subject, teacherId };
            break;
          }

          // Fallback: use the subject even without a teacher if all teachers conflict
          if (!assigned) {
            const subIdx = lectureCount % rotated.length;
            const sub = rotated[subIdx];
            assigned = {
              subject: sub,
              teacherId: sub._resolvedTeacherId ? String(sub._resolvedTeacherId) : null,
            };
          }

          const { subject, teacherId } = assigned;

          if (teacherId) {
            teacherUsage[day][slot.periodNumber].add(String(teacherId));
          }

          periods.push({
            periodNumber: slot.periodNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
            type: "lecture",
            subjectId: subject._id,
            teacherId: teacherId || null,
          });

          lectureCount++;
        }

        // ── 6. Upsert the timetable ──────────────────────────────────────────
        try {
          // Clear old teacher schedule entries for this class+day
          await TeacherSchedule.updateMany(
            { dayOfWeek: day },
            { $pull: { periods: { classId: cls._id } } }
          );

          await Timetable.findOneAndUpdate(
            { classId, dayOfWeek: day },
            { classId, dayOfWeek: day, schoolId, periods },
            { upsert: true, new: true, runValidators: true }
          );

          // Sync teacher schedules
          for (const p of periods) {
            if (p.type === "lecture" && p.teacherId) {
              await TeacherSchedule.findOneAndUpdate(
                { teacherId: p.teacherId, dayOfWeek: day },
                {
                  $set: { schoolId },
                  $push: {
                    periods: {
                      classId: cls._id,
                      subjectId: p.subjectId,
                      periodNumber: p.periodNumber,
                      startTime: p.startTime,
                      endTime: p.endTime,
                    },
                  },
                },
                { upsert: true }
              );
            }
          }

          // Invalidate cache
          invalidate(`timetable:${classId}:${day}`);
          results.created++;
        } catch (err) {
          results.errors.push(
            `Class "${cls.className}" day ${day}: ${err.message}`
          );
        }
      }
    }

    res.json({
      message: `Auto-generation complete. ${results.created} timetables created, ${results.skipped} skipped.`,
      classesFound: classes.length,
      subjectsFound: allSubjects.length,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { autoGenerateTimetables };
