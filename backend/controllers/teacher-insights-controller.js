const Student    = require('../models/studentSchema');
const TestAttempt = require('../models/testAttemptSchema');
const Subject    = require('../models/subjectSchema');

/**
 * GET /Teacher/class/:classId/insights
 * Computes risk scores for all students in a class on-demand.
 * No separate schema needed — derives from existing attendance + test attempt data.
 */
const getClassInsights = async (req, res) => {
    try {
        const { classId } = req.params;

        const students = await Student.find({
            $or: [{ classId }, { sclassName: classId }]
        }).lean();

        const results = await Promise.all(students.map(async (s) => {
            // ── Attendance ──────────────────────────────────────────────────
            const total   = s.attendance?.length || 0;
            const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
            const attendancePercent = total > 0 ? Math.round((present / total) * 100) : null;

            // ── Test attempts ───────────────────────────────────────────────
            const attempts = await TestAttempt.find({ studentId: s._id })
                .populate({ path: 'testId', select: 'subject title', populate: { path: 'subject', select: 'subName subjectName' } })
                .lean();

            // Group avg score per subject
            const subjectScores = {};
            for (const a of attempts) {
                const subName = a.testId?.subject?.subName || a.testId?.subject?.subjectName;
                if (!subName || !a.totalMarks) continue;
                const pct = (a.score / a.totalMarks) * 100;
                if (!subjectScores[subName]) subjectScores[subName] = [];
                subjectScores[subName].push(pct);
            }

            const subjectAvgs = Object.entries(subjectScores).map(([name, scores]) => ({
                name,
                avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
            }));

            const weakSubjects = subjectAvgs.filter(s => s.avg < 50).map(s => s.name);
            const overallAvg   = subjectAvgs.length
                ? Math.round(subjectAvgs.reduce((s, v) => s + v.avg, 0) / subjectAvgs.length)
                : null;

            // ── Risk score ──────────────────────────────────────────────────
            // Higher = more at risk. Formula: 100 - weighted(attendance 50% + score 50%)
            let riskScore = null;
            if (attendancePercent != null && overallAvg != null) {
                riskScore = Math.round(100 - (attendancePercent * 0.5 + overallAvg * 0.5));
            } else if (attendancePercent != null) {
                riskScore = Math.round(100 - attendancePercent);
            } else if (overallAvg != null) {
                riskScore = Math.round(100 - overallAvg);
            }

            return {
                studentId:       s._id,
                name:            s.name,
                rollNum:         s.rollNum,
                attendancePercent,
                overallAvg,
                weakSubjects,
                subjectAvgs,
                riskScore,
            };
        }));

        // Sort by risk descending, only include students with some signal
        const atRisk = results
            .filter(s => s.riskScore != null)
            .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

        res.json(atRisk);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getClassInsights };
