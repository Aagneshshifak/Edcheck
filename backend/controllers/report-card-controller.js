const Student     = require('../models/studentSchema');
const TestAttempt = require('../models/testAttemptSchema');
const Submission  = require('../models/submissionSchema');

const GRADE = (pct) => {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
};

/**
 * Returns the current academic year string, e.g. '2024-25'.
 * Academic year starts in April (month index 3).
 */
function getCurrentAcademicYear() {
    const now   = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    if (month >= 3) {
        return `${year}-${String(year + 1).slice(2)}`;
    }
    return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * GET /api/report/student/:studentId
 * Query params:
 *   term         {string}  'Term 1' | 'Term 2' | 'Final' | 'Annual' (default: 'Annual')
 *   academicYear {string}  e.g. '2024-25' (default: current year)
 */
const getReportCard = async (req, res) => {
    try {
        const { studentId } = req.params;
        const term         = req.query.term         || 'Annual';
        const academicYear = req.query.academicYear || getCurrentAcademicYear();

        const student = await Student.findById(studentId)
            .populate('examResult.subjectId', 'subName subjectName subCode')
            .populate('attendance.subjectId', 'subName subjectName')
            .populate('sclassName', 'className sclassName')
            .select('name rollNum examResult attendance sclassName school schoolId');

        if (!student) return res.status(404).json({ message: 'Student not found' });

        // ── 1. Exam results (teacher-entered) ─────────────────────────────────
        const examMap = new Map();
        for (const r of student.examResult || []) {
            const sub = r.subjectId;
            if (!sub) continue;
            const id = sub._id.toString();
            if (!examMap.has(id)) {
                examMap.set(id, {
                    subjectId:   id,
                    subjectName: sub.subName || sub.subjectName || 'Unknown',
                    subCode:     sub.subCode || sub.subjectCode || '',
                    examMarks:   0,
                    examMax:     0,
                });
            }
            const e = examMap.get(id);
            e.examMarks += r.marks    || 0;
            e.examMax   += r.maxMarks || 100;
        }

        // ── 2. Test attempts (online tests) ───────────────────────────────────
        const attempts = await TestAttempt.find({ studentId })
            .populate({ path: 'testId', populate: { path: 'subject', select: 'subName subjectName subCode' } });

        const testMap = new Map();
        for (const a of attempts) {
            const sub = a.testId?.subject;
            if (!sub) continue;
            const id = sub._id.toString();
            if (!testMap.has(id)) {
                testMap.set(id, {
                    subjectId:   id,
                    subjectName: sub.subName || sub.subjectName || 'Unknown',
                    subCode:     sub.subCode || sub.subjectCode || '',
                    totalScore:  0,
                    totalMax:    0,
                    count:       0,
                });
            }
            const t = testMap.get(id);
            t.totalScore += a.score      || 0;
            t.totalMax   += a.totalMarks || 0;
            t.count++;
        }

        // ── 3. Attendance per subject ─────────────────────────────────────────
        const attMap = new Map();
        for (const rec of student.attendance || []) {
            const sub = rec.subjectId;
            if (!sub) continue;
            const id = sub._id.toString();
            if (!attMap.has(id)) attMap.set(id, { present: 0, total: 0 });
            const a = attMap.get(id);
            a.total++;
            if (rec.status === 'Present' || rec.status === 'Late') a.present++;
        }

        // ── 4. Merge all subjects ─────────────────────────────────────────────
        const allSubjectIds = new Set([
            ...examMap.keys(),
            ...testMap.keys(),
            ...attMap.keys(),
        ]);

        const subjects = [];
        for (const id of allSubjectIds) {
            const exam = examMap.get(id);
            const test = testMap.get(id);
            const att  = attMap.get(id);

            const subjectName = exam?.subjectName || test?.subjectName || 'Unknown';
            const subCode     = exam?.subCode     || test?.subCode     || '';

            const examPct = exam && exam.examMax > 0
                ? Math.round((exam.examMarks / exam.examMax) * 100)
                : null;

            const testPct = test && test.totalMax > 0
                ? Math.round((test.totalScore / test.totalMax) * 100)
                : null;

            let testMarks = null;
            if (examPct !== null && testPct !== null) {
                testMarks = Math.round(examPct * 0.6 + testPct * 0.4);
            } else {
                testMarks = examPct ?? testPct ?? null;
            }

            const attendancePercent = att && att.total > 0
                ? Math.round((att.present / att.total) * 100)
                : null;

            let totalMarks = null;
            if (testMarks !== null) {
                const attBonus = attendancePercent !== null ? Math.round(attendancePercent * 0.2) : 0;
                totalMarks = Math.min(100, Math.round(testMarks * 0.8 + attBonus));
            }

            subjects.push({
                subjectId:        id,
                subjectName,
                subCode,
                examMarks:        exam ? Math.round((exam.examMarks / Math.max(exam.examMax, 1)) * 100) : null,
                testMarks:        testPct,
                attendancePercent,
                totalMarks,
                grade:            totalMarks !== null ? GRADE(totalMarks) : '—',
            });
        }

        subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

        const graded = subjects.filter(s => s.totalMarks !== null);
        const overallPercent = graded.length > 0
            ? Math.round(graded.reduce((s, x) => s + x.totalMarks, 0) / graded.length)
            : null;

        return res.json({
            studentId,
            name:         student.name,
            rollNum:      student.rollNum,
            className:    student.sclassName?.className || student.sclassName?.sclassName || '—',
            term,
            academicYear,
            subjects,
            overallPercent,
            overallGrade: overallPercent !== null ? GRADE(overallPercent) : '—',
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getReportCard };
