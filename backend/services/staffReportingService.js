/**
 * Staff Reporting Service
 *
 * Generates and persists structured post-assessment reports for teachers/staff.
 * Each report answers: "What does the teacher need to know about this student?"
 *
 * Architecture:
 *   1. Receives deterministic pipeline outputs (FACTS)
 *   2. Assembles DSKP context (no raw answers)
 *   3. Calls LLM for analysis and recommendations (AI)
 *   4. Validates LLM output via jsonValidator
 *   5. Persists report to MongoDB (staffStudentReport collection)
 *   6. Never overwrites previous reports (maintains history)
 *
 * RBAC: Access control is enforced at the controller/route level, not here.
 */

'use strict';

const { groqService, GROQ_MODELS } = require('./groqService');
const { STAFF_REPORT_SYSTEM_PROMPT, buildStaffReportPrompt } = require('../utils/aiPromptTemplates');
const { validateLLMOutput } = require('../utils/jsonValidator');
const StaffStudentReport = require('../models/staffStudentReportSchema');
const { logger } = require('../utils/serverLogger');

/**
 * Build the DSKP context for staff report generation.
 * Only aggregated metrics — no raw student answers.
 *
 * @param {Object} params
 * @param {Object} params.profile — StudentLearningProfile doc
 * @param {Array}  params.masteryRecords — TopicMastery docs
 * @param {Array}  params.trendRecords — LearningTrend docs
 * @param {Array}  params.diffRecs — DifficultyRecommendation docs
 * @returns {Object} dskp context
 */
function buildDSKPContext({ profile, masteryRecords, trendRecords, diffRecs }) {
    const trendByTopic = {};
    for (const t of trendRecords) trendByTopic[t.topic] = t;

    const diffByTopic = {};
    for (const d of diffRecs) diffByTopic[d.topic] = d;

    const weakTopics = masteryRecords
        .filter(m => m.masteryScore < 0.60 ||
            ['declining', 'forgetting', 'volatile'].includes(trendByTopic[m.topic]?.trendType))
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 10)
        .map(m => ({
            topic: m.topic,
            masteryScore: m.masteryScore,
            trendType: trendByTopic[m.topic]?.trendType || 'insufficient_data',
        }));

    const strongTopics = masteryRecords
        .filter(m => m.masteryScore >= 0.65)
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 5)
        .map(m => ({ topic: m.topic, masteryScore: m.masteryScore }));

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
        totalTopicsSeen:   profile?.totalTopicsSeen || 0,
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
 * Generate a staff report for a student's assessment.
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.staffId — the teacher/staff receiving the report
 * @param {string} params.assessmentId — test ID
 * @param {string} params.assessmentTitle
 * @param {Date}   params.assessmentDate
 * @param {string} params.subjectId
 * @param {string} params.schoolId
 * @param {string} params.attemptDetailId
 * @param {Object} params.assessmentMetrics — metrics from evaluation engine
 * @param {Object} params.profile — StudentLearningProfile doc
 * @param {Array}  params.masteryRecords
 * @param {Array}  params.trendRecords
 * @param {Array}  params.diffRecs
 * @returns {Object} saved StaffStudentReport doc
 */
async function generateStaffReport({
    studentId,
    staffId,
    assessmentId,
    assessmentTitle,
    assessmentDate,
    subjectId,
    schoolId,
    attemptDetailId,
    assessmentMetrics,
    profile,
    masteryRecords,
    trendRecords,
    diffRecs,
}) {
    const dskp = buildDSKPContext({ profile, masteryRecords, trendRecords, diffRecs });

    const userPrompt = buildStaffReportPrompt({
        dskp,
        assessmentMetrics,
        assessmentTitle,
        assessmentDate: assessmentDate ? new Date(assessmentDate).toISOString() : 'N/A',
    });

    let aiAnalysis = {};
    let llmMeta = {};

    try {
        const result = await groqService.call({
            userId: staffId || 'system',
            userRole: 'system',
            endpointName: 'staff-student-report',
            model: GROQ_MODELS.ANALYSIS,
            systemPrompt: STAFF_REPORT_SYSTEM_PROMPT,
            userPrompt,
            parseResponse: (content) => {
                const validated = validateLLMOutput(content, 'staff_report');
                if (validated.success || validated.data) {
                    return validated.data;
                }
                throw new Error(`Staff report validation failed: ${validated.errors.join(', ')}`);
            },
            // No caching for reports — they should always be fresh per assessment
        });

        aiAnalysis = result.data;
    } catch (err) {
        logger.error('StaffReportingService: LLM generation failed', {
            studentId, assessmentId, error: err.message,
        });
        // Store a fallback analysis indicating failure
        aiAnalysis = {
            report_type: 'post_assessment',
            overall_performance: {
                summary: 'AI analysis temporarily unavailable. Please refer to the analytics data below.',
            },
            immediate_intervention_required: false,
            recommended_teacher_actions: [],
            topic_analysis: {},
            _generation_error: err.message,
        };
    }

    // ── Build analytics snapshot (FACTS from pipeline) ────────────────────
    const analyticsSnapshot = {
        scorePercentage:   assessmentMetrics?.scorePercentage || 0,
        totalCorrect:      assessmentMetrics?.totalCorrect || 0,
        totalQuestions:    assessmentMetrics?.totalQuestions || 0,
        completionRate:    assessmentMetrics?.completionRate || 0,
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

    // ── Persist report (never overwrite — append) ─────────────────────────
    const report = await StaffStudentReport.create({
        studentId,
        staffId,
        assessmentId,
        attemptDetailId,
        subjectId,
        schoolId,
        assessmentTitle,
        assessmentDate,
        analyticsSnapshot,
        aiAnalysis,
        llmMeta: {
            provider: 'groq',
            model: GROQ_MODELS.ANALYSIS,
        },
        generatedAt: new Date(),
    });

    logger.info('StaffReportingService: report generated', {
        reportId: report._id,
        studentId,
        assessmentId,
    });

    return report;
}

/**
 * Get historical reports for a student, accessible by a specific staff member.
 *
 * @param {string} staffId
 * @param {string} studentId
 * @param {Object} options — { limit, subjectId }
 * @returns {Array} reports
 */
async function getStudentReports(staffId, studentId, { limit = 20, subjectId } = {}) {
    const filter = { studentId, staffId };
    if (subjectId) filter.subjectId = subjectId;

    return StaffStudentReport.find(filter)
        .sort({ generatedAt: -1 })
        .limit(limit)
        .lean();
}

/**
 * Get the latest report for a student from a specific staff member.
 *
 * @param {string} staffId
 * @param {string} studentId
 * @returns {Object|null} report
 */
async function getLatestReport(staffId, studentId) {
    return StaffStudentReport.findOne({ studentId, staffId })
        .sort({ generatedAt: -1 })
        .lean();
}

/**
 * Get all reports for a specific assessment.
 *
 * @param {string} assessmentId
 * @param {string} staffId — only return reports belonging to this staff
 * @returns {Array} reports
 */
async function getAssessmentReports(assessmentId, staffId) {
    return StaffStudentReport.find({ assessmentId, staffId })
        .sort({ generatedAt: -1 })
        .lean();
}

module.exports = {
    generateStaffReport,
    getStudentReports,
    getLatestReport,
    getAssessmentReports,
    buildDSKPContext,
};
