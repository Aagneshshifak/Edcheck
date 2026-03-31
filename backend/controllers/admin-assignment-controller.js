const Assignment = require("../models/assignmentSchema");
const Submission = require("../models/submissionSchema");

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
            .sort({ dueDate: -1 })
            .lean();

        const now = Date.now();

        const enriched = await Promise.all(
            assignments.map(async (a) => {
                const submissionCount = await Submission.countDocuments({ assignmentId: a._id });
                const status = new Date(a.dueDate).getTime() >= now ? "Active" : "Closed";
                return { ...a, submissionCount, status };
            })
        );

        res.json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getSchoolAssignments };
