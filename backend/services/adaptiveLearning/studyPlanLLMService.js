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
 *
 * OUTPUT from LLM (expected JSON structure):
 *   {
 *     "summary": string,
 *     "totalWeeks": number,
 *     "estimatedHours": number,
 *     "topicPriority": [{ topic, priority, reason, studyStrategy, estimatedHours }],
 *     "dailySchedule": [{ day, duration, topics, activities, goal }],
 *     "revisionOrder": [string],
 *     "practiceRecommendations": [string],
 *     "motivationTips": [string],
 *     "completionTimeline": string
 *   }
 *
 * Prompt is built deterministically from structured data.
 * Raw answer strings are NEVER included in the prompt.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { groq, GROQ_MODELS } = require('../../config/groq');
const { logger }            = require('../../utils/serverLogger');

// ── Constants ─────────────────────────────────────────────────────────────────
const STUDY_PLAN_MODEL  = GROQ_MODELS.BALANCED;
const MAX_RETRY         = 2;
const PARSE_TIMEOUT_MS  = 30000;

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
    const systemPrompt = `You are an expert adaptive learning coach specializing in personalized education.
Your task: generate a JSON study plan from structured learning analytics.

CRITICAL RULES:
1. Respond ONLY with valid JSON — no markdown, no explanation, no trailing text.
2. Prioritize weak topics with declining or forgetting trends.
3. Recommended difficulty per topic MUST be respected in suggested activities.
4. The schedule must fit within the student's available study hours per week.
5. Include specific, actionable practice recommendations.
6. Motivation tips must be concise (1 sentence each).

RESPONSE FORMAT (exact JSON schema):
{
  "summary": "2-3 sentence personalized overview",
  "totalWeeks": <integer>,
  "estimatedHours": <number>,
  "topicPriority": [
    { "topic": "...", "priority": "critical|high|medium|low", "reason": "...", "studyStrategy": "...", "estimatedHours": <number> }
  ],
  "dailySchedule": [
    { "day": "Day 1", "duration": <minutes>, "topics": ["..."], "activities": ["..."], "goal": "..." }
  ],
  "revisionOrder": ["topic1", "topic2", "..."],
  "practiceRecommendations": ["...", "..."],
  "motivationTips": ["...", "..."],
  "completionTimeline": "..."
}`;

    // ── Build human-readable analytics section ────────────────────────────
    const weakTopicsText = ctx.weakTopics.length > 0
        ? ctx.weakTopics.map(t =>
            `  - ${t.topic}: mastery=${(t.masteryScore * 100).toFixed(1)}%, trend=${t.trendType}, reason="${t.reason}"`
        ).join('\n')
        : '  - None identified';

    const strongTopicsText = ctx.strongTopics.length > 0
        ? ctx.strongTopics.map(t =>
            `  - ${t.topic}: mastery=${(t.masteryScore * 100).toFixed(1)}%`
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

    const userPrompt = `Generate a personalized study plan for a student with the following learning analytics:

STUDENT PROFILE
  Overall Mastery: ${(ctx.overallMastery * 100).toFixed(1)}%
  Readiness Score: ${(ctx.readinessScore * 100).toFixed(1)}%
  Consistency Score: ${(ctx.consistencyScore * 100).toFixed(1)}%
  Learning Pace: ${ctx.learningPace}
  Retention Estimate: ${(ctx.retentionEstimate * 100).toFixed(1)}%
  Available Study Time: ${ctx.availableStudyHoursPerWeek} hours/week
  Upcoming Exams: ${examText}

WEAK TOPICS (prioritize these):
${weakTopicsText}

STRONG TOPICS (can reduce time here):
${strongTopicsText}

RECOMMENDED DIFFICULTY PER TOPIC:
${difficultyText}

LEARNING OBJECTIVES:
${objectivesText}

Generate a complete study plan following the JSON schema exactly.`;

    return { systemPrompt, userPrompt };
}

// ── Response parser ───────────────────────────────────────────────────────────
/**
 * Parse and validate the LLM JSON response.
 * Returns the parsed plan or throws on invalid format.
 *
 * @param {string} content — raw LLM output
 * @returns {Object} validated plan
 */
function parseStudyPlanResponse(content) {
    // Strip markdown code fences if present
    const clean = content
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```\s*$/im, '')
        .trim();

    const parsed = JSON.parse(clean);

    // Minimal schema validation
    const required = ['summary', 'totalWeeks', 'topicPriority', 'revisionOrder'];
    for (const field of required) {
        if (!(field in parsed)) {
            throw new Error(`Study plan missing required field: ${field}`);
        }
    }

    // Ensure arrays exist (LLM sometimes omits empty arrays)
    parsed.dailySchedule            = parsed.dailySchedule            || [];
    parsed.practiceRecommendations  = parsed.practiceRecommendations  || [];
    parsed.motivationTips           = parsed.motivationTips           || [];
    parsed.completionTimeline       = parsed.completionTimeline       || 'Not specified';
    parsed.estimatedHours           = parsed.estimatedHours           || 0;

    return parsed;
}

// ── Main: generate study plan ─────────────────────────────────────────────────
/**
 * Call the LLM to generate a personalized study plan.
 *
 * @param {Object} analyticsContext
 *   @param {number}   analyticsContext.overallMastery
 *   @param {number}   analyticsContext.readinessScore
 *   @param {number}   analyticsContext.consistencyScore
 *   @param {number}   analyticsContext.retentionEstimate
 *   @param {number}   analyticsContext.learningPaceScore   — [0,1]
 *   @param {Array}    analyticsContext.weakTopics
 *   @param {Array}    analyticsContext.strongTopics
 *   @param {Array}    analyticsContext.difficultyRecommendations
 *   @param {Array}    analyticsContext.upcomingExams
 *   @param {number}   analyticsContext.availableStudyHoursPerWeek
 *   @param {Array}    analyticsContext.learningObjectives
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
                max_tokens:  2048,
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
            });

            return { plan, promptUsed, rawLLMResponse: rawResponse, llmMeta };

        } catch (err) {
            lastError = err;
            if (err instanceof SyntaxError) {
                logger.warn(`StudyPlanLLMService: JSON parse failed (attempt ${attempt + 1})`, {
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
}) {
    const trendByTopic = {};
    for (const t of trendRecords) trendByTopic[t.topic] = t;

    const diffByTopic = {};
    for (const d of diffRecs) diffByTopic[d.topic] = d;

    // Weak topics: mastery < 0.60 or declining/forgetting trend
    const weakTopics = masteryRecords
        .filter(m =>
            m.masteryScore < 0.60 ||
            ['declining', 'forgetting', 'volatile'].includes(trendByTopic[m.topic]?.trendType)
        )
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .slice(0, 8)
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
        studentId:               String(profile.studentId),
        overallMastery:          profile.scores?.overallMastery    || 0,
        readinessScore:          profile.scores?.readinessScore    || 0,
        consistencyScore:        profile.scores?.consistencyScore  || 0,
        retentionEstimate:       profile.scores?.retentionEstimate || 0,
        learningPaceScore:       profile.scores?.learningPace      || 0,
        weakTopics,
        strongTopics,
        difficultyRecommendations,
        upcomingExams,
        availableStudyHoursPerWeek: studyHoursPerWeek,
        learningObjectives,
    };
}

module.exports = {
    generateStudyPlan,
    buildAnalyticsContext,
    buildStudyPlanPrompt,
    parseStudyPlanResponse,
    paceLabelFromScore,
};
