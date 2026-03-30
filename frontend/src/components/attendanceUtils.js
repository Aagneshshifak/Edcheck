/**
 * Attendance utility functions for the Attendance Analytics feature.
 * Feature: attendance-analytics
 */

/**
 * Computes attendance percentage rounded to the nearest whole number.
 * Returns 0 when totalClasses is 0 to avoid division by zero.
 *
 * @param {number} attended - Number of classes attended
 * @param {number} total    - Total number of classes
 * @returns {number} Percentage in range [0, 100]
 */
export const calculatePercentage = (attended, total) => {
    if (total === 0) return 0;
    return Math.round((attended / total) * 100);
};

/**
 * Returns the appropriate colour token for a given attendance percentage.
 * Falls back to hex values when theme tokens are unavailable.
 *
 * @param {number} pct   - Attendance percentage (0–100)
 * @param {object} theme - Theme object with success / warning / danger tokens
 * @returns {string} Colour string
 */
export const getColorForPercentage = (pct, theme) => {
    const green = (theme && theme.success) || '#4caf50';
    const amber = (theme && theme.warning) || '#ff9800';
    const red   = (theme && theme.danger)  || '#f44336';

    if (pct >= 75) return green;
    if (pct >= 50) return amber;
    return red;
};

/**
 * Sorts an array of Subject_Summary objects ascending by attendancePercentage
 * (lowest first), without mutating the original array.
 *
 * @param {Array<{attendancePercentage: number}>} summaries
 * @returns {Array} New sorted array
 */
export const sortSummariesAscending = (summaries) => {
    return [...summaries].sort((a, b) => a.attendancePercentage - b.attendancePercentage);
};
