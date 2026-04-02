/**
 * Pure computation functions for class analytics.
 * No DB calls — all functions are deterministic and side-effect-free.
 */

const mongoose = require('mongoose');

/**
 * Compute the weighted average marks for a class.
 *
 * Formula: (sum of marks / sum of maxMarks) * 100, clamped to [0, 100].
 * Returns 0 for empty input or when no exam results exist.
 *
 * @param {Array} students - Array of student documents with examResult[]
 * @returns {number} Average marks percentage in [0, 100]
 */
function computeAverageMarks(students) {
    if (!students || students.length === 0) return 0;

    let sumMarks = 0;
    let sumMaxMarks = 0;

    for (const student of students) {
        const results = student.examResult;
        if (!results || results.length === 0) continue;
        for (const result of results) {
            sumMarks += result.marks;
            sumMaxMarks += result.maxMarks;
        }
    }

    if (sumMaxMarks === 0) return 0;

    const raw = (sumMarks / sumMaxMarks) * 100;
    return Math.min(100, Math.max(0, raw));
}

/**
 * Compute the attendance rate for a class.
 *
 * Formula: (presentCount / totalSessions) * 100, clamped to [0, 100].
 * Returns 100 when no attendance records exist (no data = not penalised).
 *
 * @param {Array} students - Array of student documents with attendance[]
 * @returns {number} Attendance rate percentage in [0, 100]
 */
function computeAttendanceRate(students) {
    if (!students || students.length === 0) return 100;

    let presentCount = 0;
    let totalSessions = 0;

    for (const student of students) {
        const records = student.attendance;
        if (!records || records.length === 0) continue;
        for (const record of records) {
            totalSessions += 1;
            if (record.status === 'Present') {
                presentCount += 1;
            }
        }
    }

    if (totalSessions === 0) return 100;

    const raw = (presentCount / totalSessions) * 100;
    return Math.min(100, Math.max(0, raw));
}

/**
 * Detect subjects where the class average falls below a threshold.
 *
 * Returns only the subjectId values where averageMarks < threshold,
 * sorted ascending by averageMarks.
 * Returns an empty array when no subject falls below the threshold.
 *
 * @param {Array} subjectAggregates - Array of { subjectId, averageMarks, ... }
 * @param {number} threshold - Marks threshold (default 40)
 * @returns {Array} Array of subjectId values for weak subjects, sorted by averageMarks ASC
 */
function detectWeakSubjects(subjectAggregates, threshold = 40) {
    if (!subjectAggregates || subjectAggregates.length === 0) return [];

    return subjectAggregates
        .filter(agg => agg.averageMarks < threshold)
        .sort((a, b) => a.averageMarks - b.averageMarks)
        .map(agg => agg.subjectId);
}

/**
 * Compute a composite performance score for a class.
 *
 * Formula: (averageMarks * 0.5) + (attendanceRate * 0.3) + (weakPenalty * 0.2)
 * where weakPenalty = max(0, 100 - weakSubjectCount * 10), clamped to [0, 100].
 *
 * @param {number} averageMarks - Class average marks in [0, 100]
 * @param {number} attendanceRate - Class attendance rate in [0, 100]
 * @param {number} weakSubjectCount - Number of weak subjects (>= 0)
 * @returns {number} Composite performance score in [0, 100]
 */
function computePerformanceScore(averageMarks, attendanceRate, weakSubjectCount) {
    const weakPenalty = Math.max(0, 100 - weakSubjectCount * 10);
    const raw = (averageMarks * 0.5) + (attendanceRate * 0.3) + (weakPenalty * 0.2);
    return Math.min(100, Math.max(0, raw));
}

/**
 * Fetch raw data, compute all four metrics, and upsert a ClassAnalytics document.
 *
 * @param {string|ObjectId} classId  - The sclass _id
 * @param {string|ObjectId} schoolId - The admin _id
 * @returns {Promise<Object>} The upserted ClassAnalytics document
 * @throws {Error} If classId does not reference an existing sclass document
 */
async function computeClassAnalytics(classId, schoolId) {
    const Sclass         = mongoose.model('sclass');
    const Student        = mongoose.model('student');
    const Subject        = mongoose.model('subject');
    const ClassAnalytics = mongoose.model('classAnalytics');

    // 1. Validate classId resolves to an existing sclass document
    const sclass = await Sclass.findById(classId).lean();
    if (!sclass) {
        throw new Error(`classId "${classId}" does not reference an existing sclass document`);
    }

    // 2. Fetch raw data
    const students = await Student.find({ classId }).select('examResult attendance').lean();
    const subjects  = await Subject.find({
        $or: [{ classId }, { sclassName: classId }]
    }).select('_id subName').lean();

    // 3. Build per-subject aggregates
    const subjectAggregates = subjects.map(subject => {
        const subIdStr = subject._id.toString();
        const marks = [];

        for (const student of students) {
            for (const result of (student.examResult || [])) {
                if (result.subjectId && result.subjectId.toString() === subIdStr) {
                    const maxMarks = result.maxMarks > 0 ? result.maxMarks : 100;
                    marks.push((result.marks / maxMarks) * 100);
                }
            }
        }

        const averageMarks = marks.length > 0
            ? marks.reduce((sum, m) => sum + m, 0) / marks.length
            : 0;

        return { subjectId: subject._id, averageMarks };
    });

    // 4. Compute aggregate metrics
    const avgMarks   = computeAverageMarks(students);
    const attendRate = computeAttendanceRate(students);
    const weakSubs   = detectWeakSubjects(subjectAggregates);
    const perfScore  = computePerformanceScore(avgMarks, attendRate, weakSubs.length);

    // 5. Upsert ClassAnalytics
    const doc = await ClassAnalytics.findOneAndUpdate(
        { classId },
        {
            $set: {
                schoolId,
                averageMarks:     avgMarks,
                attendanceRate:   attendRate,
                weakSubjects:     weakSubs,
                performanceScore: perfScore,
                lastUpdated:      Date.now(),
            }
        },
        { upsert: true, new: true }
    );

    return doc;
}

module.exports = {
    computeAverageMarks,
    computeAttendanceRate,
    detectWeakSubjects,
    computePerformanceScore,
    computeClassAnalytics,
};
