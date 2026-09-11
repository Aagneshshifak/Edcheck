/**
 * PostAssessmentAnalyticsEngine
 *
 * Pure deterministic analytics engine for post-assessment reporting.
 * Transforms existing pipeline outputs (questionDetails, masteryUpdates,
 * trendUpdates, difficultyRecs) into a granular hierarchical analytics object.
 *
 * Design rules:
 *   1. PURE FUNCTION — no DB access, no Groq calls, no external APIs
 *   2. Does NOT grade student answers — grading is done by EvaluationEngine
 *   3. Does NOT recompute mastery — reuses TopicMastery outputs from stage 2
 *   4. Does NOT recompute trends — reuses LearningTrend outputs from stage 3
 *   5. Does NOT override any deterministic value with AI/LLM
 *   6. Null-safe — missing curriculum metadata preserved as null
 */

'use strict';

// ── Thresholds (named constants) ──────────────────────────────────────────────
const MASTERY_CRITICAL           = 0.40;
const MASTERY_WEAK               = 0.60;
const MASTERY_DEVELOPING         = 0.75;
const MASTERY_STRONG             = 0.75;
const RETENTION_RISK_THRESHOLD   = 0.55;
const CONFIDENCE_OVERCONFIDENCE  = 0.70;
const CONFIDENCE_UNDERCONFIDENCE = 0.35;
const MASTERY_OVERCONFIDENCE_MAX = 0.45;
const MASTERY_UNDERCONFIDENCE_MIN = 0.70;
const MIN_QUESTIONS_FOR_CRITICAL = 2;

// Priority score weights (sum to 1)
const WEIGHT_MASTERY    = 0.35;
const WEIGHT_TREND      = 0.25;
const WEIGHT_RETENTION  = 0.20;
const WEIGHT_CONFIDENCE = 0.10;
const WEIGHT_ERRORS     = 0.10;

const TREND_RISK = {
    declining:         1.00,
    forgetting:        0.80,
    volatile:          0.50,
    stable:            0.10,
    improving:         0.05,
    accelerating:      0.00,
    insufficient_data: 0.20,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeDiv(a, b, fallback = 0) {
    return b > 0 ? parseFloat((a / b).toFixed(4)) : fallback;
}
function round2(n) { return parseFloat((n || 0).toFixed(4)); }
function normalizeConfidence(conf) {
    if (conf == null) return null;
    return round2(Math.min(5, Math.max(1, conf)) / 5);
}
function classifySeverity(masteryScore, questionCount) {
    if (masteryScore < MASTERY_CRITICAL) {
        return questionCount >= MIN_QUESTIONS_FOR_CRITICAL ? 'CRITICAL' : 'WEAK';
    }
    if (masteryScore < MASTERY_WEAK)       return 'WEAK';
    if (masteryScore < MASTERY_DEVELOPING) return 'DEVELOPING';
    return 'STRONG';
}

/**
 * Compute deterministic priority score for a weak area. Result in [0,1].
 */
function computePriorityScore({ masteryScore, accuracyRate, trendType, forgettingFactor, confidenceMismatch, repeatedErrors, questionCount }) {
    const masteryWeakness   = (1 - (masteryScore    || 0)) * WEIGHT_MASTERY;
    const trendRisk         = (TREND_RISK[trendType] || TREND_RISK.insufficient_data) * WEIGHT_TREND;
    const retentionRisk     = Math.min(1, (forgettingFactor || 0)) * WEIGHT_RETENTION;
    const confidencePenalty = (confidenceMismatch === 'OVERCONFIDENCE_RISK' ? 1 : 0) * WEIGHT_CONFIDENCE;
    const errorRisk         = Math.min(1, (repeatedErrors || 0) / Math.max(1, questionCount)) * WEIGHT_ERRORS;
    return round2(Math.min(1, masteryWeakness + trendRisk + retentionRisk + confidencePenalty + errorRisk));
}

// ── Hierarchical breakdown ─────────────────────────────────────────────────────
function buildHierarchicalBreakdown(questionDetails, masteryUpdates, trendUpdates) {
    const byTopic = {};

    for (const qd of (questionDetails || [])) {
        const topicKey = qd.subtopic || qd.chapter || qd.topic || 'General';
        if (!byTopic[topicKey]) {
            byTopic[topicKey] = {
                topicKey,
                subject: null, domain: qd.domain || null, chapter: qd.chapter || null,
                subtopic: qd.subtopic || null, concept: qd.concept || null,
                questionCount: 0, attemptedCount: 0, correctCount: 0,
                skippedCount: 0, totalMarks: 0, marksObtained: 0,
                confidenceValues: [], responseTimesMs: [],
                difficultyTotals: { easy: 0, medium: 0, hard: 0, challenge: 0 },
                difficultyCorrect: { easy: 0, medium: 0, hard: 0, challenge: 0 },
                repeatedErrors: 0,
            };
        }
        const entry = byTopic[topicKey];
        if (!entry.domain   && qd.domain)   entry.domain   = qd.domain;
        if (!entry.chapter  && qd.chapter)  entry.chapter  = qd.chapter;
        if (!entry.subtopic && qd.subtopic) entry.subtopic = qd.subtopic;
        if (!entry.concept  && qd.concept)  entry.concept  = qd.concept;

        entry.questionCount++;
        entry.totalMarks += qd.maxMarks || 1;
        if (qd.isSkipped) {
            entry.skippedCount++;
        } else {
            entry.attemptedCount++;
            if (qd.isCorrect) {
                entry.correctCount++;
                entry.marksObtained += qd.maxMarks || 1;
            } else if (qd.partialCredit != null) {
                entry.marksObtained += qd.partialCredit * (qd.maxMarks || 1);
            }
            if (qd.responseTimeMs) entry.responseTimesMs.push(qd.responseTimeMs);
            if (qd.confidence != null) entry.confidenceValues.push(qd.confidence);
            if (!qd.isCorrect && (qd.attemptCount || 1) > 1) entry.repeatedErrors++;
            const diff = qd.difficulty || 'medium';
            entry.difficultyTotals[diff] = (entry.difficultyTotals[diff] || 0) + 1;
            if (qd.isCorrect) entry.difficultyCorrect[diff] = (entry.difficultyCorrect[diff] || 0) + 1;
        }
    }

    for (const [topicKey, entry] of Object.entries(byTopic)) {
        const mastery = masteryUpdates?.[topicKey];
        const trend   = trendUpdates?.[topicKey];
        entry.masteryScore     = mastery?.masteryScore                  ?? null;
        entry.masteryLevel     = mastery?.masteryLevel                  ?? null;
        entry.forgettingFactor = mastery?.factors?.forgettingFactor     ?? null;
        entry.consistency      = mastery?.factors?.consistency          ?? null;
        entry.retention        = mastery != null ? (1 - (mastery.factors?.forgettingFactor || 0)) : null;
        entry.trendType        = trend?.trendType ?? 'insufficient_data';
        entry.regressionSlope  = trend?.regressionSlope ?? null;
        entry.rSquared         = trend?.rSquared         ?? null;
        entry.emaScore         = trend?.emaScore         ?? null;
        entry.accuracyRate     = safeDiv(entry.correctCount, entry.attemptedCount);
        entry.completionRate   = safeDiv(entry.attemptedCount, entry.questionCount);
        entry.avgResponseMs    = entry.responseTimesMs.length > 0
            ? Math.round(entry.responseTimesMs.reduce((a, b) => a + b, 0) / entry.responseTimesMs.length) : 0;
        entry.avgConfidence    = entry.confidenceValues.length > 0
            ? round2(entry.confidenceValues.reduce((a, b) => a + b, 0) / entry.confidenceValues.length) : null;
        entry.normConfidence   = normalizeConfidence(entry.avgConfidence);
        entry.severity         = classifySeverity(entry.masteryScore ?? 0.5, entry.questionCount);
    }

    return byTopic;
}

// ── Weak / strong area detection ──────────────────────────────────────────────
function detectSingleConfidenceMismatch(entry) {
    const normConf = entry.normConfidence;
    const mastery  = entry.masteryScore;
    if (normConf == null || mastery == null) return null;
    if (normConf >= CONFIDENCE_OVERCONFIDENCE && mastery <= MASTERY_OVERCONFIDENCE_MAX) {
        return {
            type: 'OVERCONFIDENCE_RISK', topic: entry.topicKey,
            subject: entry.subject, chapter: entry.chapter,
            subtopic: entry.subtopic, concept: entry.concept,
            confidence: normConf, mastery: round2(mastery), accuracy: entry.accuracyRate,
            explanation: `High confidence (${(normConf * 100).toFixed(0)}%) but low mastery (${(mastery * 100).toFixed(0)}%).`,
        };
    }
    if (normConf <= CONFIDENCE_UNDERCONFIDENCE && mastery >= MASTERY_UNDERCONFIDENCE_MIN) {
        return {
            type: 'UNDERCONFIDENCE', topic: entry.topicKey,
            subject: entry.subject, chapter: entry.chapter,
            subtopic: entry.subtopic, concept: entry.concept,
            confidence: normConf, mastery: round2(mastery), accuracy: entry.accuracyRate,
            explanation: `Low confidence (${(normConf * 100).toFixed(0)}%) but strong mastery (${(mastery * 100).toFixed(0)}%) — possible impostor effect.`,
        };
    }
    return null;
}

function detectWeakAreas(hierarchyMap) {
    const weakAreas = [];
    for (const [topicKey, entry] of Object.entries(hierarchyMap)) {
        const mastery = entry.masteryScore;
        const isMasteryWeak   = mastery != null && mastery < MASTERY_DEVELOPING;
        const isDecliningRisk = ['declining', 'forgetting', 'volatile'].includes(entry.trendType);
        if (!isMasteryWeak && !isDecliningRisk) continue;
        const confMismatch = detectSingleConfidenceMismatch(entry);
        const priorityScore = computePriorityScore({
            masteryScore: mastery ?? 0.5, accuracyRate: entry.accuracyRate,
            trendType: entry.trendType, forgettingFactor: entry.forgettingFactor,
            confidenceMismatch: confMismatch?.type, repeatedErrors: entry.repeatedErrors,
            questionCount: entry.questionCount,
        });
        weakAreas.push({
            topicKey, subject: entry.subject, domain: entry.domain,
            chapter: entry.chapter, subtopic: entry.subtopic, concept: entry.concept,
            mastery: round2(mastery ?? 0), accuracy: entry.accuracyRate,
            confidence: entry.normConfidence, consistency: round2(entry.consistency ?? 0),
            retention: round2(entry.retention ?? 0), forgettingFactor: round2(entry.forgettingFactor ?? 0),
            trend: entry.trendType, severity: classifySeverity(mastery ?? 0, entry.questionCount),
            priorityScore, questionCount: entry.questionCount,
            attemptedCount: entry.attemptedCount, correctCount: entry.correctCount,
            repeatedErrors: entry.repeatedErrors, confidenceMismatch: confMismatch?.type || null,
        });
    }
    weakAreas.sort((a, b) => b.priorityScore - a.priorityScore);
    return weakAreas;
}

function detectStrongAreas(hierarchyMap) {
    const strongAreas = [];
    for (const [topicKey, entry] of Object.entries(hierarchyMap)) {
        const mastery = entry.masteryScore;
        if (mastery == null || mastery < MASTERY_STRONG) continue;
        strongAreas.push({
            topicKey, subject: entry.subject, domain: entry.domain,
            chapter: entry.chapter, subtopic: entry.subtopic, concept: entry.concept,
            mastery: round2(mastery), accuracy: entry.accuracyRate,
            trend: entry.trendType, questionCount: entry.questionCount,
        });
    }
    strongAreas.sort((a, b) => b.mastery - a.mastery);
    return strongAreas;
}

function detectConfidenceMismatches(hierarchyMap) {
    const mismatches = [];
    for (const entry of Object.values(hierarchyMap)) {
        const m = detectSingleConfidenceMismatch(entry);
        if (m) mismatches.push(m);
    }
    return mismatches;
}

// ── Difficulty, retention, trend ──────────────────────────────────────────────
function buildDifficultyAnalysis(questionDetails) {
    const levels = {
        easy: { q: 0, correct: 0 }, medium: { q: 0, correct: 0 },
        hard: { q: 0, correct: 0 }, challenge: { q: 0, correct: 0 },
    };
    for (const qd of (questionDetails || [])) {
        if (qd.isSkipped) continue;
        const diff = qd.difficulty || 'medium';
        if (!levels[diff]) continue;
        levels[diff].q++;
        if (qd.isCorrect) levels[diff].correct++;
    }
    return Object.entries(levels).map(([level, { q, correct }]) => ({
        level, questionCount: q, correctCount: correct, accuracy: safeDiv(correct, q),
    }));
}

function detectRetentionRisks(hierarchyMap, masteryUpdates) {
    const risks = [];
    for (const [topicKey, mastery] of Object.entries(masteryUpdates || {})) {
        const forgetting = mastery.factors?.forgettingFactor ?? 0;
        if (forgetting <= RETENTION_RISK_THRESHOLD) continue;
        const entry = hierarchyMap[topicKey] || {};
        risks.push({
            topic: topicKey, subject: mastery.subject || entry.subject || null,
            domain: mastery.domain || entry.domain || null,
            chapter: mastery.chapter || entry.chapter || null,
            subtopic: mastery.subtopic || entry.subtopic || null,
            mastery: round2(mastery.masteryScore),
            retention: round2(1 - forgetting), forgettingFactor: round2(forgetting),
            lastAssessment: mastery.lastSeenAt || null,
            risk: forgetting > 0.75 ? 'HIGH' : 'MEDIUM',
            reason: `Forgetting factor ${(forgetting * 100).toFixed(0)}% exceeds threshold.`,
        });
    }
    risks.sort((a, b) => b.forgettingFactor - a.forgettingFactor);
    return risks;
}

function buildTrendAnalysis(hierarchyMap, trendUpdates) {
    return Object.entries(trendUpdates || {}).map(([topicKey, trend]) => {
        const entry = hierarchyMap[topicKey] || {};
        return {
            topic: topicKey, subject: trend.subject || entry.subject || null,
            chapter: trend.chapter || entry.chapter || null,
            subtopic: trend.subtopic || entry.subtopic || null,
            trendType: trend.trendType, regressionSlope: trend.regressionSlope ?? null,
            rSquared: trend.rSquared ?? null, emaScore: trend.emaScore ?? null,
            velocityPerDay: trend.velocityPerDay ?? null,
            currentMastery: round2(entry.masteryScore ?? 0),
            dataPointCount: trend.dataPointCount ?? 0, explanation: trend.explanation || '',
            masteryHistory: (trend.dataPoints || []).slice(-10).map(dp => ({
                score: round2(dp.masteryScore), date: dp.recordedAt,
            })),
        };
    });
}

// ── Hierarchy aggregations ────────────────────────────────────────────────────
function buildSubjectAnalysis(hierarchyMap) {
    const bySubject = {};
    for (const entry of Object.values(hierarchyMap)) {
        const subKey = entry.subject || 'Unknown Subject';
        if (!bySubject[subKey]) bySubject[subKey] = { subject: subKey, questionCount: 0, attemptedCount: 0, correctCount: 0, totalMastery: 0, topicCount: 0, weakTopicCount: 0 };
        const s = bySubject[subKey];
        s.questionCount  += entry.questionCount;
        s.attemptedCount += entry.attemptedCount;
        s.correctCount   += entry.correctCount;
        if (entry.masteryScore != null) { s.totalMastery += entry.masteryScore; s.topicCount++; }
        if (entry.masteryScore != null && entry.masteryScore < MASTERY_WEAK) s.weakTopicCount++;
    }
    return Object.values(bySubject).map(s => ({
        subject: s.subject, questionCount: s.questionCount,
        accuracy: safeDiv(s.correctCount, s.attemptedCount),
        avgMastery: round2(safeDiv(s.totalMastery, s.topicCount)),
        weakTopicCount: s.weakTopicCount, topicCount: s.topicCount,
    }));
}

function buildChapterAnalysis(hierarchyMap) {
    const byChapter = {};
    for (const entry of Object.values(hierarchyMap)) {
        const chKey = entry.chapter || entry.domain || 'Unknown Chapter';
        if (!byChapter[chKey]) byChapter[chKey] = { chapter: chKey, domain: entry.domain || null, subject: entry.subject || null, questionCount: 0, attemptedCount: 0, correctCount: 0, totalMastery: 0, topicCount: 0 };
        const c = byChapter[chKey];
        c.questionCount  += entry.questionCount;
        c.attemptedCount += entry.attemptedCount;
        c.correctCount   += entry.correctCount;
        if (entry.masteryScore != null) { c.totalMastery += entry.masteryScore; c.topicCount++; }
    }
    return Object.values(byChapter).map(c => ({
        chapter: c.chapter, domain: c.domain, subject: c.subject,
        questionCount: c.questionCount, accuracy: safeDiv(c.correctCount, c.attemptedCount),
        avgMastery: round2(safeDiv(c.totalMastery, c.topicCount)),
    }));
}

function buildSubtopicAnalysis(hierarchyMap) {
    const bySubtopic = {};
    for (const [topicKey, entry] of Object.entries(hierarchyMap)) {
        const stKey = entry.subtopic || entry.topicKey || topicKey;
        if (!bySubtopic[stKey]) bySubtopic[stKey] = { subtopic: stKey, chapter: entry.chapter || null, domain: entry.domain || null, subject: entry.subject || null, questionCount: 0, attemptedCount: 0, correctCount: 0, masteryScores: [] };
        const st = bySubtopic[stKey];
        st.questionCount  += entry.questionCount;
        st.attemptedCount += entry.attemptedCount;
        st.correctCount   += entry.correctCount;
        if (entry.masteryScore != null) st.masteryScores.push(entry.masteryScore);
    }
    return Object.values(bySubtopic).map(s => ({
        subtopic: s.subtopic, chapter: s.chapter, domain: s.domain, subject: s.subject,
        questionCount: s.questionCount, accuracy: safeDiv(s.correctCount, s.attemptedCount),
        avgMastery: s.masteryScores.length > 0 ? round2(s.masteryScores.reduce((a, b) => a + b, 0) / s.masteryScores.length) : null,
    }));
}

function buildConceptAnalysis(hierarchyMap) {
    return Object.values(hierarchyMap)
        .filter(entry => entry.concept != null)
        .map(entry => ({
            concept: entry.concept, subtopic: entry.subtopic, chapter: entry.chapter,
            domain: entry.domain, subject: entry.subject,
            questionCount: entry.questionCount, accuracy: entry.accuracyRate,
            mastery: entry.masteryScore != null ? round2(entry.masteryScore) : null,
            trend: entry.trendType, severity: classifySeverity(entry.masteryScore ?? 0.5, entry.questionCount),
        }));
}

// ── Interventions ─────────────────────────────────────────────────────────────
function buildRecommendedInterventions(weakAreas, retentionRisks, confidenceMismatches) {
    const interventions = [];
    for (const wa of weakAreas.slice(0, 5)) {
        let action = '';
        const label = wa.subtopic || wa.chapter || wa.topicKey;
        if (wa.severity === 'CRITICAL') {
            action = `Immediate revision on ${label}: mastery ${(wa.mastery * 100).toFixed(0)}%. Schedule targeted practice at Easy–Medium difficulty before advancing.`;
        } else if (['declining', 'forgetting'].includes(wa.trend)) {
            action = `${label} shows a ${wa.trend} trend. Use spaced repetition at Medium difficulty over the next 7 days.`;
        } else {
            action = `${label} needs focused revision (mastery ${(wa.mastery * 100).toFixed(0)}%). Assign 3–5 targeted practice questions.`;
        }
        interventions.push({
            priority: wa.severity === 'CRITICAL' ? 'CRITICAL' : wa.severity === 'WEAK' ? 'HIGH' : 'MEDIUM',
            topicKey: wa.topicKey, chapter: wa.chapter, subtopic: wa.subtopic, concept: wa.concept,
            action, reason: `Mastery: ${(wa.mastery * 100).toFixed(0)}%, Trend: ${wa.trend}`, priorityScore: wa.priorityScore,
        });
    }
    for (const rr of retentionRisks.slice(0, 3)) {
        interventions.push({
            priority: rr.risk === 'HIGH' ? 'HIGH' : 'MEDIUM',
            topicKey: rr.topic, chapter: rr.chapter, subtopic: rr.subtopic, concept: null,
            action: `Retention risk for ${rr.subtopic || rr.topic}. Schedule spaced repetition review within 3–5 days (forgetting factor: ${(rr.forgettingFactor * 100).toFixed(0)}%).`,
            reason: `Forgetting factor ${(rr.forgettingFactor * 100).toFixed(0)}% exceeds threshold.`,
            priorityScore: rr.forgettingFactor,
        });
    }
    for (const cm of confidenceMismatches.filter(c => c.type === 'OVERCONFIDENCE_RISK').slice(0, 2)) {
        interventions.push({
            priority: 'MEDIUM', topicKey: cm.topic, chapter: cm.chapter, subtopic: cm.subtopic, concept: cm.concept,
            action: `Student is overconfident in ${cm.subtopic || cm.topic}. Assign Hard/Challenge questions to expose knowledge gaps.`,
            reason: cm.explanation, priorityScore: 0.5,
        });
    }
    interventions.sort((a, b) => b.priorityScore - a.priorityScore);
    return interventions;
}

function buildOverallPerformance({ assessmentMetrics, profile, dskp }) {
    return {
        score:          round2(assessmentMetrics?.scorePercentage || 0),
        accuracy:       round2(assessmentMetrics?.accuracyRate   || safeDiv(assessmentMetrics?.totalCorrect || 0, assessmentMetrics?.totalQuestions || 0)),
        mastery:        round2(dskp?.overallMastery    || profile?.scores?.overallMastery    || 0),
        confidence:     round2(dskp?.confidenceScore   || profile?.scores?.confidenceScore   || 0.5),
        consistency:    round2(dskp?.consistencyScore  || profile?.scores?.consistencyScore  || 0),
        retention:      round2(dskp?.retentionEstimate || profile?.scores?.retentionEstimate || 0),
        engagement:     round2(dskp?.engagementScore   || profile?.scores?.engagementScore   || 0),
        completionRate: round2(assessmentMetrics?.completionRate || 0),
        trend:          dskp?.learningPace || 'N/A',
        totalQuestions: assessmentMetrics?.totalQuestions || 0,
        totalCorrect:   assessmentMetrics?.totalCorrect   || 0,
    };
}

// ── Main entry point ──────────────────────────────────────────────────────────
function runPostAssessmentAnalytics({ questionDetails, masteryUpdates, trendUpdates, difficultyRecs, profile, assessmentMetrics, dskp }) {
    const safeQD = questionDetails || [];
    const safeMU = masteryUpdates  || {};
    const safeTU = trendUpdates    || {};
    const hierarchyMap           = buildHierarchicalBreakdown(safeQD, safeMU, safeTU);
    const weakAreas              = detectWeakAreas(hierarchyMap);
    const strongAreas            = detectStrongAreas(hierarchyMap);
    const confidenceMismatch     = detectConfidenceMismatches(hierarchyMap);
    const difficultyAnalysis     = buildDifficultyAnalysis(safeQD);
    const retentionRisks         = detectRetentionRisks(hierarchyMap, safeMU);
    const trendAnalysis          = buildTrendAnalysis(hierarchyMap, safeTU);
    const subjectAnalysis        = buildSubjectAnalysis(hierarchyMap);
    const chapterAnalysis        = buildChapterAnalysis(hierarchyMap);
    const subtopicAnalysis       = buildSubtopicAnalysis(hierarchyMap);
    const conceptAnalysis        = buildConceptAnalysis(hierarchyMap);
    const recommendedInterventions = buildRecommendedInterventions(weakAreas, retentionRisks, confidenceMismatch);
    const overallPerformance     = buildOverallPerformance({ assessmentMetrics, profile, dskp });
    return {
        overallPerformance, subjectAnalysis, chapterAnalysis,
        subtopicAnalysis, conceptAnalysis, weakAreas, strongAreas,
        trendAnalysis, retentionRisks, confidenceMismatch,
        difficultyAnalysis, recommendedInterventions,
        _hierarchyMap: hierarchyMap,
    };
}

module.exports = {
    runPostAssessmentAnalytics,
    buildHierarchicalBreakdown, detectWeakAreas, detectStrongAreas,
    computePriorityScore, detectConfidenceMismatches, buildDifficultyAnalysis,
    detectRetentionRisks, buildTrendAnalysis, buildOverallPerformance,
    classifySeverity,
    MASTERY_CRITICAL, MASTERY_WEAK, MASTERY_DEVELOPING, MASTERY_STRONG,
    RETENTION_RISK_THRESHOLD, CONFIDENCE_OVERCONFIDENCE, CONFIDENCE_UNDERCONFIDENCE,
};
