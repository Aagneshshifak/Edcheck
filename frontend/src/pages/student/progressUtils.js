/**
 * Pure utility functions for the Learning Progress Chart feature.
 */

/**
 * Computes the percentage score from marks and maxMarks.
 * Guards against division by zero.
 * @param {number} marks
 * @param {number} maxMarks
 * @returns {number}
 */
export const computePercentage = (marks, maxMarks) =>
    maxMarks > 0 ? Math.round((marks / maxMarks) * 1000) / 10 : 0;

/**
 * Computes the trend direction from a chronologically ordered array of entries.
 * @param {{ percentageScore: number }[]} entries
 * @returns {'up' | 'down' | 'neutral' | null}
 */
export const computeTrend = (entries) => {
    if (entries.length < 2) return null;
    const last = entries[entries.length - 1].percentageScore;
    const secondLast = entries[entries.length - 2].percentageScore;
    if (last > secondLast) return 'up';
    if (last < secondLast) return 'down';
    return 'neutral';
};

/**
 * Computes the average percentageScore per subject, rounded to one decimal place.
 * @param {{ subjectName: string, percentageScore: number }[]} items
 * @returns {Record<string, number>}
 */
export const computeSubjectAverages = (items) => {
    const totals = {};
    const counts = {};
    for (const item of items) {
        const name = item.subjectName;
        totals[name] = (totals[name] || 0) + item.percentageScore;
        counts[name] = (counts[name] || 0) + 1;
    }
    const averages = {};
    for (const name of Object.keys(totals)) {
        averages[name] = Math.round((totals[name] / counts[name]) * 10) / 10;
    }
    return averages;
};

/**
 * Filters items to only those whose subjectName is in the selected array.
 * Returns items unchanged when selected is empty.
 * @param {{ subjectName: string }[]} items
 * @param {string[]} selected
 * @returns {{ subjectName: string }[]}
 */
export const filterBySubjects = (items, selected) => {
    if (!selected || selected.length === 0) return items;
    return items.filter((item) => selected.includes(item.subjectName));
};

// Golden-ratio HSL colour helpers (same algorithm as CustomBarChart.js)
const goldenRatioConjugate = 0.618033988749895;

const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

/**
 * Generates a stable colour for each subject using the golden-ratio HSL algorithm.
 * @param {string[]} subjects  — ordered list of distinct subject names
 * @returns {Record<string, string>}
 */
export const generateSubjectColors = (subjects) => {
    const colors = {};
    subjects.forEach((name, i) => {
        const hue = (i * goldenRatioConjugate) % 1;
        const [r, g, b] = hslToRgb(hue, 0.6, 0.6);
        colors[name] = `rgb(${r}, ${g}, ${b})`;
    });
    return colors;
};
