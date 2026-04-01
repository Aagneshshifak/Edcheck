const bcrypt = require('bcrypt');
const crypto = require('crypto');
const Teacher = require('../models/teacherSchema.js');
const Subject = require('../models/subjectSchema.js');
const Sclass = require('../models/sclassSchema.js');
const TestAttempt = require('../models/testAttemptSchema.js');
const Test = require('../models/testSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const { logger } = require('../utils/serverLogger.js');

// POST /Admin/teacher/add
const addTeacher = async (req, res) => {
    try {
        const { name, email, password, phone, subjectIds, classIds, schoolId } = req.body;
        if (!name || !email || !password || !schoolId) {
            return res.status(400).json({ message: 'name, email, password and schoolId are required' });
        }
        const existing = await Teacher.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(password, salt);

        const teacher = new Teacher({
            name, email, password: hashed, phone,
            schoolId, school: schoolId,
            teachSubjects: subjectIds || [],
            teachClasses:  classIds  || [],
            // backward-compat single fields
            teachSubject: subjectIds?.[0] || undefined,
            teachSclass:  classIds?.[0]  || undefined,
        });
        await teacher.save();

        // Link subjects back to teacher
        if (subjectIds?.length) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { teacherId: teacher._id, teacher: teacher._id });
        }

        teacher.password = undefined;
        logger.info(`Teacher added: ${name}`, { schoolId });
        res.status(201).json(teacher);
    } catch (err) {
        logger.error('addTeacher failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/teacher/:id
const updateTeacher = async (req, res) => {
    try {
        const { name, email, phone, subjectIds, classIds } = req.body;
        const update = {};
        if (name)       update.name         = name;
        if (email)      update.email        = email;
        if (phone)      update.phone        = phone;
        if (subjectIds) { update.teachSubjects = subjectIds; update.teachSubject = subjectIds[0]; }
        if (classIds)   { update.teachClasses  = classIds;  update.teachSclass  = classIds[0];  }

        if (email) {
            const dup = await Teacher.findOne({ email, _id: { $ne: req.params.id } });
            if (dup) return res.status(409).json({ message: 'Email already in use' });
        }

        const teacher = await Teacher.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

        if (subjectIds) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { teacherId: teacher._id, teacher: teacher._id });
        }

        teacher.password = undefined;
        res.json(teacher);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/teacher/:id
const removeTeacher = async (req, res) => {
    try {
        const teacher = await Teacher.findByIdAndDelete(req.params.id);
        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
        await Subject.updateMany({ teacherId: teacher._id }, { $unset: { teacherId: 1, teacher: 1 } });
        logger.info(`Teacher removed: ${teacher.name}`);
        res.json({ message: 'Teacher removed', teacher });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/teacher/:id/performance
const getTeacherPerformance = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id)
            .populate('teachSubjects', 'subName')
            .populate('teachClasses', 'sclassName');
        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

        // Assignments created by this teacher
        const assignments = await Assignment.find({ teacher: req.params.id }).countDocuments();

        // Tests created by this teacher
        const tests = await Test.find({ teacher: req.params.id });
        const testIds = tests.map(t => t._id);

        // Average score across all attempts on this teacher's tests
        const avgResult = await TestAttempt.aggregate([
            { $match: { testId: { $in: testIds } } },
            { $group: { _id: null, avgScore: { $avg: { $multiply: [{ $divide: ['$score', '$totalMarks'] }, 100] } } } }
        ]);

        teacher.password = undefined;
        res.json({
            teacher,
            stats: {
                assignmentsCreated: assignments,
                testsCreated: tests.length,
                avgStudentScore: avgResult[0]?.avgScore?.toFixed(1) ?? null,
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/teachers/bulk-delete
const bulkDeleteTeachers = async (req, res) => {
    try {
        const { teacherIds, schoolId } = req.body;
        if (!teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
            return res.status(400).json({ message: 'teacherIds must be a non-empty array' });
        }

        // Validate all teachers belong to the school
        const teachers = await Teacher.find({ _id: { $in: teacherIds }, schoolId });
        if (teachers.length !== teacherIds.length) {
            return res.status(403).json({ message: 'Some teacher IDs do not belong to this school' });
        }

        const ids = teachers.map(t => t._id);

        await Subject.updateMany({ teacherId: { $in: ids } }, { $unset: { teacherId: 1, teacher: 1 } });
        await Teacher.deleteMany({ _id: { $in: ids } });

        const N = ids.length;
        logger.info(`Bulk deleted ${N} teachers`, { schoolId });
        res.json({ deleted: N, message: `${N} teachers removed` });
    } catch (err) {
        logger.error('bulkDeleteTeachers failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PATCH /Admin/teacher/:id/status
const updateTeacherStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'suspended'].includes(status)) {
            return res.status(400).json({ message: "status must be 'active' or 'suspended'" });
        }

        const teacher = await Teacher.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { new: true, select: '_id name status' }
        );
        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

        res.json({ _id: teacher._id, name: teacher.name, status: teacher.status });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/teacher/:id/reset-password
const resetTeacherPassword = async (req, res) => {
    try {
        const tempPassword = crypto.randomBytes(6).toString('base64').slice(0, 8);
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(tempPassword, salt);

        const teacher = await Teacher.findByIdAndUpdate(req.params.id, { $set: { password: hashed } });
        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

        res.json({ tempPassword });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addTeacher, updateTeacher, removeTeacher, getTeacherPerformance, bulkDeleteTeachers, updateTeacherStatus, resetTeacherPassword };
