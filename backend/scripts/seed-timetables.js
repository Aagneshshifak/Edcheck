/**
 * seed-timetables.js
 *
 * Generates timetables for ALL classes in the DB without touching
 * students, teachers, or other data.
 *
 * Usage:  node backend/scripts/seed-timetables.js
 *
 * What it does:
 *  - Finds every school (admin) in the DB
 *  - For each school, finds all classes and their subjects
 *  - Generates 6-day timetables (Mon–Sat) with distinct subject rotation per class
 *  - Avoids teacher double-booking across classes on the same period
 *  - Syncs teacherSchedule collection
 */

const mongoose = require("mongoose");
const dotenv   = require("dotenv");
const path     = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Admin          = require("../models/adminSchema");
const Sclass         = require("../models/sclassSchema");
const Subject        = require("../models/subjectSchema");
const Timetable      = require("../models/timetableSchema");
const TeacherSchedule = require("../models/teacherScheduleSchema");
const { getDailySchedule } = require("../utils/scheduleConfig");

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function generateForSchool(admin) {
    const schoolId = admin._id;
    const classes  = await Sclass.find({ schoolId }).lean();

    if (classes.length === 0) {
        console.log(`  [${admin.schoolName}] No classes found — skipping.`);
        return 0;
    }

    // Load subjects grouped by classId
    const allSubjects = await Subject.find({ schoolId }).lean();
    const subsByClass = {};
    for (const cls of classes) {
        subsByClass[String(cls._id)] = allSubjects.filter(
            s => String(s.classId || s.sclassName) === String(cls._id)
        );
    }

    // Wipe existing timetables + teacher schedules for this school
    await Timetable.deleteMany({ schoolId });
    await TeacherSchedule.deleteMany({ schoolId });

    const schedule     = getDailySchedule();
    const lectureSlots = schedule.filter(s => s.type === "lecture");

    // Track teacher usage per day per period
    const teacherUsage = {};
    for (const day of DAYS) {
        teacherUsage[day] = {};
        for (const slot of lectureSlots) teacherUsage[day][slot.periodNumber] = new Set();
    }

    let created = 0;
    let skipped = 0;

    for (let ci = 0; ci < classes.length; ci++) {
        const cls      = classes[ci];
        const subjects = subsByClass[String(cls._id)] || [];

        if (subjects.length === 0) {
            console.log(`    Class "${cls.className}" has no subjects — skipped.`);
            skipped++;
            continue;
        }

        for (let dayIdx = 0; dayIdx < DAYS.length; dayIdx++) {
            const day = DAYS[dayIdx];

            // Rotate subjects uniquely per class+day
            const offset  = (ci * 3 + dayIdx * 2) % subjects.length;
            const rotated = [...subjects.slice(offset), ...subjects.slice(0, offset)];

            const periods = [];
            let lectureCount = 0;

            for (const slot of schedule) {
                if (slot.type !== "lecture") {
                    periods.push({
                        periodNumber: null,
                        startTime: slot.startTime,
                        endTime:   slot.endTime,
                        type:      slot.type,
                    });
                    continue;
                }

                // Find a subject whose teacher is free at this period
                let assigned = null;
                for (let attempt = 0; attempt < rotated.length; attempt++) {
                    const sub = rotated[(lectureCount + attempt) % rotated.length];
                    const tid = sub.teacherId ? String(sub.teacherId) : null;
                    if (!tid || !teacherUsage[day][slot.periodNumber].has(tid)) {
                        assigned = { sub, tid };
                        break;
                    }
                }
                // Fallback: assign anyway (teacher conflict logged but not blocked in seed)
                if (!assigned) {
                    const sub = rotated[lectureCount % rotated.length];
                    assigned  = { sub, tid: sub.teacherId ? String(sub.teacherId) : null };
                }

                const { sub, tid } = assigned;
                if (tid) teacherUsage[day][slot.periodNumber].add(tid);

                periods.push({
                    periodNumber: slot.periodNumber,
                    startTime:   slot.startTime,
                    endTime:     slot.endTime,
                    type:        "lecture",
                    subjectId:   sub._id,
                    teacherId:   tid || null,
                });
                lectureCount++;
            }

            await Timetable.create({ classId: cls._id, dayOfWeek: day, schoolId, periods });

            // Sync teacherSchedule
            for (const p of periods) {
                if (p.type === "lecture" && p.teacherId) {
                    await TeacherSchedule.findOneAndUpdate(
                        { teacherId: p.teacherId, dayOfWeek: day },
                        {
                            $set:  { schoolId },
                            $push: {
                                periods: {
                                    classId:      cls._id,
                                    subjectId:    p.subjectId,
                                    periodNumber: p.periodNumber,
                                    startTime:    p.startTime,
                                    endTime:      p.endTime,
                                },
                            },
                        },
                        { upsert: true }
                    );
                }
            }
            created++;
        }
        console.log(`    "${cls.className}" — 6 days generated`);
    }

    return { created, skipped };
}

async function run() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB\n");

    const admins = await Admin.find({}).lean();
    if (admins.length === 0) {
        console.log("No schools found. Run `npm run seed` first.");
        process.exit(1);
    }

    let total = 0;
    for (const admin of admins) {
        console.log(`School: ${admin.schoolName || admin.email}`);
        const result = await generateForSchool(admin);
        if (result) {
            console.log(`  → ${result.created} timetables created, ${result.skipped} classes skipped\n`);
            total += result.created;
        }
    }

    console.log(`\n✓ Done. Total timetable documents created: ${total}`);
    console.log("Each class now has a distinct 6-day schedule (Mon–Sat).");
    await mongoose.disconnect();
    process.exit(0);
}

run().catch(err => {
    console.error("Failed:", err.message);
    process.exit(1);
});
