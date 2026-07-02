/**
 * LearningProfileBuilder
 *
 * Stage 5 of the adaptive learning pipeline.
 * Aggregates outputs from the Mastery Engine, Trend Analyzer, and
 * Difficulty Engine into a unified StudentLearningProfile document.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Profile Score Computations
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * overallMastery     = mean(masteryScore) across all topics
 *
 * learningPace       = clamp(median(velocityPerDay) / MAX_VELOCITY, 0, 1)
 *                      MAX_VELOCITY = 0.01 mastery-units/day
 *
 * retentionEstimate  = mean(1 − forgettingFactor) across topics
 *
 * consistencyScore   = mean(consistencyFactor) across topics
 *
 * engagementScore    = 0.6 · completionRate + 0.4 · sessionFrequencyScore
 *                      sessionFrequencyScore = min(sessionsLast30Days / 10, 1)
 *
 * confidenceScore    = avgConfidence / 5  (rescaled from [1,5] → [0,1])
 *                      null → 0.5 (neutral)
 *
 * readinessScore     = 0.4·overallMastery + 0.3·retentionEstimate + 0.3·consistencyScore
 *
 * Alert generation rules:
 *   at_risk          any topic declining AND mastery < 0.35
 *   plateau          any topic with plateau pattern AND mastery 0.40–0.60 for > 7 days
 *   rapid_decline    trendType = declining AND slope < −0.005
 *   ready_for_challenge overallMastery > 0.85 AND readinessScore > 0.80
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design note: stateless, accepts pre-computed engine outputs. DB writes in controller.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_VELOCITY            = 0.01;   // mastery-units/day → f_pace = 1.0
const STRONG_TOPIC_COUNT      = 5;
const WEAK_TOPIC_COUNT        = 5;
const SESSIONS_FOR_FULL_ENGAGEMENT = 10; // sessions in 30 days → engagementScore = 1

// Alert thresholds
const AT_RISK_MASTERY         = 0.35;
const PLATEAU_MIN             = 0.40;
const PLATEAU_MAX             = 0.60;
const RAPID_DECLINE_SLOPE     = -0.005;
const READY_MASTERY           = 0.85;
const READY_READINESS         = 0.80;

// ── Utility ───────────────────────────────────────────────────────────────────
function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
    if (!arr || arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

const clamp01 = (v) => Math.min(1, Math.max(0, isNaN(v) ? 0 : v));

// ── Score computers ───────────────────────────────────────────────────────────

function computeOverallMastery(masteryRecords) {
    const scores = masteryRecords.map(r => r.masteryScore || 0);
    return clamp01(parseFloat(mean(scores).toFixed(4)));
}

function computeLearningPace(trendRecords) {
    const velocities = trendRecords
        .map(r => r.velocityPerDay || 0)
        .filter(v => v > 0);  // only positive (improving) velocities
    if (velocities.length === 0) return 0;
    const med = median(velocities);
    return clamp01(parseFloat((med / MAX_VELOCITY).toFixed(4)));
}

function computeRetentionEstimate(masteryRecords) {
    const retentions = masteryRecords.map(r => 1 - (r.factors?.forgettingFactor || 0));
    return clamp01(parseFloat(mean(retentions).toFixed(4)));
}

function computeConsistencyScore(masteryRecords) {
    const consistencies = masteryRecords.map(r => r.factors?.consistency || 0);
    return clamp01(parseFloat(mean(consistencies).toFixed(4)));
}

/**
 * @param {number} avgCompletionRate — mean completionRate across attempts
 * @param {number} sessionsLast30Days — number of quiz sessions in last 30 days
 */
function computeEngagementScore(avgCompletionRate, sessionsLast30Days) {
    const completionPart = clamp01(avgCompletionRate);
    const frequencyPart  = clamp01(sessionsLast30Days / SESSIONS_FOR_FULL_ENGAGEMENT);
    return clamp01(parseFloat((0.6 * completionPart + 0.4 * frequencyPart).toFixed(4)));
}

/**
 * @param {number|null} avgConfidence — mean confidence across attempts (1–5 scale) or null
 */
function computeConfidenceScore(avgConfidence) {
    if (avgConfidence === null || avgConfidence === undefined) return 0.5;
    return clamp01(parseFloat((avgConfidence / 5).toFixed(4)));
}

function computeReadinessScore(overallMastery, retentionEstimate, consistencyScore) {
    return clamp01(parseFloat(
        (0.4 * overallMastery + 0.3 * retentionEstimate + 0.3 * consistencyScore).toFixed(4)
    ));
}

// ── Alert generator ───────────────────────────────────────────────────────────
/**
 * Generate alerts based on mastery and trend data.
 * Returns only NEW alerts (existing resolved/unresolved ones are managed by caller).
 *
 * @param {Array} masteryRecords  — TopicMastery docs
 * @param {Array} trendRecords    — LearningTrend docs
 * @param {Object} scores         — computed profile scores
 * @returns {Array<{ alertType, topic, triggeredAt }>}
 */
function generateAlerts(masteryRecords, trendRecords, scores) {
    const alerts = [];
    const now    = new Date();

    const trendByTopic = {};
    for (const t of trendRecords) {
        trendByTopic[t.topic] = t;
    }

    for (const m of masteryRecords) {
        const trend = trendByTopic[m.topic];

        // at_risk: declining topic with low mastery
        if (trend?.trendType === 'declining' && m.masteryScore < AT_RISK_MASTERY) {
            alerts.push({ alertType: 'at_risk', topic: m.topic, triggeredAt: now });
        }

        // plateau: stable mastery in the developing range
        if (
            trend?.patterns?.some(p => p.patternType === 'plateau') &&
            m.masteryScore >= PLATEAU_MIN &&
            m.masteryScore <= PLATEAU_MAX
        ) {
            alerts.push({ alertType: 'plateau', topic: m.topic, triggeredAt: now });
        }

        // rapid_decline: steep negative slope
        if (trend?.regressionSlope < RAPID_DECLINE_SLOPE) {
            alerts.push({ alertType: 'rapid_decline', topic: m.topic, triggeredAt: now });
        }
    }

    // ready_for_challenge: overall strong performance
    if (scores.overallMastery > READY_MASTERY && scores.readinessScore > READY_READINESS) {
        alerts.push({ alertType: 'ready_for_challenge', topic: null, triggeredAt: now });
    }

    return alerts;
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Build a StudentLearningProfile from pipeline stage outputs.
 *
 * @param {Object} params
 *   @param {string}  params.studentId
 *   @param {string}  [params.schoolId]
 *   @param {Array}   params.masteryRecords        — TopicMastery docs
 *   @param {Array}   params.trendRecords          — LearningTrend docs
 *   @param {Array}   params.difficultyRecommendations  — DifficultyRecommendation docs
 *   @param {number}  params.avgCompletionRate     — mean completionRate across recent attempts
 *   @param {number}  params.sessionsLast30Days    — quiz sessions count
 *   @param {number|null} params.avgConfidence     — mean confidence (1–5) or null
 *   @param {number}  params.totalQuizAttempts
 *
 * @returns {Object} profile data (ready to upsert into StudentLearningProfile)
 */
function buildProfile({
    studentId,
    schoolId,
    masteryRecords,
    trendRecords,
    difficultyRecommendations,
    avgCompletionRate   = 1,
    sessionsLast30Days  = 0,
    avgConfidence       = null,
    totalQuizAttempts   = 0,
}) {
    if (!masteryRecords || masteryRecords.length === 0) {
        return buildEmptyProfile(studentId, schoolId);
    }

    // ── Sort topics by mastery score ──────────────────────────────────────
    const sortedByMastery = [...masteryRecords].sort((a, b) => b.masteryScore - a.masteryScore);

    const trendByTopic = {};
    for (const t of trendRecords) trendByTopic[t.topic] = t;

    const toTopicSummary = (m) => ({
        topic:        m.topic,
        masteryScore: m.masteryScore,
        trendType:    trendByTopic[m.topic]?.trendType || 'insufficient_data',
        subjectId:    m.subjectId,
    });

    const strongestTopics = sortedByMastery.slice(0, STRONG_TOPIC_COUNT).map(toTopicSummary);
    const weakestTopics   = sortedByMastery.slice(-WEAK_TOPIC_COUNT).reverse().map(toTopicSummary);

    // ── Compute scores ────────────────────────────────────────────────────
    const overallMastery    = computeOverallMastery(masteryRecords);
    const learningPace      = computeLearningPace(trendRecords);
    const retentionEstimate = computeRetentionEstimate(masteryRecords);
    const consistencyScore  = computeConsistencyScore(masteryRecords);
    const engagementScore   = computeEngagementScore(avgCompletionRate, sessionsLast30Days);
    const confidenceScore   = computeConfidenceScore(avgConfidence);
    const readinessScore    = computeReadinessScore(overallMastery, retentionEstimate, consistencyScore);

    const scores = {
        overallMastery, learningPace, retentionEstimate,
        consistencyScore, engagementScore, confidenceScore, readinessScore,
    };

    // ── Difficulty per subject ────────────────────────────────────────────
    const difficultyBySubject = {};
    for (const rec of difficultyRecommendations) {
        if (rec.subjectId) {
            difficultyBySubject[String(rec.subjectId)] = rec.recommendedDifficulty;
        }
    }

    // ── Alerts ────────────────────────────────────────────────────────────
    const alerts = generateAlerts(masteryRecords, trendRecords, scores);

    // ── Explanation ───────────────────────────────────────────────────────
    const explanation = buildProfileExplanation(scores, strongestTopics, weakestTopics);

    return {
        studentId,
        schoolId,
        strongestTopics,
        weakestTopics,
        scores,
        totalQuizAttempts,
        totalTopicsSeen:    masteryRecords.length,
        lastActivityAt:     new Date(),
        difficultyBySubject,
        alerts,
        explanation,
    };
}

function buildEmptyProfile(studentId, schoolId) {
    return {
        studentId,
        schoolId,
        strongestTopics: [],
        weakestTopics:   [],
        scores: {
            overallMastery: 0, learningPace: 0, retentionEstimate: 0,
            consistencyScore: 0, engagementScore: 0, confidenceScore: 0.5, readinessScore: 0,
        },
        totalQuizAttempts: 0,
        totalTopicsSeen:   0,
        lastActivityAt:    new Date(),
        difficultyBySubject: {},
        alerts: [],
        explanation: 'No quiz data available yet. Complete a quiz to start building your profile.',
    };
}

function buildProfileExplanation(scores, strongestTopics, weakestTopics) {
    const pct = (v) => (v * 100).toFixed(1) + '%';
    return [
        `Overall mastery: ${pct(scores.overallMastery)}.`,
        `Readiness: ${pct(scores.readinessScore)}.`,
        `Strongest: ${strongestTopics.map(t => t.topic).join(', ') || 'none'}.`,
        `Needs work: ${weakestTopics.map(t => t.topic).join(', ') || 'none'}.`,
        `Retention: ${pct(scores.retentionEstimate)}, Consistency: ${pct(scores.consistencyScore)}.`,
    ].join(' ');
}

module.exports = {
    buildProfile,
    computeOverallMastery,
    computeLearningPace,
    computeRetentionEstimate,
    computeConsistencyScore,
    computeEngagementScore,
    computeConfidenceScore,
    computeReadinessScore,
    generateAlerts,
};
