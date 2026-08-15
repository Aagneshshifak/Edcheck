/**
 * AdaptiveLearningController
 *
 * HTTP layer for the adaptive learning system.
 * Validates inputs, delegates to the pipeline/services, and returns
 * structured JSON responses.
 *
 * Route groups (registered in adaptiveLearningRoutes.js):
 *   POST /api/adaptive/attempt          — submit attempt through full pipeline
 *   GET  /api/adaptive/profile/:sid     — get student learning profile
 *   GET  /api/adaptive/mastery/:sid     — get all topic mastery records
 *   GET  /api/adaptive/trends/:sid      — get learning trends
 *   GET  /api/adaptive/difficulty/:sid  — get latest difficulty recommendations
 *   POST /api/adaptive/study-plan/:sid  — generate LLM study plan
 *   GET  /api/adaptive/study-plan/:sid  — get latest saved study plan
 *   GET  /api/adaptive/attempt/:id      — get attempt detail by ID
 *   GET  /api/adaptive/analytics/:sid   — full analytics dump (research/admin)
 */

'use strict';

const mongoose = require('mongoose');

const Test          = require('../models/testSchema');
const TestAttempt   = require('../models/testAttemptSchema');

const QuizAttemptDetail        = require('../models/adaptiveLearning/quizAttemptDetailSchema');
const TopicMastery             = require('../models/adaptiveLearning/topicMasterySchema');
const LearningTrend            = require('../models/adaptiveLearning/learningTrendSchema');
const DifficultyRecommendation = require('../models/adaptiveLearning/difficultyRecommendationSchema');
const StudentLearningProfile   = require('../models/adaptiveLearning/studentLearningProfileSchema');
const AdaptiveStudyPlan        = require('../models/adaptiveLearning/adaptiveStudyPlanSchema');

const pipeline         = require('../services/adaptiveLearning/adaptivePipeline');
const studyPlanService = require('../services/adaptiveLearning/studyPlanLLMService');
const assessmentGenerator = require('../services/assessmentGenerator');
const { logger }       = require('../utils/serverLogger');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function sendError(res, status, message, details = null) {
    const body = { success: false, error: { message, status } };
    if (details) body.error.details = details;
    return res.status(status).json(body);
}

// ── POST /api/adaptive/attempt ────────────────────────────────────────────────
/**
 * Submit a quiz attempt through the full adaptive pipeline.
 *
 * Request body:
 * {
 *   "studentId":   "ObjectId",
 *   "testId":      "ObjectId",
 *   "submissions": [
 *     { "studentAnswer": 2, "responseTimeMs": 12000, "confidence": 4, "attemptCount": 1 },
 *     ...
 *   ],
 *   "totalDurationMs": 600000
 * }
 *
 * Submissions are index-aligned with test.questions.
 * Each submission may include: studentAnswer, responseTimeMs, confidence (1-5), attemptCount.
 */
const submitAdaptiveAttempt = async (req, res) => {
    try {
        const { studentId, testId, submissions, totalDurationMs } = req.body;

        // ── Input validation ──────────────────────────────────────────────
        if (!studentId || !isValidObjectId(studentId)) {
            return sendError(res, 400, 'studentId must be a valid MongoDB ObjectId');
        }
        if (!testId || !isValidObjectId(testId)) {
            return sendError(res, 400, 'testId must be a valid MongoDB ObjectId');
        }
        if (!Array.isArray(submissions) || submissions.length === 0) {
            return sendError(res, 400, 'submissions must be a non-empty array');
        }

        // ── Fetch test and attempt ────────────────────────────────────────
        const [test, attempt] = await Promise.all([
            Test.findById(testId).lean(),
            TestAttempt.findOne({ studentId, testId }).lean(),
        ]);

        if (!test) {
            return sendError(res, 404, 'Test not found');
        }
        if (!attempt) {
            return sendError(res, 404, 'TestAttempt not found. Submit via /TestAttempt first.');
        }

        // Check for duplicate adaptive processing
        const existing = await QuizAttemptDetail.findOne({ attemptId: attempt._id });
        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Attempt already processed by adaptive pipeline',
                attemptDetailId: existing._id,
            });
        }

        // ── Enrich questions with topic and difficulty tags ───────────────
        // If test questions lack topic/difficulty, use defaults
        const enrichedQuestions = test.questions.map((q, i) => ({
            questionText:  q.questionText,
            questionType:  q.questionType  || 'mcq',
            topic:         q.topic         || (test.subject ? String(test.subject) : 'General'),
            difficulty:    q.difficulty    || 'medium',
            marks:         q.marks,
            correctAnswer: q.correctAnswer,
        }));

        // ── Run pipeline ──────────────────────────────────────────────────
        const result = await pipeline.runPipeline({
            studentId:      String(studentId),
            testId:         String(testId),
            attemptId:      String(attempt._id),
            subjectId:      test.subject ? String(test.subject) : undefined,
            schoolId:       test.school  ? String(test.school)  : undefined,
            questions:      enrichedQuestions,
            submissions,
            totalDurationMs: totalDurationMs || 0,
        });

        return res.status(result.success ? 200 : 207).json({
            success:      result.success,
            message:      result.success ? 'Adaptive pipeline completed' : 'Pipeline completed with stage errors',
            durationMs:   result.durationMs,
            stageErrors:  result.stageErrors,
            summary: {
                topicsProcessed:  Object.keys(result.masteryUpdates  || {}).length,
                trendsAnalyzed:   Object.keys(result.trendUpdates    || {}).length,
                diffRecs:         Object.keys(result.difficultyRecs  || {}).length,
                overallMastery:   result.profile?.scores?.overallMastery,
                readinessScore:   result.profile?.scores?.readinessScore,
            },
            attemptDetailId: result.attemptDetail?._id,
            profileId:       result.profile?._id,
        });

    } catch (err) {
        logger.error('submitAdaptiveAttempt: error', { error: err.message });
        return sendError(res, 500, 'Internal server error');
    }
};

// ── GET /api/adaptive/profile/:studentId ─────────────────────────────────────
const getStudentProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const profile = await StudentLearningProfile.findOne({ studentId }).lean();
        if (!profile) {
            return res.json({
                success: true,
                profile: null,
                message: 'No profile yet. Complete a quiz to start building your profile.',
            });
        }

        return res.json({ success: true, profile });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/mastery/:studentId ─────────────────────────────────────
const getTopicMastery = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const { subjectId, topic } = req.query;
        const filter = { studentId };
        if (subjectId && isValidObjectId(subjectId)) filter.subjectId = subjectId;
        if (topic) filter.topic = { $regex: new RegExp(topic, 'i') };

        const records = await TopicMastery.find(filter)
            .sort({ masteryScore: -1 })
            .lean();

        return res.json({ success: true, count: records.length, records });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/trends/:studentId ──────────────────────────────────────
const getLearningTrends = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const { trendType, subjectId } = req.query;
        const filter = { studentId };
        if (trendType) filter.trendType = trendType;
        if (subjectId && isValidObjectId(subjectId)) filter.subjectId = subjectId;

        const trends = await LearningTrend.find(filter)
            .sort({ updatedAt: -1 })
            .lean();

        return res.json({ success: true, count: trends.length, trends });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/difficulty/:studentId ───────────────────────────────────
const getDifficultyRecommendations = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        // Latest recommendation per topic
        const allRecs = await DifficultyRecommendation.find({ studentId })
            .sort({ recommendedAt: -1 })
            .lean();

        const seen     = new Set();
        const latest   = allRecs.filter(r => {
            if (seen.has(r.topic)) return false;
            seen.add(r.topic);
            return true;
        });

        return res.json({ success: true, count: latest.length, recommendations: latest });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── POST /api/adaptive/study-plan/:studentId ──────────────────────────────────
/**
 * Generate a new LLM-based study plan for a student.
 *
 * Request body (all optional — reasonable defaults used if omitted):
 * {
 *   "upcomingExams": ["Math Final", "Physics Test"],
 *   "studyHoursPerWeek": 12,
 *   "learningObjectives": ["Master quadratic equations", "Improve lab skills"]
 * }
 */
const generateStudyPlan = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const { upcomingExams = [], studyHoursPerWeek = 10, learningObjectives = [] } = req.body || {};

        // ── Fetch all analytics ───────────────────────────────────────────
        const { profile, masteryRecords, trendRecords, latestDiffRecs } =
            await pipeline.getStudentAnalytics(studentId);

        if (!masteryRecords || masteryRecords.length === 0) {
            return sendError(res, 422, 'No mastery data available. Complete at least one adaptive quiz first.');
        }

        // ── Build analytics context (no raw answers exposed to LLM) ──────
        const analyticsContext = studyPlanService.buildAnalyticsContext({
            profile: profile || { studentId, scores: {} },
            masteryRecords,
            trendRecords,
            diffRecs: latestDiffRecs,
            upcomingExams,
            studyHoursPerWeek,
            learningObjectives,
        });

        // ── Call LLM ──────────────────────────────────────────────────────
        const { plan, promptUsed, rawLLMResponse, llmMeta } =
            await studyPlanService.generateStudyPlan(analyticsContext);

        // ── Deactivate previous plans ─────────────────────────────────────
        await AdaptiveStudyPlan.updateMany({ studentId, isActive: true }, { $set: { isActive: false } });

        // ── Save new plan ─────────────────────────────────────────────────
        const subjectId = masteryRecords[0]?.subjectId;
        const schoolId  = profile?.schoolId;

        const savedPlan = await AdaptiveStudyPlan.create({
            studentId,
            subjectId,
            schoolId,
            analyticsSnapshot: {
                overallMastery:             analyticsContext.overallMastery,
                readinessScore:             analyticsContext.readinessScore,
                consistencyScore:           analyticsContext.consistencyScore,
                learningPace:               studyPlanService.paceLabelFromScore(analyticsContext.learningPaceScore),
                weakTopics:                 analyticsContext.weakTopics,
                strongTopics:               analyticsContext.strongTopics,
                difficultyRecommendations:  analyticsContext.difficultyRecommendations,
                upcomingExams,
                availableStudyHoursPerWeek: studyHoursPerWeek,
                learningObjectives,
            },
            promptUsed,
            plan,
            llmMeta,
            rawLLMResponse,
            generatedAt: new Date(),
            isActive: true,
        });

        // ── Update profile with latest plan reference ─────────────────────
        await StudentLearningProfile.findOneAndUpdate(
            { studentId },
            {
                $set: {
                    'latestStudyPlan.generatedAt': savedPlan.generatedAt,
                    'latestStudyPlan.studyPlanId': savedPlan._id,
                    'latestStudyPlan.planSummary': plan.summary,
                },
            }
        );

        return res.status(201).json({
            success: true,
            studyPlan: {
                _id: savedPlan._id,
                generatedAt: savedPlan.generatedAt,
                llmMeta,
                plan,
            },
        });

    } catch (err) {
        logger.error('generateStudyPlan: error', { error: err.message });
        if (err.message?.includes('AI')) {
            return sendError(res, 503, 'AI service temporarily unavailable. Please try again.');
        }
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/study-plan/:studentId ───────────────────────────────────
const getStudyPlan = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const plan = await AdaptiveStudyPlan.findOne({ studentId, isActive: true })
            .sort({ generatedAt: -1 })
            .lean();

        if (!plan) {
            return res.json({
                success: true,
                studyPlan: null,
                message: 'No study plan generated yet.',
            });
        }

        return res.json({ success: true, studyPlan: plan });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/attempt/:id ─────────────────────────────────────────────
const getAttemptDetail = async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) return sendError(res, 400, 'Invalid attempt detail ID');

        const detail = await QuizAttemptDetail.findById(id).lean();
        if (!detail) return sendError(res, 404, 'Attempt detail not found');

        return res.json({ success: true, attemptDetail: detail });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/analytics/:studentId ────────────────────────────────────
/**
 * Full analytics dump for research/admin use.
 * Returns all pipeline stage outputs in a single response.
 */
const getFullAnalytics = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        // Only allow Admin or the student themselves
        if (req.user.role !== 'Admin' && req.user.id !== studentId) {
            return sendError(res, 403, 'Access denied');
        }

        const [analytics, recentAttempts, studyPlanHistory] = await Promise.all([
            pipeline.getStudentAnalytics(studentId),
            QuizAttemptDetail.find({ studentId })
                .sort({ attemptedAt: -1 })
                .limit(10)
                .lean(),
            AdaptiveStudyPlan.find({ studentId })
                .sort({ generatedAt: -1 })
                .limit(5)
                .select('-rawLLMResponse -promptUsed')
                .lean(),
        ]);

        return res.json({
            success: true,
            studentId,
            analytics: {
                profile:          analytics.profile,
                masteryRecords:   analytics.masteryRecords,
                trendRecords:     analytics.trendRecords,
                latestDiffRecs:   analytics.latestDiffRecs,
            },
            recentAttempts,
            studyPlanHistory,
        });

    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/difficulty/:studentId/topic/:topic/explain ─────────────
/**
 * Returns the explainability trace for a specific topic recommendation.
 */
const explainDifficultyRec = async (req, res) => {
    try {
        const { studentId, topic } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const rec = await DifficultyRecommendation.findOne({ studentId, topic })
            .sort({ recommendedAt: -1 })
            .lean();

        if (!rec) return sendError(res, 404, `No difficulty recommendation found for topic "${topic}"`);

        return res.json({
            success: true,
            topic,
            recommendedDifficulty: rec.recommendedDifficulty,
            decisionTrace: rec.decisionTrace,
            explanation:   rec.explanation,
            inputs: {
                masteryScore:  rec.inputMasteryScore,
                trendType:     rec.inputTrendType,
                cognitiveLoad: rec.inputCognitiveLoad,
                prevDifficulty: rec.inputPrevDifficulty,
            },
        });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── POST /api/adaptive/study-plan-feedback/:studentId ─────────────────────────
/**
 * Submit feedback on a study plan recommendation.
 *
 * Request body:
 * {
 *   "studyPlanId": "ObjectId",
 *   "feedback": [
 *     { "topic": "Algebra", "status": "completed", "usefulness": "useful", "difficulty_feedback": "appropriate", "comment": "" }
 *   ]
 * }
 */
const submitStudyPlanFeedback = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const { studyPlanId, feedback } = req.body || {};
        if (!studyPlanId || !isValidObjectId(studyPlanId)) {
            return sendError(res, 400, 'studyPlanId must be a valid ObjectId');
        }
        if (!Array.isArray(feedback) || feedback.length === 0) {
            return sendError(res, 400, 'feedback must be a non-empty array');
        }

        const StudyPlanFeedback = require('../models/adaptiveLearning/studyPlanFeedbackSchema');

        const savedFeedback = [];
        for (const item of feedback) {
            const saved = await StudyPlanFeedback.create({
                studentId,
                studyPlanId,
                topic: item.topic,
                status: item.status || 'not_started',
                usefulness: item.usefulness || null,
                difficulty_feedback: item.difficulty_feedback || null,
                comment: (item.comment || '').slice(0, 500),
            });
            savedFeedback.push(saved);
        }

        // Invalidate cached study plans so next generation uses this feedback
        const { groqService } = require('../services/groqService');
        await groqService.invalidateByUserId(studentId);

        return res.status(201).json({
            success: true,
            message: `Saved ${savedFeedback.length} feedback entries`,
            feedback: savedFeedback,
        });

    } catch (err) {
        logger.error('submitStudyPlanFeedback: error', { error: err.message });
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/study-plan-feedback/:studentId ──────────────────────────
const getStudyPlanFeedback = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const StudyPlanFeedback = require('../models/adaptiveLearning/studyPlanFeedbackSchema');

        const { studyPlanId } = req.query;
        const filter = { studentId };
        if (studyPlanId && isValidObjectId(studyPlanId)) filter.studyPlanId = studyPlanId;

        const feedback = await StudyPlanFeedback.find(filter)
            .sort({ submittedAt: -1 })
            .limit(50)
            .lean();

        return res.json({ success: true, count: feedback.length, feedback });
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── POST /api/adaptive/post-assessment-analysis ──────────────────────────────
/**
 * Trigger comprehensive post-assessment analysis.
 * Steps:
 *   1. Run deterministic evaluation (pipeline stages 1-5) — if not already run
 *   2. Generate student analysis via LLM
 *   3. Generate/update personalized study plan
 *   4. Generate staff report
 *
 * This is designed to run asynchronously — the student has already received
 * their assessment result from the pipeline.
 *
 * Request body:
 * {
 *   "studentId": "ObjectId",
 *   "testId": "ObjectId",
 *   "staffId": "ObjectId" (optional — if provided, generates staff report)
 * }
 */
const runPostAssessmentAnalysis = async (req, res) => {
    try {
        const { studentId, testId, staffId } = req.body;

        if (!studentId || !isValidObjectId(studentId)) {
            return sendError(res, 400, 'studentId must be a valid ObjectId');
        }
        if (!testId || !isValidObjectId(testId)) {
            return sendError(res, 400, 'testId must be a valid ObjectId');
        }

        // Respond immediately — analysis runs in background
        res.status(202).json({
            success: true,
            message: 'Post-assessment analysis started. Results will be available shortly.',
        });

        // ── Background processing ────────────────────────────────────────
        setImmediate(async () => {
            try {
                const { profile, masteryRecords, trendRecords, latestDiffRecs } =
                    await pipeline.getStudentAnalytics(studentId);

                if (!masteryRecords || masteryRecords.length === 0) {
                    logger.warn('postAssessmentAnalysis: no mastery data', { studentId });
                    return;
                }

                // Get latest attempt detail for metrics
                const latestAttempt = await QuizAttemptDetail.findOne({ studentId, testId })
                    .sort({ attemptedAt: -1 })
                    .lean();

                if (!latestAttempt) {
                    logger.warn('postAssessmentAnalysis: no attempt detail found', { studentId, testId });
                    return;
                }

                const test = await Test.findById(testId).lean();

                // ── Step 1: Generate study plan ──────────────────────────
                try {
                    // Fetch any previous feedback
                    const StudyPlanFeedback = require('../models/adaptiveLearning/studyPlanFeedbackSchema');
                    const prevFeedback = await StudyPlanFeedback.find({ studentId })
                        .sort({ submittedAt: -1 })
                        .limit(20)
                        .lean();

                    const analyticsContext = studyPlanService.buildAnalyticsContext({
                        profile: profile || { studentId, scores: {} },
                        masteryRecords,
                        trendRecords,
                        diffRecs: latestDiffRecs,
                        previousFeedback: prevFeedback.map(f => ({
                            topic: f.topic,
                            status: f.status,
                            comment: f.comment,
                        })),
                    });

                    const { plan, promptUsed, rawLLMResponse, llmMeta } =
                        await studyPlanService.generateStudyPlan(analyticsContext);

                    // Save study plan
                    await AdaptiveStudyPlan.updateMany({ studentId, isActive: true }, { $set: { isActive: false } });
                    await AdaptiveStudyPlan.create({
                        studentId,
                        subjectId: latestAttempt.subjectId,
                        schoolId: profile?.schoolId,
                        analyticsSnapshot: {
                            overallMastery: analyticsContext.overallMastery,
                            readinessScore: analyticsContext.readinessScore,
                            consistencyScore: analyticsContext.consistencyScore,
                            learningPace: studyPlanService.paceLabelFromScore(analyticsContext.learningPaceScore),
                            weakTopics: analyticsContext.weakTopics,
                            strongTopics: analyticsContext.strongTopics,
                            difficultyRecommendations: analyticsContext.difficultyRecommendations,
                        },
                        promptUsed,
                        plan,
                        llmMeta,
                        rawLLMResponse,
                        generatedAt: new Date(),
                        isActive: true,
                    });

                    logger.info('postAssessmentAnalysis: study plan generated', { studentId });
                } catch (planErr) {
                    logger.error('postAssessmentAnalysis: study plan failed', { studentId, error: planErr.message });
                }

                // ── Step 2: Generate staff report ────────────────────────
                if (staffId && isValidObjectId(staffId)) {
                    try {
                        const staffReportService = require('../services/staffReportingService');
                        await staffReportService.generateStaffReport({
                            studentId,
                            staffId,
                            assessmentId: testId,
                            assessmentTitle: test?.title || 'Assessment',
                            assessmentDate: latestAttempt.attemptedAt,
                            subjectId: latestAttempt.subjectId,
                            schoolId: profile?.schoolId,
                            attemptDetailId: latestAttempt._id,
                            assessmentMetrics: latestAttempt.metrics,
                            profile: profile || { studentId, scores: {} },
                            masteryRecords,
                            trendRecords,
                            diffRecs: latestDiffRecs,
                        });
                        logger.info('postAssessmentAnalysis: staff report generated', { studentId, staffId });
                    } catch (reportErr) {
                        logger.error('postAssessmentAnalysis: staff report failed', { studentId, error: reportErr.message });
                    }
                }

            } catch (err) {
                logger.error('postAssessmentAnalysis: background error', { studentId, error: err.message });
            }
        });

    } catch (err) {
        logger.error('runPostAssessmentAnalysis: error', { error: err.message });
        return sendError(res, 500, err.message);
    }
};

// ── GET /api/adaptive/staff-reports/:studentId ────────────────────────────────
/**
 * Get staff reports for a student. Staff can only see their own reports.
 * Admin can see all reports.
 */
const getStaffReports = async (req, res) => {
    try {
        const { studentId } = req.params;
        if (!isValidObjectId(studentId)) return sendError(res, 400, 'Invalid studentId');

        const staffReportService = require('../services/staffReportingService');
        const staffId = req.user.role === 'Admin' ? undefined : req.user.id;

        if (staffId) {
            // Strict RBAC: Check if teacher is assigned to the student's class
            const Teacher = require('../models/teacherSchema');
            const Student = require('../models/studentSchema');
            const [teacher, student] = await Promise.all([
                Teacher.findById(staffId).lean(),
                Student.findById(studentId).lean()
            ]);

            if (!teacher || !student) {
                return sendError(res, 403, 'Access denied: student or teacher not found');
            }

            const classIds = [
                ...(teacher.teachClasses || []).map(id => id.toString()),
                teacher.teachSclass ? teacher.teachSclass.toString() : null
            ].filter(Boolean);

            const studentClassId = student.classId || student.sclassName;
            const isAuthorized = studentClassId && classIds.includes(studentClassId.toString());

            if (!isAuthorized) {
                return sendError(res, 403, 'Access denied: student is not assigned to your classes');
            }

            const reports = await staffReportService.getStudentReports(staffId, studentId, {
                limit: parseInt(req.query.limit) || 20,
                subjectId: req.query.subjectId,
            });
            return res.json({ success: true, count: reports.length, reports });
        } else {
            // Admin: get all reports for this student
            const StaffStudentReport = require('../models/staffStudentReportSchema');
            const reports = await StaffStudentReport.find({ studentId })
                .sort({ generatedAt: -1 })
                .limit(parseInt(req.query.limit) || 20)
                .lean();
            return res.json({ success: true, count: reports.length, reports });
        }
    } catch (err) {
        return sendError(res, 500, err.message);
    }
};

// ── POST /api/adaptive/generate-test ──────────────────────────────────────────
const generateAdaptiveAssessment = async (req, res) => {
    try {
        const { studentId, subjectId, totalQuestions = 10, durationMinutes = 30 } = req.body;

        if (!studentId || !isValidObjectId(studentId)) {
            return sendError(res, 400, 'studentId must be a valid MongoDB ObjectId');
        }
        if (!subjectId || !isValidObjectId(subjectId)) {
            return sendError(res, 400, 'subjectId must be a valid MongoDB ObjectId');
        }

        const Student = require('../models/studentSchema');
        const student = await Student.findById(studentId).lean();
        if (!student) {
            return sendError(res, 404, 'Student not found');
        }

        const classId = student.classId || student.sclassName;
        const schoolId = student.schoolId || student.school;

        const Subject = require('../models/subjectSchema');
        const subjectDoc = await Subject.findById(subjectId).lean();
        if (!subjectDoc) {
            return sendError(res, 404, 'Subject not found');
        }

        const subjects = [{
            name: subjectDoc.subjectName || subjectDoc.subName || 'Subject',
            topics: subjectDoc.topics || []
        }];

        const analytics = await pipeline.getStudentAnalytics(studentId);

        const test = await assessmentGenerator.generateAssessment({
            studentId,
            subjectId,
            classId,
            schoolId,
            totalQuestions,
            durationMinutes,
            dskp: analytics.profile ? {
                overallMastery: analytics.profile.scores?.overallMastery || 0,
                readinessScore: analytics.profile.scores?.readinessScore || 0,
                consistencyScore: analytics.profile.scores?.consistencyScore || 0,
                engagementScore: analytics.profile.scores?.engagementScore || 0,
                confidenceScore: analytics.profile.scores?.confidenceScore || 0,
                learningPace: analytics.profile.scores?.learningPace || 0,
                retentionEstimate: analytics.profile.scores?.retentionEstimate || 0,
                weakTopics: analytics.profile.weakTopics || [],
                strongTopics: analytics.profile.strongTopics || [],
                topicDetails: analytics.masteryRecords || [],
                difficultyRecommendations: analytics.latestDiffRecs || []
            } : {
                overallMastery: 0,
                readinessScore: 0,
                consistencyScore: 0,
                engagementScore: 0,
                confidenceScore: 0,
                learningPace: 0,
                retentionEstimate: 0,
                weakTopics: [],
                strongTopics: [],
                topicDetails: [],
                difficultyRecommendations: []
            },
            subjects
        });

        return res.status(201).json({
            success: true,
            message: 'Adaptive assessment generated successfully',
            testId: test._id,
            test
        });

    } catch (err) {
        logger.error('generateAdaptiveAssessment: error', { error: err.message });
        return sendError(res, 500, err.message);
    }
};

module.exports = {
    submitAdaptiveAttempt,
    getStudentProfile,
    getTopicMastery,
    getLearningTrends,
    getDifficultyRecommendations,
    generateStudyPlan,
    getStudyPlan,
    getAttemptDetail,
    getFullAnalytics,
    explainDifficultyRec,
    submitStudyPlanFeedback,
    getStudyPlanFeedback,
    runPostAssessmentAnalysis,
    getStaffReports,
    generateAdaptiveAssessment,
};
