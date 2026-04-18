const Test        = require("../models/testSchema");
const TestAttempt  = require("../models/testAttemptSchema");
const Student      = require("../models/studentSchema");

// GET /Admin/tests/:schoolId?classId=&status=active|completed
const getSchoolTests = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const filter = { school: schoolId };
        if (req.query.classId) filter.classId = req.query.classId;
        if (req.query.status === 'active')    filter.isActive = true;
        if (req.query.status === 'completed') filter.isActive = false;

        const tests = await Test.find(filter)
            .populate("subject",    "subName subjectName subCode")
            .populate("classId",    "sclassName className")
            .populate("createdBy",  "name email")
            .sort({ createdAt: -1 })
            .lean();

        const testIds = tests.map((t) => t._id);

        // Safe aggregation — guard against null dates and zero totalMarks
        let aggregation = [];
        if (testIds.length > 0) {
            aggregation = await TestAttempt.aggregate([
                { $match: { testId: { $in: testIds } } },
                {
                    $group: {
                        _id:          "$testId",
                        attemptCount: { $sum: 1 },
                        classAvgScore: {
                            $avg: {
                                $multiply: [
                                    {
                                        $divide: [
                                            { $ifNull: ["$score", 0] },
                                            { $cond: [{ $gt: [{ $ifNull: ["$totalMarks", 0] }, 0] }, "$totalMarks", 1] }
                                        ]
                                    },
                                    100
                                ]
                            }
                        },
                        fastSubmits: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $ne: ["$startedAt",   null] },
                                            { $ne: ["$submittedAt", null] },
                                            {
                                                $lt: [
                                                    { $subtract: ["$submittedAt", "$startedAt"] },
                                                    60000
                                                ]
                                            }
                                        ]
                                    },
                                    1, 0
                                ]
                            }
                        }
                    }
                }
            ]);
        }

        const statsMap = {};
        for (const row of aggregation) {
            statsMap[row._id.toString()] = {
                attemptCount:  row.attemptCount,
                classAvgScore: row.classAvgScore != null ? Math.round(row.classAvgScore * 10) / 10 : null,
                fastSubmits:   row.fastSubmits || 0,
            };
        }

        const enriched = tests.map((t) => {
            const stats = statsMap[t._id.toString()] || { attemptCount: 0, classAvgScore: null, fastSubmits: 0 };
            const cheatingAlert = stats.fastSubmits > 0;
            return { ...t, ...stats, cheatingAlert };
        });

        res.status(200).json(enriched);
    } catch (err) {
        console.error('[getSchoolTests] ERROR:', err.message, err.stack);
        res.status(500).json({ message: err.message });
    }
};

// POST /Admin/tests/create  — admin creates a test
const adminCreateTest = async (req, res) => {
    try {
        const { title, subjectId, classId, schoolId, durationMinutes, questions, shuffleQuestions } = req.body;
        if (!title || !classId || !schoolId) {
            return res.status(400).json({ message: 'title, classId and schoolId are required' });
        }
        const test = new Test({
            title,
            subject:         subjectId || undefined,
            classId,
            school:          schoolId,
            durationMinutes: durationMinutes || 30,
            questions:       questions || [],
            shuffleQuestions: shuffleQuestions || false,
            isActive:        true,
        });
        await test.save();
        res.status(201).json(test);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /Admin/tests/:id/toggle  — activate / deactivate
const toggleTestStatus = async (req, res) => {
    try {
        const test = await Test.findById(req.params.id);
        if (!test) return res.status(404).json({ message: 'Test not found' });
        test.isActive = !test.isActive;
        await test.save();
        res.json({ isActive: test.isActive });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getSchoolTests, adminCreateTest, toggleTestStatus };
