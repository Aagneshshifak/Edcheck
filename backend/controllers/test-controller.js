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

// Get tests for a class (teacher view) — includes admin-created tests
const getTestsByClass = async (req, res) => {
    try {
        const classId = req.params.classId;
        const filter = { classId };
        if (req.query.school) filter.school = req.query.school;

        const tests = await Test.find(filter)
            .populate("subject", "subName subjectName subCode");
        res.send(tests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /TestsByTeacher/:teacherId — all tests for a teacher's subjects across their classes
const getTestsByTeacher = async (req, res) => {
    try {
        const Teacher = require('../models/teacherSchema');
        const teacher = await Teacher.findById(req.params.teacherId)
            .populate('teachSubjects', 'subName subjectName')
            .populate('teachClasses', '_id')
            .lean();

        if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

        const classIds = [
            ...(teacher.teachClasses || []).map(c => c._id),
            teacher.teachSclass,
        ].filter(Boolean);

        const subjectNames = [
            ...(teacher.teachSubjects || []).map(s => s.subName || s.subjectName),
            teacher.teachSubject?.subName,
        ].filter(Boolean).map(n => n.toLowerCase());

        if (classIds.length === 0) return res.json([]);

        const tests = await Test.find({ classId: { $in: classIds } })
            .populate('subject', 'subName subjectName subCode')
            .lean();

        // Filter by subject name match (case-insensitive)
        const filtered = subjectNames.length > 0
            ? tests.filter(t => {
                if (!t.subject) return true;
                const name = (t.subject.subName || t.subject.subjectName || '').toLowerCase();
                return subjectNames.includes(name);
            })
            : tests;

        res.json(filtered);
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

// Get a single test by ID (teacher/admin)
const getTestById = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id)
            .populate('subject', 'subName subjectName subCode')
            .populate('classId', 'sclassName className');
        if (!test) return res.status(404).json({ message: 'Test not found' });
        res.json(test);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Test/:id/questions — teacher saves questions to an admin-created test
const updateTestQuestions = async (req, res) => {
    try {
        const { questions, teacherId } = req.body;
        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: 'questions array is required' });
        }
        const test = await Test.findByIdAndUpdate(
            req.params.id,
            { $set: { questions, ...(teacherId ? { createdBy: teacherId } : {}) } },
            { new: true, runValidators: false }
        );
        if (!test) return res.status(404).json({ message: 'Test not found' });
        res.json(test);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /Test/ai-validate-answers — AI validates correct answers for imported questions
const aiValidateAnswers = async (req, res) => {
    try {
        const { questions } = req.body;
        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'questions array is required' });
        }

        const { groq } = require('../config/groq');

        const systemPrompt = `You are an expert teacher and question validator.
Given a list of multiple-choice questions with their options, identify the correct answer index (0-based) for each question.
Respond ONLY with valid JSON: { "results": [{ "questionIndex": number, "correctAnswer": number, "confidence": "high"|"medium"|"low", "explanation": string }] }
Rules:
- correctAnswer is the 0-based index of the correct option (0=A, 1=B, 2=C, 3=D)
- Be accurate — these are school-level questions
- If genuinely ambiguous, use confidence "low"`;

        const userPrompt = `Validate the correct answers for these ${questions.length} questions:\n\n${
            questions.map((q, i) =>
                `Q${i}: ${q.questionText}\n${q.options.map((o, j) => `  ${j}. ${o}`).join('\n')}`
            ).join('\n\n')
        }`;

        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: userPrompt },
            ],
        });

        const content = response.choices?.[0]?.message?.content ?? '';
        const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(clean);

        if (!Array.isArray(parsed.results)) {
            return res.status(500).json({ message: 'AI returned unexpected format' });
        }

        res.json(parsed);
    } catch (err) {
        if (err instanceof SyntaxError) {
            return res.status(500).json({ message: 'AI returned unexpected format' });
        }
        res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
    }
};
const publishTest = async (req, res) => {
    try {
        const { teacherId } = req.body;
        const test = await Test.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: true, ...(teacherId ? { createdBy: teacherId } : {}) } },
            { new: true }
        );
        if (!test) return res.status(404).json({ message: 'Test not found' });
        res.json({ message: 'Test published successfully', test });
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
    getTestsByTeacher,
    getTestById,
    getTestsForStudent,
    updateTest,
    updateTestQuestions,
    publishTest,
    aiValidateAnswers,
    deleteTest,
};
