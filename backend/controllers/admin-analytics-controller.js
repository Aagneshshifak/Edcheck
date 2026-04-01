const mongoose = require("mongoose");
const TestAttempt = require("../models/testAttemptSchema");
const Student     = require("../models/studentSchema");
const Assignment  = require("../models/assignmentSchema");
const Submission  = require("../models/submissionSchema");
const Sclass      = require("../models/sclassSchema");
const Teacher     = require("../models/teacherSchema");
const Subject     = require("../models/subjectSchema");

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
            { $unwind: { path: "$classInfo", preserveNullAndEmpty: true } },
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
            { $unwind: { path: "$subjectInfo", preserveNullAndEmpty: true } },
            { $lookup: { from: "sclasses", localField: "_id.class", foreignField: "_id", as: "classInfo" } },
            { $unwind: { path: "$classInfo", preserveNullAndEmpty: true } },
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
            { $unwind: { path: "$classInfo", preserveNullAndEmpty: true } },
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
            { $unwind: { path: "$subject", preserveNullAndEmpty: true } },
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

module.exports = { getAnalyticsOverview, getLeaderboard, getSubjectDifficulty, getTeacherPerformance, getStudentRisk };
