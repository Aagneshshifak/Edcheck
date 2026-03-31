const Student = require('../models/studentSchema.js');
const Sclass = require('../models/sclassSchema.js');

// GET /Admin/attendance/school/:schoolId
// Returns per-class attendance percentages
const getSchoolAttendance = async (req, res) => {
    try {
        const { schoolId } = req.params;

        const classes = await Sclass.find({ $or: [{ schoolId }, { school: schoolId }] });

        const results = await Promise.all(classes.map(async (cls) => {
            const students = await Student.find({
                $or: [{ classId: cls._id }, { sclassName: cls._id }]
            }, 'attendance');

            let totalRecords = 0;
            let presentCount = 0;

            for (const student of students) {
                for (const record of student.attendance) {
                    totalRecords++;
                    if (record.status === 'Present') presentCount++;
                }
            }

            const attendancePercentage = totalRecords === 0
                ? 0
                : Math.round((presentCount / totalRecords) * 100);

            return {
                classId: cls._id,
                className: cls.className || cls.sclassName,
                totalRecords,
                presentCount,
                attendancePercentage,
            };
        }));

        return res.status(200).json(results);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET /Admin/attendance/class/:classId
// Returns per-student, per-subject attendance breakdown for a class
const getClassAttendance = async (req, res) => {
    try {
        const { classId } = req.params;

        const students = await Student.find({
            $or: [{ classId }, { sclassName: classId }]
        }).populate('attendance.subjectId', 'subName subjectName');

        const results = students.map((student) => {
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
                entry.totalClasses++;
                if (record.status === 'Present') entry.attendedClasses++;
            }

            const subjects = Array.from(subjectMap.values()).map(entry => ({
                ...entry,
                attendancePercentage: entry.totalClasses === 0
                    ? 0
                    : Math.round((entry.attendedClasses / entry.totalClasses) * 100),
            }));

            const totalAll = subjects.reduce((sum, s) => sum + s.totalClasses, 0);
            const presentAll = subjects.reduce((sum, s) => sum + s.attendedClasses, 0);
            const overallPercentage = totalAll === 0
                ? 0
                : Math.round((presentAll / totalAll) * 100);

            return {
                studentId: student._id,
                studentName: student.name,
                rollNum: student.rollNum,
                subjects,
                overallPercentage,
            };
        });

        return res.status(200).json(results);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// GET /Admin/attendance/student/:studentId?from=&to=
// Returns per-subject attendance breakdown for a single student with optional date filter
const getStudentAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { from, to } = req.query;

        const student = await Student.findById(studentId)
            .populate('attendance.subjectId', 'subName subjectName');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const fromDate = from ? new Date(from) : null;
        const toDate = to ? new Date(to) : null;

        const subjectMap = new Map();

        for (const record of student.attendance) {
            const subject = record.subjectId;
            if (!subject) continue;

            // Apply optional date range filter
            if (fromDate && record.date < fromDate) continue;
            if (toDate && record.date > toDate) continue;

            const id = subject._id.toString();
            if (!subjectMap.has(id)) {
                subjectMap.set(id, {
                    subjectId: id,
                    subjectName: subject.subName || subject.subjectName || 'Unknown',
                    totalClasses: 0,
                    attendedClasses: 0,
                    absentCount: 0,
                });
            }

            const entry = subjectMap.get(id);
            entry.totalClasses++;
            if (record.status === 'Present') {
                entry.attendedClasses++;
            } else {
                entry.absentCount++;
            }
        }

        const summaries = Array.from(subjectMap.values()).map(entry => ({
            subjectId: entry.subjectId,
            subjectName: entry.subjectName,
            totalClasses: entry.totalClasses,
            attendedClasses: entry.attendedClasses,
            absentCount: entry.absentCount,
            attendancePercentage: entry.totalClasses === 0
                ? 0
                : Math.round((entry.attendedClasses / entry.totalClasses) * 100),
        }));

        return res.status(200).json(summaries);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getSchoolAttendance, getClassAttendance, getStudentAttendance };
