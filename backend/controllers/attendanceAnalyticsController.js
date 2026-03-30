const Student = require('../models/studentSchema.js');

// GET /attendance-analytics/:studentId
const getAttendanceAnalytics = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId)
            .populate('attendance.subjectId', 'subName subjectName');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Group attendance records by subject
        const subjectMap = new Map();

        for (const record of student.attendance) {
            const subject = record.subjectId;
            if (!subject) continue;

            const id = subject._id.toString();

            if (!subjectMap.has(id)) {
                subjectMap.set(id, {
                    subjectId: id,
                    subjectName: subject.subName || subject.subjectName || 'Unknown',
                    totalClasses: 0,
                    attendedClasses: 0,
                });
            }

            const entry = subjectMap.get(id);
            entry.totalClasses += 1;
            if (record.status === 'Present') {
                entry.attendedClasses += 1;
            }
        }

        const summaries = Array.from(subjectMap.values()).map(entry => ({
            subjectId: entry.subjectId,
            subjectName: entry.subjectName,
            totalClasses: entry.totalClasses,
            attendedClasses: entry.attendedClasses,
            attendancePercentage: entry.totalClasses === 0
                ? 0
                : Math.round((entry.attendedClasses / entry.totalClasses) * 100),
        }));

        return res.status(200).json(summaries);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getAttendanceAnalytics };
