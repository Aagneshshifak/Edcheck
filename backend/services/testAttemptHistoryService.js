/**
 * TestAttemptHistoryService
 *
 * Handles the creation and enrichment of immutable TestAttemptHistory records.
 * Called immediately after a student submits a test.
 *
 * Responsibilities:
 *   1. Build a complete history record from test + student + attempt data
 *   2. Compute all derived metrics (grade, topic performance, etc.)
 *   3. Persist the immutable record
 *   4. Trigger the adaptive learning pipeline asynchronously
 *   5. Back-fill mastery deltas and AI feedback into the history record
 *
 * The pipeline trigger is fire-and-forget from the HTTP request's perspective
 * (the student gets an immediate response). Pipeline results are written back
 * to the history record once they complete.
 */

'use strict';

const mongoose = require('mongoose');

const TestAttemptHistory = require('../models/testAttemptHistorySchema');
const TopicMastery       = require('../models/adaptiveLearning/topicMasterySchema');
const adaptivePipeline   = require('./adaptiveLearning/adaptivePipeline');
const studyPlanService   = require('./adaptiveLearning/studyPlanLLMService');
const AdaptiveStudyPlan  = require('../models/adaptiveLearning/adaptiveStudyPlanSchema');
const { logger }         = require('../utils/serverLogger');

// ── Grade computation ─────────────────────────────────────────────────────────
const GRADE_THRESHOLDS = [
    { min: 90, grade: 'A+' },
    { min: 80, grade: 'A'  },
    { min: 70, grade: 'B'  },
    { min: 60, grade: 'C'  },
    { min: 50, grade: 'D'  },
    { min: 0,  grade: 'F'  },
];

function computeGrade(percentage) {
    for (const { min, grade } of GRADE_THRESHOLDS) {
        if (percentage >= min) return grade;
    }
    return 'F';
}

// ── Dominant difficulty from question list ────────────────────────────────────
function dominantDifficulty(questions) {
    const counts = { easy: 0, medium: 0, hard: 0, challenge: 0 };
    for (const q of questions) counts[q.difficulty || 'medium'] = (counts[q.difficulty || 'medium'] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    // If all counts are equal across 3+ levels, call it mixed
    const vals = Object.values(counts).filter(v => v > 0);
    const allSame = vals.every(v => v === vals[0]);
    if (allSame && vals.length > 1) return 'mixed';
    return top ? top[0] : 'mixed';
}

// ── Build topic performance breakdown ─────────────────────────────────────────
function buildTopicPerformance(questions, responses, masteryBeforeMap) {
    const byTopic = {};

    for (let i = 0; i < questions.length; i++) {
        const q   = questions[i];
        const r   = responses[i] || {};
        const topic = q.topic || 'General';

        if (!byTopic[topic]) {
            byTopic[topic] = {
                topic,
                totalQuestions: 0, correctAnswers: 0, wrongAnswers: 0,
                skipped: 0, marksObtained: 0, maxMarks: 0,
                totalResponseMs: 0, answeredCount: 0,
            };
        }

        const tp = byTopic[topic];
        tp.totalQuestions++;
        tp.maxMarks += q.marks || 1;

        const isSkipped = r.studentAnswer === null || r.studentAnswer === undefined || r.studentAnswer === '';
        if (isSkipped) {
            tp.skipped++;
        } else {
            tp.answeredCount++;
            tp.totalResponseMs += r.responseTimeMs || 0;

            const isCorrect = Number(r.studentAnswer) === Number(q.correctAnswer);
            if (isCorrect) {
                tp.correctAnswers++;
                tp.marksObtained += q.marks || 1;
            } else {
                tp.wrongAnswers++;
            }
        }
    }

    return Object.values(byTopic).map(tp => ({
        topic:           tp.topic,
        totalQuestions:  tp.totalQuestions,
        correctAnswers:  tp.correctAnswers,
        wrongAnswers:    tp.wrongAnswers,
        skipped:         tp.skipped,
        marksObtained:   tp.marksObtained,
        maxMarks:        tp.maxMarks,
        accuracy:        tp.answeredCount > 0 ? parseFloat((tp.correctAnswers / tp.answeredCount).toFixed(4)) : 0,
        avgResponseMs:   tp.answeredCount > 0 ? Math.round(tp.totalResponseMs / tp.answeredCount) : 0,
        masteryBefore:   masteryBeforeMap[tp.topic] ?? null,
        masteryAfter:    null,   // filled by pipeline callback
        masteryDelta:    null,
    }));
}

// ── Build question responses ───────────────────────────────────────────────────
function buildQuestionResponses(questions, submissions) {
    return questions.map((q, idx) => {
        const sub     = submissions[idx] || {};
        const isSkipped = sub.studentAnswer === null || sub.studentAnswer === undefined || sub.studentAnswer === '';
        const isCorrect = !isSkipped && Number(sub.studentAnswer) === Number(q.correctAnswer);
        const marksObtained = isCorrect ? (q.marks || 1) : 0;

        return {
            questionIndex:    idx,
            questionText:     q.questionText || '',
            questionType:     q.questionType  || 'mcq',
            topic:            q.topic         || 'General',
            difficulty:       q.difficulty    || 'medium',
            studentAnswer:    isSkipped ? null : sub.studentAnswer,
            correctAnswer:    q.correctAnswer,
            isCorrect,
            isSkipped,
            marksObtained,
            maxMarks:         q.marks || 1,
            responseTimeMs:   Number(sub.responseTimeMs) || 0,
            numberOfAttempts: Number(sub.attemptCount)   || 1,
            confidence:       sub.confidence != null ? Math.min(5, Math.max(1, Number(sub.confidence))) : null,
        };
    });
}

// ── Compute improvement score vs last same-test attempt ───────────────────────
async function computeImprovementScore(studentId, testId, currentPercentage) {
    const prev = await TestAttemptHistory.findOne(
        { studentId, testId },
        { percentage: 1 },
    ).sort({ submittedAt: -1 }).lean();

    if (!prev) return null;
    return parseFloat((currentPercentage - prev.percentage).toFixed(2));
}

// ── Main: create history record ───────────────────────────────────────────────
/**
 * Create an immutable TestAttemptHistory record.
 *
 * @param {Object} params
 *   @param {Object}  params.test           — full test doc (populated)
 *   @param {Object}  params.student        — student doc (lean)
 *   @param {Object}  params.savedAttempt   — TestAttempt doc just saved
 *   @param {Array}   params.submissions    — per-question student responses
 *   @param {string}  [params.teacherName]  — snapshot from populated teacher
 *   @param {string}  [params.subjectName]  — snapshot from populated subject
 *   @param {string}  [params.className]    — snapshot from populated class
 *
 * @returns {Object} savedHistoryRecord
 */
async function createAttemptHistory(params) {
    const { test, student, savedAttempt, submissions, teacherName = '', subjectName = '', className = '' } = params;

    const studentId = String(student._id);
    const testId    = String(test._id);
    const questions = test.questions || [];

    // ── Snapshot mastery BEFORE this attempt runs ─────────────────────────
    const existingMastery = await TopicMastery.find({ studentId }).lean();
    const masteryBeforeMap = {};
    for (const m of existingMastery) masteryBeforeMap[m.topic] = m.masteryScore;

    // ── Build question responses ──────────────────────────────────────────
    const questionResponses = buildQuestionResponses(questions, submissions);

    // ── Aggregate metrics ─────────────────────────────────────────────────
    const totalQuestions     = questions.length;
    const skippedQuestions   = questionResponses.filter(r => r.isSkipped).length;
    const attemptedQuestions = totalQuestions - skippedQuestions;
    const correctAnswers     = questionResponses.filter(r => r.isCorrect).length;
    const wrongAnswers        = attemptedQuestions - correctAnswers;
    const finalScore         = savedAttempt.score ?? 0;
    const maxScore           = savedAttempt.totalMarks ?? questions.reduce((s, q) => s + (q.marks || 1), 0);
    const percentage         = maxScore > 0 ? parseFloat(((finalScore / maxScore) * 100).toFixed(2)) : 0;
    const grade              = computeGrade(percentage);

    // Response time / confidence
    const answeredResponses = questionResponses.filter(r => !r.isSkipped);
    const avgResponseTimeMs  = answeredResponses.length > 0
        ? Math.round(answeredResponses.reduce((s, r) => s + r.responseTimeMs, 0) / answeredResponses.length)
        : 0;
    const confidenceVals     = answeredResponses.filter(r => r.confidence !== null).map(r => r.confidence);
    const avgConfidence      = confidenceVals.length > 0
        ? parseFloat((confidenceVals.reduce((a, b) => a + b, 0) / confidenceVals.length).toFixed(2))
        : null;

    // Time taken
    const startedAt   = savedAttempt.startedAt   ? new Date(savedAttempt.startedAt)   : null;
    const submittedAt = savedAttempt.submittedAt  ? new Date(savedAttempt.submittedAt) : new Date();
    const timeTakenSeconds = startedAt
        ? Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)
        : 0;

    // Improvement
    const improvementScore = await computeImprovementScore(studentId, testId, percentage);

    // Topic breakdown
    const topicPerformance = buildTopicPerformance(questions, submissions, masteryBeforeMap);

    // ── Create the immutable record ───────────────────────────────────────
    const historyRecord = await TestAttemptHistory.create({
        studentId,
        testId,
        attemptId:   savedAttempt._id,
        subjectId:   test.subject,
        classId:     test.classId,
        teacherId:   test.createdBy,
        schoolId:    test.school,

        testTitle:   test.title   || '',
        subjectName,
        teacherName,
        className,

        startedAt,
        submittedAt,
        timeTakenSeconds,

        totalQuestions,
        attemptedQuestions,
        correctAnswers,
        wrongAnswers,
        skippedQuestions,
        finalScore,
        maxScore,
        percentage,
        grade,
        difficultyLevel: dominantDifficulty(questions),
        submissionType:  savedAttempt.submissionType || 'manual',
        status:          'completed',

        accuracyRate:      attemptedQuestions > 0 ? parseFloat((correctAnswers / attemptedQuestions).toFixed(4)) : 0,
        completionRate:    totalQuestions > 0 ? parseFloat((attemptedQuestions / totalQuestions).toFixed(4)) : 0,
        avgResponseTimeMs,
        avgConfidence,
        improvementScore,

        topicPerformance,
        questionResponses,
    });

    logger.info('TestAttemptHistoryService: history record created', {
        historyId: historyRecord._id,
        studentId,
        testId,
        percentage,
        grade,
    });

    return historyRecord;
}

// ── Back-fill mastery deltas after pipeline completes ─────────────────────────
/**
 * Called by the adaptive pipeline to update mastery-after values in the history record.
 *
 * @param {string} historyId        — TestAttemptHistory._id
 * @param {Object} masteryUpdates   — { [topic]: TopicMastery doc }
 * @param {Object} pipelineResult   — AdaptivePipeline result
 */
async function backfillMasteryDeltas(historyId, masteryUpdates, pipelineResult) {
    if (!historyId || !masteryUpdates) return;

    try {
        const history = await TestAttemptHistory.findById(historyId);
        if (!history) return;

        // Update topic performance with after-mastery values
        for (const tp of history.topicPerformance) {
            const updated = masteryUpdates[tp.topic];
            if (updated) {
                tp.masteryAfter  = updated.masteryScore;
                tp.masteryDelta  = tp.masteryBefore != null
                    ? parseFloat((updated.masteryScore - tp.masteryBefore).toFixed(4))
                    : null;
            }
        }

        // Overall mastery
        const profile = pipelineResult?.profile;
        if (profile) {
            history.overallMasteryAfter  = profile.scores?.overallMastery ?? null;
            history.learningVelocity     = profile.scores?.learningPace ?? null;
            history.profileVersion       = profile.version ?? null;
        }

        // Link to adaptive detail doc
        if (pipelineResult?.attemptDetail?._id) {
            history.adaptiveDetailId = pipelineResult.attemptDetail._id;
        }

        history.markModified('topicPerformance');
        await history.save();

        logger.info('TestAttemptHistoryService: mastery deltas back-filled', { historyId });
    } catch (err) {
        logger.error('TestAttemptHistoryService: backfill failed', { error: err.message, historyId });
    }
}

// ── AI feedback generation ────────────────────────────────────────────────────
/**
 * Generate and persist AI feedback for a history record.
 * Uses Groq directly (not via adaptive pipeline).
 *
 * @param {string} historyId
 * @param {Object} profile  — StudentLearningProfile
 */
async function generateAndSaveAIFeedback(historyId, profile) {
    try {
        const history = await TestAttemptHistory.findById(historyId).lean();
        if (!history || !profile) return;

        const { groq, GROQ_MODELS } = require('../config/groq');

        const weakTopics  = history.topicPerformance.filter(t => t.accuracy < 0.5).map(t => t.topic);
        const strongTopics = history.topicPerformance.filter(t => t.accuracy >= 0.75).map(t => t.topic);

        const systemPrompt = `You are an educational feedback assistant. Generate concise, encouraging, actionable feedback.
Respond ONLY with valid JSON: { "summary": string, "strengths": [string], "weaknesses": [string], "recommendations": [string] }`;

        const userPrompt = `Student test result:
Score: ${history.finalScore}/${history.maxScore} (${history.percentage}%) — Grade ${history.grade}
Correct: ${history.correctAnswers}, Wrong: ${history.wrongAnswers}, Skipped: ${history.skippedQuestions}
Improvement from last attempt: ${history.improvementScore !== null ? history.improvementScore + '%' : 'First attempt'}
Strong topics: ${strongTopics.join(', ') || 'none'}
Weak topics: ${weakTopics.join(', ') || 'none'}
Overall mastery before: ${(history.overallMasteryBefore * 100 || 0).toFixed(1)}%
Overall mastery after: ${(history.overallMasteryAfter * 100 || 0).toFixed(1)}%

Generate brief feedback (2-sentence summary, 2-3 strengths, 2-3 weaknesses, 3 specific recommendations).`;

        const response = await groq.chat.completions.create({
            model:       GROQ_MODELS.FAST,
            messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            temperature: 0.4,
            max_tokens:  512,
        });

        const raw   = response.choices?.[0]?.message?.content || '';
        const clean = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();
        const parsed = JSON.parse(clean);

        await TestAttemptHistory.findByIdAndUpdate(historyId, {
            $set: {
                'aiFeedback.summary':         parsed.summary         || '',
                'aiFeedback.strengths':        parsed.strengths        || [],
                'aiFeedback.weaknesses':       parsed.weaknesses       || [],
                'aiFeedback.recommendations':  parsed.recommendations  || [],
                'aiFeedback.generatedAt':      new Date(),
            },
        });

        logger.info('TestAttemptHistoryService: AI feedback saved', { historyId });
    } catch (err) {
        logger.warn('TestAttemptHistoryService: AI feedback failed (non-fatal)', { error: err.message, historyId });
    }
}

// ── Full pipeline trigger (async, fire-and-forget) ────────────────────────────
/**
 * Run the adaptive pipeline and back-fill results into the history record.
 * Errors are swallowed — the student already has their score.
 *
 * @param {Object} params
 *   @param {Object} historyRecord  — just-saved TestAttemptHistory doc
 *   @param {Object} test           — full test doc
 *   @param {Array}  submissions    — per-question responses
 *   @param {string} attemptId      — TestAttempt._id
 */
async function triggerAdaptivePipeline({ historyRecord, test, submissions, attemptId }) {
    try {
        const studentId = String(historyRecord.studentId);
        const testId    = String(historyRecord.testId);

        const enrichedQuestions = (test.questions || []).map(q => ({
            questionText:  q.questionText,
            questionType:  q.questionType  || 'mcq',
            topic:         q.topic         || 'General',
            difficulty:    q.difficulty    || 'medium',
            marks:         q.marks         || 1,
            correctAnswer: q.correctAnswer,
        }));

        const result = await adaptivePipeline.runPipeline({
            studentId,
            testId,
            attemptId:      String(attemptId),
            subjectId:      test.subject ? String(test.subject) : undefined,
            schoolId:       test.school  ? String(test.school)  : undefined,
            questions:      enrichedQuestions,
            submissions,
            totalDurationMs: (historyRecord.timeTakenSeconds || 0) * 1000,
        });

        // Back-fill mastery into history
        await backfillMasteryDeltas(historyRecord._id, result.masteryUpdates || {}, result);

        // Generate AI feedback using updated profile
        if (result.profile) {
            await generateAndSaveAIFeedback(historyRecord._id, result.profile);
        }

        // Optional: auto-generate study plan if profile readiness is high enough
        if (result.profile?.scores?.readinessScore >= 0.4) {
            const { getStudentAnalytics } = require('./adaptiveLearning/adaptivePipeline');
            const analytics = await getStudentAnalytics(studentId);

            const context = studyPlanService.buildAnalyticsContext({
                profile:             analytics.profile || result.profile,
                masteryRecords:      analytics.masteryRecords  || [],
                trendRecords:        analytics.trendRecords    || [],
                diffRecs:            analytics.latestDiffRecs  || [],
                studyHoursPerWeek:   10,
                learningObjectives:  [],
            });

            // Only auto-generate if there's no active plan in last 24 hours
            const recentPlan = await AdaptiveStudyPlan.findOne({
                studentId,
                isActive: true,
                generatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            });

            if (!recentPlan && context.weakTopics.length > 0) {
                const { plan, promptUsed, rawLLMResponse, llmMeta } =
                    await studyPlanService.generateStudyPlan(context);

                await AdaptiveStudyPlan.updateMany({ studentId, isActive: true }, { $set: { isActive: false } });
                await AdaptiveStudyPlan.create({
                    studentId,
                    subjectId:   test.subject,
                    schoolId:    test.school,
                    analyticsSnapshot: {
                        overallMastery:     context.overallMastery,
                        readinessScore:     context.readinessScore,
                        consistencyScore:   context.consistencyScore,
                        learningPace:       studyPlanService.paceLabelFromScore(context.learningPaceScore),
                        weakTopics:         context.weakTopics,
                        strongTopics:       context.strongTopics,
                        difficultyRecommendations: context.difficultyRecommendations,
                        upcomingExams:      [],
                        availableStudyHoursPerWeek: 10,
                        learningObjectives: [],
                    },
                    promptUsed,
                    plan,
                    llmMeta,
                    rawLLMResponse,
                    generatedAt: new Date(),
                    isActive:    true,
                });

                logger.info('TestAttemptHistoryService: auto study plan generated', { studentId });
            }
        }

        // ── Staff Report Generation & Notification Delivery ───────────────────
        if (test.createdBy) {
            try {
                const staffReportService = require('./adaptiveLearning/staffReportingService');
                const { getStudentAnalytics } = require('./adaptiveLearning/adaptivePipeline');
                const analytics = await getStudentAnalytics(studentId);

                const report = await staffReportService.generateStaffReport({
                    studentId,
                    staffId: String(test.createdBy),
                    assessmentId: testId,
                    assessmentTitle: test.title || 'Assessment',
                    assessmentDate: historyRecord.submittedAt,
                    subjectId: test.subject,
                    schoolId: test.school,
                    attemptDetailId: result.attemptDetail?._id,
                    assessmentMetrics: result.attemptDetail?.metrics || {
                        scorePercentage: historyRecord.percentage,
                        totalCorrect: historyRecord.correctAnswers,
                        totalQuestions: historyRecord.totalQuestions,
                        completionRate: historyRecord.completionRate,
                    },
                    profile: analytics.profile || result.profile,
                    masteryRecords: analytics.masteryRecords || [],
                    trendRecords: analytics.trendRecords || [],
                    diffRecs: analytics.latestDiffRecs || [],
                });

                // Create in-app notification for the teacher
                const { createNotifications } = require('../controllers/notification-controller');
                await createNotifications(
                    [test.createdBy],
                    `New performance report generated for student ${historyRecord.studentName || student.name} on assessment "${test.title}"`,
                    'report', // using new 'report' type
                    { reportId: report._id }
                );
                logger.info('TestAttemptHistoryService: Staff report and notification created', { studentId, staffId: test.createdBy });
            } catch (reportErr) {
                logger.error('TestAttemptHistoryService: Staff report generation failed', { error: reportErr.message });
            }
        }

    } catch (err) {
        logger.error('TestAttemptHistoryService: pipeline trigger failed', {
            error: err.message,
            historyId: historyRecord._id,
        });
    }
}

// ── Rank computation (run after all attempts are in) ─────────────────────────
/**
 * Compute and persist ranks for all students who attempted a test.
 * Call this after a teacher "publishes" results.
 *
 * @param {string} testId
 */
async function computeAndSaveRanks(testId) {
    const attempts = await TestAttemptHistory.find({ testId })
        .sort({ percentage: -1, timeTakenSeconds: 1 })  // ties: lower time wins
        .select('_id percentage')
        .lean();

    const total = attempts.length;
    const ops   = attempts.map((a, idx) => ({
        updateOne: {
            filter: { _id: a._id },
            update: { $set: { rank: idx + 1, totalRanked: total } },
        },
    }));

    if (ops.length > 0) {
        await TestAttemptHistory.bulkWrite(ops);
    }

    logger.info('TestAttemptHistoryService: ranks computed', { testId, total });
}

module.exports = {
    createAttemptHistory,
    triggerAdaptivePipeline,
    backfillMasteryDeltas,
    generateAndSaveAIFeedback,
    computeAndSaveRanks,
    computeGrade,
    buildTopicPerformance,
    buildQuestionResponses,
};
