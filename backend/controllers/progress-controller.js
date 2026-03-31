const Student     = require('../models/studentSchema');
const TestAttempt = require('../models/testAttemptSchema');

/**
 * Compute percentage score rounded to one decimal place.
 * Returns 0 when maxMarks is 0 to avoid division by zero.
 */
const computePercentage = (marks, maxMarks) =>
    maxMarks > 0 ? Math.round((marks / maxMarks) * 100 * 10) / 10 : 0;

/**
 * GET /StudentProgress/:studentId
 *
 * Returns all exam results and completed test attempts for the student,
 * normalised to ProgressItem DTOs and sorted ascending by date.
 *
 * Response 200: ProgressItem[]
 * Response 404: { message: "Student not found" }
 * Response 500: { message: <error string> }
 */
const getStudentProgress = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Look up student and populate subject info on each exam result
        const student = await Student.findById(studentId)
            .populate('examResult.subjectId');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Map exam results to ProgressItem DTOs
        const examItems = (student.examResult || []).map((entry) => {
            const subjectId   = entry.subjectId?._id?.toString() ?? '';
            const subjectName = entry.subjectId?.subName ?? '';
            const marks       = entry.marks    ?? 0;
            const maxMarks    = entry.maxMarks  ?? 0;
            return {
                date:            entry.examDate,
                subjectId,
                subjectName,
                marks,
                maxMarks,
                percentageScore: computePercentage(marks, maxMarks),
                source:          'exam',
            };
        });

        // Query test attempts for this student, populating subject via testId
        const attempts = await TestAttempt.find({ studentId })
            .populate({ path: 'testId', populate: { path: 'subject' } });

        // Exclude attempts with null/missing submittedAt, then map to ProgressItem DTOs
        const testItems = attempts
            .filter((a) => a.submittedAt != null)
            .map((a) => {
                const subjectId   = a.testId?.subject?._id?.toString() ?? '';
                const subjectName = a.testId?.subject?.subName ?? '';
                const marks       = a.score      ?? 0;
                const maxMarks    = a.totalMarks  ?? 0;
                return {
                    date:            a.submittedAt,
                    subjectId,
                    subjectName,
                    marks,
                    maxMarks,
                    percentageScore: computePercentage(marks, maxMarks),
                    source:          'test',
                };
            });

        // Merge and sort ascending by date
        const merged = [...examItems, ...testItems]
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        return res.status(200).json(merged);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { getStudentProgress };
