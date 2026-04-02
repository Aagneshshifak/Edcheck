/**
 * Daily schedule configuration for the Smart Timetable System.
 * Derives the 12-slot array from fixed school constants.
 */

const SCHOOL_START = "08:45";
const SCHOOL_END = "16:30";
const INTERVAL_MIN = 15;
const LUNCH_MIN = 40;
const LECTURE_COUNT = 8;

// Slot template: type + optional fixed duration (lectures get computed duration)
const SLOT_TEMPLATE = [
  { type: "lecture" },
  { type: "lecture" },
  { type: "interval", duration: INTERVAL_MIN },
  { type: "lecture" },
  { type: "lecture" },
  { type: "lunch", duration: LUNCH_MIN },
  { type: "lecture" },
  { type: "lecture" },
  { type: "interval", duration: INTERVAL_MIN },
  { type: "lecture" },
  { type: "lecture" },
];

/**
 * Parse "HH:MM" into total minutes since midnight.
 * @param {string} time
 * @returns {number}
 */
function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Format total minutes since midnight as "HH:MM".
 * @param {number} minutes
 * @returns {string}
 */
function fromMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Compute the lecture duration in minutes from the fixed constants.
 * Total school minutes minus total break minutes, divided by number of lectures.
 * @returns {number}
 */
function computeLectureDuration() {
  const totalMinutes = toMinutes(SCHOOL_END) - toMinutes(SCHOOL_START);
  const totalBreakMinutes =
    INTERVAL_MIN * 2 + LUNCH_MIN; // two intervals + one lunch
  const availableForLectures = totalMinutes - totalBreakMinutes;
  return Math.floor(availableForLectures / LECTURE_COUNT);
}

/**
 * Returns the 12-slot daily schedule array derived from fixed constants.
 * Each slot contains: type, periodNumber (null for breaks), startTime, endTime.
 * @returns {Array<{type: string, periodNumber: number|null, startTime: string, endTime: string}>}
 */
function getDailySchedule() {
  const lectureDuration = computeLectureDuration();
  let currentMinutes = toMinutes(SCHOOL_START);
  let periodCounter = 1;

  return SLOT_TEMPLATE.map((slot) => {
    const duration =
      slot.type === "lecture" ? lectureDuration : slot.duration;

    const startTime = fromMinutes(currentMinutes);
    const endTime = fromMinutes(currentMinutes + duration);

    const entry = {
      type: slot.type,
      periodNumber: slot.type === "lecture" ? periodCounter : null,
      startTime,
      endTime,
    };

    if (slot.type === "lecture") {
      periodCounter++;
    }

    currentMinutes += duration;
    return entry;
  });
}

module.exports = {
  getDailySchedule,
  SCHOOL_START,
  SCHOOL_END,
  INTERVAL_MIN,
  LUNCH_MIN,
  LECTURE_COUNT,
};
