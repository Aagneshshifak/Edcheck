const mongoose = require("mongoose");
const TestAttempt = require("../models/testAttemptSchema");
const Student     = require("../models/studentSchema");
const Assignment  = require("../models/assignmentSchema");
const Submission  = require("../models/submissionSchema");
const Sclass      = require("../models/sclassSchema");

// GET /Admin/analytics/overview/:schoolId
// Returns: avgScoresByClass, completionRatesByClass, attendanceTrend30d
const getAnalyticsOverview = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        // ── 1. Average test score by class ──────────────────────────────────
        const avgScoresByClass = await TestAttempt.aggregate([
            {
                $lookup: {
                    from: "tests",
                    localField: "testId",
                    foreignField: "_id",
                    as: "test"
                }
            },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId } },
            {
                $group: {
                    _id: "$test.classId",
                    avgScore: { $avg: "$score" }
                }
            },
            {
                $lookup: {
                    from: "sclasses",
                    localField: "_id",
                    foreignField: "_id",
                    as: "classInfo"
                }
            },
            { $unwind: { path: "$classInfo", preserveNullAndEmpty: true } },
            {
                $project: {
                    classId: "$_id",
                    className: {
                        $ifNull: ["$classInfo.className", "$classInfo.sclassName"]
                    },
                    avgScore: { $round: ["$avgScore", 2] }
                }
            },
            { $sort: { className: 1 } }
        ]);

        // ── 2. Assignment completion rates by class ──────────────────────────
        const classes = await Sclass.find({
            $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }]
        }).lean();

        const completionRatesByClass = await Promise.all(
            classes.map(async (cls) => {
                const assignments = await Assignment.find({
                    school: schoolObjectId,
                    sclassName: cls._id
                }).lean();

                if (assignments.length === 0) {
                    return {
                        classId: cls._id,
                        className: cls.className || cls.sclassName,
                        completionRate: null
                    };
                }

                const studentCount = await Student.countDocuments({
                    $or: [{ classId: cls._id }, { sclassName: cls._id }]
                });

                if (studentCount === 0) {
                    return {
                        classId: cls._id,
                        className: cls.className || cls.sclassName,
                        completionRate: null
                    };
                }

                const totalExpected = assignments.length * studentCount;
                const totalSubmissions = await Submission.countDocuments({
                    assignmentId: { $in: assignments.map((a) => a._id) }
                });

                const completionRate = Math.round((totalSubmissions / totalExpected) * 100);

                return {
                    classId: cls._id,
                    className: cls.className || cls.sclassName,
                    completionRate
                };
            })
        );

        // ── 3. Attendance trend — last 30 days ───────────────────────────────
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const attendanceTrend30d = await Student.aggregate([
            { $match: { $or: [{ schoolId: schoolObjectId }, { school: schoolObjectId }] } },
            { $unwind: "$attendance" },
            { $match: { "attendance.date": { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$attendance.date" }
                    },
                    present: {
                        $sum: {
                            $cond: [{ $eq: ["$attendance.status", "Present"] }, 1, 0]
                        }
                    },
                    total: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: "$_id",
                    present: 1,
                    total: 1,
                    attendanceRate: {
                        $cond: [
                            { $eq: ["$total", 0] },
                            0,
                            { $round: [{ $multiply: [{ $divide: ["$present", "$total"] }, 100] }, 1] }
                        ]
                    }
                }
            }
        ]);

        res.status(200).json({ avgScoresByClass, completionRatesByClass, attendanceTrend30d });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/leaderboard/:schoolId
// Returns top 10 students by average test score
const getLeaderboard = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const leaderboard = await TestAttempt.aggregate([
            {
                $lookup: {
                    from: "tests",
                    localField: "testId",
                    foreignField: "_id",
                    as: "test"
                }
            },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId } },
            {
                $group: {
                    _id: "$studentId",
                    avgScore:     { $avg: "$score" },
                    attemptCount: { $sum: 1 }
                }
            },
            { $sort: { avgScore: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "students",
                    localField: "_id",
                    foreignField: "_id",
                    as: "student"
                }
            },
            { $unwind: "$student" },
            {
                $lookup: {
                    from: "sclasses",
                    localField: "student.classId",
                    foreignField: "_id",
                    as: "classInfo"
                }
            },
            { $unwind: { path: "$classInfo", preserveNullAndEmpty: true } },
            {
                $project: {
                    studentId:    "$_id",
                    studentName:  "$student.name",
                    rollNum:      "$student.rollNum",
                    className: {
                        $ifNull: ["$classInfo.className", "$classInfo.sclassName"]
                    },
                    avgScore:     { $round: ["$avgScore", 2] },
                    attemptCount: 1
                }
            }
        ]);

        res.status(200).json(leaderboard);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/analytics/subjectDifficulty/:schoolId
// Returns average score per subject across all classes
const getSubjectDifficulty = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const schoolObjectId = new mongoose.Types.ObjectId(schoolId);

        const subjectDifficulty = await TestAttempt.aggregate([
            {
                $lookup: {
                    from: "tests",
                    localField: "testId",
                    foreignField: "_id",
                    as: "test"
                }
            },
            { $unwind: "$test" },
            { $match: { "test.school": schoolObjectId, "test.subject": { $exists: true, $ne: null } } },
            {
                $group: {
                    _id:          "$test.subject",
                    avgScore:     { $avg: "$score" },
                    attemptCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "subjects",
                    localField: "_id",
                    foreignField: "_id",
                    as: "subject"
                }
            },
            { $unwind: { path: "$subject", preserveNullAndEmpty: true } },
            {
                $project: {
                    subjectId:   "$_id",
                    subjectName: {
                        $ifNull: ["$subject.subjectName", "$subject.subName"]
                    },
                    avgScore:     { $round: ["$avgScore", 2] },
                    attemptCount: 1
                }
            },
            { $sort: { avgScore: 1 } }
        ]);

        res.status(200).json(subjectDifficulty);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAnalyticsOverview, getLeaderboard, getSubjectDifficulty };
