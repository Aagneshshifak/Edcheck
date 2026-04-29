const mongoose = require('mongoose');
const { groq, GROQ_MODELS } = require('../config/groq');
const { cache } = require('../utils/cache');
const { withAICache } = require('../services/ai-cache-service');

const Admin          = require('../models/adminSchema');
const Sclass         = require('../models/sclassSchema');
const Student        = require('../models/studentSchema');
const Teacher        = require('../models/teacherSchema');
const Test           = require('../models/testSchema');
const TestAttempt    = require('../models/testAttemptSchema');
const Assignment     = require('../models/assignmentSchema');
const Submission     = require('../models/submissionSchema');

const StudentRiskProfile       = require('../models/studentRiskProfileSchema');
const ClassPerformanceReport   = require('../models/classPerformanceReportSchema');
const TeacherPerformanceReport = require('../models/teacherPerformanceReportSchema');
const SchoolPerformanceReport  = require('../models/schoolPerformanceReportSchema');
const AIRecommendation         = require('../models/aiRecommendationSchema');

const {
    sanitiseForGroq,
    buildStudentRiskPrompt,
    parseStudentRiskResponse,
    buildClassPerformancePrompt,
    parseClassPerformanceResponse,
    buildTeacherPerformancePrompt,
    parseTeacherPerformanceResponse,
    buildSchoolSummaryPrompt,
    parseSchoolSummaryResponse,
    buildRecommendationsPrompt,
    parseRecommendationsResponse,
} = require('../services/admin-ai-intelligence-service');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determine whether an error originated from the Groq SDK (network / auth).
 * Mirrors the pattern in ai-teaching-controller.js.
 */
function isGroqApiError(err) {
    if (err && typeof err.status === 'number') return true;
    if (err && err.code && /^E(CONN|TIMEOUT|NOTFOUND)/.test(err.code)) return true;
    return false;
}

/**
 * Verify that the authenticated user has Admin role.
 * Returns false and sends HTTP 403 if not.
 */
function requireAdmin(req, res) {
    if (!req.user || req.user.role !== 'Admin') {
        res.status(403).json({ message: 'Access denied: Admin role required' });
        return false;
    }
    return true;
}

/**
 * Validate that id is a valid 24-char hex MongoDB ObjectId.
 * Returns false and sends HTTP 400 if invalid.
 */
function validateObjectId(id, fieldName, res) {
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        res.status(400).json({ message: `${fieldName} must be a valid MongoDB ObjectId` });
        return false;
    }
    return true;
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/ai/admin/predict-student-risk
 * Body: { testId }
 */
const predictStudentRisk = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { testId } = req.body;
        if (!testId) {
            return res.status(400).json({ message: 'testId is required' });
        }
        if (!validateObjectId(testId, 'testId', res)) return;

        // Cache check
        const cacheKey = `ai:admin:risk:${testId}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return res.status(200).json({ profiles: cached.profiles, cachedAt: cached.cachedAt });
        }

        // Fetch test
        const test = await Test.findById(testId).lean();
        if (!test) {
            return res.status(404).json({ message: 'Test not found' });
        }

        const schoolId = test.school;

        // Fetch test attempts
        const attempts = await TestAttempt.find({ testId }).lean();

        // Collect unique student IDs from attempts
        const studentIds = [...new Set(attempts.map(a => String(a.studentId)))];

        // Fetch student details
        const students = await Student.find({ _id: { $in: studentIds } })
            .select('name rollNum classId schoolId attendance examResult')
            .lean();

        // Fetch last 5 test scores per student
        const recentAttemptsByStudent = {};
        for (const sid of studentIds) {
            const recent = await TestAttempt.find({ studentId: sid, submittedAt: { $ne: null } })
                .sort({ submittedAt: -1 })
                .limit(5)
                .lean();
            recentAttemptsByStudent[sid] = recent;
        }

        // Fetch assignments for this class
        const classAssignments = await Assignment.find({ sclassName: test.classId }).lean();
        const assignmentIds = classAssignments.map(a => a._id);

        // Build student data for prompt
        const studentsData = students.map(student => {
            const sid = String(student._id);

            // Attendance percentage
            const totalAttendance = (student.attendance || []).length;
            const presentCount = (student.attendance || []).filter(a => a.status === 'Present').length;
            const attendancePct = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

            // Assignment completion rate
            const submittedAssignments = 0; // Will be computed below
            const assignmentCompletionRate = 0;

            // Last 5 test scores
            const lastFiveScores = (recentAttemptsByStudent[sid] || []).map(a => {
                if (a.totalMarks && a.totalMarks > 0) {
                    return Math.round((a.score / a.totalMarks) * 100);
                }
                return a.score || 0;
            });

            return {
                studentId: sid,
                name: student.name,
                attendancePct,
                assignmentCompletionRate,
                lastFiveScores,
            };
        });

        // Sanitise and call Groq
        const sanitised = sanitiseForGroq(studentsData);
        const { systemPrompt, userPrompt } = buildStudentRiskPrompt(sanitised);

        const { data: parsed, fromCache, cachedAt: cAt } = await withAICache({
            endpointName:  'predict-student-risk',
            userId:        String(schoolId),
            userRole:      'admin',
            inputObj:      { testId, studentIds },
            relatedTestId: testId,
            fn: async () => {
                const response = await groq.chat.completions.create({
                    model: GROQ_MODELS.BALANCED,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                });
                const content = response.choices?.[0]?.message?.content ?? '';
                return parseStudentRiskResponse(content);
            },
        });

        // Upsert StudentRiskProfile documents
        const now = new Date();
        const upsertOps = parsed.map(item => ({
            updateOne: {
                filter: { studentId: item.studentId, testId },
                update: {
                    $set: {
                        studentId: item.studentId,
                        schoolId,
                        testId,
                        riskLevel: item.riskLevel,
                        weakSubjects: item.weakSubjects,
                        suggestedActions: item.suggestedActions,
                        generatedAt: now,
                    },
                },
                upsert: true,
            },
        }));

        if (upsertOps.length > 0) {
            await StudentRiskProfile.bulkWrite(upsertOps);
        }

        const profiles = await StudentRiskProfile.find({ testId }).lean();

        // Also store in legacy node-cache for backward compat
        const cacheValue = { profiles, cachedAt: cAt || now };
        cache.set(cacheKey, cacheValue, 3600);

        return res.status(200).json({ profiles, ...(fromCache ? { cachedAt: cAt } : {}) });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * POST /api/ai/admin/class-performance-analysis
 * Body: { classId }
 */
const analyseClassPerformance = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { classId } = req.body;
        if (!classId) {
            return res.status(400).json({ message: 'classId is required' });
        }
        if (!validateObjectId(classId, 'classId', res)) return;

        // Cache check
        const cacheKey = `ai:admin:class:${classId}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return res.status(200).json({ report: cached.report, cachedAt: cached.cachedAt });
        }

        // Fetch class
        const sclass = await Sclass.findById(classId).lean();
        if (!sclass) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const schoolId = sclass.schoolId;

        // Fetch tests for this class
        const tests = await Test.find({ classId }).lean();
        const testIds = tests.map(t => t._id);

        // Fetch all attempts for those tests
        const attempts = await TestAttempt.find({ testId: { $in: testIds } }).lean();

        // Compute avg scores per subject
        const subjectScores = {};
        for (const test of tests) {
            const subjectId = String(test.subject);
            const testAttempts = attempts.filter(a => String(a.testId) === String(test._id));
            if (testAttempts.length === 0) continue;

            const scores = testAttempts.map(a => {
                if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
                return a.score || 0;
            });
            const avg = scores.reduce((s, v) => s + v, 0) / scores.length;

            if (!subjectScores[subjectId]) subjectScores[subjectId] = [];
            subjectScores[subjectId].push(avg);
        }

        const avgScoresBySubject = Object.entries(subjectScores).map(([subjectId, scores]) => ({
            subjectId,
            avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        }));

        // Fetch students in class for attendance
        const students = await Student.find({ classId }).select('name attendance').lean();
        const totalStudents = students.length;

        // Attendance rates
        const attendanceRates = students.map(s => {
            const total = (s.attendance || []).length;
            const present = (s.attendance || []).filter(a => a.status === 'Present').length;
            return total > 0 ? (present / total) * 100 : 0;
        });
        const avgAttendanceRate = attendanceRates.length > 0
            ? Math.round(attendanceRates.reduce((s, v) => s + v, 0) / attendanceRates.length)
            : 0;

        // Assignment completion rate
        const assignments = await Assignment.find({ sclassName: classId }).lean();
        const assignmentIds = assignments.map(a => a._id);
        const submissions = assignmentIds.length > 0
            ? await Submission.find({ assignmentId: { $in: assignmentIds } }).lean()
            : [];
        const expectedSubmissions = assignments.length * totalStudents;
        const assignmentCompletionRate = expectedSubmissions > 0
            ? Math.round((submissions.length / expectedSubmissions) * 100)
            : 0;

        const classData = {
            classId,
            className: sclass.className,
            avgScoresBySubject,
            avgAttendanceRate,
            assignmentCompletionRate,
        };

        // Sanitise and call Groq
        const sanitised = sanitiseForGroq(classData);
        const { systemPrompt, userPrompt } = buildClassPerformancePrompt(sanitised);

        const { data: parsed, fromCache, cachedAt: cAt } = await withAICache({
            endpointName:  'class-performance-analysis',
            userId:        String(schoolId),
            userRole:      'admin',
            inputObj:      { classId, avgScoresBySubject, avgAttendanceRate, assignmentCompletionRate },
            relatedTestId: null,
            fn: async () => {
                const response = await groq.chat.completions.create({
                    model: GROQ_MODELS.BALANCED,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                });
                const content = response.choices?.[0]?.message?.content ?? '';
                return parseClassPerformanceResponse(content);
            },
        });

        // Upsert ClassPerformanceReport
        const now = new Date();
        const report = await ClassPerformanceReport.findOneAndUpdate(
            { classId },
            {
                $set: {
                    classId,
                    schoolId,
                    averageScore: parsed.averageScore,
                    weakSubjects: parsed.weakSubjects,
                    recommendations: parsed.recommendations,
                    generatedAt: now,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Also store in legacy node-cache
        const cacheValue = { report, cachedAt: cAt || now };
        cache.set(cacheKey, cacheValue, 3600);

        return res.status(200).json({ report, ...(fromCache ? { cachedAt: cAt } : {}) });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * POST /api/ai/admin/teacher-performance-analysis
 * Body: { teacherId }
 */
const analyseTeacherPerformance = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { teacherId } = req.body;
        if (!teacherId) {
            return res.status(400).json({ message: 'teacherId is required' });
        }
        if (!validateObjectId(teacherId, 'teacherId', res)) return;

        // Cache check
        const cacheKey = `ai:admin:teacher:${teacherId}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return res.status(200).json({ report: cached.report, cachedAt: cached.cachedAt });
        }

        // Fetch teacher
        const teacher = await Teacher.findById(teacherId).lean();
        if (!teacher) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        const schoolId = teacher.schoolId;

        // Fetch tests created by this teacher
        const tests = await Test.find({ createdBy: teacherId }).lean();
        const testIds = tests.map(t => t._id);

        // Fetch all attempts for those tests
        const attempts = testIds.length > 0
            ? await TestAttempt.find({ testId: { $in: testIds } }).lean()
            : [];

        // Subject results: avg student scores per test
        const subjectResults = tests.map(test => {
            const testAttempts = attempts.filter(a => String(a.testId) === String(test._id));
            const scores = testAttempts.map(a => {
                if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
                return a.score || 0;
            });
            const avgScore = scores.length > 0
                ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
                : 0;
            return { testId: String(test._id), title: test.title, avgScore, attemptCount: testAttempts.length };
        });

        // Improvement trends: last 6 attempts per student
        const studentIds = [...new Set(attempts.map(a => String(a.studentId)))];
        const improvementTrends = [];
        for (const sid of studentIds.slice(0, 20)) { // cap at 20 students for prompt size
            const studentAttempts = await TestAttempt.find({
                studentId: sid,
                testId: { $in: testIds },
                submittedAt: { $ne: null },
            })
                .sort({ submittedAt: 1 })
                .limit(6)
                .lean();

            const scores = studentAttempts.map(a => {
                if (a.totalMarks && a.totalMarks > 0) return Math.round((a.score / a.totalMarks) * 100);
                return a.score || 0;
            });
            if (scores.length >= 2) {
                improvementTrends.push({ studentId: sid, scores });
            }
        }

        // Grading patterns: assignments created by teacher
        const assignments = await Assignment.find({ createdBy: teacherId }).lean();
        const assignmentIds = assignments.map(a => a._id);
        const submissions = assignmentIds.length > 0
            ? await Submission.find({ assignmentId: { $in: assignmentIds } }).lean()
            : [];

        const gradedSubmissions = submissions.filter(s => s.grade);
        const submissionRate = assignments.length > 0
            ? Math.round((submissions.length / (assignments.length * Math.max(studentIds.length, 1))) * 100)
            : 0;

        const gradingPatterns = {
            assignmentsCreated: assignments.length,
            totalSubmissions: submissions.length,
            gradedSubmissions: gradedSubmissions.length,
            submissionRate,
        };

        const teacherData = {
            teacherId,
            name: teacher.name,
            subjectResults,
            improvementTrends,
            gradingPatterns,
        };

        // Sanitise and call Groq
        const sanitised = sanitiseForGroq(teacherData);
        const { systemPrompt, userPrompt } = buildTeacherPerformancePrompt(sanitised);

        const response = await groq.chat.completions.create({
            model: GROQ_MODELS.BALANCED,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });

        const content = response.choices?.[0]?.message?.content ?? '';
        const parsed = parseTeacherPerformanceResponse(content);

        // Upsert TeacherPerformanceReport
        const now = new Date();
        const report = await TeacherPerformanceReport.findOneAndUpdate(
            { teacherId },
            {
                $set: {
                    teacherId,
                    schoolId,
                    performanceScore: parsed.performanceScore,
                    subjectPerformanceTrend: parsed.subjectPerformanceTrend,
                    recommendations: parsed.recommendations,
                    generatedAt: now,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Store in cache
        const cacheValue = { report, cachedAt: now };
        cache.set(cacheKey, cacheValue, 3600);

        return res.status(200).json({ report });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * POST /api/ai/admin/school-performance-summary
 * Body: { schoolId }
 */
const generateSchoolSummary = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { schoolId } = req.body;
        if (!schoolId) {
            return res.status(400).json({ message: 'schoolId is required' });
        }
        if (!validateObjectId(schoolId, 'schoolId', res)) return;

        // Cache check
        const cacheKey = `ai:admin:school:${schoolId}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return res.status(200).json({ report: cached.report, cachedAt: cached.cachedAt });
        }

        // Verify school exists
        const school = await Admin.findById(schoolId).lean();
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Fetch all classes for this school
        const classes = await Sclass.find({ schoolId }).lean();
        const classIds = classes.map(c => c._id);

        // Fetch all tests for this school
        const tests = await Test.find({ school: schoolId }).lean();
        const testIds = tests.map(t => t._id);

        // Fetch all attempts
        const attempts = testIds.length > 0
            ? await TestAttempt.find({ testId: { $in: testIds } }).lean()
            : [];

        // Class averages
        const classAverages = classes.map(cls => {
            const classTests = tests.filter(t => String(t.classId) === String(cls._id));
            const classTestIds = classTests.map(t => String(t._id));
            const classAttempts = attempts.filter(a => classTestIds.includes(String(a.testId)));
            const scores = classAttempts.map(a => {
                if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
                return a.score || 0;
            });
            const avgScore = scores.length > 0
                ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
                : 0;
            return { classId: String(cls._id), className: cls.className, avgScore };
        });

        // Subject averages
        const subjectScoreMap = {};
        for (const test of tests) {
            const subjectId = String(test.subject);
            const testAttempts = attempts.filter(a => String(a.testId) === String(test._id));
            const scores = testAttempts.map(a => {
                if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
                return a.score || 0;
            });
            if (scores.length === 0) continue;
            if (!subjectScoreMap[subjectId]) subjectScoreMap[subjectId] = [];
            subjectScoreMap[subjectId].push(...scores);
        }
        const subjectAverages = Object.entries(subjectScoreMap).map(([subjectId, scores]) => ({
            subjectId,
            avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
        }));

        // 30-day attendance trend
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const students = await Student.find({ schoolId }).select('attendance').lean();
        const attendanceTrend30d = [];
        const dateMap = {};
        for (const student of students) {
            for (const record of (student.attendance || [])) {
                if (record.date >= thirtyDaysAgo) {
                    const dateStr = new Date(record.date).toISOString().split('T')[0];
                    if (!dateMap[dateStr]) dateMap[dateStr] = { present: 0, total: 0 };
                    dateMap[dateStr].total++;
                    if (record.status === 'Present') dateMap[dateStr].present++;
                }
            }
        }
        for (const [date, counts] of Object.entries(dateMap).sort()) {
            attendanceTrend30d.push({
                date,
                attendanceRate: Math.round((counts.present / counts.total) * 100),
            });
        }

        const schoolData = {
            schoolId,
            schoolName: school.schoolName,
            classAverages,
            subjectAverages,
            attendanceTrend30d,
        };

        // Sanitise and call Groq
        const sanitised = sanitiseForGroq(schoolData);
        const { systemPrompt, userPrompt } = buildSchoolSummaryPrompt(sanitised);

        const response = await groq.chat.completions.create({
            model: GROQ_MODELS.BALANCED,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });

        const content = response.choices?.[0]?.message?.content ?? '';
        const parsed = parseSchoolSummaryResponse(content);

        // Upsert SchoolPerformanceReport
        const now = new Date();
        const report = await SchoolPerformanceReport.findOneAndUpdate(
            { schoolId },
            {
                $set: {
                    schoolId,
                    overallAverageScore: parsed.overallAverageScore,
                    topClasses: parsed.topClasses,
                    weakSubjects: parsed.weakSubjects,
                    academicTrend: parsed.academicTrend,
                    generatedAt: now,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Store in cache
        const cacheValue = { report, cachedAt: now };
        cache.set(cacheKey, cacheValue, 3600);

        return res.status(200).json({ report });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * POST /api/ai/admin/generate-recommendations
 * Body: { schoolId }
 */
const generateRecommendations = async (req, res) => {
    try {
        if (!requireAdmin(req, res)) return;

        const { schoolId } = req.body;
        if (!schoolId) {
            return res.status(400).json({ message: 'schoolId is required' });
        }
        if (!validateObjectId(schoolId, 'schoolId', res)) return;

        // Cache check
        const cacheKey = `ai:admin:recommendations:${schoolId}`;
        const cached = cache.get(cacheKey);
        if (cached !== undefined) {
            return res.status(200).json({ recommendation: cached.recommendation, cachedAt: cached.cachedAt });
        }

        // Fetch most recent reports for this school
        const [riskProfiles, classReports, teacherReports, schoolReport] = await Promise.all([
            StudentRiskProfile.find({ schoolId }).sort({ generatedAt: -1 }).limit(50).lean(),
            ClassPerformanceReport.find({ schoolId }).sort({ generatedAt: -1 }).lean(),
            TeacherPerformanceReport.find({ schoolId }).sort({ generatedAt: -1 }).lean(),
            SchoolPerformanceReport.findOne({ schoolId }).sort({ generatedAt: -1 }).lean(),
        ]);

        // Check if any reports exist
        if (
            riskProfiles.length === 0 &&
            classReports.length === 0 &&
            teacherReports.length === 0 &&
            !schoolReport
        ) {
            return res.status(404).json({
                message: 'No AI reports found for this school. Run individual analyses first.',
            });
        }

        const reportsData = {
            riskProfiles,
            classReports,
            teacherReports,
            schoolReport,
        };

        // Sanitise and call Groq
        const sanitised = sanitiseForGroq(reportsData);
        const { systemPrompt, userPrompt } = buildRecommendationsPrompt(sanitised);

        const response = await groq.chat.completions.create({
            model: GROQ_MODELS.BALANCED,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });

        const content = response.choices?.[0]?.message?.content ?? '';
        const parsed = parseRecommendationsResponse(content);

        // Upsert AIRecommendation
        const now = new Date();
        const recommendation = await AIRecommendation.findOneAndUpdate(
            { schoolId },
            {
                $set: {
                    schoolId,
                    recommendations: parsed,
                    generatedAt: now,
                },
            },
            { upsert: true, new: true }
        ).lean();

        // Store in cache
        const cacheValue = { recommendation, cachedAt: now };
        cache.set(cacheKey, cacheValue, 3600);

        return res.status(200).json({ recommendation });

    } catch (err) {
        if (err.message === 'AI returned an unexpected response format') {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        if (isGroqApiError(err)) {
            return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    predictStudentRisk,
    analyseClassPerformance,
    analyseTeacherPerformance,
    generateSchoolSummary,
    generateRecommendations,
};
