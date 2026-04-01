const mongoose = require('mongoose');
const Student  = require('../models/studentSchema');
const Sclass   = require('../models/sclassSchema');

const THRESHOLD = 70; // attendance % below which alert fires

// GET /Admin/alerts/:schoolId
const getAlerts = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const oid = new mongoose.Types.ObjectId(schoolId);
        const schoolQ = { $or: [{ schoolId: oid }, { school: oid }] };
        const alerts = [];

        const classes = await Sclass.find({ $or: [{ schoolId: oid }, { school: oid }] }).lean();
        const classNames = {};
        classes.forEach(c => { classNames[String(c._id)] = c.sclassName || c.className; });


        // Class-level attendance alerts
        for (const cls of classes) {
            const students = await Student.find(
                { ...schoolQ, $or: [{ classId: cls._id }, { sclassName: cls._id }] },
                'attendance'
            ).lean();
            if (!students.length) continue;
            let total = 0, present = 0;
            for (const s of students) {
                total   += s.attendance?.length || 0;
                present += s.attendance?.filter(a => a.status === 'Present').length || 0;
            }
            const rate = total > 0 ? Math.round((present / total) * 100) : null;
            if (rate !== null && rate < THRESHOLD) {
                alerts.push({
                    type: 'attendance', severity: rate < 50 ? 'error' : 'warning',
                    title: `Low attendance — ${cls.sclassName || cls.className}`,
                    message: `Class average is ${rate}% (threshold ${THRESHOLD}%)`,
                    classId: String(cls._id), className: cls.sclassName || cls.className, value: rate,
                });
            }
        }

        // Individual at-risk students (attendance < 60%)
        const allStudents = await Student.find(schoolQ, 'name rollNum classId sclassName attendance').lean();
        for (const s of allStudents) {
            const total   = s.attendance?.length || 0;
            const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
            const rate    = total > 0 ? Math.round((present / total) * 100) : null;
            if (rate !== null && rate < 60) {
                const clsId = String(s.classId || s.sclassName);
                alerts.push({
                    type: 'student_risk', severity: rate < 40 ? 'error' : 'warning',
                    title: `${s.name} — low attendance`,
                    message: `${rate}% in ${classNames[clsId] || 'Unknown Class'}`,
                    studentId: String(s._id), rollNum: s.rollNum, value: rate,
                });
            }
        }

        alerts.sort((a, b) => {
            if (a.severity === 'error' && b.severity !== 'error') return -1;
            if (b.severity === 'error' && a.severity !== 'error') return  1;
            return (a.value || 0) - (b.value || 0);
        });

        res.json({ alerts, total: alerts.length });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getAlerts };
