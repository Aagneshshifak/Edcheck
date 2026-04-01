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

            const teachers = await Teacher.find(schoolQ, '_id name').lean();
            const teacherPerf = await Promise.all(teachers.slice(0, 8).map(async (t) => {
                const testIds = await Test.find({ createdBy: t._id }).distinct('_id');
                const agg = await TestAttempt.aggregate([
                    { $match: { testId: { $in: testIds } } },
                    { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$score', { $cond: [{ $eq: ['$totalMarks', 0] }, 1, { $ifNull: ['$totalMarks', 1] }] }] }, 100] } } } },
                ]);
                const score = agg[0]?.avg != null ? Math.round(agg[0].avg) : null;
                return { name: t.name, score };
            }));

            const students = await Student.find(schoolQ, 'name rollNum classId sclassName attendance').lean();
            const riskList = students.map(s => {
                const total   = s.attendance?.length || 0;
                const present = s.attendance?.filter(a => a.status === 'Present').length || 0;
                const rate    = total > 0 ? (present / total) * 100 : null;
                const risk    = rate != null ? Math.round(100 - rate) : null;
                return { name: s.name, rollNum: s.rollNum, attendanceRate: rate != null ? Math.round(rate) : null, riskScore: risk };
            })
            .filter(s => s.riskScore != null && s.riskScore > 30)
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 5);

            const recentNotices = await Notice.find({ $or: [{ school: oid }, { schoolId: oid }] })
                .sort({ date: -1 })
                .limit(5)
                .select('title details date audience')
                .lean();

            return {
                stats: { totalStudents, totalTeachers, totalClasses, activeTests },
                classPerformance,
                teacherPerformance: teacherPerf.filter(t => t.score != null),
                studentRisk: riskList,
                recentNotices,
            };
        }, 60); // 60s TTL — dashboard refreshes frequently

        res.json(data);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDashboardSummary };
