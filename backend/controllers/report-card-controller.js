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
 * GET /api/report/student/:studentId
 *
 * Builds a full report card by aggregating:
 *   - examResult (teacher-entered marks)
 *   - test attempts (online tests)
 *   - attendance (subject-wise %)
 *   - assignment submissions (graded)
 *
 * Returns per-subject rows with testMarks, assignmentMarks,
 * attendancePercent, totalMarks, grade.
 */
const getReportCard = async (req, res) => {
    try {
        const { studentId } = req.params;

        const student = await Student.findById(studentId)
            .populate('examResult.subjectId', 'subName subjectName subCode')
            .populate('attendance.subjectId', 'subName subjectName')
            .populate('sclassName', 'className sclassName')
            .select('name rollNum examResult attendance sclassName school schoolId');

        if (!student) return res.status(404).json({ message: 'Student not found' });

        // ── 1. Exam results (teacher-entered) ─────────────────────────────────
        const examMap = new Map(); // subjectId → { marks, maxMarks, subjectName, subCode }
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

        const testMap = new Map(); // subjectId → { totalScore, totalMax, count }
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
        const attMap = new Map(); // subjectId → { present, total }
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

            // Exam marks (out of 100 normalised)
            const examPct = exam && exam.examMax > 0
                ? Math.round((exam.examMarks / exam.examMax) * 100)
                : null;

            // Test marks — average across all attempts (out of 100 normalised)
            const testPct = test && test.totalMax > 0
                ? Math.round((test.totalScore / test.totalMax) * 100)
                : null;

            // Combined test marks: weight exam 60%, online tests 40%
            let testMarks = null;
            if (examPct !== null && testPct !== null) {
                testMarks = Math.round(examPct * 0.6 + testPct * 0.4);
            } else {
                testMarks = examPct ?? testPct ?? null;
            }

            const attendancePercent = att && att.total > 0
                ? Math.round((att.present / att.total) * 100)
                : null;

            // Total = 80% test marks + 20% attendance bonus
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

        // Sort alphabetically
        subjects.sort((a, b) => a.subjectName.localeCompare(b.subjectName));

        // Overall
        const graded = subjects.filter(s => s.totalMarks !== null);
        const overallPercent = graded.length > 0
            ? Math.round(graded.reduce((s, x) => s + x.totalMarks, 0) / graded.length)
            : null;

        return res.json({
            studentId,
            name:           student.name,
            rollNum:        student.rollNum,
            className:      student.sclassName?.className || student.sclassName?.sclassName || '—',
            subjects,
            overallPercent,
            overallGrade:   overallPercent !== null ? GRADE(overallPercent) : '—',
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getReportCard };
