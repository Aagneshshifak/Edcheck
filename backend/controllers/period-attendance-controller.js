const Student = require('../models/studentSchema');

const VALID_STATUSES = ['Present', 'Absent', 'Late'];

/**
 * POST /api/attendance/mark
 * Body: { classId, subjectId, teacherId, date, periodNumber, records: [{studentId, status}] }
 *
 * Uses bulkWrite for performance with large classes (45+ students).
 * Duplicate guard: 409 if attendance already exists for same class+date+period+subject.
 */
const markPeriodAttendance = async (req, res) => {
    try {
        const { classId, subjectId, teacherId, date, periodNumber, records } = req.body;

        if (!classId || !subjectId || !date || !periodNumber || !Array.isArray(records) || !records.length) {
            return res.status(400).json({ message: 'classId, subjectId, date, periodNumber and records are required' });
        }

        const attendanceDate = new Date(date);
        const dayStart = new Date(attendanceDate.toDateString());
        const dayEnd   = new Date(dayStart.getTime() + 86400000);

        // ── Duplicate guard (single query) ────────────────────────────────────
        const duplicate = await Student.findOne({
            $or: [{ classId }, { sclassName: classId }],
            attendance: {
                $elemMatch: {
                    subjectId,
                    periodNumber: Number(periodNumber),
                    date: { $gte: dayStart, $lt: dayEnd },
                },
            },
        }).select('_id');

        if (duplicate) {
            return res.status(409).json({ message: 'Attendance already marked for this period.' });
        }

        // ── Bulk write — one updateOne per student ────────────────────────────
        const ops = records.map(({ studentId, status }) => ({
            updateOne: {
                filter: { _id: studentId },
                update: {
                    $push: {
                        attendance: {
                            date:         attendanceDate,
                            subjectId,
                            status:       VALID_STATUSES.includes(status) ? status : 'Absent',
                            sessionType:  'lecture',
                            periodNumber: Number(periodNumber),
                        },
                    },
                },
            },
        }));

        await Student.bulkWrite(ops, { ordered: false });

        const absentees = records
            .filter(r => r.status === 'Absent' || r.status === 'Late')
            .map(r => ({ studentId: r.studentId, status: r.status, name: r.name }));

        return res.status(201).json({
            message: `Attendance marked for ${records.length} students`,
            date, periodNumber, subjectId, classId,
            absentees,
            summary: {
                total:   records.length,
                present: records.filter(r => r.status === 'Present').length,
                absent:  records.filter(r => r.status === 'Absent').length,
                late:    records.filter(r => r.status === 'Late').length,
            },
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/attendance/check?classId=&date=&periodNumber=&subjectId=
 * Returns { marked: true/false }
 */
const checkPeriodAttendance = async (req, res) => {
    try {
        const { classId, date, periodNumber, subjectId } = req.query;
        if (!classId || !date || !periodNumber || !subjectId) {
            return res.status(400).json({ message: 'classId, date, periodNumber and subjectId are required' });
        }

        const dayStart = new Date(new Date(date).toDateString());
        const dayEnd   = new Date(dayStart.getTime() + 86400000);

        const student = await Student.findOne({
            $or: [{ classId }, { sclassName: classId }],
            attendance: {
                $elemMatch: {
                    subjectId,
                    periodNumber: Number(periodNumber),
                    date: { $gte: dayStart, $lt: dayEnd },
                },
            },
        }).select('_id');

        return res.json({ marked: !!student });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/attendance/class/:classId
 * Per-student, per-subject attendance summary.
 */
const getClassAttendancePeriod = async (req, res) => {
    try {
        const { classId } = req.params;
        const students = await Student.find({
            $or: [{ classId }, { sclassName: classId }],
        }).populate('attendance.subjectId', 'subName subjectName').select('name rollNum attendance');

        const result = students.map(s => {
            const subMap = new Map();
            for (const rec of s.attendance) {
                const sub = rec.subjectId;
                if (!sub) continue;
                const id = sub._id.toString();
                if (!subMap.has(id)) {
                    subMap.set(id, { subjectId: id, subjectName: sub.subName || sub.subjectName, total: 0, present: 0, late: 0 });
                }
                const e = subMap.get(id);
                e.total++;
                if (rec.status === 'Present') e.present++;
                else if (rec.status === 'Late') { e.present++; e.late++; } // late counts as present
            }
            const subjects = Array.from(subMap.values()).map(e => ({
                ...e,
                percentage: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
            }));
            const totalAll   = subjects.reduce((a, b) => a + b.total, 0);
            const presentAll = subjects.reduce((a, b) => a + b.present, 0);
            return {
                studentId: s._id, name: s.name, rollNum: s.rollNum,
                subjects,
                overall: totalAll > 0 ? Math.round((presentAll / totalAll) * 100) : 0,
            };
        });

        return res.json(result);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

/**
 * GET /api/attendance/student/:studentId
 * Subject-wise attendance summary for one student.
 */
const getStudentAttendancePeriod = async (req, res) => {
    try {
        const student = await Student.findById(req.params.studentId)
            .populate('attendance.subjectId', 'subName subjectName')
            .select('name rollNum attendance');

        if (!student) return res.status(404).json({ message: 'Student not found' });

        const subMap = new Map();
        for (const rec of student.attendance) {
            const sub = rec.subjectId;
            if (!sub) continue;
            const id = sub._id.toString();
            if (!subMap.has(id)) {
                subMap.set(id, { subjectId: id, subjectName: sub.subName || sub.subjectName, total: 0, present: 0, late: 0 });
            }
            const e = subMap.get(id);
            e.total++;
            if (rec.status === 'Present') e.present++;
            else if (rec.status === 'Late') { e.present++; e.late++; }
        }

        const subjects = Array.from(subMap.values()).map(e => ({
            ...e,
            percentage: e.total > 0 ? Math.round((e.present / e.total) * 100) : 0,
        }));

        return res.json({ studentId: student._id, name: student.name, rollNum: student.rollNum, subjects });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { markPeriodAttendance, checkPeriodAttendance, getClassAttendancePeriod, getStudentAttendancePeriod };
