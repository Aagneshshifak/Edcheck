const Assignment = require("../models/assignmentSchema");
const Submission = require("../models/submissionSchema");
const Student    = require("../models/studentSchema");

// GET /Admin/assignments/:schoolId?classId=&subjectId=
const getSchoolAssignments = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const filter = { school: schoolId };

        if (req.query.classId)   filter.sclassName = req.query.classId;
        if (req.query.subjectId) filter.subject    = req.query.subjectId;

        const assignments = await Assignment.find(filter)
            .populate("subject",    "subName subjectName subCode")
            .populate("sclassName", "sclassName className")
            .populate("createdBy",  "name email")
            .sort({ dueDate: -1 })
            .lean();

        const now = Date.now();

        const enriched = await Promise.all(
            assignments.map(async (a) => {
                const [submissionCount, totalStudents] = await Promise.all([
                    Submission.countDocuments({ assignmentId: a._id }),
                    Student.countDocuments({ sclassName: a.sclassName?._id || a.sclassName }),
                ]);
                const submissionRate = totalStudents > 0
                    ? Math.round((submissionCount / totalStudents) * 100)
                    : 0;
                const dueMs  = new Date(a.dueDate).getTime();
                const status = dueMs >= now ? "Active" : "Closed";
                const overdue = status === "Closed" && submissionCount < totalStudents;
                return { ...a, submissionCount, totalStudents, submissionRate, status, overdue };
            })
        );

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getSchoolAssignments };
