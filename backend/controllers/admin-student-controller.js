const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');
const Parent = require('../models/parentSchema.js');
const TestAttempt = require('../models/testAttemptSchema.js');
const Test = require('../models/testSchema.js');
const Submission = require('../models/submissionSchema.js');
const { logger } = require('../utils/serverLogger.js');
const { logActivity } = require('../utils/activityLogger.js');

// POST /Admin/student/add
const addStudent = async (req, res) => {
    try {
        const { name, rollNum, password, classId, schoolId, parentName, parentPhone, parentId } = req.body;
        if (!name || !rollNum || !classId || !schoolId) {
            return res.status(400).json({ message: 'name, rollNum, classId and schoolId are required' });
        }

        const existing = await Student.findOne({ rollNum, classId });
        if (existing) return res.status(409).json({ message: 'Roll number already exists in this class' });

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password || String(rollNum), salt);

        const student = new Student({
            name, rollNum,
            password: hashed,
            classId, sclassName: classId,
            schoolId, school: schoolId,
            parentId: parentId || undefined,
            parentName: parentName || undefined,
            parentPhone: parentPhone || undefined,
            status: 'active',
        });
        await student.save();

        // Add student to class roster
        await Sclass.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });

        student.password = undefined;
        logger.info(`Student added: ${name}`, { schoolId, classId });
        logActivity({ schoolId, actorName: 'Admin', actorRole: 'Admin', action: 'added student', target: name, targetType: 'student' });
        res.status(201).json(student);
    } catch (err) {
        logger.error('addStudent failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/student/:id
const updateStudent = async (req, res) => {
    try {
        const { name, rollNum, classId, parentId, parentName, parentPhone, status } = req.body;
        const update = {};
        if (name)         update.name        = name;
        if (rollNum)      update.rollNum      = rollNum;
        if (parentId)     update.parentId     = parentId;
        if (parentName)   update.parentName   = parentName;
        if (parentPhone)  update.parentPhone  = parentPhone;
        if (status)       update.status       = status;

        // Handle class transfer: remove from old class, add to new
        const existing = await Student.findById(req.params.id).select('classId sclassName');
        if (!existing) return res.status(404).json({ message: 'Student not found' });

        if (classId !== undefined) {
            const oldClassId = existing.classId || existing.sclassName;
            const newClassId = classId || null;

            // Remove from old class roster
            if (oldClassId && String(oldClassId) !== String(newClassId)) {
                await Sclass.findByIdAndUpdate(oldClassId, { $pull: { students: existing._id } });
            }

            if (newClassId) {
                update.classId    = newClassId;
                update.sclassName = newClassId;
                // Add to new class roster
                await Sclass.findByIdAndUpdate(newClassId, { $addToSet: { students: existing._id } });
            } else {
                // Explicitly clearing class assignment
                update.classId    = null;
                update.sclassName = null;
            }
        }

        const student = await Student.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
            .populate('classId', 'sclassName')
            .populate('parentId', 'name phone');

        student.password = undefined;
        res.json(student);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/student/:id
const removeStudent = async (req, res) => {
    try {
        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) return res.status(404).json({ message: 'Student not found' });
        await Sclass.findByIdAndUpdate(student.classId, { $pull: { students: student._id } });
        logger.info(`Student removed: ${student.name}`);
        res.json({ message: 'Student removed', student });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/student/:id/performance
const getStudentPerformance = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('classId', 'sclassName')
            .populate('examResult.subjectId', 'subName')
            .populate('attendance.subjectId', 'subName');
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const attempts = await TestAttempt.find({ studentId: req.params.id })
            .populate({ path: 'testId', select: 'title subject', populate: { path: 'subject', select: 'subName' } });

        const avgScore = attempts.length
            ? (attempts.reduce((s, a) => s + (a.score / (a.totalMarks || 1)) * 100, 0) / attempts.length).toFixed(1)
            : null;

        const totalSessions = student.attendance.length;
        const presentSessions = student.attendance.filter(a => a.status === 'Present').length;
        const attendancePct = totalSessions ? ((presentSessions / totalSessions) * 100).toFixed(1) : null;

        student.password = undefined;
        res.json({
            student,
            stats: { avgTestScore: avgScore, attendancePercentage: attendancePct, totalAttempts: attempts.length },
            attempts,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/students/bulk-delete
const bulkDeleteStudents = async (req, res) => {
    try {
        const { studentIds, schoolId } = req.body;
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'studentIds must be a non-empty array' });
        }

        // Validate all students belong to the school
        const students = await Student.find({ _id: { $in: studentIds }, schoolId });
        if (students.length !== studentIds.length) {
            return res.status(403).json({ message: 'Some student IDs do not belong to this school' });
        }

        const ids = students.map(s => s._id);

        await Submission.deleteMany({ studentId: { $in: ids } });
        await TestAttempt.deleteMany({ studentId: { $in: ids } });
        await Sclass.updateMany({ students: { $in: ids } }, { $pull: { students: { $in: ids } } });
        await Student.deleteMany({ _id: { $in: ids } });

        const N = ids.length;
        logger.info(`Bulk deleted ${N} students`, { schoolId });
        res.json({ deleted: N, message: `${N} students removed` });
    } catch (err) {
        logger.error('bulkDeleteStudents failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PATCH /Admin/student/:id/status
const updateStudentStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ message: "status must be 'active' or 'suspended'" });
        }

        const student = await Student.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true, select: '_id name status' }
        );
        if (!student) return res.status(404).json({ message: 'Student not found' });

        res.json({ _id: student._id, name: student.name, status: student.status });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/student/:id/reset-password
const resetStudentPassword = async (req, res) => {
    try {
        const tempPassword = crypto.randomBytes(6).toString('base64').slice(0, 8);
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(tempPassword, salt);

        const student = await Student.findByIdAndUpdate(req.params.id, { $set: { password: hashed } });
        if (!student) return res.status(404).json({ message: 'Student not found' });

        res.json({ tempPassword });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/student/:id/enroll  — enroll student into a class (one class at a time)
const enrollStudent = async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'classId is required' });

        const student = await Student.findById(req.params.id).select('classId sclassName name');
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const targetClass = await Sclass.findById(classId);
        if (!targetClass) return res.status(404).json({ message: 'Class not found' });

        const oldClassId = student.classId || student.sclassName;

        // Already in this class — idempotent
        if (oldClassId && String(oldClassId) === String(classId)) {
            return res.json({ message: 'Student is already enrolled in this class' });
        }

        // Remove from previous class
        if (oldClassId) {
            await Sclass.findByIdAndUpdate(oldClassId, { $pull: { students: student._id } });
        }

        // Update student
        await Student.findByIdAndUpdate(req.params.id, {
            $set: { classId, sclassName: classId },
        });

        // Add to new class roster
        await Sclass.findByIdAndUpdate(classId, { $addToSet: { students: student._id } });

        logger.info(`Student ${student.name} enrolled into class ${targetClass.sclassName}`);
        res.json({ message: `${student.name} enrolled into ${targetClass.sclassName}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/student/:id/enroll  — remove student from their current class
const unenrollStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id).select('classId sclassName name');
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const currentClassId = student.classId || student.sclassName;
        if (!currentClassId) {
            return res.json({ message: 'Student is not enrolled in any class' });
        }

        // Remove from class roster
        await Sclass.findByIdAndUpdate(currentClassId, { $pull: { students: student._id } });

        // Clear class reference on student
        await Student.findByIdAndUpdate(req.params.id, {
            $set: { classId: null, sclassName: null },
        });

        logger.info(`Student ${student.name} unenrolled from class ${currentClassId}`);
        res.json({ message: `${student.name} removed from class` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addStudent, updateStudent, removeStudent, getStudentPerformance, bulkDeleteStudents, updateStudentStatus, resetStudentPassword, enrollStudent, unenrollStudent };
