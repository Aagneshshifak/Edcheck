const Sclass     = require('../models/sclassSchema.js');
const Subject    = require('../models/subjectSchema.js');
const Student    = require('../models/studentSchema.js');
const Teacher    = require('../models/teacherSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const { logger } = require('../utils/serverLogger.js');

// POST /Admin/class/add
const addClass = async (req, res) => {
    try {
        const { className, section, schoolId, classTeacherId, subjectIds, studentIds } = req.body;
        if (!className || !schoolId) {
            return res.status(400).json({ message: 'className and schoolId are required' });
        }

        // Unique className + section per school (also enforced by DB index)
        const existing = await Sclass.findOne({
            className,
            section: section || '',
            $or: [{ schoolId }, { school: schoolId }],
        });
        if (existing) {
            return res.status(409).json({ message: 'A class with this name and section already exists in this school' });
        }

        const sclass = new Sclass({
            className, sclassName: className,
            section: section || '',
            schoolId, school: schoolId,
            classTeacher: classTeacherId || null,
            subjects:  subjectIds  || [],
            students:  studentIds  || [],
            status: 'active',
        });
        await sclass.save();

        // Back-link subjects to this class
        if (subjectIds?.length) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { classId: sclass._id, sclassName: sclass._id });
        }

        logger.info(`Class added: ${className}`, { schoolId });
        res.status(201).json(sclass);
    } catch (err) {
        // Duplicate key from the unique index
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A class with this name and section already exists' });
        }
        logger.error('addClass failed', { message: err.message });
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/class/:id
const updateClass = async (req, res) => {
    try {
        const { className, section, classTeacherId, subjectIds, studentIds, status } = req.body;
        const update = {};
        if (className)             { update.className = className; update.sclassName = className; }
        if (section !== undefined)   update.section = section;
        if (status !== undefined)    update.status = status;
        // null = explicitly clear teacher; valid string = set teacher; undefined/'' = don't touch
        if (classTeacherId === null) {
            update.classTeacher = null;
        } else if (classTeacherId && classTeacherId !== '') {
            update.classTeacher = classTeacherId;
        }
        // Replace subjects/students arrays when provided
        if (Array.isArray(subjectIds)) update.subjects = subjectIds;
        if (Array.isArray(studentIds)) update.students = studentIds;

        const sclass = await Sclass.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Back-link subjects to this class
        if (Array.isArray(subjectIds)) {
            await Subject.updateMany({ _id: { $in: subjectIds } }, { classId: sclass._id, sclassName: sclass._id });
        }
        res.json(sclass);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A class with this name and section already exists' });
        }
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/class/:id
const removeClass = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id);
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        const [studentCount, assignmentCount] = await Promise.all([
            Student.countDocuments({
                $or: [
                    { _id: { $in: sclass.students } },
                    { classId: req.params.id },
                    { sclassName: req.params.id },
                ],
            }),
            Assignment.countDocuments({
                $or: [{ sclassName: req.params.id }, { classId: req.params.id }],
            }),
        ]);

        if (studentCount > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${studentCount} student${studentCount > 1 ? 's are' : ' is'} still enrolled. Reassign or remove them first.`,
                studentCount,
            });
        }
        if (assignmentCount > 0) {
            return res.status(400).json({
                message: `Cannot delete: ${assignmentCount} assignment${assignmentCount > 1 ? 's exist' : ' exists'} for this class. Delete the assignments first.`,
                assignmentCount,
            });
        }

        await Sclass.findByIdAndDelete(req.params.id);
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
            .populate('classTeacher', 'name email')
            .populate('subjects', 'subName subCode teacherId')
            .populate('students', 'name rollNum status');
        if (!sclass) return res.status(404).json({ message: 'Class not found' });

        // Also fetch subjects/students via back-reference for classes that predate the arrays
        const [subjectsRef, studentsRef, teachers] = await Promise.all([
            Subject.find({ $or: [{ classId: req.params.id }, { sclassName: req.params.id }] })
                .populate('teacherId', 'name email'),
            Student.find({ $or: [{ classId: req.params.id }, { sclassName: req.params.id }] }, 'name rollNum status'),
            Teacher.find({ teachClasses: req.params.id }, 'name email teachSubjects')
                .populate('teachSubjects', 'subName'),
        ]);

        // Merge: deduplicate by _id
        const mergeById = (arr1, arr2) => {
            const map = {};
            [...arr1, ...arr2].forEach(item => { map[String(item._id)] = item; });
            return Object.values(map);
        };

        res.json({
            sclass,
            subjects: mergeById(sclass.subjects || [], subjectsRef),
            students: mergeById(sclass.students || [], studentsRef),
            teachers,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/class/:id/status  — toggle active/inactive
const toggleClassStatus = async (req, res) => {
    try {
        const sclass = await Sclass.findById(req.params.id);
        if (!sclass) return res.status(404).json({ message: 'Class not found' });
        sclass.status = sclass.status === 'active' ? 'inactive' : 'active';
        await sclass.save();
        res.json({ status: sclass.status });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addClass, updateClass, removeClass, getClassDetail, toggleClassStatus };
