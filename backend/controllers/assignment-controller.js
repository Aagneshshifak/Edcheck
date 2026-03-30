const Assignment  = require("../models/assignmentSchema");
const Submission  = require("../models/submissionSchema");
const path        = require("path");

// ── Assignments ──────────────────────────────────────────────────────────────

// Create assignment (teacher/admin)
const createAssignment = async (req, res) => {
    try {
        const assignment = new Assignment(req.body);
        const result = await assignment.save();
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get assignments by class
const getAssignmentsByClass = async (req, res) => {
    try {
        const assignments = await Assignment.find({
            sclassName: req.params.classId,
            isActive: true
        })
        .populate("subject", "subName subjectName subCode")
        .sort({ dueDate: 1 });

        res.send(assignments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get assignments by subject
const getAssignmentsBySubject = async (req, res) => {
    try {
        const assignments = await Assignment.find({
            subject: req.params.subjectId,
            isActive: true
        })
        .populate("subject", "subName subjectName")
        .sort({ dueDate: 1 });

        res.send(assignments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Delete assignment
const deleteAssignment = async (req, res) => {
    try {
        const result = await Assignment.findByIdAndDelete(req.params.id);
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Submissions ──────────────────────────────────────────────────────────────

// Submit assignment (student uploads file)
const submitAssignment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const { studentId, assignmentId, school } = req.body;
        const fileUrl  = `/uploads/${req.file.filename}`;
        const fileName = req.file.originalname;
        const fileType = path.extname(req.file.originalname).replace(".", "").toLowerCase();

        // Upsert — one submission per student per assignment
        const submission = await Submission.findOneAndUpdate(
            { studentId, assignmentId },
            {
                studentId, assignmentId, fileUrl, fileName, fileType,
                submittedAt: new Date(), school,
                status: new Date() > (await Assignment.findById(assignmentId))?.dueDate
                    ? "late" : "submitted"
            },
            { upsert: true, new: true }
        );

        res.send(submission);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get submissions for a student
const getStudentSubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({ studentId: req.params.studentId })
            .populate("assignmentId", "title topic dueDate subject")
            .sort({ submittedAt: -1 });
        res.send(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get all submissions for an assignment (teacher view)
const getAssignmentSubmissions = async (req, res) => {
    try {
        const submissions = await Submission.find({ assignmentId: req.params.assignmentId })
            .populate("studentId", "name rollNum");
        res.send(submissions);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Grade a submission
const gradeSubmission = async (req, res) => {
    try {
        const { grade, feedback } = req.body;
        const result = await Submission.findByIdAndUpdate(
            req.params.id,
            { grade, feedback, status: "graded" },
            { new: true }
        );
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createAssignment,
    getAssignmentsByClass,
    getAssignmentsBySubject,
    deleteAssignment,
    submitAssignment,
    getStudentSubmissions,
    getAssignmentSubmissions,
    gradeSubmission,
};
