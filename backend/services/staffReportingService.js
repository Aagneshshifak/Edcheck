/**
 * Staff Reporting Service
 *
 * Generates and persists structured post-assessment reports for teachers/staff.
 * Each report answers: "What does the teacher need to know about this student?"
 *
 * Flow:
 *   1. Receive assessment/pipeline information
 *   2. Build deterministic analytics (postAssessmentAnalyticsEngine)
 *   3. Create report doc with generationStatus = PROCESSING
 *   4. Build LLM analytics payload (no raw answers)
 *   5. Call existing groqService
 *   6. Validate AI response (jsonValidator)
 *   7. Save AI output to report
 *   8. Set generationStatus = COMPLETED (or COMPLETED_WITHOUT_AI on failure)
 *   9. Record timing
 *
 * RBAC: Access control is enforced at the controller/route level, not here.
 * LLM CONTRACT: LLM must NEVER see raw student answers or modify deterministic values.
 */

'use strict';

const { groqService, GROQ_MODELS } = require('./groqService');
const { STAFF_REPORT_SYSTEM_PROMPT, buildStaffReportPrompt } = require('../utils/aiPromptTemplates');
const { validateLLMOutput } = require('../utils/jsonValidator');
const StaffStudentReport = require('../models/staffStudentReportSchema');
const { runPostAssessmentAnalytics } = require('./adaptiveLearning/postAssessmentAnalyticsEngine');
const { logger } = require('../utils/serverLogger');

// ── Build DSKP context for LLM prompt ────────────────────────────────────────
function buildDSKPContext({ profile, masteryRecords, trendRecords, diffRecs }) {
    const trendByTopic = {};
    for (const t of (trendRecords || [])) trendByTopic[t.topic] = t;

    const diffByTopic = {};
    for (const d of (diffRecs || [])) diffByTopic[d.topic] = d;

    const weakTopics = (masteryRecords || [])
        .filter(m => m.masteryScore < 0.60 ||
            ['declining', 'forgetting', 'volatile'].includes(trendByTopic[m.topic]?.trendType))
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 10)
        .map(m => ({
            domain: m.domain, chapter: m.chapter, subtopic: m.subtopic, topic: m.topic,
            masteryScore: m.masteryScore,
            trendType: trendByTopic[m.topic]?.trendType || 'insufficient_data',
        }));

    const strongTopics = (masteryRecords || [])
        .filter(m => m.masteryScore >= 0.65)
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 5)
        .map(m => ({ domain: m.domain, chapter: m.chapter, subtopic: m.subtopic, topic: m.topic, masteryScore: m.masteryScore }));

    const alerts = (profile?.alerts || [])
        .filter(a => !a.isResolved)
        .map(a => ({ alertType: a.alertType, topic: a.topic }));

    return {
        overallMastery:    profile?.scores?.overallMastery    || 0,
        readinessScore:    profile?.scores?.readinessScore    || 0,
        consistencyScore:  profile?.scores?.consistencyScore  || 0,
        confidenceScore:   profile?.scores?.confidenceScore   || 0.5,
        retentionEstimate: profile?.scores?.retentionEstimate || 0,
        engagementScore:   profile?.scores?.engagementScore   || 0,
        learningPace:      profile?.scores?.learningPace >= 0.66 ? 'fast'
                         : profile?.scores?.learningPace >= 0.33 ? 'medium' : 'slow',
        totalQuizAttempts: profile?.totalQuizAttempts || 0,
        totalTopicsSeen:   profile?.totalTopicsSeen   || 0,
        weakTopics,
        strongTopics,
        alerts,
        difficultyRecommendations: Object.entries(diffByTopic).map(([topic, d]) => ({
            topic,
            difficulty: d.recommendedDifficulty,
        })),
    };
}

/**
 * Generate a full staff report for a student's assessment.
 *
 * @param {Object} params
 *   studentId, staffId, assessmentId, assessmentTitle, assessmentDate,
 *   subjectId, schoolId, classId, attemptDetailId,
 *   assessmentMetrics, profile, masteryRecords, trendRecords, diffRecs,
 *   questionDetails (from QuizAttemptDetail.questionDetails),
 *   masteryUpdates  (stage 2 output { [topic]: TopicMastery doc }),
 *   trendUpdates    (stage 3 output { [topic]: LearningTrend doc }),
 *   difficultyRecs  (stage 4 output { [topic]: DifficultyRec doc }),
 */
async function generateStaffReport({
    studentId,
    staffId,
    assessmentId,
    assessmentTitle,
    assessmentDate,
    subjectId,
    schoolId,
    classId,
    attemptDetailId,
    assessmentMetrics,
    profile,
    masteryRecords,
    trendRecords,
    diffRecs,
    // New: granular inputs
    questionDetails,
    masteryUpdates,
    trendUpdates,
    difficultyRecs,
}) {
    const generationStartedAt = new Date();
    logger.info('REPORT_GENERATION_STARTED', { studentId, assessmentId });

    // ── 1. Build deterministic DSKP context ───────────────────────────────
    const dskp = buildDSKPContext({ profile, masteryRecords, trendRecords, diffRecs });

    // ── 2. Run granular post-assessment analytics (pure deterministic) ────
    let granularAnalytics = null;
    try {
        granularAnalytics = runPostAssessmentAnalytics({
            questionDetails:  questionDetails || [],
            masteryUpdates:   masteryUpdates  || {},
            trendUpdates:     trendUpdates    || {},
            difficultyRecs:   difficultyRecs  || {},
            profile,
            assessmentMetrics,
            dskp,
        });
        logger.info('REPORT_ANALYTICS_COMPLETED', { studentId, assessmentId,
            weakAreas: granularAnalytics.weakAreas.length });
    } catch (analyticsErr) {
        logger.error('StaffReportingService: analytics engine failed (non-fatal)', {
            studentId, assessmentId, error: analyticsErr.message,
        });
        granularAnalytics = null;
    }

    // ── 3. Build legacy analytics snapshot ────────────────────────────────
    const analyticsSnapshot = {
        scorePercentage:   assessmentMetrics?.scorePercentage || 0,
        totalCorrect:      assessmentMetrics?.totalCorrect    || 0,
        totalQuestions:    assessmentMetrics?.totalQuestions  || 0,
        completionRate:    assessmentMetrics?.completionRate  || 0,
        overallMastery:    dskp.overallMastery,
        readinessScore:    dskp.readinessScore,
        consistencyScore:  dskp.consistencyScore,
        confidenceScore:   dskp.confidenceScore,
        retentionEstimate: dskp.retentionEstimate,
        learningPace:      dskp.learningPace,
        topicBreakdown:    assessmentMetrics?.topicBreakdown || {},
        difficultyBreakdown: assessmentMetrics?.difficultyBreakdown || {},
        weakTopics:        dskp.weakTopics,
        strongTopics:      dskp.strongTopics,
        alerts:            dskp.alerts,
    };

    // ── 4. Create report doc with PROCESSING status BEFORE LLM call ──────
    let report;
    try {
        const reportData = {
            studentId, staffId, assessmentId, attemptDetailId,
            subjectId, schoolId, classId,
            assessmentTitle, assessmentDate,
            analyticsSnapshot,
            generationStatus:   'PROCESSING',
            generationStartedAt,
            generatedAt:        new Date(),
            reportVersion:      1,
        };

        // Embed deterministic analytics immediately
        if (granularAnalytics) {
            reportData.overallPerformance     = granularAnalytics.overallPerformance;
            reportData.subjectAnalysis        = granularAnalytics.subjectAnalysis;
            reportData.chapterAnalysis        = granularAnalytics.chapterAnalysis;
            reportData.subtopicAnalysis       = granularAnalytics.subtopicAnalysis;
            reportData.conceptAnalysis        = granularAnalytics.conceptAnalysis;
            reportData.weakAreas              = granularAnalytics.weakAreas;
            reportData.strongAreas            = granularAnalytics.strongAreas;
            reportData.trendAnalysis          = granularAnalytics.trendAnalysis;
            reportData.retentionRisks         = granularAnalytics.retentionRisks;
            reportData.confidenceMismatch     = granularAnalytics.confidenceMismatch;
            reportData.difficultyAnalysis     = granularAnalytics.difficultyAnalysis;
            reportData.recommendedInterventions = granularAnalytics.recommendedInterventions;
        }

        report = await StaffStudentReport.create(reportData);
        logger.info('StaffReportingService: report doc created (PROCESSING)', {
            reportId: report._id, studentId, assessmentId,
        });
    } catch (createErr) {
        logger.error('StaffReportingService: failed to create report doc', {
            studentId, assessmentId, error: createErr.message,
        });
        // Cannot continue without a report doc
        throw createErr;
    }

    // ── 5. Build LLM prompt (enriched with granular analytics, no raw answers) ──
    const llmAssessmentMetrics = {
        ...assessmentMetrics,
        // Add granular weak areas to give LLM richer context
        criticalWeakAreas: (granularAnalytics?.weakAreas || [])
            .filter(wa => wa.severity === 'CRITICAL')
            .slice(0, 5)
            .map(wa => ({
                chapter: wa.chapter, subtopic: wa.subtopic, concept: wa.concept,
                mastery: wa.mastery, accuracy: wa.accuracy, trend: wa.trend,
                priorityScore: wa.priorityScore,
            })),
        confidenceMismatches: (granularAnalytics?.confidenceMismatch || []).slice(0, 3),
        retentionRisks:       (granularAnalytics?.retentionRisks || []).slice(0, 3),
        difficultyBreakdown:  granularAnalytics?.difficultyAnalysis?.reduce((acc, d) => {
            acc[d.level] = { correct: d.correctCount, total: d.questionCount, accuracy: d.accuracy };
            return acc;
        }, {}) || assessmentMetrics?.difficultyBreakdown || {},
    };

    const userPrompt = buildStaffReportPrompt({
        dskp,
        assessmentMetrics: llmAssessmentMetrics,
        assessmentTitle,
        assessmentDate: assessmentDate ? new Date(assessmentDate).toISOString() : 'N/A',
    });

    // ── 6. Call LLM ───────────────────────────────────────────────────────
    let aiAnalysis = {};
    let llmMeta    = { provider: 'groq', model: GROQ_MODELS.ANALYSIS };
    let aiSucceeded = false;

    logger.info('REPORT_AI_STARTED', { reportId: report._id, studentId });

    try {
        const llmStart = Date.now();
        const result = await groqService.call({
            userId:       staffId || 'system',
            userRole:     'system',
            endpointName: 'staff-student-report',
            model:        GROQ_MODELS.ANALYSIS,
            systemPrompt: STAFF_REPORT_SYSTEM_PROMPT,
            userPrompt,
            parseResponse: (content) => {
                const validated = validateLLMOutput(content, 'staff_report');
                if (validated.success || validated.data) {
                    return validated.data;
                }
                throw new Error(`Staff report validation failed: ${validated.errors.join(', ')}`);
            },
        });
        aiAnalysis  = result.data;
        llmMeta.latencyMs = Date.now() - llmStart;
        aiSucceeded = true;
        logger.info('REPORT_AI_COMPLETED', { reportId: report._id, studentId });
    } catch (llmErr) {
        logger.error('REPORT_AI_FAILED', {
            reportId: report._id, studentId, assessmentId, error: llmErr.message,
        });
        aiAnalysis = {
            summary: 'AI analysis temporarily unavailable. Please refer to the deterministic analytics below.',
            criticalWeakAreas: [],
            confidenceInsights: [],
            retentionRisks: [],
            teacherRecommendations: [],
            _generation_error: llmErr.message,
        };
        llmMeta.error = llmErr.message;
    }

    // ── 7. Update report with AI output + final status ────────────────────
    const generationCompletedAt = new Date();
    const generationDurationMs  = generationCompletedAt.getTime() - generationStartedAt.getTime();

    const finalStatus = aiSucceeded ? 'COMPLETED' : 'COMPLETED_WITHOUT_AI';

    try {
        await StaffStudentReport.findByIdAndUpdate(report._id, {
            $set: {
                aiAnalysis,
                llmMeta,
                generationStatus:    finalStatus,
                generationCompletedAt,
                generationDurationMs,
                status:              'generated',
            },
        });
    } catch (updateErr) {
        logger.error('StaffReportingService: failed to update report with AI output', {
            reportId: report._id, error: updateErr.message,
        });
    }

    logger.info('REPORT_GENERATION_COMPLETED', {
        reportId: report._id, studentId, assessmentId,
        generationStatus: finalStatus, generationDurationMs,
    });

    // Return fresh doc
    return StaffStudentReport.findById(report._id).lean();
}

// ── Query helpers ─────────────────────────────────────────────────────────────

async function getStudentReports(staffId, studentId, { limit = 20, subjectId } = {}) {
    const filter = { studentId, staffId };
    if (subjectId) filter.subjectId = subjectId;
    return StaffStudentReport.find(filter).sort({ generatedAt: -1 }).limit(limit).lean();
}

async function getLatestReport(staffId, studentId) {
    return StaffStudentReport.findOne({ studentId, staffId }).sort({ generatedAt: -1 }).lean();
}

async function getAssessmentReports(assessmentId, staffId) {
    return StaffStudentReport.find({ assessmentId, staffId }).sort({ generatedAt: -1 }).lean();
}

/**
 * Get weak areas summary for a student (from latest reports, ordered by priority).
 */
async function getWeakAreasSummary(staffId, studentId) {
    const reports = await StaffStudentReport.find({ staffId, studentId, generationStatus: { $in: ['COMPLETED', 'COMPLETED_WITHOUT_AI'] } })
        .sort({ generatedAt: -1 }).limit(5).lean();

    if (!reports.length) return [];

    // Merge weak areas from last 5 reports, deduplicate by topicKey, keep highest priority
    const byTopic = {};
    for (const r of reports) {
        for (const wa of (r.weakAreas || [])) {
            const key = wa.topicKey;
            if (!byTopic[key] || wa.priorityScore > byTopic[key].priorityScore) {
                byTopic[key] = { ...wa, reportId: r._id, assessmentDate: r.assessmentDate };
            }
        }
    }

    return Object.values(byTopic).sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get class analytics — aggregated across all students in a class.
 */
async function getClassAnalytics(staffId, classId) {
    const reports = await StaffStudentReport.find({
        staffId,
        classId,
        generationStatus: { $in: ['COMPLETED', 'COMPLETED_WITHOUT_AI'] },
    }).sort({ generatedAt: -1 }).lean();

    // Group by studentId, keep latest report per student
    const latestByStudent = {};
    for (const r of reports) {
        const sid = String(r.studentId);
        if (!latestByStudent[sid]) latestByStudent[sid] = r;
    }

    const studentReports = Object.values(latestByStudent);
    if (!studentReports.length) return null;

    // Aggregate weak concepts across students
    const conceptFrequency = {};
    for (const r of studentReports) {
        for (const wa of (r.weakAreas || [])) {
            const key = wa.subtopic || wa.chapter || wa.topicKey;
            if (!conceptFrequency[key]) {
                conceptFrequency[key] = {
                    concept: key, chapter: wa.chapter, domain: wa.domain,
                    count: 0, totalMastery: 0,
                };
            }
            conceptFrequency[key].count++;
            conceptFrequency[key].totalMastery += wa.mastery || 0;
        }
    }

    const weakestConcepts = Object.values(conceptFrequency)
        .map(c => ({ ...c, avgMastery: parseFloat((c.totalMastery / c.count).toFixed(4)) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    const masteryVals = studentReports.map(r => r.overallPerformance?.mastery || r.analyticsSnapshot?.overallMastery || 0);
    const scoreVals   = studentReports.map(r => r.overallPerformance?.score   || r.analyticsSnapshot?.scorePercentage   || 0);

    const avg = arr => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4)) : 0;

    const criticalStudentCount = studentReports.filter(r =>
        (r.weakAreas || []).some(wa => wa.severity === 'CRITICAL')).length;

    return {
        classId,
        studentCount:        studentReports.length,
        avgMastery:          avg(masteryVals),
        avgScore:            avg(scoreVals),
        criticalStudentCount,
        weakestConcepts,
        reportedAt:          new Date(),
    };
}

module.exports = {
    generateStaffReport,
    getStudentReports,
    getLatestReport,
    getAssessmentReports,
    getWeakAreasSummary,
    getClassAnalytics,
    buildDSKPContext,
};
