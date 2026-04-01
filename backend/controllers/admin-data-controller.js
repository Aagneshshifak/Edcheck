const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Subject = require('../models/subjectSchema.js');
const TestAttempt = require('../models/testAttemptSchema.js');
const Test = require('../models/testSchema.js');
const Submission = require('../models/submissionSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const ActivityLog = require('../models/activityLogSchema.js');
const { logger } = require('../utils/serverLogger.js');

// Helper: format today as YYYY-MM-DD
const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Exports ──────────────────────────────────────────────────────────────────

// GET /Admin/data/export/students/:schoolId
const exportStudents = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        const students = await Student.find({ schoolId })
            .populate('classId', 'sclassName className')
            .select('name rollNum classId email status');

        const header = 'name,rollNum,class,email\n';
        const rows = students.map(s => {
            const cls = s.classId ? (s.classId.sclassName || s.classId.className || '') : '';
            const email = s.email || '';
            return `"${s.name}","${s.rollNum}","${cls}","${email}"`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="students_${todayStr()}.csv"`);
        res.send(header + rows);
    } catch (err) {
        logger.error('exportStudents failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/data/export/teachers/:schoolId
const exportTeachers = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        const teachers = await Teacher.find({ schoolId })
            .populate('teachSubjects', 'subjectName subName')
            .select('name email teachSubjects status');

        const header = 'name,email,subjects,status\n';
        const rows = teachers.map(t => {
            const subjects = (t.teachSubjects || [])
                .map(s => s.subjectName || s.subName || '')
                .filter(Boolean)
                .join('; ');
            return `"${t.name}","${t.email}","${subjects}","${t.status || 'active'}"`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="teachers_${todayStr()}.csv"`);
        res.send(header + rows);
    } catch (err) {
        logger.error('exportTeachers failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/data/export/classes/:schoolId
const exportClasses = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        const classes = await Sclass.find({ schoolId }).select('sclassName className _id');

        const rows = await Promise.all(classes.map(async (cls) => {
            const subjectCount = await Subject.countDocuments({ classId: cls._id });
            const teacherCount = await Teacher.countDocuments({ teachClasses: cls._id });
            const name = cls.sclassName || cls.className || '';
            return `"${name}","${subjectCount}","${teacherCount}"`;
        }));

        const header = 'class,subjectCount,teacherCount\n';
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="classes_${todayStr()}.csv"`);
        res.send(header + rows.join('\n'));
    } catch (err) {
        logger.error('exportClasses failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/data/export/testResults/:schoolId
const exportTestResults = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        // Get all tests for this school to scope attempts
        const testIds = await Test.find({ school: schoolId }).distinct('_id');

        const attempts = await TestAttempt.find({ testId: { $in: testIds } })
            .populate('studentId', 'name')
            .populate('testId', 'title')
            .select('studentId testId score totalMarks submittedAt');

        const header = 'studentName,testTitle,score,totalMarks,date\n';
        const rows = attempts.map(a => {
            const studentName = a.studentId ? a.studentId.name : '';
            const testTitle = a.testId ? a.testId.title : '';
            const date = a.submittedAt ? a.submittedAt.toISOString().slice(0, 10) : '';
            return `"${studentName}","${testTitle}","${a.score ?? ''}","${a.totalMarks ?? ''}","${date}"`;
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="test-results_${todayStr()}.csv"`);
        res.send(header + rows);
    } catch (err) {
        logger.error('exportTestResults failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// ── Import History ────────────────────────────────────────────────────────────

// GET /Admin/data/importHistory/:schoolId
const getImportHistory = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 20);
        const skip = (page - 1) * limit;

        const filter = {
            schoolId,
            action: { $regex: /bulk/i },
        };

        const [logs, total] = await Promise.all([
            ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            ActivityLog.countDocuments(filter),
        ]);

        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
        logger.error('getImportHistory failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// ── Orphan Management ─────────────────────────────────────────────────────────

// GET /Admin/data/orphans/:schoolId
const getOrphans = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        // All valid test IDs for this school
        const validTestIds = await Test.find({ school: schoolId }).distinct('_id');
        // All valid assignment IDs for this school
        const validAssignmentIds = await Assignment.find({ school: schoolId }).distinct('_id');
        // All valid subject IDs for this school
        const validSubjectIds = await Subject.find({ schoolId }).distinct('_id');

        // Orphaned test attempts: testId not in valid tests for this school
        const orphanedAttempts = await TestAttempt.find({
            testId: { $nin: validTestIds },
        }).select('_id studentId testId');

        // Orphaned submissions: assignmentId not in valid assignments for this school
        const orphanedSubmissions = await Submission.find({
            school: schoolId,
            assignmentId: { $nin: validAssignmentIds },
        }).select('_id studentId assignmentId');

        // Orphaned attendance: students with attendance entries referencing deleted subjects
        const studentsWithOrphanAttendance = await Student.find({
            schoolId,
            'attendance.subjectId': { $nin: validSubjectIds },
        }).select('_id name');

        res.json({
            orphanedAttempts: orphanedAttempts.length,
            orphanedSubmissions: orphanedSubmissions.length,
            orphanedAttendanceStudents: studentsWithOrphanAttendance.length,
            details: {
                attemptIds: orphanedAttempts.map(a => a._id),
                submissionIds: orphanedSubmissions.map(s => s._id),
                studentIds: studentsWithOrphanAttendance.map(s => s._id),
            },
        });
    } catch (err) {
        logger.error('getOrphans failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/data/orphans/:schoolId
const deleteOrphans = async (req, res) => {
    try {
        const schoolId = req.params.schoolId || req.query.schoolId;
        if (!schoolId) return res.status(400).json({ message: 'schoolId is required' });

        const validTestIds = await Test.find({ school: schoolId }).distinct('_id');
        const validAssignmentIds = await Assignment.find({ school: schoolId }).distinct('_id');
        const validSubjectIds = await Subject.find({ schoolId }).distinct('_id');

        // Delete orphaned test attempts
        const attemptResult = await TestAttempt.deleteMany({
            testId: { $nin: validTestIds },
        });

        // Delete orphaned submissions for this school
        const submissionResult = await Submission.deleteMany({
            school: schoolId,
            assignmentId: { $nin: validAssignmentIds },
        });

        // Pull orphaned attendance entries from students
        const attendanceResult = await Student.updateMany(
            { schoolId, 'attendance.subjectId': { $nin: validSubjectIds } },
            { $pull: { attendance: { subjectId: { $nin: validSubjectIds } } } }
        );

        logger.info('deleteOrphans completed', {
            schoolId,
            deletedAttempts: attemptResult.deletedCount,
            deletedSubmissions: submissionResult.deletedCount,
            updatedStudents: attendanceResult.modifiedCount,
        });

        res.json({
            deletedAttempts: attemptResult.deletedCount,
            deletedSubmissions: submissionResult.deletedCount,
            updatedStudents: attendanceResult.modifiedCount,
        });
    } catch (err) {
        logger.error('deleteOrphans failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    exportStudents,
    exportTeachers,
    exportClasses,
    exportTestResults,
    getImportHistory,
    getOrphans,
    deleteOrphans,
};
