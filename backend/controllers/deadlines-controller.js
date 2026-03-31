const Student    = require('../models/studentSchema');
const Assignment = require('../models/assignmentSchema');
const Test       = require('../models/testSchema');

/**
 * GET /UpcomingDeadlines/:studentId
 *
 * Returns up to 10 upcoming active assignments and tests for the student's class,
 * sorted ascending by due date.
 */
const getUpcomingDeadlines = async (req, res) => {
    try {
        const { studentId } = req.params;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const classId = student.classId || student.sclassName;
        if (!classId) {
            return res.status(200).json([]);
        }

        const now = new Date();

        const [assignments, tests] = await Promise.all([
            Assignment.find({
                sclassName: classId,
                isActive: true,
                dueDate: { $gte: now },
            }).populate('subject', 'subName'),

            Test.find({
                classId,
                isActive: true,
                createdAt: { $gte: now },
            }).populate('subject', 'subName'),
        ]);

        const assignmentItems = assignments.map((a) => ({
            type: 'assignment',
            id: a._id.toString(),
            title: a.title,
            subjectName: a.subject ? (a.subject.subName || '') : '',
            dueDate: a.dueDate,
        }));

        const testItems = tests.map((t) => ({
            type: 'test',
            id: t._id.toString(),
            title: t.title,
            subjectName: t.subject ? (t.subject.subName || '') : '',
            dueDate: t.createdAt,
        }));

        const merged = [...assignmentItems, ...testItems]
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
            .slice(0, 10);

        return res.status(200).json(merged);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getUpcomingDeadlines };
