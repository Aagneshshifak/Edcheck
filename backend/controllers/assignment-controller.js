const Assignment  = require("../models/assignmentSchema");
const Submission  = require("../models/submissionSchema");
const Student     = require("../models/studentSchema");
const { createNotifications } = require("./notification-controller");
const { withCache, invalidate } = require("../utils/cache");
const path        = require("path");

// ── Assignments ──────────────────────────────────────────────────────────────

// Create assignment (teacher/admin)
const createAssignment = async (req, res) => {
    try {
        const assignment = new Assignment(req.body);
        const result = await assignment.save();

        // Notify all students in the class
        try {
            const students = await Student.find({
                $or: [{ classId: result.sclassName }, { sclassName: result.sclassName }]
            }).select("_id");
            if (students.length > 0) {
                await createNotifications(
                    students.map((s) => s._id),
                    `New assignment posted: "${result.title}" — due ${new Date(result.dueDate).toLocaleDateString()}`,
                    "assignment"
                );
            }
        } catch (_) { /* non-fatal */ }

        invalidate(`assignments:class:${result.sclassName}`);
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get assignments by class — paginated
// GET /AssignmentsByClass/:classId?page=1&limit=10
const getAssignmentsByClass = async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 20);
        const skip  = (page - 1) * limit;

        const cacheKey = `assignments:class:${req.params.classId}:p${page}:l${limit}`;

        const result = await withCache(cacheKey, async () => {
            const [assignments, total] = await Promise.all([
                Assignment.find({ sclassName: req.params.classId, isActive: true })
                    .populate("subject", "subName subjectName subCode")
                    .sort({ dueDate: 1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Assignment.countDocuments({ sclassName: req.params.classId, isActive: true }),
            ]);
            return { assignments, total, page, limit, totalPages: Math.ceil(total / limit) };
        }, 60); // cache for 60s

        res.json(result);
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
        if (result) invalidate(`assignments:class:${result.sclassName}`);
        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── Submissions ──────────────────────────────────────────────────────────────

// Submit assignment (student uploads file — supports single or multiple files, local or Cloudinary)
const submitAssignment = async (req, res) => {
    try {
        const { studentId, assignmentId, school } = req.body;

        // Build files array from req.files (multiple) or req.file (single)
        const rawFiles = req.files?.length ? req.files : req.file ? [req.file] : [];
        if (!rawFiles.length) return res.status(400).json({ message: 'No file uploaded' });

        const files = rawFiles.map(f => ({
            fileName: f.originalname,
            fileUrl:  f.path || `/uploads/${f.filename}`,   // Cloudinary URL or local path
            fileType: f.originalname.split('.').pop().toLowerCase(),
            publicId: f.filename || null,
            size:     f.size || null,
        }));

        // Legacy single-file fields — use first file for backward compat
        const primary = files[0];

        const assignment = await Assignment.findById(assignmentId).lean();
        const isLate = assignment && new Date() > new Date(assignment.dueDate);

        const submission = await Submission.findOneAndUpdate(
            { studentId, assignmentId },
            {
                studentId, assignmentId, school,
                files,
                fileUrl:     primary.fileUrl,
                fileName:    primary.fileName,
                fileType:    primary.fileType,
                submittedAt: new Date(),
                status:      isLate ? 'late' : 'submitted',
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

// Get assignments by teacher — enriched with submissionCount and totalStudents
const getAssignmentsByTeacher = async (req, res) => {
    try {
        const assignments = await Assignment.find({ createdBy: req.params.teacherId, isActive: true })
            .populate('subject', 'subName subjectName')
            .populate('sclassName', 'sclassName className')
            .sort({ dueDate: -1 });

        const enriched = await Promise.all(assignments.map(async (a) => {
            const [submissionCount, totalStudents] = await Promise.all([
                Submission.countDocuments({ assignmentId: a._id }),
                Student.countDocuments({ sclassName: a.sclassName }),
            ]);
            return { ...a.toObject(), submissionCount, totalStudents };
        }));

        res.json(enriched);
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

        // Notify the student
        try {
            if (result?.studentId) {
                if (grade != null) {
                    await createNotifications(
                        [result.studentId],
                        `Your assignment has been graded: ${grade}`,
                        "marks"
                    );
                }
                if (feedback) {
                    await createNotifications(
                        [result.studentId],
                        `Teacher feedback on your assignment: "${feedback}"`,
                        "feedback"
                    );
                }
            }
        } catch (_) { /* non-fatal */ }

        res.send(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    createAssignment,
    getAssignmentsByClass,
    getAssignmentsBySubject,
    getAssignmentsByTeacher,
    deleteAssignment,
    submitAssignment,
    getStudentSubmissions,
    getAssignmentSubmissions,
    gradeSubmission,
};
