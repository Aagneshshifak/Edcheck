const mongoose = require('mongoose');
const Student    = require('../models/studentSchema.js');
const Teacher    = require('../models/teacherSchema.js');
const Sclass     = require('../models/sclassSchema.js');
const Test       = require('../models/testSchema.js');
const TestAttempt = require('../models/testAttemptSchema.js');
const Notice     = require('../models/noticeSchema.js');
const { withCache } = require('../utils/cache.js');

// GET /Admin/dashboard/:schoolId
const getDashboardSummary = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const data = await withCache(`dashboard:${schoolId}`, async () => {
            const oid = new mongoose.Types.ObjectId(schoolId);
            const schoolQ = { $or: [{ schoolId: oid }, { school: oid }] };

            const [totalStudents, totalTeachers, totalClasses, activeTests] = await Promise.all([
                Student.countDocuments(schoolQ),
                Teacher.countDocuments(schoolQ),
                Sclass.countDocuments({ $or: [{ schoolId: oid }, { school: oid }] }),
                Test.countDocuments({ school: oid, isActive: true }),
            ]);

            const classPerformance = await TestAttempt.aggregate([
                { $lookup: { from: 'tests', localField: 'testId', foreignField: '_id', as: 'test' } },
                { $unwind: '$test' },
                { $match: { 'test.school': oid } },
                { $group: { _id: '$test.classId', avgScore: { $avg: { $multiply: [{ $divide: ['$score', { $cond: [{ $eq: ['$totalMarks', 0] }, 1, { $ifNull: ['$totalMarks', 1] }] }] }, 100] } } } },
                { $lookup: { from: 'sclasses', localField: '_id', foreignField: '_id', as: 'cls' } },
                { $unwind: { path: '$cls', preserveNullAndEmptyArrays: true } },
                { $project: { className: { $ifNull: ['$cls.sclassName', '$cls.className'] }, avgScore: { $round: ['$avgScore', 1] } } },
                { $sort: { className: 1 } },
            ]);

            // Teacher performance — lean + limit to 8
            const teachers = await Teacher.find(schoolQ, '_id name').lean().limit(8);
            const teacherPerf = await Promise.all(teachers.map(async (t) => {
                const testIds = await Test.find({ createdBy: t._id }).distinct('_id');
                const agg = await TestAttempt.aggregate([
                    { $match: { testId: { $in: testIds } } },
                    { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$score', { $cond: [{ $eq: ['$totalMarks', 0] }, 1, { $ifNull: ['$totalMarks', 1] }] }] }, 100] } } } },
                ]);
                const score = agg[0]?.avg != null ? Math.round(agg[0].avg) : null;
                return { name: t.name, score };
            }));

            // Student risk — cursor-based streaming with .lean() to avoid loading all 450 docs at once
            const riskList = [];
            const cursor = Student
                .find(schoolQ, 'name rollNum attendance')
                .lean()
                .cursor();

            for await (const s of cursor) {
                const total   = s.attendance?.length || 0;
                const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
                const rate    = total > 0 ? (present / total) * 100 : null;
                const risk    = rate != null ? Math.round(100 - rate) : null;
                if (risk != null && risk > 30) {
                    riskList.push({
                        name: s.name,
                        rollNum: s.rollNum,
                        attendanceRate: Math.round(rate),
                        riskScore: risk,
                    });
                }
            }
            riskList.sort((a, b) => b.riskScore - a.riskScore);
            const topRisk = riskList.slice(0, 5);

            const recentNotices = await Notice.find({ $or: [{ school: oid }, { schoolId: oid }] })
                .sort({ date: -1 })
                .limit(5)
                .select('title details date audience')
                .lean();

            return {
                stats: { totalStudents, totalTeachers, totalClasses, activeTests },
                classPerformance,
                teacherPerformance: teacherPerf.filter(t => t.score != null),
                studentRisk: topRisk,
                recentNotices,
            };
        }, 60);

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDashboardSummary };
