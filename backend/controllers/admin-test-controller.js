const Test        = require("../models/testSchema");
const TestAttempt  = require("../models/testAttemptSchema");

// GET /Admin/tests/:schoolId?classId=
const getSchoolTests = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const filter = { school: schoolId };

        if (req.query.classId) filter.classId = req.query.classId;

        const tests = await Test.find(filter)
            .populate("subject", "subName subjectName subCode")
            .populate("classId", "sclassName className")
            .sort({ createdAt: -1 })
            .lean();

        // Aggregate attempt counts and average scores per test in one query
        const testIds = tests.map((t) => t._id);

        const aggregation = await TestAttempt.aggregate([
            { $match: { testId: { $in: testIds } } },
            {
                $group: {
                    _id: "$testId",
                    attemptCount:  { $sum: 1 },
                    classAvgScore: { $avg: "$score" }
                }
            }
        ]);

        // Build a lookup map for O(1) access
        const statsMap = {};
        for (const row of aggregation) {
            statsMap[row._id.toString()] = {
                attemptCount:  row.attemptCount,
                classAvgScore: row.classAvgScore != null
                    ? Math.round(row.classAvgScore * 100) / 100
                    : null
            };
        }

        const enriched = tests.map((t) => {
            const stats = statsMap[t._id.toString()] || { attemptCount: 0, classAvgScore: null };
            return { ...t, ...stats };
        });

        res.status(200).json(enriched);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getSchoolTests };
