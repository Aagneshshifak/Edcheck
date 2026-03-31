const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Returns a human-readable relative label for a deadline.
 *
 * @param {Date} dueDate - The deadline date
 * @param {Date} now - The current reference time
 * @returns {string} Relative label: "Due Today", "Due Tomorrow", day name, or "Next <day>"
 */
export function getRelativeLabel(dueDate, now) {
  const diffMs = dueDate - now;

  if (diffMs < 24 * 60 * 60 * 1000) {
    return 'Due Today';
  }

  if (diffMs < 48 * 60 * 60 * 1000) {
    return 'Due Tomorrow';
  }

  const dayName = DAY_NAMES[dueDate.getDay()];

  // Determine calendar week: week starts on Sunday (day 0)
  const nowWeekStart = new Date(now);
  nowWeekStart.setHours(0, 0, 0, 0);
  nowWeekStart.setDate(nowWeekStart.getDate() - nowWeekStart.getDay());

  const dueWeekStart = new Date(dueDate);
  dueWeekStart.setHours(0, 0, 0, 0);
  dueWeekStart.setDate(dueWeekStart.getDate() - dueWeekStart.getDay());

  const weekDiff = Math.round((dueWeekStart - nowWeekStart) / (7 * 24 * 60 * 60 * 1000));

  if (weekDiff <= 0) {
    return dayName;
  }

  if (weekDiff === 1) {
    return `Next ${dayName}`;
  }

  // Beyond next calendar week — still return "Next <day>" as a reasonable fallback
  return `Next ${dayName}`;
}
