/**
 * TestAttemptHistoryController
 *
 * HTTP layer for the Test Attempt History module.
 * Route groups:
 *   POST /api/history/submit          — student submits, creates history + triggers pipeline
 *   GET  /api/history/student/:sid    — student history list (search/filter/sort)
 *   GET  /api/history/:id             — single attempt detail
 *   GET  /api/history/student/:sid/analytics  — longitudinal analytics
 *   GET  /api/history/test/:tid/results       — teacher: all attempts for a test
 *   POST /api/history/test/:tid/publish       — teacher: publish solutions
 *   POST /api/history/test/:tid/ranks         — teacher: compute + publish ranks
 *   GET  /api/history/student/:sid/export/:id — PDF export data
 */

'use strict';

const mongoose = require('mongoose');
const Test              = require('../models/testSchema');
const TestAttempt       = require('../models/testAttemptSchema');
const TestAttemptHistory = require('../models/testAttemptHistorySchema');
const Student           = require('../models/studentSchema');
const historyService    = require('../services/testAttemptHistoryService');
const { logger }        = require('../utils/serverLogger');

function isValidId(id) { return mongoose.Types.ObjectId.isValid(id); }
function err(res, s, msg) { return res.status(s).json({ success: false, error: { message: msg, status: s } }); }

// ── POST /api/history/submit ──────────────────────────────────────────────────
/**
 * Unified submit endpoint:
 *   1. Saves the legacy TestAttempt (backward compat)
 *   2. Creates an immutable TestAttemptHistory record
 *   3. Triggers adaptive pipeline asynchronously (non-blocking)
 *
 * Body: { studentId, testId, submissions: [{studentAnswer, responseTimeMs, confidence, attemptCount},...],
 *         startedAt?, totalDurationMs? }
 */
const submitAttemptHistory = async (req, res) => {
    try {
        const { studentId, testId, submissions, startedAt, totalDurationMs } = req.body;

        if (!isValidId(studentId)) return err(res, 400, 'Invalid studentId');
        if (!isValidId(testId))    return err(res, 400, 'Invalid testId');
        if (!Array.isArray(submissions) || submissions.length === 0)
            return err(res, 400, 'submissions must be a non-empty array');

        // Prevent duplicate attempts (same student+test)
        const dup = await TestAttempt.findOne({ studentId, testId });
        if (dup) return res.status(409).json({
            success: false,
            error: { message: 'Attempt already submitted for this test.', status: 409 },
        });

        // Fetch test with populated references
        const test = await Test.findById(testId)
            .populate('subject',   'subName subjectName')
            .populate('createdBy', 'name')
            .populate('classId',   'sclassName className')
            .lean();
        if (!test) return err(res, 404, 'Test not found');

        const student = await Student.findById(studentId).lean();
        if (!student) return err(res, 404, 'Student not found');

        // Compute legacy score
        const questions  = test.questions || [];
        const answers    = submissions.map(s => s.studentAnswer);
        let legacyScore  = 0;
        for (let i = 0; i < questions.length; i++) {
            if (answers[i] !== undefined && answers[i] !== null &&
                Number(answers[i]) === Number(questions[i].correctAnswer)) {
                legacyScore += questions[i].marks || 1;
            }
        }
        const totalMarks = questions.reduce((s, q) => s + (q.marks || 1), 0);

        // Save legacy TestAttempt
        const submissionType = req.body.submissionType || 'manual';
        const legacyAttempt  = await TestAttempt.create({
            studentId, testId,
            answers:        answers.map(a => (a === null || a === undefined) ? -1 : Number(a)),
            score:          legacyScore,
            totalMarks,
            startedAt:      startedAt ? new Date(startedAt) : undefined,
            submittedAt:    new Date(),
            submissionType,
        });

        // Snapshot teacher/subject/class names
        const teacherName = test.createdBy?.name || '';
        const subjectName = test.subject?.subName || test.subject?.subjectName || '';
        const className   = test.classId?.sclassName || test.classId?.className || '';

        // Create immutable history record
        const historyRecord = await historyService.createAttemptHistory({
            test, student, savedAttempt: legacyAttempt,
            submissions, teacherName, subjectName, className,
        });

        // Fire-and-forget adaptive pipeline
        setImmediate(() => {
            historyService.triggerAdaptivePipeline({
                historyRecord, test, submissions, attemptId: legacyAttempt._id,
            });
        });

        return res.status(201).json({
            success:   true,
            message:   'Test submitted successfully',
            attemptId: legacyAttempt._id,
            historyId: historyRecord._id,
            score:     legacyScore,
            totalMarks,
            percentage: historyRecord.percentage,
            grade:      historyRecord.grade,
        });

    } catch (e) {
        logger.error('submitAttemptHistory error', { error: e.message });
        return err(res, 500, 'Internal server error');
    }
};

// ── GET /api/history/student/:studentId ──────────────────────────────────────
/**
 * Student history list with search, filter, sort, pagination.
 * Query params:
 *   subject=subjectId   teacher=teacherId   grade=A|B|C|D|F
 *   from=ISO    to=ISO   minScore=0  maxScore=100
 *   sort=latest|oldest|highest|lowest   page=1  limit=20
 *   search=string (matches testTitle, subjectName)
 */
const getStudentHistory = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidId(studentId)) return err(res, 400, 'Invalid studentId');

        const {
            subject, teacher, grade, from, to, minScore, maxScore,
            sort = 'latest', page = '1', limit = '20', search,
        } = req.query;

        const filter = { studentId };
        if (subject  && isValidId(subject))  filter.subjectId = subject;
        if (teacher  && isValidId(teacher))  filter.teacherId = teacher;
        if (grade)  filter.grade = grade;
        if (from || to) {
            filter.submittedAt = {};
            if (from) filter.submittedAt.$gte = new Date(from);
            if (to)   filter.submittedAt.$lte = new Date(to);
        }
        if (minScore !== undefined || maxScore !== undefined) {
            filter.percentage = {};
            if (minScore !== undefined) filter.percentage.$gte = Number(minScore);
            if (maxScore !== undefined) filter.percentage.$lte = Number(maxScore);
        }
        if (search) {
            const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ testTitle: rx }, { subjectName: rx }];
        }

        const sortMap = {
            latest:  { submittedAt: -1 },
            oldest:  { submittedAt:  1 },
            highest: { percentage:  -1 },
            lowest:  { percentage:   1 },
        };
        const sortObj = sortMap[sort] || sortMap.latest;

        const pageNum  = Math.max(1, parseInt(page,  10) || 1);
        const limitNum = Math.min(100, parseInt(limit, 10) || 20);
        const skip     = (pageNum - 1) * limitNum;

        const [records, total] = await Promise.all([
            TestAttemptHistory.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(limitNum)
                .select('-questionResponses -aiFeedback.recommendations')  // keep response small
                .lean(),
            TestAttemptHistory.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            total,
            page:    pageNum,
            pages:   Math.ceil(total / limitNum),
            records,
        });

    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── GET /api/history/:id ──────────────────────────────────────────────────────
const getAttemptHistoryById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidId(id)) return err(res, 400, 'Invalid id');

        const record = await TestAttemptHistory.findById(id).lean();
        if (!record) return err(res, 404, 'Attempt history not found');

        // Hide correct answers if solutions not published
        if (!record.solutionsPublished) {
            record.questionResponses = record.questionResponses.map(q => ({
                ...q, correctAnswer: undefined,
            }));
        }

        return res.json({ success: true, record });
    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── GET /api/history/student/:studentId/analytics ────────────────────────────
/**
 * Full longitudinal analytics for a student.
 * Returns data for all chart types needed on the frontend.
 */
const getStudentAnalytics = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidId(studentId)) return err(res, 400, 'Invalid studentId');

        const { subjectId, days = '90' } = req.query;
        const since = new Date(Date.now() - parseInt(days, 10) * 24 * 60 * 60 * 1000);
        const filter = { studentId, submittedAt: { $gte: since } };
        if (subjectId && isValidId(subjectId)) filter.subjectId = subjectId;

        const records = await TestAttemptHistory.find(filter)
            .sort({ submittedAt: 1 })
            .select('submittedAt percentage finalScore maxScore grade subjectId subjectName ' +
                    'correctAnswers wrongAnswers skippedQuestions totalQuestions ' +
                    'avgResponseTimeMs timeTakenSeconds topicPerformance ' +
                    'overallMasteryBefore overallMasteryAfter learningVelocity improvementScore')
            .lean();

        if (records.length === 0) {
            return res.json({ success: true, analytics: null, message: 'No attempts in the selected period.' });
        }

        // Score progression (time-series)
        const scoreProgression = records.map(r => ({
            date:       r.submittedAt,
            score:      r.percentage,
            grade:      r.grade,
            subjectId:  r.subjectId,
            subject:    r.subjectName,
        }));

        // Subject-wise progress (avg percentage per subject)
        const bySubject = {};
        for (const r of records) {
            const key = String(r.subjectId || 'unknown');
            if (!bySubject[key]) bySubject[key] = { subjectName: r.subjectName || key, scores: [] };
            bySubject[key].scores.push(r.percentage);
        }
        const subjectProgress = Object.values(bySubject).map(s => ({
            subject: s.subjectName,
            avg:     parseFloat((s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(2)),
            count:   s.scores.length,
        }));

        // Topic mastery progression (latest masteryAfter per topic)
        const topicMasteryMap = {};
        for (const r of records) {
            for (const tp of (r.topicPerformance || [])) {
                if (!topicMasteryMap[tp.topic] || r.submittedAt > topicMasteryMap[tp.topic].date) {
                    topicMasteryMap[tp.topic] = {
                        topic:   tp.topic,
                        mastery: tp.masteryAfter ?? tp.accuracy,
                        date:    r.submittedAt,
                    };
                }
            }
        }
        const topicMasteryProgression = Object.values(topicMasteryMap).sort((a, b) => b.mastery - a.mastery);

        // Accuracy trend
        const accuracyTrend = records.map(r => ({
            date:     r.submittedAt,
            accuracy: r.totalQuestions > 0 ? parseFloat((r.correctAnswers / r.totalQuestions * 100).toFixed(2)) : 0,
        }));

        // Avg response time trend
        const responseTimeTrend = records.map(r => ({
            date: r.submittedAt,
            avgMs: r.avgResponseTimeMs,
        }));

        // Weekly / monthly averages
        function groupByPeriod(recs, granularity) {
            const buckets = {};
            for (const r of recs) {
                const d = new Date(r.submittedAt);
                let key;
                if (granularity === 'week') {
                    const week = Math.floor(d.getDate() / 7);
                    key = `${d.getFullYear()}-W${String(d.getMonth() + 1).padStart(2,'0')}-${week}`;
                } else {
                    key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
                }
                if (!buckets[key]) buckets[key] = { key, scores: [], date: d };
                buckets[key].scores.push(r.percentage);
            }
            return Object.values(buckets).map(b => ({
                period: b.key,
                avg:    parseFloat((b.scores.reduce((a, c) => a + c, 0) / b.scores.length).toFixed(2)),
                count:  b.scores.length,
                date:   b.date,
            })).sort((a, b) => a.date - b.date);
        }

        const weeklyImprovement  = groupByPeriod(records, 'week');
        const monthlyImprovement = groupByPeriod(records, 'month');

        // Weak / strong topics
        const topicAccMap = {};
        for (const r of records) {
            for (const tp of (r.topicPerformance || [])) {
                if (!topicAccMap[tp.topic]) topicAccMap[tp.topic] = { total: 0, correct: 0 };
                topicAccMap[tp.topic].total   += tp.totalQuestions;
                topicAccMap[tp.topic].correct += tp.correctAnswers;
            }
        }
        const topicList = Object.entries(topicAccMap).map(([topic, v]) => ({
            topic, accuracy: v.total > 0 ? parseFloat((v.correct / v.total * 100).toFixed(2)) : 0,
        })).sort((a, b) => b.accuracy - a.accuracy);

        const strongTopics = topicList.slice(0, 5);
        const weakTopics   = [...topicList].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5);

        // Attendance frequency
        const testFrequency = records.length;

        // Learning velocity + consistency
        const velocities = records.filter(r => r.learningVelocity != null).map(r => r.learningVelocity);
        const avgVelocity = velocities.length > 0
            ? parseFloat((velocities.reduce((a, b) => a + b, 0) / velocities.length).toFixed(4))
            : null;

        const percentages = records.map(r => r.percentage);
        const mean   = percentages.reduce((a, b) => a + b, 0) / percentages.length;
        const stdDev = Math.sqrt(percentages.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / percentages.length);
        const consistencyScore = parseFloat(Math.max(0, 1 - stdDev / 50).toFixed(4)); // normalised

        return res.json({
            success: true,
            analytics: {
                scoreProgression,
                subjectProgress,
                topicMasteryProgression,
                accuracyTrend,
                responseTimeTrend,
                weeklyImprovement,
                monthlyImprovement,
                strongTopics,
                weakTopics,
                testFrequency,
                avgVelocity,
                consistencyScore,
                totalAttempts: records.length,
                overallAvg:    parseFloat(mean.toFixed(2)),
            },
        });

    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── GET /api/history/test/:testId/results ────────────────────────────────────
// Teacher: all attempts for a test, with comparison data
const getTestAttempts = async (req, res) => {
    try {
        const { testId } = req.params;
        if (!isValidId(testId)) return err(res, 400, 'Invalid testId');

        const { sort = 'highest', page = '1', limit = '50' } = req.query;
        const sortMap = { highest: { percentage: -1 }, lowest: { percentage: 1 }, latest: { submittedAt: -1 } };
        const pageNum  = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(200, parseInt(limit, 10) || 50);

        const [records, total] = await Promise.all([
            TestAttemptHistory.find({ testId })
                .sort(sortMap[sort] || sortMap.highest)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('studentId', 'name rollNum')
                .select('-questionResponses')
                .lean(),
            TestAttemptHistory.countDocuments({ testId }),
        ]);

        // Question difficulty stats (how many students got each question wrong)
        const allRecords = await TestAttemptHistory.find({ testId })
            .select('questionResponses').lean();

        const qStats = {};
        for (const rec of allRecords) {
            for (const qr of (rec.questionResponses || [])) {
                const idx = qr.questionIndex;
                if (!qStats[idx]) qStats[idx] = { idx, correct: 0, wrong: 0, skipped: 0, total: 0 };
                qStats[idx].total++;
                if (qr.isSkipped)       qStats[idx].skipped++;
                else if (qr.isCorrect)  qStats[idx].correct++;
                else                    qStats[idx].wrong++;
            }
        }
        const questionStats = Object.values(qStats).map(s => ({
            ...s,
            difficulty:      s.total > 0 ? parseFloat(((s.wrong + s.skipped) / s.total * 100).toFixed(2)) : 0,
            discrimination:  s.total > 0 ? parseFloat((s.correct / s.total).toFixed(4)) : 0,
        })).sort((a, b) => a.idx - b.idx);

        return res.json({ success: true, total, page: pageNum, pages: Math.ceil(total / limitNum), records, questionStats });
    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── POST /api/history/test/:testId/publish ────────────────────────────────────
// Teacher: publish solutions so students can see correct answers
const publishSolutions = async (req, res) => {
    try {
        const { testId } = req.params;
        if (!isValidId(testId)) return err(res, 400, 'Invalid testId');

        const result = await TestAttemptHistory.updateMany(
            { testId },
            { $set: { solutionsPublished: true, solutionsPublishedAt: new Date() } },
        );

        return res.json({ success: true, message: 'Solutions published', modifiedCount: result.modifiedCount });
    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── POST /api/history/test/:testId/ranks ──────────────────────────────────────
// Teacher: compute and publish ranks
const publishRanks = async (req, res) => {
    try {
        const { testId } = req.params;
        if (!isValidId(testId)) return err(res, 400, 'Invalid testId');

        await historyService.computeAndSaveRanks(testId);
        return res.json({ success: true, message: 'Ranks computed and saved' });
    } catch (e) {
        return err(res, 500, e.message);
    }
};

// ── GET /api/history/student/:studentId/export/:id ────────────────────────────
// Return all data needed to generate a PDF score report on the frontend
const getExportData = async (req, res) => {
    try {
        const { studentId, id } = req.params;
        if (!isValidId(studentId) || !isValidId(id)) return err(res, 400, 'Invalid IDs');

        const record = await TestAttemptHistory.findOne({ _id: id, studentId }).lean();
        if (!record) return err(res, 404, 'Record not found');

        const student = await Student.findById(studentId).select('name rollNum').lean();

        return res.json({ success: true, exportData: { record, student } });
    } catch (e) {
        return err(res, 500, e.message);
    }
};

module.exports = {
    submitAttemptHistory,
    getStudentHistory,
    getAttemptHistoryById,
    getStudentAnalytics,
    getTestAttempts,
    publishSolutions,
    publishRanks,
    getExportData,
};
