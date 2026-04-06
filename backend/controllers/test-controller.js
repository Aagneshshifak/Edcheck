const Test        = require("../models/testSchema");
const TestAttempt  = require("../models/testAttemptSchema");
const Student      = require("../models/studentSchema");
const { createNotifications } = require("./notification-controller");

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that question text is not empty
 * @param {string} questionText - The question text to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateQuestionText(questionText) {
    if (!questionText || questionText.trim() === "") {
        return "Question text cannot be empty";
    }
    return null;
}

/**
 * Validates that option count is between 2-6
 * @param {Array} options - The options array to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateOptionCount(options) {
    if (!options || !Array.isArray(options)) {
        return "Questions must have 2-6 options";
    }
    if (options.length < 2 || options.length > 6) {
        return "Questions must have 2-6 options";
    }
    return null;
}

/**
 * Validates that correctAnswer index is within option range
 * @param {number} correctAnswer - The correct answer index
 * @param {Array} options - The options array
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateCorrectAnswer(correctAnswer, options) {
    if (correctAnswer == null) {
        return "Correct answer must be a valid option index";
    }
    if (!options || !Array.isArray(options)) {
        return "Correct answer must be a valid option index";
    }
    if (correctAnswer < 0 || correctAnswer >= options.length) {
        return "Correct answer must be a valid option index";
    }
    return null;
}

/**
 * Validates that marks value is greater than zero
 * @param {number} marks - The marks value to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateMarks(marks) {
    if (marks == null || marks <= 0) {
        return "Marks must be greater than 0";
    }
    return null;
}

/**
 * Validates a complete question object
 * @param {Object} question - The question object to validate
 * @param {number} questionIndex - The index of the question (for error messages)
 * @returns {string|null} Error message if invalid, null if valid
 */
function validateQuestion(question, questionIndex = 0) {
    const questionNum = questionIndex + 1;
    
    let error = validateQuestionText(question.questionText);
    if (error) return `Question ${questionNum}: ${error}`;
    
    error = validateOptionCount(question.options);
    if (error) return `Question ${questionNum}: ${error}`;
    
    error = validateCorrectAnswer(question.correctAnswer, question.options);
    if (error) return `Question ${questionNum}: ${error}`;
    
    error = validateMarks(question.marks);
    if (error) return `Question ${questionNum}: ${error}`;
    
    return null;
}

function validateTest(body) {
    const { durationMinutes, questions } = body;

    if (!durationMinutes || durationMinutes <= 0) {
        return "durationMinutes must be greater than 0";
    }

    if (!questions || questions.length === 0) {
        return "at least one question is required";
    }

    for (let i = 0; i < questions.length; i++) {
        const error = validateQuestion(questions[i], i);
        if (error) return error;
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

// Get a single test by ID
const getTestById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const test = await Test.findById(id)
            .populate("subject", "subName subjectName subCode")
            .populate("classId", "sclassName className section");
        
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }
        
        res.send(test);
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

// Update test questions (teacher adds/updates questions)
const updateTestQuestions = async (req, res) => {
    try {
        const { id } = req.params;
        const { questions } = req.body;
        const teacherId = req.body.teacherId || req.user?._id;

        // Validate questions array exists
        if (!questions || !Array.isArray(questions)) {
            return res.status(400).json({ message: "Questions array is required" });
        }

        // Validate each question
        for (let i = 0; i < questions.length; i++) {
            const error = validateQuestion(questions[i], i);
            if (error) {
                return res.status(400).json({ message: error });
            }
        }

        // Find the test
        const test = await Test.findById(id);
        if (!test) {
            return res.status(404).json({ message: "Test not found" });
        }

        // Authorization: verify teacher teaches the class
        if (teacherId) {
            const Teacher = require("../models/teacherSchema");
            const teacher = await Teacher.findById(teacherId);
            
            if (!teacher) {
                return res.status(403).json({ message: "Unauthorized: Teacher not found" });
            }

            // Check if teacher teaches this class (support both single and array formats)
            const teachesClass = 
                (teacher.teachClasses && teacher.teachClasses.some(c => c.toString() === test.classId.toString())) ||
                (teacher.teachSclass && teacher.teachSclass.toString() === test.classId.toString());

            if (!teachesClass) {
                return res.status(403).json({ message: "Unauthorized: Teacher does not teach this class" });
            }
        }

        // Update only the questions array, preserve all other metadata
        test.questions = questions;
        const updatedTest = await test.save();

        // Populate fields for response
        await updatedTest.populate("subject", "subName subjectName subCode");
        await updatedTest.populate("classId", "sclassName");

        res.status(200).json(updatedTest);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Publish test and notify admin
const publishTest = async (req, res) => {
    try {
        const { id } = req.params;
        const teacherId = req.body.teacherId || req.user?._id;

        // Find the test
        const test = await Test.findById(id)
            .populate("subject", "subName subjectName subCode")
            .populate("classId", "sclassName className section");
        
        if (!test) {
            return res.status(404).json({ message: "Test not found" });
        }

        // Validate test has at least one question
        if (!test.questions || test.questions.length === 0) {
            return res.status(400).json({ message: "Cannot publish test with no questions" });
        }

        // Authorization: verify teacher teaches the class
        if (teacherId) {
            const Teacher = require("../models/teacherSchema");
            const teacher = await Teacher.findById(teacherId);
            
            if (!teacher) {
                return res.status(403).json({ message: "Unauthorized: Teacher not found" });
            }

            // Check if teacher teaches this class
            const teachesClass = 
                (teacher.teachClasses && teacher.teachClasses.some(c => c.toString() === test.classId._id.toString())) ||
                (teacher.teachSclass && teacher.teachSclass.toString() === test.classId._id.toString());

            if (!teachesClass) {
                return res.status(403).json({ message: "Unauthorized: Teacher does not teach this class" });
            }

            // Set isActive to true
            test.isActive = true;
            await test.save();

            // Retrieve admin information for notification
            const Admin = require("../models/adminSchema");
            const admin = await Admin.findById(test.school);

            if (admin) {
                // Format notification message
                const className = test.classId.sclassName || test.classId.className || "Unknown Class";
                const section = test.classId.section ? ` (${test.classId.section})` : "";
                const subjectName = test.subject ? ` - ${test.subject.subName || test.subject.subjectName || test.subject.subCode}` : "";
                const message = `Teacher ${teacher.name} published test '${test.title}' for ${className}${section}${subjectName} (${test.durationMinutes} min)`;

                // Create notification for admin
                try {
                    await createNotifications(
                        [admin._id],
                        message,
                        "test",
                        {
                            metadata: {
                                testId: test._id,
                                teacherId: teacher._id,
                                teacherName: teacher.name
                            }
                        }
                    );
                } catch (notifError) {
                    // Log error but don't block the response
                    console.error("Failed to create notification:", notifError);
                }
            }

            return res.status(200).json({ 
                message: "Test published successfully",
                test: test
            });
        } else {
            return res.status(400).json({ message: "Teacher ID is required" });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createTest,
    getTestById,
    getTestsByClass,
    getTestsForStudent,
    updateTest,
    deleteTest,
    updateTestQuestions,
    publishTest,
    // Validation helpers
    validateQuestionText,
    validateOptionCount,
    validateCorrectAnswer,
    validateMarks,
    validateQuestion,
};
