const Subject    = require('../models/subjectSchema.js');
const Sclass     = require('../models/sclassSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const Teacher    = require('../models/teacherSchema.js');
const { logger } = require('../utils/serverLogger.js');

// POST /Admin/subjects/add  — create a new subject and link it to a class
const addSubject = async (req, res) => {
    try {
        const { subName, subCode, sessions, classId, schoolId, topics, teacherId } = req.body;
        if (!subName || !schoolId) {
            return res.status(400).json({ message: 'subName and schoolId are required' });
        }

        const subject = new Subject({
            subName, subjectName: subName,
            subCode, subjectCode: subCode,
            sessions: sessions || 30,
            classId:    classId || null,
            sclassName: classId || null,
            schoolId, school: schoolId,
            teacherId: teacherId || null,
            teacher:   teacherId || null,
            topics: topics || [],
        });
        await subject.save();

        // Push subject into class.subjects array
        if (classId) {
            await Sclass.findByIdAndUpdate(classId, { $addToSet: { subjects: subject._id } });
        }

        // Back-link teacher
        if (teacherId) {
            await Teacher.findByIdAndUpdate(teacherId, { $addToSet: { teachSubjects: subject._id } });
        }

        logger.info(`Subject added: ${subName}`, { schoolId, classId });
        res.status(201).json(subject);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/subjects/:id  — remove subject and clean up class + teacher back-links
const removeSubject = async (req, res) => {
    try {
        const subject = await Subject.findByIdAndDelete(req.params.id);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        // Remove from class.subjects array
        const classRef = subject.classId || subject.sclassName;
        if (classRef) {
            await Sclass.findByIdAndUpdate(classRef, { $pull: { subjects: subject._id } });
        }

        // Remove from teacher.teachSubjects array
        const teacherRef = subject.teacherId || subject.teacher;
        if (teacherRef) {
            await Teacher.findByIdAndUpdate(teacherRef, { $pull: { teachSubjects: subject._id } });
        }

        logger.info(`Subject removed: ${subject.subName}`);
        res.json({ message: 'Subject removed', subject });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/subjects/:id  — update subject fields including class reassignment
const updateSubject = async (req, res) => {
    try {
        const { subName, subCode, sessions, classId, teacherId, topics } = req.body;

        const existing = await Subject.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Subject not found' });

        const update = {};
        if (subName  !== undefined) { update.subName = subName; update.subjectName = subName; }
        if (subCode  !== undefined) { update.subCode = subCode; update.subjectCode = subCode; }
        if (sessions !== undefined)   update.sessions = sessions;
        if (topics   !== undefined)   update.topics   = topics;

        // Handle class reassignment
        if (classId !== undefined) {
            const oldClassId = existing.classId || existing.sclassName;
            const newClassId = classId || null;

            if (String(oldClassId || '') !== String(newClassId || '')) {
                // Remove from old class
                if (oldClassId) {
                    await Sclass.findByIdAndUpdate(oldClassId, { $pull: { subjects: existing._id } });
                }
                // Add to new class
                if (newClassId) {
                    await Sclass.findByIdAndUpdate(newClassId, { $addToSet: { subjects: existing._id } });
                }
            }
            update.classId    = newClassId;
            update.sclassName = newClassId;
        }

        // Handle teacher reassignment
        if (teacherId !== undefined) {
            const oldTeacherId = existing.teacherId || existing.teacher;
            const newTeacherId = teacherId || null;

            if (String(oldTeacherId || '') !== String(newTeacherId || '')) {
                if (oldTeacherId) {
                    await Teacher.findByIdAndUpdate(oldTeacherId, { $pull: { teachSubjects: existing._id } });
                }
                if (newTeacherId) {
                    await Teacher.findByIdAndUpdate(newTeacherId, { $addToSet: { teachSubjects: existing._id } });
                }
            }
            update.teacherId = newTeacherId;
            update.teacher   = newTeacherId;
        }

        const subject = await Subject.findByIdAndUpdate(
            req.params.id, { $set: update }, { new: true }
        ).populate('classId', 'sclassName').populate('teacherId', 'name email');

        res.json(subject);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/subjects/:id/assign-class  — assign (or reassign) a subject to a class
const assignSubjectToClass = async (req, res) => {
    try {
        const { classId } = req.body;
        if (!classId) return res.status(400).json({ message: 'classId is required' });

        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        const targetClass = await Sclass.findById(classId);
        if (!targetClass) return res.status(404).json({ message: 'Class not found' });

        const oldClassId = subject.classId || subject.sclassName;

        // Already assigned to this class — idempotent
        if (oldClassId && String(oldClassId) === String(classId)) {
            return res.json({ message: 'Subject is already assigned to this class' });
        }

        // Remove from old class
        if (oldClassId) {
            await Sclass.findByIdAndUpdate(oldClassId, { $pull: { subjects: subject._id } });
        }

        // Update subject
        await Subject.findByIdAndUpdate(req.params.id, {
            $set: { classId, sclassName: classId },
        });

        // Add to new class
        await Sclass.findByIdAndUpdate(classId, { $addToSet: { subjects: subject._id } });

        logger.info(`Subject "${subject.subName}" assigned to class "${targetClass.sclassName}"`);
        res.json({ message: `"${subject.subName}" assigned to "${targetClass.sclassName}"` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /Admin/subjects/:id/assign-class  — unassign subject from its current class
const unassignSubjectFromClass = async (req, res) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        const currentClassId = subject.classId || subject.sclassName;
        if (!currentClassId) {
            return res.json({ message: 'Subject is not assigned to any class' });
        }

        await Sclass.findByIdAndUpdate(currentClassId, { $pull: { subjects: subject._id } });
        await Subject.findByIdAndUpdate(req.params.id, {
            $set: { classId: null, sclassName: null },
        });

        logger.info(`Subject "${subject.subName}" unassigned from class`);
        res.json({ message: `"${subject.subName}" unassigned from class` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /Admin/subjects/detail/:schoolId  — all subjects with teacher + assignment counts + topics
const getSubjectsDetail = async (req, res) => {
    try {
        const id = req.params.schoolId;
        const subjects = await Subject.find({
            $or: [{ schoolId: id }, { school: id }]
        })
            .populate('classId',   'sclassName')
            .populate('teacherId', 'name email')
            .lean();

        const subjectIds = subjects.map(s => s._id);

        // Count assignments per subject in one aggregation
        const assignmentCounts = await Assignment.aggregate([
            { $match: { subject: { $in: subjectIds } } },
            { $group: { _id: '$subject', count: { $sum: 1 } } }
        ]);
        const assignMap = {};
        for (const r of assignmentCounts) assignMap[r._id.toString()] = r.count;

        const enriched = subjects.map(s => ({
            ...s,
            assignmentCount: assignMap[s._id.toString()] || 0,
        }));

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/subjects/:id/topics  — replace topics array
const updateTopics = async (req, res) => {
    try {
        const { topics } = req.body;
        if (!Array.isArray(topics)) return res.status(400).json({ message: 'topics must be an array' });

        const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: { topics } },
            { new: true }
        ).populate('classId', 'sclassName').populate('teacherId', 'name');

        if (!subject) return res.status(404).json({ message: 'Subject not found' });
        logger.info(`Topics updated for subject ${subject.subName}`);
        res.json(subject);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/subjects/:id/teacher  — assign teacher to subject
const assignTeacher = async (req, res) => {
    try {
        const { teacherId } = req.body;
        const subject = await Subject.findByIdAndUpdate(
            req.params.id,
            { $set: { teacherId, teacher: teacherId } },
            { new: true }
        ).populate('teacherId', 'name email');

        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        // Also update teacher's teachSubjects array
        if (teacherId) {
            await Teacher.findByIdAndUpdate(teacherId, { $addToSet: { teachSubjects: subject._id } });
        }
        res.json(subject);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { addSubject, removeSubject, updateSubject, getSubjectsDetail, updateTopics, assignTeacher, assignSubjectToClass, unassignSubjectFromClass };
