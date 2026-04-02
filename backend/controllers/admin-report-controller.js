const mongoose = require('mongoose');
const Student    = require('../models/studentSchema');
const Teacher    = require('../models/teacherSchema');
const Assignment = require('../models/assignmentSchema');
const Submission = require('../models/submissionSchema');
const TestAttempt = require('../models/testAttemptSchema');

// ── Helpers ──────────────────────────────────────────────────────────────────

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const dateFilter = (from, to) => {
    if (!from && !to) return null;
    const filter = {};
    if (from) filter.$gte = new Date(from);
    if (to)   filter.$lte = new Date(to);
    return filter;
};

// ── GET /Admin/reports/studentPerformance/:schoolId ──────────────────────────
// Returns per-student, per-subject average test scores
const getStudentPerformance = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { classId, subjectId, from, to } = req.query;
        const schoolOid = toObjectId(schoolId);

        const matchTest = { 'test.school': schoolOid };
        if (classId)   matchTest['test.classId'] = toObjectId(classId);
        if (subjectId) matchTest['test.subject']  = toObjectId(subjectId);

        const dateMatch = dateFilter(from, to);
        if (dateMatch) matchTest.submittedAt = dateMatch;

        const rows = await TestAttempt.aggregate([
            {
                $lookup: {
                    from: 'tests',
                    localField: 'testId',
                    foreignField: '_id',
                    as: 'test',
                }
            },
            { $unwind: '$test' },
            { $match: matchTest },
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'student',
                }
            },
            { $unwind: '$student' },
            {
                $lookup: {
                    from: 'sclasses',
                    localField: 'test.classId',
                    foreignField: '_id',
                    as: 'classInfo',
                }
            },
            { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'test.subject',
                    foreignField: '_id',
                    as: 'subjectInfo',
                }
            },
            { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: {
                        studentId:  '$studentId',
                        subjectId:  '$test.subject',
                        classId:    '$test.classId',
                    },
                    studentName:   { $first: '$student.name' },
                    className:     { $first: { $ifNull: ['$classInfo.sclassName', '$classInfo.className'] } },
                    subjectName:   { $first: { $ifNull: ['$subjectInfo.subName', '$subjectInfo.subjectName'] } },
                    avgScore:      { $avg: '$score' },
                    totalAttempts: { $sum: 1 },
                }
            },
            {
                $project: {
                    _id: 0,
                    studentName:   1,
                    className:     1,
                    subjectName:   1,
                    avgScore:      { $round: ['$avgScore', 1] },
                    totalAttempts: 1,
                }
            },
            { $sort: { studentName: 1, subjectName: 1 } },
        ]);

        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /Admin/reports/classAttendance/:schoolId ─────────────────────────────
// Returns per-student, per-subject attendance percentages
const getClassAttendanceReport = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { classId, from, to } = req.query;
        const schoolOid = toObjectId(schoolId);

        const studentMatch = {
            $or: [{ schoolId: schoolOid }, { school: schoolOid }],
        };
        if (classId) {
            const classOid = toObjectId(classId);
            studentMatch.$or = undefined;
            studentMatch.$and = [
                { $or: [{ schoolId: schoolOid }, { school: schoolOid }] },
                { $or: [{ classId: classOid }, { sclassName: classOid }] },
            ];
        }

        const attendanceDateFilter = dateFilter(from, to);

        const pipeline = [
            { $match: studentMatch },
            { $unwind: '$attendance' },
        ];

        if (attendanceDateFilter) {
            pipeline.push({ $match: { 'attendance.date': attendanceDateFilter } });
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'sclasses',
                    localField: 'classId',
                    foreignField: '_id',
                    as: 'classInfo',
                }
            },
            { $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'attendance.subjectId',
                    foreignField: '_id',
                    as: 'subjectInfo',
                }
            },
            { $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: {
                        studentId:  '$_id',
                        subjectId:  '$attendance.subjectId',
                    },
                    studentName:  { $first: '$name' },
                    className:    { $first: { $ifNull: ['$classInfo.sclassName', '$classInfo.className'] } },
                    subjectName:  { $first: { $ifNull: ['$subjectInfo.subName', '$subjectInfo.subjectName'] } },
                    presentCount: { $sum: { $cond: [{ $eq: ['$attendance.status', 'Present'] }, 1, 0] } },
                    absentCount:  { $sum: { $cond: [{ $eq: ['$attendance.status', 'Absent'] }, 1, 0] } },
                    total:        { $sum: 1 },
                }
            },
            {
                $project: {
                    _id: 0,
                    studentName:  1,
                    className:    1,
                    subjectName:  1,
                    presentCount: 1,
                    absentCount:  1,
                    attendancePercentage: {
                        $cond: [
                            { $eq: ['$total', 0] },
                            0,
                            { $round: [{ $multiply: [{ $divide: ['$presentCount', '$total'] }, 100] }, 1] },
                        ]
                    },
                }
            },
            { $sort: { studentName: 1, subjectName: 1 } }
        );

        const rows = await Student.aggregate(pipeline);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /Admin/reports/teacherActivity/:schoolId ─────────────────────────────
// Returns per-teacher assignment and test creation counts
const getTeacherActivity = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { from, to } = req.query;
        const schoolOid = toObjectId(schoolId);

        const teachers = await Teacher.find({
            $or: [{ schoolId: schoolOid }, { school: schoolOid }],
        }).lean();

        const dateMatch = dateFilter(from, to);

        const rows = await Promise.all(
            teachers.map(async (teacher) => {
                const assignmentQuery = { createdBy: teacher._id };
                if (dateMatch) assignmentQuery.createdAt = dateMatch;

                const testQuery = { createdBy: teacher._id };
                if (dateMatch) testQuery.createdAt = dateMatch;

                const [assignmentsCreated, testsCreated] = await Promise.all([
                    Assignment.countDocuments(assignmentQuery),
                    mongoose.model('test').countDocuments(testQuery),
                ]);

                return {
                    teacherName:       teacher.name,
                    assignmentsCreated,
                    testsCreated,
                    totalActivity:     assignmentsCreated + testsCreated,
                };
            })
        );

        // Sort by total activity descending
        rows.sort((a, b) => b.totalActivity - a.totalActivity);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── GET /Admin/reports/assignmentCompletion/:schoolId ────────────────────────
// Returns per-assignment completion rates
const getAssignmentCompletion = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { classId, subjectId } = req.query;
        const schoolOid = toObjectId(schoolId);

        const assignmentQuery = { school: schoolOid };
        if (classId)   assignmentQuery.sclassName = toObjectId(classId);
        if (subjectId) assignmentQuery.subject     = toObjectId(subjectId);

        const assignments = await Assignment.find(assignmentQuery)
            .populate('sclassName', 'sclassName className')
            .populate('subject', 'subName subjectName')
            .lean();

        const rows = await Promise.all(
            assignments.map(async (assignment) => {
                const classOid = assignment.sclassName?._id || assignment.sclassName;

                const [totalStudents, submittedCount] = await Promise.all([
                    Student.countDocuments({
                        $or: [{ classId: classOid }, { sclassName: classOid }],
                    }),
                    Submission.countDocuments({ assignmentId: assignment._id }),
                ]);

                const completionRate = totalStudents > 0
                    ? Math.round((submittedCount / totalStudents) * 100)
                    : 0;

                const cls = assignment.sclassName;
                const sub = assignment.subject;

                return {
                    assignmentTitle: assignment.title,
                    className:       cls?.sclassName || cls?.className || '—',
                    subjectName:     sub?.subName || sub?.subjectName || '—',
                    totalStudents,
                    submittedCount,
                    completionRate,
                };
            })
        );

        rows.sort((a, b) => a.assignmentTitle.localeCompare(b.assignmentTitle));
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getStudentPerformance,
    getClassAttendanceReport,
    getTeacherActivity,
    getAssignmentCompletion,
};
