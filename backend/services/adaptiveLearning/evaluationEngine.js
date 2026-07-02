/**
 * EvaluationEngine
 *
 * Stage 1 of the adaptive learning pipeline.
 * Evaluates every question individually and produces structured performance
 * metrics from a raw quiz submission.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Algorithm Overview
 * ─────────────────────────────────────────────────────────────────────────────
 * For each question:
 *   1. Detect question type (mcq, true_false, numerical, short_answer)
 *   2. Apply the type-specific evaluation rule
 *   3. Assign isCorrect, isSkipped, partialCredit
 *   4. Compute per-question evaluation notes (explainability)
 *
 * Aggregate metrics computed once at the end:
 *   - accuracyRate      = correctCount / answeredQuestions
 *   - completionRate    = answeredQuestions / totalQuestions
 *   - avgResponseTimeMs = sum(responseTimeMs) / answeredQuestions
 *   - avgConfidence     = mean of provided confidence values
 *   - topicBreakdown    = per-topic { correct, total, skipped, totalTime }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Evaluation rules by type:
 *   MCQ / True-False   exact index match to correctAnswer
 *   Numerical          |studentVal − correctVal| ≤ NUMERICAL_TOLERANCE
 *   Short Answer       normalized string similarity ≥ SHORT_ANSWER_THRESHOLD
 *                      (Jaccard over word tokens — deterministic, no LLM)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design note:
 *   This module is intentionally stateless — all inputs come in, a structured
 *   result comes out. No DB access. Fully unit-testable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const NUMERICAL_TOLERANCE  = 0.001;  // |student - correct| ≤ this → correct
const SHORT_ANSWER_THRESHOLD = 0.5;  // Jaccard similarity ≥ this → correct

// Difficulty → numeric weight mapping (used in mastery engine)
const DIFFICULTY_WEIGHT = {
    easy:      0.25,
    medium:    0.50,
    hard:      0.75,
    challenge: 1.00,
};

// ── Utility: Jaccard similarity over word tokens ──────────────────────────────
/**
 * Deterministic short-answer grader.
 * Tokenizes both strings to lowercase word sets and computes:
 *   jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param {string} studentText
 * @param {string} correctText
 * @returns {number} similarity ∈ [0,1]
 */
function jaccardSimilarity(studentText, correctText) {
    const tokenize = (str) =>
        new Set(String(str).toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));

    const setA = tokenize(studentText);
    const setB = tokenize(correctText);

    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const token of setA) {
        if (setB.has(token)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return intersection / union;
}

// ── Core: evaluate a single question ─────────────────────────────────────────
/**
 * Evaluate one question and return a structured question detail record.
 *
 * @param {Object} questionDef   — question definition from Test.questions[]
 *   @param {string}  questionDef.questionText
 *   @param {string}  questionDef.questionType   — "mcq"|"true_false"|"numerical"|"short_answer"
 *   @param {string}  questionDef.topic          — e.g. "Algebra"
 *   @param {string}  questionDef.difficulty     — "easy"|"medium"|"hard"|"challenge"
 *   @param {number}  questionDef.marks
 *   @param {*}       questionDef.correctAnswer  — index (MCQ/TF) or value (numerical/text)
 *
 * @param {Object} submission    — student's response for this question
 *   @param {*}       submission.studentAnswer  — null/undefined = skipped
 *   @param {number}  submission.responseTimeMs
 *   @param {number}  [submission.confidence]   — 1–5, optional
 *   @param {number}  [submission.attemptCount] — answer changes before submit
 *
 * @param {number} questionIndex — 0-based position in quiz
 *
 * @returns {Object} question detail record (matches questionDetailSchema shape)
 */
function evaluateQuestion(questionDef, submission, questionIndex) {
    const {
        questionType = 'mcq',
        topic        = 'General',
        difficulty   = 'medium',
        marks        = 1,
        correctAnswer,
    } = questionDef;

    const {
        studentAnswer  = null,
        responseTimeMs = 0,
        confidence     = null,
        attemptCount   = 1,
    } = submission || {};

    // ── Skipped detection ─────────────────────────────────────────────────
    const isSkipped = (studentAnswer === null || studentAnswer === undefined || studentAnswer === '');

    let isCorrect     = false;
    let partialCredit = null;
    let evaluationNotes = '';

    if (!isSkipped) {
        switch (questionType) {

            case 'mcq':
            case 'true_false': {
                // Both types use integer index comparison
                isCorrect = Number(studentAnswer) === Number(correctAnswer);
                evaluationNotes = isCorrect
                    ? `Correct ${questionType.toUpperCase()} answer (index ${correctAnswer})`
                    : `Incorrect: selected ${studentAnswer}, expected ${correctAnswer}`;
                break;
            }

            case 'numerical': {
                const sv = parseFloat(studentAnswer);
                const cv = parseFloat(correctAnswer);
                if (Number.isNaN(sv)) {
                    evaluationNotes = 'Non-numeric answer provided';
                } else {
                    const delta = Math.abs(sv - cv);
                    isCorrect = delta <= NUMERICAL_TOLERANCE;
                    evaluationNotes = isCorrect
                        ? `Correct numerical answer (|${sv} − ${cv}| ≤ ${NUMERICAL_TOLERANCE})`
                        : `Incorrect: |${sv} − ${cv}| = ${delta.toFixed(6)} > tolerance`;
                }
                break;
            }

            case 'short_answer': {
                const similarity = jaccardSimilarity(String(studentAnswer), String(correctAnswer));
                partialCredit    = parseFloat(similarity.toFixed(4));
                isCorrect        = similarity >= SHORT_ANSWER_THRESHOLD;
                evaluationNotes  = `Short-answer Jaccard similarity: ${(similarity * 100).toFixed(1)}% `
                    + `(threshold ${SHORT_ANSWER_THRESHOLD * 100}%). `
                    + (isCorrect ? 'Accepted.' : 'Below threshold.');
                break;
            }

            default:
                evaluationNotes = `Unknown question type: ${questionType}`;
        }
    } else {
        evaluationNotes = 'Question skipped by student';
    }

    return {
        questionIndex,
        questionType,
        topic,
        difficulty,
        maxMarks:       marks,
        studentAnswer,
        correctAnswer,
        isCorrect,
        isSkipped,
        partialCredit,
        responseTimeMs: Math.max(0, Number(responseTimeMs) || 0),
        confidence:     confidence !== null ? Math.min(5, Math.max(1, Number(confidence))) : null,
        attemptCount:   Math.max(1, Number(attemptCount) || 1),
        evaluationNotes,
    };
}

// ── Core: compute aggregate metrics ──────────────────────────────────────────
/**
 * Compute aggregate metrics from an array of evaluated question details.
 *
 * @param {Array<Object>} questionDetails — output of evaluateQuestion()
 * @returns {Object} metrics object matching the metrics sub-schema
 */
function computeAggregateMetrics(questionDetails) {
    const total        = questionDetails.length;
    let answered       = 0;
    let skipped        = 0;
    let correct        = 0;
    let incorrect      = 0;
    let rawScore       = 0;
    let maxScore       = 0;
    let totalTime      = 0;
    let confidenceSum  = 0;
    let confidenceCount = 0;

    // topic → { correct, total, skipped, totalTime }
    const topicBreakdown = {};

    for (const qd of questionDetails) {
        maxScore += qd.maxMarks;

        const tb = topicBreakdown[qd.topic] = topicBreakdown[qd.topic] || {
            correct: 0, total: 0, skipped: 0, totalTime: 0,
        };
        tb.total++;

        if (qd.isSkipped) {
            skipped++;
            tb.skipped++;
            continue;
        }

        answered++;
        totalTime += qd.responseTimeMs;
        tb.totalTime += qd.responseTimeMs;

        if (qd.confidence !== null) {
            confidenceSum += qd.confidence;
            confidenceCount++;
        }

        if (qd.isCorrect) {
            correct++;
            rawScore += qd.partialCredit !== null
                ? qd.maxMarks * qd.partialCredit
                : qd.maxMarks;
            tb.correct++;
        } else {
            // Partial credit for short answer even when below threshold
            if (qd.partialCredit !== null && qd.partialCredit > 0) {
                rawScore += qd.maxMarks * qd.partialCredit;
            }
            incorrect++;
        }
    }

    return {
        totalQuestions:    total,
        answeredQuestions: answered,
        skippedQuestions:  skipped,
        correctCount:      correct,
        incorrectCount:    incorrect,
        rawScore:          parseFloat(rawScore.toFixed(4)),
        maxScore,
        accuracyRate:      answered > 0 ? parseFloat((correct / answered).toFixed(4)) : 0,
        avgResponseTimeMs: answered > 0 ? Math.round(totalTime / answered) : 0,
        avgConfidence:     confidenceCount > 0 ? parseFloat((confidenceSum / confidenceCount).toFixed(2)) : null,
        completionRate:    total > 0 ? parseFloat((answered / total).toFixed(4)) : 0,
        topicBreakdown,
    };
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Evaluate an entire quiz attempt.
 *
 * @param {Object} params
 *   @param {Array<Object>} params.questions   — test.questions[] (from DB, includes correctAnswer)
 *   @param {Array<Object>} params.submissions — per-question student responses
 *                                               (index-aligned with questions)
 *     Each submission: { studentAnswer, responseTimeMs?, confidence?, attemptCount? }
 *
 * @returns {{ questionDetails: Array, metrics: Object }}
 *   Ready to be embedded in a QuizAttemptDetail document.
 */
function evaluateAttempt({ questions, submissions }) {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('EvaluationEngine: questions array is required and must not be empty');
    }
    if (!Array.isArray(submissions)) {
        throw new Error('EvaluationEngine: submissions must be an array');
    }

    const questionDetails = questions.map((qDef, idx) => {
        const sub = submissions[idx] || {};
        return evaluateQuestion(qDef, sub, idx);
    });

    const metrics = computeAggregateMetrics(questionDetails);

    return { questionDetails, metrics };
}

module.exports = {
    evaluateAttempt,
    evaluateQuestion,
    computeAggregateMetrics,
    jaccardSimilarity,
    DIFFICULTY_WEIGHT,
    NUMERICAL_TOLERANCE,
    SHORT_ANSWER_THRESHOLD,
};
