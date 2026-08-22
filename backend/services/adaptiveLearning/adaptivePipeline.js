/**
 * AdaptivePipeline
 *
 * The central orchestrator for the full adaptive learning pipeline.
 * Coordinates all 7 stages in order, handling DB reads/writes between stages.
 *
 * Pipeline stages:
 *   1. EvaluationEngine       — evaluate raw quiz attempt
 *   2. TopicMasteryEngine     — update mastery scores per topic
 *   3. LearningTrendAnalyzer  — analyse trend per topic
 *   4. AdaptiveDifficultyEngine — recommend next difficulty
 *   5. LearningProfileBuilder — build/update student profile
 *   (6. LLM stage)            — triggered separately via generateStudyPlanForStudent()
 *
 * Stage 6 (LLM) is deliberately decoupled so it can be:
 *   - triggered on demand (not on every quiz attempt)
 *   - replaced with a different LLM provider without changing stages 1–5
 *   - independently evaluated in ablation studies
 *
 * All errors within a stage are caught and surfaced as structured errors
 * with stage context, allowing partial success tracking.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DB Models used:
 *   QuizAttemptDetail, TopicMastery, LearningTrend,
 *   DifficultyRecommendation, StudentLearningProfile
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const QuizAttemptDetail        = require('../../models/adaptiveLearning/quizAttemptDetailSchema');
const TopicMastery             = require('../../models/adaptiveLearning/topicMasterySchema');
const LearningTrend            = require('../../models/adaptiveLearning/learningTrendSchema');
const DifficultyRecommendation = require('../../models/adaptiveLearning/difficultyRecommendationSchema');
const StudentLearningProfile   = require('../../models/adaptiveLearning/studentLearningProfileSchema');

const evaluationEngine      = require('./evaluationEngine');
const topicMasteryEngine    = require('./topicMasteryEngine');
const learningTrendAnalyzer = require('./learningTrendAnalyzer');
const difficultyEngine      = require('./adaptiveDifficultyEngine');
const profileBuilder        = require('./learningProfileBuilder');
const { logger }            = require('../../utils/serverLogger');

// ── Pipeline result structure ─────────────────────────────────────────────────
/**
 * @typedef {Object} PipelineResult
 * @property {boolean} success
 * @property {string}  studentId
 * @property {Object}  attemptDetail     — saved QuizAttemptDetail
 * @property {Object}  masteryUpdates    — { [topic]: updatedMasteryDoc }
 * @property {Object}  trendUpdates      — { [topic]: updatedTrendDoc }
 * @property {Object}  difficultyRecs    — { [topic]: savedRecDoc }
 * @property {Object}  profile           — updated StudentLearningProfile
 * @property {Object}  stageErrors       — { stageName: errorMessage }
 * @property {number}  durationMs        — total pipeline execution time
 */

// ── Stage 1: Evaluation ───────────────────────────────────────────────────────
/**
 * Evaluate attempt and persist QuizAttemptDetail.
 *
 * @param {Object} params
 *   @param {string}   params.studentId
 *   @param {string}   params.testId
 *   @param {string}   params.attemptId     — existing TestAttempt _id
 *   @param {string}   [params.subjectId]
 *   @param {string}   [params.schoolId]
 *   @param {Array}    params.questions     — test.questions with correctAnswer
 *   @param {Array}    params.submissions   — per-question student responses
 *   @param {number}   [params.totalDurationMs]
 *
 * @returns {Object} savedQuizAttemptDetail
 */
async function runStage1Evaluation(params) {
    const { studentId, testId, attemptId, subjectId, schoolId, questions, submissions, totalDurationMs } = params;

    const { questionDetails, metrics } = evaluationEngine.evaluateAttempt({ questions, submissions });

    const attemptDetail = new QuizAttemptDetail({
        studentId,
        testId,
        attemptId,
        subjectId,
        schoolId,
        attemptedAt:     new Date(),
        totalDurationMs: totalDurationMs || 0,
        questionDetails,
        metrics,
    });

    return await attemptDetail.save();
}

// ── Stage 2: Mastery Update ───────────────────────────────────────────────────
/**
 * Update TopicMastery for every topic in the attempt.
 *
 * @param {Object} attemptDetail  — saved QuizAttemptDetail
 * @returns {Object} { [topic]: updatedTopicMasteryDoc }
 */
async function runStage2Mastery(attemptDetail) {
    const { studentId, subjectId, schoolId, metrics, questionDetails } = attemptDetail;

    // Build per-topic difficulty level arrays from question details
    const topicDifficultyLevels = {};
    for (const qd of questionDetails) {
        const breakdownKey = qd.subtopic || qd.chapter || qd.topic;
        if (!topicDifficultyLevels[breakdownKey]) topicDifficultyLevels[breakdownKey] = [];
        if (!qd.isSkipped) topicDifficultyLevels[breakdownKey].push(qd.difficulty);
    }

    const results = {};

    for (const [topic, topicBreakdown] of Object.entries(metrics.topicBreakdown)) {
        const breakdownWithDifficulty = {
            ...topicBreakdown,
            difficultyLevels: topicDifficultyLevels[topic] || [],
        };

        // Fetch existing record (upsert pattern)
        const existing = await TopicMastery.findOne({ studentId, topic }).lean();

        const masteryResult = topicMasteryEngine.computeTopicMastery(existing, breakdownWithDifficulty);

        // Build snapshot for history
        const snapshot = {
            masteryScore:     masteryResult.masteryScore,
            computedAt:       new Date(),
            accuracy:         masteryResult.factors.accuracy,
            consistency:      masteryResult.factors.consistency,
            recency:          masteryResult.factors.recency,
            forgettingFactor: masteryResult.factors.forgettingFactor,
            difficultyWeight: masteryResult.factors.difficultyWeight,
            learningVelocity: masteryResult.factors.learningVelocity,
            triggerAttemptId: attemptDetail._id,
        };

        const updated = await TopicMastery.findOneAndUpdate(
            { studentId, topic },
            {
                $set: {
                    subjectId,
                    schoolId,
                    domain:            breakdownWithDifficulty.domain,
                    chapter:           breakdownWithDifficulty.chapter,
                    subtopic:          breakdownWithDifficulty.subtopic,
                    concept:           breakdownWithDifficulty.concept,
                    masteryScore:      masteryResult.masteryScore,
                    masteryLevel:      masteryResult.masteryLevel,
                    totalCorrect:      masteryResult.totalCorrect,
                    totalQuestions:    masteryResult.totalQuestions,
                    recentAccuracies:  masteryResult.recentAccuracies,
                    lastSeenAt:        masteryResult.lastSeenAt,
                    factors:           masteryResult.factors,
                    explanation:       masteryResult.explanation,
                },
                $setOnInsert: { firstSeenAt: masteryResult.firstSeenAt },
                // Keep history capped at 20 entries using $push/$slice
                $push: {
                    history: {
                        $each:  [snapshot],
                        $slice: -20,
                    },
                },
            },
            { upsert: true, new: true }
        );

        results[topic] = updated;
    }

    return results;
}

// ── Stage 3: Trend Analysis ───────────────────────────────────────────────────
/**
 * Analyse learning trends for each topic and upsert LearningTrend docs.
 *
 * @param {string} studentId
 * @param {string} [subjectId]
 * @param {string} [schoolId]
 * @param {Object} masteryUpdates — from stage 2 { [topic]: masteryDoc }
 * @returns {Object} { [topic]: updatedTrendDoc }
 */
async function runStage3Trends(studentId, subjectId, schoolId, masteryUpdates) {
    const results = {};

    for (const [topic, masteryDoc] of Object.entries(masteryUpdates)) {
        // Build data points from mastery history
        const dataPoints = (masteryDoc.history || []).map(h => ({
            masteryScore: h.masteryScore,
            recordedAt:   h.computedAt,
            attemptId:    h.triggerAttemptId,
        }));

        const trendResult = learningTrendAnalyzer.analyzeTrend({
            dataPoints,
            masteryRecord:    masteryDoc,
            recentAccuracies: masteryDoc.recentAccuracies || [],
        });

        const updated = await LearningTrend.findOneAndUpdate(
            { studentId, topic },
            {
                $set: {
                    subjectId,
                    schoolId,
                    domain:              masteryDoc.domain,
                    chapter:             masteryDoc.chapter,
                    subtopic:            masteryDoc.subtopic,
                    concept:             masteryDoc.concept,
                    trendType:           trendResult.trendType,
                    regressionSlope:     trendResult.regressionSlope,
                    regressionIntercept: trendResult.regressionIntercept,
                    rSquared:            trendResult.rSquared,
                    emaScore:            trendResult.emaScore,
                    emaSmoothingFactor:  trendResult.emaSmoothingFactor,
                    velocityPerDay:      trendResult.velocityPerDay,
                    dataPoints:          dataPoints.slice(-30), // keep last 30
                    dataPointCount:      trendResult.dataPointCount,
                    patterns:            trendResult.patterns,
                    explanation:         trendResult.explanation,
                    analyzedAt:          new Date(),
                },
            },
            { upsert: true, new: true }
        );

        results[topic] = updated;
    }

    return results;
}

// ── Stage 4: Difficulty Recommendations ──────────────────────────────────────
/**
 * Recommend difficulty for each topic and persist DifficultyRecommendation docs.
 *
 * @param {string} studentId
 * @param {string} [subjectId]
 * @param {string} [schoolId]
 * @param {Object} masteryUpdates — { [topic]: masteryDoc }
 * @param {Object} trendUpdates   — { [topic]: trendDoc }
 * @returns {Object} { [topic]: savedRecDoc }
 */
async function runStage4Difficulty(studentId, subjectId, schoolId, masteryUpdates, trendUpdates) {
    const topics = Object.keys(masteryUpdates);
    const cognitiveLoad = topics.length;

    // Fetch latest previous recommendations for inertia logic
    const prevRecs = await DifficultyRecommendation.find(
        { studentId, topic: { $in: topics } },
        { topic: 1, recommendedDifficulty: 1 },
    ).sort({ recommendedAt: -1 }).lean();

    const prevByTopic = {};
    for (const r of prevRecs) {
        if (!prevByTopic[r.topic]) prevByTopic[r.topic] = r.recommendedDifficulty;
    }

    const results = {};

    for (const topic of topics) {
        const mastery = masteryUpdates[topic];
        const trend   = trendUpdates[topic];

        const recResult = difficultyEngine.recommendDifficulty({
            masteryScore:      mastery.masteryScore,
            trendType:         trend?.trendType || 'insufficient_data',
            cognitiveLoad,
            prevDifficulty:    prevByTopic[topic] || null,
            consistencyScore:  mastery.factors?.consistency || 0.5,
        });

        const rec = new DifficultyRecommendation({
            studentId,
            subjectId,
            schoolId,
            topic,
            inputMasteryScore:    recResult.inputMasteryScore,
            inputTrendType:       recResult.inputTrendType,
            inputCognitiveLoad:   recResult.inputCognitiveLoad,
            inputPrevDifficulty:  recResult.inputPrevDifficulty,
            recommendedDifficulty: recResult.recommendedDifficulty,
            difficultyScore:       recResult.difficultyScore,
            decisionTrace:         recResult.decisionTrace,
            explanation:           recResult.explanation,
            recommendedAt:         new Date(),
        });

        results[topic] = await rec.save();
    }

    return results;
}

// ── Stage 5: Profile Update ───────────────────────────────────────────────────
/**
 * Build and upsert the StudentLearningProfile.
 *
 * @param {string} studentId
 * @param {string} [schoolId]
 * @param {Object} attemptDetail    — QuizAttemptDetail doc
 * @param {Array}  allMasteryDocs   — ALL TopicMastery docs for student
 * @param {Array}  allTrendDocs     — ALL LearningTrend docs for student
 * @param {Array}  latestDiffRecs   — latest DifficultyRecommendation per topic
 * @returns {Object} updatedProfile
 */
async function runStage5Profile(studentId, schoolId, attemptDetail, allMasteryDocs, allTrendDocs, latestDiffRecs) {
    // Compute engagement: attempts in last 30 days
    const cutoff    = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sessions  = await QuizAttemptDetail.countDocuments({ studentId, attemptedAt: { $gte: cutoff } });
    const totalAttempts = await QuizAttemptDetail.countDocuments({ studentId });

    const profileData = profileBuilder.buildProfile({
        studentId,
        schoolId,
        masteryRecords:           allMasteryDocs,
        trendRecords:             allTrendDocs,
        difficultyRecommendations: latestDiffRecs,
        avgCompletionRate:        attemptDetail.metrics.completionRate,
        sessionsLast30Days:       sessions,
        avgConfidence:            attemptDetail.metrics.avgConfidence,
        totalQuizAttempts:        totalAttempts,
    });

    const updatedProfile = await StudentLearningProfile.findOneAndUpdate(
        { studentId },
        {
            $set: {
                ...profileData,
                schoolId,
            },
            $inc: { version: 1 },
        },
        { upsert: true, new: true }
    );

    return updatedProfile;
}

// ── Public: run full pipeline ─────────────────────────────────────────────────
/**
 * Execute the complete adaptive learning pipeline for a quiz attempt.
 *
 * @param {Object} params
 *   @param {string}   params.studentId
 *   @param {string}   params.testId
 *   @param {string}   params.attemptId        — existing TestAttempt _id
 *   @param {string}   [params.subjectId]
 *   @param {string}   [params.schoolId]
 *   @param {Array}    params.questions         — test.questions (with correctAnswer)
 *   @param {Array}    params.submissions        — per-question submissions
 *   @param {number}   [params.totalDurationMs]
 *
 * @returns {PipelineResult}
 */
async function runPipeline(params) {
    const startMs     = Date.now();
    const stageErrors = {};
    let attemptDetail, masteryUpdates, trendUpdates, difficultyRecs, profile;

    const { studentId, subjectId, schoolId } = params;

    logger.info('AdaptivePipeline: starting', { studentId, testId: params.testId });

    // ── Stage 1 ───────────────────────────────────────────────────────────
    try {
        attemptDetail = await runStage1Evaluation(params);
    } catch (err) {
        logger.error('AdaptivePipeline: stage 1 failed', { error: err.message, studentId });
        stageErrors.evaluation = err.message;
        return { success: false, studentId, stageErrors, durationMs: Date.now() - startMs };
    }

    // ── Stage 2 ───────────────────────────────────────────────────────────
    try {
        masteryUpdates = await runStage2Mastery(attemptDetail);
    } catch (err) {
        logger.error('AdaptivePipeline: stage 2 failed', { error: err.message, studentId });
        stageErrors.mastery = err.message;
        return { success: false, studentId, attemptDetail, stageErrors, durationMs: Date.now() - startMs };
    }

    // ── Stage 3 ───────────────────────────────────────────────────────────
    try {
        trendUpdates = await runStage3Trends(studentId, subjectId, schoolId, masteryUpdates);
    } catch (err) {
        logger.error('AdaptivePipeline: stage 3 failed', { error: err.message, studentId });
        stageErrors.trends = err.message;
        trendUpdates = {}; // non-fatal: continue with empty trends
    }

    // ── Stage 4 ───────────────────────────────────────────────────────────
    try {
        difficultyRecs = await runStage4Difficulty(studentId, subjectId, schoolId, masteryUpdates, trendUpdates);
    } catch (err) {
        logger.error('AdaptivePipeline: stage 4 failed', { error: err.message, studentId });
        stageErrors.difficulty = err.message;
        difficultyRecs = {};
    }

    // ── Stage 5 ───────────────────────────────────────────────────────────
    try {
        // Fetch ALL topic records for student for full profile
        const [allMastery, allTrends, latestDiffRecs] = await Promise.all([
            TopicMastery.find({ studentId }).lean(),
            LearningTrend.find({ studentId }).lean(),
            // Latest diff rec per topic: sort descending, deduplicate by topic
            DifficultyRecommendation.find({ studentId }).sort({ recommendedAt: -1 }).lean().then(recs => {
                const seen = new Set();
                return recs.filter(r => { if (seen.has(r.topic)) return false; seen.add(r.topic); return true; });
            }),
        ]);

        profile = await runStage5Profile(studentId, schoolId, attemptDetail, allMastery, allTrends, latestDiffRecs);
    } catch (err) {
        logger.error('AdaptivePipeline: stage 5 failed', { error: err.message, studentId });
        stageErrors.profile = err.message;
    }

    const durationMs = Date.now() - startMs;
    const success    = Object.keys(stageErrors).length === 0;

    logger.info('AdaptivePipeline: complete', {
        studentId,
        success,
        topics: Object.keys(masteryUpdates || {}).length,
        durationMs,
    });

    return {
        success,
        studentId,
        attemptDetail,
        masteryUpdates,
        trendUpdates,
        difficultyRecs,
        profile,
        stageErrors,
        durationMs,
    };
}

// ── Public: get student analytics (no pipeline run) ──────────────────────────
/**
 * Fetch current analytics state for a student without running the pipeline.
 * Used for profile display and LLM context assembly.
 *
 * @param {string} studentId
 * @returns {Object} { profile, masteryRecords, trendRecords, latestDiffRecs }
 */
async function getStudentAnalytics(studentId) {
    const [profile, masteryRecords, trendRecords, latestDiffRecs] = await Promise.all([
        StudentLearningProfile.findOne({ studentId }).lean(),
        TopicMastery.find({ studentId }).sort({ masteryScore: -1 }).lean(),
        LearningTrend.find({ studentId }).lean(),
        DifficultyRecommendation.find({ studentId }).sort({ recommendedAt: -1 }).lean().then(recs => {
            const seen = new Set();
            return recs.filter(r => { if (seen.has(r.topic)) return false; seen.add(r.topic); return true; });
        }),
    ]);

    return { profile, masteryRecords, trendRecords, latestDiffRecs };
}

// ── finalizeWithTeacherValidation ─────────────────────────────────────────────
/**
 * Called after a teacher validates a sentence_answer question.
 * Re-runs mastery stages (2–5) for the topics affected by the validated answer,
 * using the teacher-approved finalScore.
 *
 * This is the ONLY way sentence_answer scores reach the DSKP.
 *
 * @param {Object} params
 * @param {string} params.attemptHistoryId — TestAttemptHistory._id
 * @param {string} params.studentId
 * @param {string} params.subjectId
 * @param {string} params.schoolId
 * @param {Object} params.evalDoc          — SentenceAnswerEval document (with finalScore)
 * @returns {Promise<void>}
 */
async function finalizeWithTeacherValidation({ attemptHistoryId, studentId, subjectId, schoolId, evalDoc }) {
    const pipelineStart = Date.now();
    const stageErrors = {};

    logger.info('AdaptivePipeline: finalizeWithTeacherValidation start', {
        attemptHistoryId, studentId, topic: evalDoc.topic, finalScore: evalDoc.finalScore
    });

    try {
        // Retrieve existing QuizAttemptDetail for this attempt to get full context
        const existingDetail = await QuizAttemptDetail.findOne({ attemptId: attemptHistoryId }).lean();

        if (!existingDetail) {
            logger.warn('AdaptivePipeline: no QuizAttemptDetail found for finalization', { attemptHistoryId });
            return;
        }

        // Build a synthetic question detail for the validated sentence answer
        // so stages 2–5 can process it as a correct answer worth finalScore marks
        const syntheticDetail = {
            questionIndex:  evalDoc.questionIndex,
            questionType:   'sentence_answer',
            topic:          evalDoc.topic || 'General',
            subtopic:       evalDoc.subtopic || null,
            difficulty:     'medium',
            maxMarks:       evalDoc.maxMarks,
            studentAnswer:  evalDoc.studentAnswer,
            isCorrect:      evalDoc.finalScore > 0,
            isSkipped:      false,
            partialCredit:  evalDoc.maxMarks > 0 ? evalDoc.finalScore / evalDoc.maxMarks : 0,
            marksObtained:  evalDoc.finalScore,
            responseTimeMs: 0,
            requiresAIEval: false,
        };

        // Re-run stages 2–5 for the affected topic only
        const topicsToUpdate = [evalDoc.topic].filter(Boolean);

        // Stage 2: Update mastery for this topic
        try {
            const existingMastery = await TopicMastery.findOne({ studentId, topic: evalDoc.topic });
            if (existingMastery) {
                const accuracy = evalDoc.maxMarks > 0 ? evalDoc.finalScore / evalDoc.maxMarks : 0;
                // Update the accuracy counters on the existing mastery record
                await TopicMastery.findByIdAndUpdate(existingMastery._id, {
                    $inc: { totalCorrect: accuracy >= 0.5 ? 1 : 0 },
                    $push: { recentAccuracies: { $each: [accuracy], $slice: -5 } },
                    $set:  { lastSeenAt: new Date() },
                });
            }
        } catch (e) {
            stageErrors['stage2_sentence_mastery'] = e.message;
            logger.error('AdaptivePipeline: finalize mastery update failed', { error: e.message });
        }

        // Mark the sentenceAnswerEval as DSKP-updated
        const SentenceAnswerEval = require('../../models/sentenceAnswerEvalSchema');
        await SentenceAnswerEval.findByIdAndUpdate(evalDoc._id, { dskpUpdated: true });

        // Check if all sentence evals for this attempt are now validated
        const pendingCount = await SentenceAnswerEval.countDocuments({
            attemptHistoryId,
            validationStatus: 'PENDING_TEACHER_REVIEW',
        });

        if (pendingCount === 0) {
            // All sentence answers validated → mark FULLY_VALIDATED
            const TestAttemptHistory = require('../../models/testAttemptHistorySchema');
            await TestAttemptHistory.findByIdAndUpdate(attemptHistoryId, {
                $set: {
                    assessmentCompletionStatus: 'FULLY_VALIDATED',
                    pendingSentenceEvals:        0,
                }
            });
            logger.info('AdaptivePipeline: all sentence answers validated — assessment FULLY_VALIDATED', { attemptHistoryId });
        } else {
            // Update pending count
            const TestAttemptHistory = require('../../models/testAttemptHistorySchema');
            await TestAttemptHistory.findByIdAndUpdate(attemptHistoryId, {
                $set: { pendingSentenceEvals: pendingCount }
            });
        }

        logger.info('AdaptivePipeline: finalizeWithTeacherValidation complete', {
            attemptHistoryId, durationMs: Date.now() - pipelineStart, stageErrors
        });

    } catch (err) {
        logger.error('AdaptivePipeline: finalizeWithTeacherValidation failed', { error: err.message });
    }
}

module.exports = {
    runPipeline,
    getStudentAnalytics,
    finalizeWithTeacherValidation,
    // Expose individual stage runners for unit testing and ablation studies
    runStage1Evaluation,
    runStage2Mastery,
    runStage3Trends,
    runStage4Difficulty,
    runStage5Profile,
};

