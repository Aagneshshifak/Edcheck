const Test        = require("../models/testSchema");
const TestAttempt  = require("../models/testAttemptSchema");
const Student      = require("../models/studentSchema");
const { createNotifications } = require("./notification-controller");

// ── Helpers ──────────────────────────────────────────────────────────────────

function validateTest(body) {
    const { durationMinutes, questions } = body;

    if (!durationMinutes || durationMinutes <= 0) {
        return "durationMinutes must be greater than 0";
    }

    if (!questions || questions.length === 0) {
        return "at least one question is required";
    }

    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.options || q.options.length < 2 || q.options.length > 6) {
            return `question ${i + 1}: options must have between 2 and 6 items`;
        }
        if (q.correctAnswer == null || q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
            return `question ${i + 1}: correctAnswer must be a valid index into options`;
        }
        if (!q.marks || q.marks <= 0) {
            return `question ${i + 1}: marks must be greater than 0`;
        }
    }

    return null;
}

// ── Controllers ──────────────────────────────────────────────────────────────

// Create a test (teacher/admin)
const createTest = async (req, res) => {
    try {
        const error = validateTest(req.body);
        if (error) return res.status(400).json({ message: error });

        const test = new Test(req.body);
        const result = await test.save();

        // Notify all students in the class
        try {
            if (result.classId) {
                const students = await Student.find({
                    $or: [{ classId: result.classId }, { sclassName: result.classId }]
                }).select("_id");
                if (students.length > 0) {
                    await createNotifications(
                        students.map((s) => s._id),
                        `New test scheduled: "${result.title}" (${result.durationMinutes} min)`,
                        "test"
                    );
                }
            }
        } catch (_) { /* non-fatal */ }

        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get tests for a class (teacher view)
const getTestsByClass = async (req, res) => {
    try {
        const classId = req.params.classId || req.query.classId;
        const school = req.query.school;
        
        if (!classId) {
            return res.status(400).json({ message: 'classId is required' });
        }
        
        const filter = { classId };
        if (school) filter.school = school;
        
        const tests = await Test.find(filter)
            .populate("subject", "subName subjectName subCode");
        res.send(tests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get active tests available for a student (excludes already-attempted tests)
const getTestsForStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Look up the student to get their classId
        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found" });

        const classId = student.classId || student.sclassName;
        if (!classId) return res.status(400).json({ message: "Student has no class assigned" });

        // Find tests already attempted by this student
        const attempts = await TestAttempt.find({ studentId }).select("testId");
        const attemptedTestIds = attempts.map((a) => a.testId.toString());

        // Fetch active tests for the student's class, excluding attempted ones
        const tests = await Test.find({
            classId,
            isActive: true,
            _id: { $nin: attemptedTestIds }
        }).populate("subject", "subName subjectName subCode");

        // Strip correctAnswer from each question before sending
        const sanitized = tests.map((test) => {
            const t = test.toObject();
            t.questions = t.questions.map(({ correctAnswer, ...rest }) => rest);
            return t;
        });

        res.send(sanitized);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update a test
const updateTest = async (req, res) => {
    try {
        const result = await Test.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete a test
const deleteTest = async (req, res) => {
    try {
        await Test.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: "Test deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createTest,
    getTestsByClass,
    getTestsForStudent,
    updateTest,
    deleteTest,
};
