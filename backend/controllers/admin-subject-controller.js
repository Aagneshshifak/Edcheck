const Subject    = require('../models/subjectSchema.js');
const Assignment = require('../models/assignmentSchema.js');
const Teacher    = require('../models/teacherSchema.js');
const { logger } = require('../utils/serverLogger.js');

// GET /Admin/subjects/detail/:schoolId  — all subjects with teacher + assignment counts + topics
const getSubjectsDetail = async (req, res) => {
    try {
        const subjects = await Subject.find({ schoolId: req.params.schoolId })
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

module.exports = { getSubjectsDetail, updateTopics, assignTeacher };
