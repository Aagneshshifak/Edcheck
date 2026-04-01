const Sclass = require('../models/sclassSchema.js');
const Subject = require('../models/subjectSchema.js');
const Student = require('../models/studentSchema.js');
const Teacher = require('../models/teacherSchema.js');
const { logger } = require('../utils/serverLogger.js');

// POST /Admin/class/add
const addClass = async (req, res) => {
    try {
        const { className, section, schoolId, classTeacherId, subjectIds } = req.body;
        if (!className || !schoolId) {
            return res.status(400).json({ message: 'className and schoolId are required' });
        }
        const existing = await Sclass.findOne({ sclassName: className, schoolId });
        if (existing) return res.status(409).json({ message: 'Class name already exists in this school' });

        const sclass = new Sclass({
            className, sclassName: className,
            section: section || '',
            schoolId, school: schoolId,
            classTeacher: classTeacherId || undefined,
        });
        await sclass.save();

        if (subjectIds?.length) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { classId: sclass._id, sclassName: sclass._id });
        }

        logger.info(`Class added: ${className}`, { schoolId });
        res.status(201).json(sclass);
    } catch (err) {
        logger.error('addClass failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/class/:id
const updateClass = async (req, res) => {
    try {
        const { className, section, classTeacherId, subjectIds } = req.body;
        const update = {};
        if (className)             { update.className = className; update.sclassName = className; }
        if (section !== undefined)   update.section = section;
        // null = explicitly clear teacher; valid string = set teacher; undefined/'' = don't touch
        if (classTeacherId === null) {
            update.classTeacher = null;
        } else if (classTeacherId && classTeacherId !== '') {
            update.classTeacher = classTeacherId;
        }
        const sclass = await Sclass.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        if (subjectIds) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { classId: sclass._id, sclassName: sclass._id });
        }
        res.json(sclass);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/class/:id
const removeClass = async (req, res) => {
    try {
        const sclass = await Sclass.findByIdAndDelete(req.params.id);
        if (!sclass) return res.status(404).json({ message: 'Class not found' });
        logger.info(`Class removed: ${sclass.sclassName}`);
        res.json({ message: 'Class removed', sclass });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/class/:id/detail  — full detail with students, subjects, teachers
const getClassDetail = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id)
            .populate('classTeacher', 'name email');
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        const subjects = await Subject.find({ classId: req.params.id })
            .populate('teacherId', 'name email');
        const students = await Student.find({ classId: req.params.id }, 'name rollNum status');
        const teachers = await Teacher.find({ teachClasses: req.params.id }, 'name email teachSubjects')
            .populate('teachSubjects', 'subName');

        res.json({ sclass, subjects, students, teachers });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addClass, updateClass, removeClass, getClassDetail };
