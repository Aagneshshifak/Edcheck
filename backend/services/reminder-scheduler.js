const cron = require("node-cron");
const teacherSchedule = require("../models/teacherScheduleSchema");
const Sclass = require("../models/sclassSchema");
const { createNotifications } = require("../controllers/notification-controller");
const { logger } = require("../utils/serverLogger");

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// In-memory dedup set: "teacherId:dayOfWeek:periodNumber:date"
const sentReminders = new Set();

/**
 * Convert "HH:MM" string to total minutes since midnight.
 */
const toMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
};

/**
 * Format a Date as "HH:MM" (zero-padded).
 */
const toHHMM = (date) => {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
};

/**
 * Format a Date as "YYYY-MM-DD".
 */
const toDateStr = (date) => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
};

/**
 * Add `minutes` to a Date and return a new Date.
 */
const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

const checkAndSendReminders = async () => {
    const now = new Date();
    const target4 = addMinutes(now, 4);
    const target5 = addMinutes(now, 5);

    const target4Str = toHHMM(target4);
    const target5Str = toHHMM(target5);
    const target4Min = toMinutes(target4Str);
    const target5Min = toMinutes(target5Str);

    const dayOfWeek = DAYS[now.getDay()];
    const dateStr = toDateStr(now);

    // Only query days that are valid for teacherSchedule (Mon–Sat)
    if (!["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].includes(dayOfWeek)) {
        return;
    }

    let schedules;
    try {
        schedules = await teacherSchedule.find({ dayOfWeek }).lean();
    } catch (err) {
        logger.error("reminder-scheduler: failed to query teacherSchedule", { err: err.message });
        return;
    }

    for (const schedule of schedules) {
        try {
            const { teacherId, periods } = schedule;

            for (const period of periods) {
                const periodMin = toMinutes(period.startTime);

                if (periodMin < target4Min || periodMin > target5Min) {
                    continue;
                }

                const dedupKey = `${teacherId}:${dayOfWeek}:${period.periodNumber}:${dateStr}`;
                if (sentReminders.has(dedupKey)) {
                    continue;
                }

                // Resolve class name
                let className = "Unknown Class";
                if (period.classId) {
                    try {
                        const cls = await Sclass.findById(period.classId).lean();
                        if (cls) className = cls.className;
                    } catch (err) {
                        logger.warn("reminder-scheduler: failed to resolve className", {
                            classId: String(period.classId),
                            err: err.message,
                        });
                    }
                }

                const message = `You have Period ${period.periodNumber} for ${className} in 5 minutes.`;

                await createNotifications([teacherId], message, "reminder");

                sentReminders.add(dedupKey);
                logger.info("reminder-scheduler: sent reminder", { dedupKey });
            }
        } catch (err) {
            logger.error("reminder-scheduler: error processing teacher schedule", {
                teacherId: String(schedule.teacherId),
                err: err.message,
            });
        }
    }
};

const startReminderScheduler = () => {
    cron.schedule("* * * * *", () => {
        checkAndSendReminders().catch((err) => {
            logger.error("reminder-scheduler: unhandled error in cron job", { err: err.message });
        });
    });
    logger.info("reminder-scheduler: started (runs every minute)");
};

module.exports = { startReminderScheduler, sentReminders };
