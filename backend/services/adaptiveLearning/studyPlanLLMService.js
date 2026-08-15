/**
 * StudyPlanLLMService
 *
 * Stage 7 of the adaptive learning pipeline.
 * Generates personalized study plans by sending structured analytics
 * (never raw quiz answers) to the LLM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LLM Interface Contract (research-grade transparency)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * INPUT to LLM (analyticsContext):
 *   - mastery scores per topic (aggregated, normalized)
 *   - learning trends per topic (classified)
 *   - weak concepts with explainability
 *   - recommended difficulty per topic
 *   - learning objectives
 *   - available study hours per week
 *   - upcoming exam names/dates
 *   - profile scores (readiness, consistency, engagement, pace label)
 *   - confidence analysis per topic
 *   - retention/forgetting indicators
 *   - previous study-plan feedback
 *
 * OUTPUT from LLM (expected JSON structure — see STUDY_PLAN_SYSTEM_PROMPT):
 *   Immediate priorities, short-term revision, practice activities,
 *   reinforcement activities, assessment preparation, daily schedule,
 *   revision order, prerequisite warnings, motivation tips.
 *
 * Prompt is built deterministically from structured data.
 * Raw answer strings are NEVER included in the prompt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { groq, GROQ_MODELS } = require('../../config/groq');
const { logger }             = require('../../utils/serverLogger');
const { STUDY_PLAN_SYSTEM_PROMPT } = require('../../utils/aiPromptTemplates');
const { validateLLMOutput }  = require('../../utils/jsonValidator');

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDY_PLAN_MODEL  = GROQ_MODELS.ANALYSIS;
const MAX_RETRY         = 2;

// ── Pace label ────────────────────────────────────────────────────────────────
function paceLabelFromScore(learningPaceScore) {
    if (learningPaceScore >= 0.66) return 'fast';
    if (learningPaceScore >= 0.33) return 'medium';
    return 'slow';
}

// ── Prompt builder ────────────────────────────────────────────────────────────
/**
 * Build a structured, deterministic prompt from analytics data.
 * The prompt contains only statistics and objectives — never raw answers.
 *
 * @param {Object} ctx  — analyticsContext
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildStudyPlanPrompt(ctx) {
    const systemPrompt = STUDY_PLAN_SYSTEM_PROMPT;

    // ── Build human-readable analytics section ────────────────────────────
    const pct = (v) => ((v || 0) * 100).toFixed(1) + '%';

    const weakTopicsText = ctx.weakTopics.length > 0
        ? ctx.weakTopics.map(t =>
            `  - ${t.topic}: mastery=${pct(t.masteryScore)}, trend=${t.trendType}, reason="${t.reason}"`
        ).join('\n')
        : '  - None identified';

    const strongTopicsText = ctx.strongTopics.length > 0
        ? ctx.strongTopics.map(t =>
            `  - ${t.topic}: mastery=${pct(t.masteryScore)}`
        ).join('\n')
        : '  - None identified';

    const difficultyText = ctx.difficultyRecommendations.length > 0
        ? ctx.difficultyRecommendations.map(d =>
            `  - ${d.topic}: ${d.difficulty} (${d.reason})`
        ).join('\n')
        : '  - Not enough data yet';

    const examText = ctx.upcomingExams.length > 0
        ? ctx.upcomingExams.join(', ')
        : 'None specified';

    const objectivesText = ctx.learningObjectives.length > 0
        ? ctx.learningObjectives.map(o => `  - ${o}`).join('\n')
        : '  - General improvement';

    // Topic-level detail for deeper reasoning
    const topicDetailText = (ctx.topicDetails || []).map(t =>
        `  - ${t.topic}: mastery=${pct(t.masteryScore)}, trend=${t.trendType}, ` +
        `consistency=${pct(t.consistency)}, forgetting=${pct(t.forgettingFactor)}, ` +
        `confidence=${pct(t.confidenceScore)}, difficulty_rec=${t.recommendedDifficulty || 'N/A'}`
    ).join('\n') || '  - No detailed topic data';

    // Feedback from previous study plans
    const feedbackText = (ctx.previousFeedback || []).map(f =>
        `  - ${f.topic}: ${f.status} — ${f.comment || 'no comment'}`
    ).join('\n') || '  - No previous feedback';

    const userPrompt = `Generate a personalized study plan for a student with the following learning analytics:

STUDENT PROFILE
  Overall Mastery: ${pct(ctx.overallMastery)}
  Readiness Score: ${pct(ctx.readinessScore)}
  Consistency Score: ${pct(ctx.consistencyScore)}
  Confidence Score: ${pct(ctx.confidenceScore)}
  Learning Pace: ${ctx.learningPace}
  Retention Estimate: ${pct(ctx.retentionEstimate)}
  Engagement Score: ${pct(ctx.engagementScore)}
  Available Study Time: ${ctx.availableStudyHoursPerWeek} hours/week
  Upcoming Exams: ${examText}

TOPIC-LEVEL DETAIL:
${topicDetailText}

WEAK TOPICS (prioritize these):
${weakTopicsText}

STRONG TOPICS (can reduce time here):
${strongTopicsText}

RECOMMENDED DIFFICULTY PER TOPIC:
${difficultyText}

LEARNING OBJECTIVES:
${objectivesText}

PREVIOUS STUDY PLAN FEEDBACK:
${feedbackText}

Generate a complete study plan following the JSON schema exactly. Each recommendation must have a specific reason tied to the analytics above.`;

    return { systemPrompt, userPrompt };
}

// ── Response parser ───────────────────────────────────────────────────────────
/**
 * Parse and validate the LLM JSON response using the centralized validator.
 *
 * @param {string} content — raw LLM output
 * @returns {Object} validated plan
 */
function parseStudyPlanResponse(content) {
    const result = validateLLMOutput(content, 'study_plan');

    if (result.success && result.data) {
        return result.data;
    }

    // If validation found repairable issues, use the repaired data
    if (result.data) {
        logger.warn('StudyPlanLLMService: response had validation issues (repaired)', {
            errors: result.errors,
        });
        return result.data;
    }

    // Complete failure
    throw new Error(`Study plan validation failed: ${result.errors.join(', ')}`);
}

// ── Main: generate study plan ─────────────────────────────────────────────────
/**
 * Call the LLM to generate a personalized study plan.
 *
 * @param {Object} analyticsContext
 *   @param {number}   analyticsContext.overallMastery
 *   @param {number}   analyticsContext.readinessScore
 *   @param {number}   analyticsContext.consistencyScore
 *   @param {number}   analyticsContext.confidenceScore
 *   @param {number}   analyticsContext.engagementScore
 *   @param {number}   analyticsContext.retentionEstimate
 *   @param {number}   analyticsContext.learningPaceScore   — [0,1]
 *   @param {Array}    analyticsContext.weakTopics
 *   @param {Array}    analyticsContext.strongTopics
 *   @param {Array}    analyticsContext.topicDetails
 *   @param {Array}    analyticsContext.difficultyRecommendations
 *   @param {Array}    analyticsContext.upcomingExams
 *   @param {number}   analyticsContext.availableStudyHoursPerWeek
 *   @param {Array}    analyticsContext.learningObjectives
 *   @param {Array}    analyticsContext.previousFeedback
 *   @param {string}   analyticsContext.studentId  — for logging
 *
 * @returns {Object} { plan, promptUsed, rawLLMResponse, llmMeta }
 */
async function generateStudyPlan(analyticsContext) {
    // Normalize pace label
    const ctx = {
        ...analyticsContext,
        learningPace: paceLabelFromScore(analyticsContext.learningPaceScore || 0),
    };

    const { systemPrompt, userPrompt } = buildStudyPlanPrompt(ctx);
    const promptUsed = `SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`;

    let lastError;
    let rawResponse = '';

    for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
        const startMs = Date.now();

        try {
            const response = await groq.chat.completions.create({
                model: STUDY_PLAN_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user',   content: userPrompt   },
                ],
                temperature: 0.3,    // low temperature for deterministic, structured output
                max_tokens:  4096,   // increased for richer plans
            });

            const latencyMs = Date.now() - startMs;
            rawResponse     = response.choices?.[0]?.message?.content || '';

            const plan = parseStudyPlanResponse(rawResponse);

            const llmMeta = {
                provider:         'groq',
                model:            STUDY_PLAN_MODEL,
                latencyMs,
                promptTokens:     response.usage?.prompt_tokens     || 0,
                completionTokens: response.usage?.completion_tokens || 0,
            };

            logger.info('StudyPlanLLMService: plan generated', {
                studentId: analyticsContext.studentId,
                latencyMs,
                weakTopicCount: ctx.weakTopics.length,
                model: STUDY_PLAN_MODEL,
            });

            return { plan, promptUsed, rawLLMResponse: rawResponse, llmMeta };

        } catch (err) {
            lastError = err;
            if (err instanceof SyntaxError || err.message?.includes('validation')) {
                logger.warn(`StudyPlanLLMService: parse/validation failed (attempt ${attempt + 1})`, {
                    error: err.message,
                    preview: rawResponse.slice(0, 200),
                });
            } else {
                logger.error('StudyPlanLLMService: LLM call failed', { error: err.message, attempt });
                // Don't retry non-parse errors (network/auth)
                break;
            }
        }
    }

    throw lastError || new Error('StudyPlanLLMService: failed after retries');
}

// ── Analytics context builder ─────────────────────────────────────────────────
/**
 * Assemble analyticsContext from profile + mastery + trend documents.
 * This is the ONLY place where profile data is transformed for the LLM.
 *
 * @param {Object} params
 *   @param {Object}  params.profile          — StudentLearningProfile doc
 *   @param {Array}   params.masteryRecords   — TopicMastery docs
 *   @param {Array}   params.trendRecords     — LearningTrend docs
 *   @param {Array}   params.diffRecs         — DifficultyRecommendation docs (latest per topic)
 *   @param {Array}   [params.upcomingExams]
 *   @param {number}  [params.studyHoursPerWeek]
 *   @param {Array}   [params.learningObjectives]
 *   @param {Array}   [params.previousFeedback] — feedback from prior study plans
 *
 * @returns {Object} analyticsContext ready for generateStudyPlan()
 */
function buildAnalyticsContext({
    profile,
    masteryRecords,
    trendRecords,
    diffRecs,
    upcomingExams        = [],
    studyHoursPerWeek    = 10,
    learningObjectives   = [],
    previousFeedback     = [],
}) {
    const trendByTopic = {};
    for (const t of trendRecords) trendByTopic[t.topic] = t;

    const diffByTopic = {};
    for (const d of diffRecs) diffByTopic[d.topic] = d;

    // Build detailed topic-level data for the LLM
    const topicDetails = masteryRecords.map(m => {
        const trend = trendByTopic[m.topic] || {};
        const diff = diffByTopic[m.topic] || {};
        return {
            topic:                m.topic,
            masteryScore:         m.masteryScore,
            trendType:            trend.trendType || 'insufficient_data',
            consistency:          m.factors?.consistency || 0,
            forgettingFactor:     m.factors?.forgettingFactor || 0,
            confidenceScore:      0, // will be available if confidence data exists
            recommendedDifficulty: diff.recommendedDifficulty || null,
            lastAccuracy:         m.recentAccuracies?.length > 0
                ? m.recentAccuracies[m.recentAccuracies.length - 1] : 0,
        };
    });

    // Weak topics: mastery < 0.60 or declining/forgetting trend
    const weakTopics = masteryRecords
        .filter(m =>
            m.masteryScore < 0.60 ||
            ['declining', 'forgetting', 'volatile'].includes(trendByTopic[m.topic]?.trendType)
        )
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 10)
        .map(m => {
            const trend = trendByTopic[m.topic] || {};
            return {
                topic:        m.topic,
                masteryScore: m.masteryScore,
                trendType:    trend.trendType || 'insufficient_data',
                reason:       trend.explanation?.slice(0, 100) || 'Below proficiency threshold',
            };
        });

    const strongTopics = masteryRecords
        .filter(m => m.masteryScore >= 0.65)
        .sort((a, b) => b.masteryScore - a.masteryScore)
        .slice(0, 5)
        .map(m => ({ topic: m.topic, masteryScore: m.masteryScore }));

    const difficultyRecommendations = Object.entries(diffByTopic).map(([topic, d]) => ({
        topic,
        difficulty: d.recommendedDifficulty,
        reason: (d.explanation || '').split('.')[0],  // first sentence only
    }));

    return {
        studentId:                 String(profile.studentId),
        overallMastery:            profile.scores?.overallMastery    || 0,
        readinessScore:            profile.scores?.readinessScore    || 0,
        consistencyScore:          profile.scores?.consistencyScore  || 0,
        confidenceScore:           profile.scores?.confidenceScore   || 0.5,
        engagementScore:           profile.scores?.engagementScore   || 0,
        retentionEstimate:         profile.scores?.retentionEstimate || 0,
        learningPaceScore:         profile.scores?.learningPace      || 0,
        topicDetails,
        weakTopics,
        strongTopics,
        difficultyRecommendations,
        upcomingExams,
        availableStudyHoursPerWeek: studyHoursPerWeek,
        learningObjectives,
        previousFeedback,
    };
}

module.exports = {
    generateStudyPlan,
    buildAnalyticsContext,
    buildStudyPlanPrompt,
    parseStudyPlanResponse,
    paceLabelFromScore,
};

