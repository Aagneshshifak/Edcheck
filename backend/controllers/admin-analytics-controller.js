const mongoose = require("mongoose");
const TestAttempt = require("../models/testAttemptSchema");
const Student     = require("../models/studentSchema");
const Assignment  = require("../models/assignmentSchema");
const Submission  = require("../models/submissionSchema");
const Sclass      = require("../models/sclassSchema");
const Teacher     = require("../models/teacherSchema");
const Subject     = require("../models/subjectSchema");
const Parent       = require("../models/parentSchema");
const Notification = require("../models/notificationSchema");

// GET /Admin/analytics/overview/:schoolId
const getAnalyticsOverview = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        // 1. Average test score by class
        const avgScoresByClass = await TestAttempt.aggregate([
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId } },
            { $group: { _id: "$test.classId", avgScore: { $avg: "$score" } } },
            { $lookup: { from: "sclasses", localField: "_id", foreignField: "_id", as: "classInfo" } },
            { $unwind: { path: "$classInfo", preserveNullAndEmptyArrays: true } },
            { $project: { classId: "$_id", className: { $ifNull: ["$classInfo.className", "$classInfo.sclassName"] }, avgScore: { $round: ["$avgScore", 2] } } },
            { $sort: { className: 1 } }
        ]);

        // 2. Assignment completion rates by class
        const classes = await Sclass.find({ $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }] }).lean();
        const completionRatesByClass = await Promise.all(classes.map(async (cls) => {
            const assignments = await Assignment.find({ school: schoolObjectId, sclassName: cls._id }).lean();
            if (!assignments.length) return { classId: cls._id, className: cls.className || cls.sclassName, completionRate: null };
            const studentCount = await Student.countDocuments({ $or: [{ classId: cls._id }, { sclassName: cls._id }] });
            if (!studentCount) return { classId: cls._id, className: cls.className || cls.sclassName, completionRate: null };
            const totalSubmissions = await Submission.countDocuments({ assignmentId: { $in: assignments.map(a => a._id) } });
            return { classId: cls._id, className: cls.className || cls.sclassName, completionRate: Math.round((totalSubmissions / (assignments.length * studentCount)) * 100) };
        }));

        // 3. Attendance trend — last 30 days
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const attendanceTrend30d = await Student.aggregate([
            { $match: { $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }] } },
            { $unwind: "$attendance" },
            { $match: { "attendance.date": { $gte: thirtyDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$attendance.date" } }, present: { $sum: { $cond: [{ $eq: ["$attendance.status", "Present"] }, 1, 0] } }, total: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { date: "$_id", present: 1, total: 1, attendanceRate: { $cond: [{ $eq: ["$total", 0] }, 0, { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] }] } } }
        ]);

        // 4. Subject-wise performance (avg score per subject)
        const subjectPerformance = await TestAttempt.aggregate([
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId, "test.subject": { $exists: true, $ne: null } } },
            { $group: { _id: { subject: "$test.subject", class: "$test.classId" }, avgScore: { $avg: "$score" }, count: { $sum: 1 } } },
            { $lookup: { from: "subjects", localField: "_id.subject", foreignField: "_id", as: "subjectInfo" } },
            { $unwind: { path: "$subjectInfo", preserveNullAndEmptyArrays: true } },
            { $lookup: { from: "sclasses", localField: "_id.class", foreignField: "_id", as: "classInfo" } },
            { $unwind: { path: "$classInfo", preserveNullAndEmptyArrays: true } },
            { $project: {
                subjectName: { $ifNull: ["$subjectInfo.subjectName", "$subjectInfo.subName"] },
                className:   { $ifNull: ["$classInfo.className", "$classInfo.sclassName"] },
                avgScore:    { $round: ["$avgScore", 1] },
                count: 1
            }},
            { $sort: { className: 1, subjectName: 1 } }
        ]);

        res.status(200).json({ avgScoresByClass, completionRatesByClass, attendanceTrend30d, subjectPerformance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/leaderboard/:schoolId
const getLeaderboard = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
        const leaderboard = await TestAttempt.aggregate([
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId } },
            { $group: { _id: "$studentId", avgScore: { $avg: "$score" }, attemptCount: { $sum: 1 } } },
            { $sort: { avgScore: -1 } },
            { $limit: 10 },
            { $lookup: { from: "students", localField: "_id", foreignField: "_id", as: "student" } },
            { $unwind: "$student" },
            { $lookup: { from: "sclasses", localField: "student.classId", foreignField: "_id", as: "classInfo" } },
            { $unwind: { path: "$classInfo", preserveNullAndEmptyArrays: true } },
            { $project: { studentId: "$_id", studentName: "$student.name", rollNum: "$student.rollNum", className: { $ifNull: ["$classInfo.className", "$classInfo.sclassName"] }, avgScore: { $round: ["$avgScore", 2] }, attemptCount: 1 } }
        ]);
        res.status(200).json(leaderboard);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/subjectDifficulty/:schoolId
const getSubjectDifficulty = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
        const subjectDifficulty = await TestAttempt.aggregate([
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId, "test.subject": { $exists: true, $ne: null } } },
            { $group: { _id: "$test.subject", avgScore: { $avg: "$score" }, attemptCount: { $sum: 1 } } },
            { $lookup: { from: "subjects", localField: "_id", foreignField: "_id", as: "subject" } },
            { $unwind: { path: "$subject", preserveNullAndEmptyArrays: true } },
            { $project: { subjectId: "$_id", subjectName: { $ifNull: ["$subject.subjectName", "$subject.subName"] }, avgScore: { $round: ["$avgScore", 2] }, attemptCount: 1 } },
            { $sort: { avgScore: 1 } }
        ]);
        res.status(200).json(subjectDifficulty);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/teachers/:schoolId  — teacher performance scores
const getTeacherPerformance = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const teachers = await Teacher.find({
            $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }]
        }).populate('teachSubjects', 'subName').lean();

        const results = await Promise.all(teachers.map(async (t) => {
            // Avg student score on this teacher's tests
            const testIds = await require('../models/testSchema').find({ createdBy: t._id }).distinct('_id');
            const scoreAgg = await TestAttempt.aggregate([
                { $match: { testId: { $in: testIds } } },
                { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$score', { $ifNull: ['$totalMarks', 1] }] }, 100] } } } }
            ]);
            const avgStudentScore = scoreAgg[0]?.avg != null ? Math.round(scoreAgg[0].avg * 10) / 10 : null;

            // Assignment completion rate
            const assignments = await Assignment.find({ createdBy: t._id }).lean();
            let assignmentCompletionRate = null;
            if (assignments.length > 0) {
                const totalSubs = await Submission.countDocuments({ assignmentId: { $in: assignments.map(a => a._id) } });
                // estimate expected: each assignment × students in that class
                let totalExpected = 0;
                for (const a of assignments) {
                    const cnt = await Student.countDocuments({ $or: [{ classId: a.sclassName }, { sclassName: a.sclassName }] });
                    totalExpected += cnt;
                }
                assignmentCompletionRate = totalExpected > 0 ? Math.round((totalSubs / totalExpected) * 100) : null;
            }

            // Composite performance score: 60% avg student score + 40% assignment completion
            let performanceScore = null;
            if (avgStudentScore != null && assignmentCompletionRate != null) {
                performanceScore = Math.round(avgStudentScore * 0.6 + assignmentCompletionRate * 0.4);
            } else if (avgStudentScore != null) {
                performanceScore = Math.round(avgStudentScore);
            } else if (assignmentCompletionRate != null) {
                performanceScore = Math.round(assignmentCompletionRate);
            }

            return {
                teacherId: t._id,
                name: t.name,
                email: t.email,
                subjects: t.teachSubjects?.map(s => s.subName) || [],
                testsCreated: testIds.length,
                assignmentsCreated: assignments.length,
                avgStudentScore,
                assignmentCompletionRate,
                performanceScore,
            };
        }));

        res.json(results.sort((a, b) => (b.performanceScore ?? -1) - (a.performanceScore ?? -1)));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/risk/:schoolId  — student risk monitoring
const getStudentRisk = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const students = await Student.find({
            $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }]
        }).populate('classId', 'sclassName').lean();

        const results = await Promise.all(students.map(async (s) => {
            // Attendance rate
            const total   = s.attendance?.length || 0;
            const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
            const attendanceRate = total > 0 ? (present / total) * 100 : null;

            // Avg test score
            const attempts = await TestAttempt.find({ studentId: s._id }).lean();
            const avgScore = attempts.length > 0
                ? attempts.reduce((sum, a) => sum + ((a.score / (a.totalMarks || 1)) * 100), 0) / attempts.length
                : null;

            // Risk score: higher = more at risk
            // Formula: 100 - weighted(attendance 50% + score 50%)
            let riskScore = null;
            if (attendanceRate != null && avgScore != null) {
                riskScore = Math.round(100 - (attendanceRate * 0.5 + avgScore * 0.5));
            } else if (attendanceRate != null) {
                riskScore = Math.round(100 - attendanceRate);
            } else if (avgScore != null) {
                riskScore = Math.round(100 - avgScore);
            }

            // Risk flags
            const flags = [];
            if (attendanceRate != null && attendanceRate < 75) flags.push('Low Attendance');
            if (avgScore != null && avgScore < 50) flags.push('Low Scores');
            if (s.status === 'suspended') flags.push('Suspended');

            return {
                studentId: s._id,
                name: s.name,
                rollNum: s.rollNum,
                className: s.classId?.sclassName || '—',
                status: s.status || 'active',
                attendanceRate: attendanceRate != null ? Math.round(attendanceRate * 10) / 10 : null,
                avgScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
                riskScore,
                flags,
            };
        }));

        // Return sorted by risk score descending, only students with some risk signal
        const atRisk = results
            .filter(s => s.riskScore != null && (s.riskScore > 30 || s.flags.length > 0))
            .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

        res.json(atRisk);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Helper: compute mean, median, stddev ─────────────────────────────────────
function computeStats(scores) {
    const n = scores.length;
    if (n === 0) return { mean: 0, median: 0, stddev: 0 };
    const mean = scores.reduce((s, v) => s + v, 0) / n;
    const sorted = [...scores].sort((a, b) => a - b);
    const median = n % 2 === 1
        ? sorted[Math.floor(n / 2)]
        : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    return {
        mean:   Math.round(mean   * 10) / 10,
        median: Math.round(median * 10) / 10,
        stddev: Math.round(stddev * 10) / 10,
    };
}

// GET /Admin/analytics/gradeDistribution/:schoolId
// Query: classId?, subjectId?, testId?
const getGradeDistribution = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { classId, subjectId, testId } = req.query;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        // Build match stage via test lookup
        const testMatch = { "test.school": schoolObjectId };
        if (classId)   testMatch["test.classId"]  = new mongoose.Types.ObjectId(classId);
        if (subjectId) testMatch["test.subject"]   = new mongoose.Types.ObjectId(subjectId);
        if (testId)    testMatch["test._id"]        = new mongoose.Types.ObjectId(testId);

        const attempts = await TestAttempt.aggregate([
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: testMatch },
            { $match: { score: { $ne: null }, totalMarks: { $gt: 0 } } },
            { $project: { pct: { $multiply: [{ $divide: ["$score", "$totalMarks"] }, 100] } } },
        ]);

        const scores = attempts.map(a => Math.min(100, Math.max(0, a.pct)));

        // 11 buckets: 0-9, 10-19, ..., 90-100
        const bucketDefs = [
            "0-9","10-19","20-29","30-39","40-49",
            "50-59","60-69","70-79","80-89","90-100",
        ];
        const counts = new Array(10).fill(0);
        for (const s of scores) {
            const idx = s >= 100 ? 9 : Math.floor(s / 10);
            counts[idx]++;
        }
        const buckets = bucketDefs.map((range, i) => ({ range, count: counts[i] }));

        const stats = computeStats(scores);

        const threshold = 50;
        const pass = scores.filter(s => s >= threshold).length;
        const fail = scores.length - pass;

        res.status(200).json({
            buckets,
            stats,
            passFailRatio: { pass, fail, threshold },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/cohortProgression/:schoolId
// Query: classId?
const getCohortProgression = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        // Build last 6 calendar months (YYYY-MM strings, oldest first)
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
        const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Fetch all classes for this school
        const allClasses = await Sclass.find({
            $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }],
        }).lean();

        const classFilter = req.query.classId
            ? allClasses.filter(c => c._id.toString() === req.query.classId)
            : allClasses;

        // Aggregate test attempts grouped by classId + month
        const scoreAgg = await TestAttempt.aggregate([
            { $match: { submittedAt: { $gte: windowStart } } },
            { $lookup: { from: "tests", localField: "testId", foreignField: "_id", as: "test" } },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId, score: { $ne: null }, totalMarks: { $gt: 0 } } },
            {
                $group: {
                    _id: {
                        classId: "$test.classId",
                        month: { $dateToString: { format: "%Y-%m", date: "$submittedAt" } },
                    },
                    avgScore: { $avg: { $multiply: [{ $divide: ["$score", "$totalMarks"] }, 100] } },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Build lookup: classId+month → avgScore
        const scoreMap = {};
        for (const row of scoreAgg) {
            const key = `${row._id.classId}_${row._id.month}`;
            scoreMap[key] = Math.round(row.avgScore * 10) / 10;
        }

        // Per-class series
        const series = classFilter.map(cls => {
            const data = months.map(m => {
                const key = `${cls._id}_${m}`;
                return scoreMap[key] ?? null;
            });
            return {
                classId: cls._id,
                className: cls.className || cls.sclassName,
                data,
            };
        });

        // School-wide average per month
        const schoolAvgData = months.map(m => {
            const vals = scoreAgg
                .filter(r => r._id.month === m)
                .map(r => r.avgScore);
            if (!vals.length) return null;
            return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
        });
        series.push({ classId: "school", className: "School Average", data: schoolAvgData });

        // Assignment submission rates per class per month
        const submissionRates = await Promise.all(classFilter.map(async (cls) => {
            const data = await Promise.all(months.map(async (m) => {
                const [year, month] = m.split("-").map(Number);
                const start = new Date(year, month - 1, 1);
                const end   = new Date(year, month, 1);

                const assignments = await Assignment.find({
                    school: schoolObjectId,
                    sclassName: cls._id,
                    createdAt: { $gte: start, $lt: end },
                }).lean();

                if (!assignments.length) return null;

                const studentCount = await Student.countDocuments({
                    $or: [{ classId: cls._id }, { sclassName: cls._id }],
                });
                if (!studentCount) return null;

                const submitted = await Submission.countDocuments({
                    assignmentId: { $in: assignments.map(a => a._id) },
                    submittedAt: { $gte: start, $lt: end },
                });

                const expected = assignments.length * studentCount;
                const rate = Math.min(1, submitted / expected);
                return Math.round(rate * 100) / 100;
            }));
            return {
                classId: cls._id,
                className: cls.className || cls.sclassName,
                data,
            };
        }));

        res.status(200).json({ months, series, submissionRates });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/riskTrends/:schoolId
const getRiskTrends = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const now = new Date();
        const last30Start  = new Date(now); last30Start.setDate(now.getDate() - 30);
        const prior30Start = new Date(now); prior30Start.setDate(now.getDate() - 60);

        const students = await Student.find({
            $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }],
        }).populate("classId", "sclassName className").lean();

        const attendanceDecline = [];
        const scoreDecline = [];

        for (const s of students) {
            const className = s.classId?.sclassName || s.classId?.className || "—";

            // ── Attendance decline ──────────────────────────────────────────
            const att = s.attendance || [];
            const last30  = att.filter(a => a.date >= last30Start);
            const prior30 = att.filter(a => a.date >= prior30Start && a.date < last30Start);

            if (last30.length > 0 && prior30.length > 0) {
                const last30Rate  = (last30.filter(a => a.status === "Present").length  / last30.length)  * 100;
                const prior30Rate = (prior30.filter(a => a.status === "Present").length / prior30.length) * 100;
                const delta = Math.round((last30Rate - prior30Rate) * 10) / 10;
                if (delta < -10) {
                    attendanceDecline.push({
                        studentId: s._id,
                        name: s.name,
                        className,
                        prior30: Math.round(prior30Rate * 10) / 10,
                        last30:  Math.round(last30Rate  * 10) / 10,
                        delta,
                    });
                }
            }

            // ── Score decline ───────────────────────────────────────────────
            const attempts = await TestAttempt.find({ studentId: s._id, submittedAt: { $ne: null } })
                .sort({ submittedAt: -1 })
                .limit(6)
                .lean();

            if (attempts.length >= 6) {
                const last3  = attempts.slice(0, 3);
                const prior3 = attempts.slice(3, 6);
                const avg = arr => arr.reduce((sum, a) => sum + ((a.score / (a.totalMarks || 1)) * 100), 0) / arr.length;
                const last3avg  = Math.round(avg(last3)  * 10) / 10;
                const prior3avg = Math.round(avg(prior3) * 10) / 10;
                const delta = Math.round((last3avg - prior3avg) * 10) / 10;
                if (delta < -15) {
                    scoreDecline.push({
                        studentId: s._id,
                        name: s.name,
                        className,
                        prior3avg,
                        last3avg,
                        delta,
                    });
                }
            }
        }

        const attendanceIds = new Set(attendanceDecline.map(s => s.studentId.toString()));
        const highRisk = scoreDecline
            .filter(s => attendanceIds.has(s.studentId.toString()))
            .map(s => s.studentId);

        res.status(200).json({ attendanceDecline, scoreDecline, highRisk });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/parentEngagement/:schoolId
const getParentEngagement = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const totalParents  = await Parent.countDocuments({ school: schoolObjectId });
        const activeParents = await Parent.countDocuments({
            school: schoolObjectId,
            lastLoginAt: { $gte: thirtyDaysAgo },
        });

        const activePercent = totalParents > 0
            ? Math.round((activeParents / totalParents) * 1000) / 10
            : 0;

        // Notification read rate — notificationSchema uses readStatus boolean per document
        // Each notification document is delivered to one userId; readStatus=true means read.
        // We scope to parent users by looking up parent userIds for this school.
        const parentIds = await Parent.find({ school: schoolObjectId }).distinct("_id");

        let delivered = 0;
        let read = 0;

        if (parentIds.length > 0) {
            const notifAgg = await Notification.aggregate([
                { $match: { userId: { $in: parentIds } } },
                {
                    $group: {
                        _id: null,
                        delivered: { $sum: 1 },
                        // Handle both readStatus boolean and readBy array (future-proof)
                        read: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ["$readStatus", true] },
                                            { $gt: [{ $size: { $ifNull: ["$readBy", []] } }, 0] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
            ]);

            if (notifAgg.length > 0) {
                delivered = notifAgg[0].delivered;
                read      = notifAgg[0].read;
            }
        }

        const notificationReadRate = delivered > 0
            ? Math.round((read / delivered) * 1000) / 10
            : 0;

        res.status(200).json({
            totalParents,
            activeParents,
            activePercent,
            notificationReadRate,
            delivered,
            read,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getAnalyticsOverview,
    getLeaderboard,
    getSubjectDifficulty,
    getTeacherPerformance,
    getStudentRisk,
    getGradeDistribution,
    getCohortProgression,
    getRiskTrends,
    getParentEngagement,
};
