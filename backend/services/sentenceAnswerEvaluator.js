/**
 * SentenceAnswerEvaluator
 *
 * AI-assisted evaluation service for sentence_answer / descriptive questions.
 *
 * Flow:
 *   Student Answer
 *         ↓
 *   Question + Expected Answer + Key Concepts + Rubric
 *         ↓
 *   Groq AI Evaluation
 *         ↓
 *   Strict JSON Validation
 *         ↓
 *   Retry / Safe Repair if Invalid (max 2 retries)
 *         ↓
 *   AI Score + Feedback + Confidence
 *
 * IMPORTANT:
 *   - The AI score is NEVER directly written to DSKP.
 *   - Only the teacher-validated finalScore influences DSKP.
 *   - AI is an assistant to the teacher, not the final authority.
 *   - LOW confidence answers are always marked PENDING_TEACHER_REVIEW.
 *   - ALL sentence answers require teacher validation regardless of confidence.
 */

'use strict';

const { groqService, GROQ_MODELS }   = require('./groqService');
const SentenceAnswerEval             = require('../models/sentenceAnswerEvalSchema');
const TestAttemptHistory             = require('../models/testAttemptHistorySchema');
const { logger }                     = require('../utils/serverLogger');

// ── Default scoring rubric (configurable per question) ─────────────────────────
const DEFAULT_RUBRIC = {
    conceptCoverage:    0.40,
    correctness:        0.30,
    relevance:          0.15,
    explanationQuality: 0.15,
};

// ── System prompt ──────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an expert academic evaluator. Your task is to evaluate a student's descriptive/sentence answer against an expected answer and a set of key concepts.

You must return ONLY valid JSON matching this exact schema:
{
  "score": <number, 0 to maxScore>,
  "maxScore": <number>,
  "conceptCoverage": <number, 0 to 1>,
  "correctness": <number, 0 to 1>,
  "relevance": <number, 0 to 1>,
  "explanationQuality": <number, 0 to 1>,
  "coveredConcepts": [<string>, ...],
  "missingConcepts": [<string>, ...],
  "incorrectConcepts": [<string>, ...],
  "feedback": "<string - constructive, specific feedback for the student>",
  "confidence": "<LOW|MEDIUM|HIGH>"
}

Rules:
- score must be between 0 and maxScore (inclusive).
- All percentage scores must be between 0 and 1.
- Use partial scoring — do not just mark as correct/incorrect.
- confidence: LOW if student answer is ambiguous or very short, MEDIUM if partially complete, HIGH if comprehensive.
- feedback must be constructive and reference specific concepts.
- Never return null for arrays — return empty arrays [] if nothing applies.
- Return ONLY the JSON object, no other text.`;

// ── Build user prompt ─────────────────────────────────────────────────────────
function buildUserPrompt({ questionText, expectedAnswer, keyConcepts, studentAnswer, maxMarks, scoringRubric }) {
    const rubric = scoringRubric || DEFAULT_RUBRIC;
    return `QUESTION:
${questionText}

EXPECTED ANSWER (reference):
${expectedAnswer || 'Not specified — evaluate based on key concepts only.'}

KEY CONCEPTS to check for (student should cover these):
${keyConcepts && keyConcepts.length > 0 ? keyConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n') : 'No specific key concepts defined — evaluate general quality.'}

SCORING RUBRIC WEIGHTS:
- Concept Coverage: ${(rubric.conceptCoverage * 100).toFixed(0)}%
- Correctness: ${(rubric.correctness * 100).toFixed(0)}%
- Relevance: ${(rubric.relevance * 100).toFixed(0)}%
- Explanation Quality: ${(rubric.explanationQuality * 100).toFixed(0)}%

MAXIMUM MARKS: ${maxMarks}

STUDENT'S ANSWER:
${studentAnswer || '[No answer provided]'}

Evaluate the student's answer and return the JSON evaluation.`;
}

// ── Strict AI response validator ───────────────────────────────────────────────
function validateAIResponse(data, maxMarks) {
    const errors = [];

    if (typeof data !== 'object' || data === null) {
        return { valid: false, errors: ['Response is not an object'] };
    }

    // score
    if (typeof data.score !== 'number' || data.score < 0 || data.score > maxMarks) {
        errors.push(`score must be a number between 0 and ${maxMarks}, got: ${data.score}`);
    }
    // maxScore
    if (typeof data.maxScore !== 'number') {
        // repair: set from parameter
        data.maxScore = maxMarks;
    }
    // dimension scores
    for (const dim of ['conceptCoverage', 'correctness', 'relevance', 'explanationQuality']) {
        if (typeof data[dim] !== 'number' || data[dim] < 0 || data[dim] > 1) {
            errors.push(`${dim} must be a number between 0 and 1, got: ${data[dim]}`);
        }
    }
    // concept arrays
    for (const arr of ['coveredConcepts', 'missingConcepts', 'incorrectConcepts']) {
        if (!Array.isArray(data[arr])) {
            // safe repair: convert null/undefined to []
            data[arr] = [];
        }
    }
    // feedback
    if (typeof data.feedback !== 'string' || data.feedback.trim() === '') {
        errors.push('feedback must be a non-empty string');
    }
    // confidence
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(data.confidence)) {
        errors.push(`confidence must be LOW, MEDIUM, or HIGH, got: ${data.confidence}`);
    }

    return { valid: errors.length === 0, errors, repairedData: data };
}

// ── Safe structural repair (before retry) ─────────────────────────────────────
function safeRepair(raw, maxMarks) {
    try {
        // Strip markdown code fences if present
        let cleaned = raw
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // Find first { ... } JSON block
        const start = cleaned.indexOf('{');
        const end   = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            cleaned = cleaned.substring(start, end + 1);
        }

        const parsed = JSON.parse(cleaned);

        // Clamp score to valid range
        if (typeof parsed.score === 'number') {
            parsed.score = Math.max(0, Math.min(maxMarks, parsed.score));
        }
        parsed.maxScore = maxMarks;

        // Ensure arrays
        for (const arr of ['coveredConcepts', 'missingConcepts', 'incorrectConcepts']) {
            if (!Array.isArray(parsed[arr])) parsed[arr] = [];
        }

        // Default confidence
        if (!['LOW', 'MEDIUM', 'HIGH'].includes(parsed.confidence)) {
            parsed.confidence = 'LOW';
        }

        return parsed;
    } catch (_) {
        return null;
    }
}

// ── Core evaluation function ───────────────────────────────────────────────────
/**
 * Evaluate a single sentence_answer question.
 *
 * @param {Object} params
 * @param {string} params.questionText
 * @param {string} params.expectedAnswer
 * @param {string[]} params.keyConcepts
 * @param {string} params.studentAnswer
 * @param {number} params.maxMarks
 * @param {Object} [params.scoringRubric]
 * @param {string} params.userId   - for groqService logging
 * @returns {Promise<Object>} validated AI evaluation result
 */
async function evaluateSentenceAnswer({ questionText, expectedAnswer, keyConcepts, studentAnswer, maxMarks, scoringRubric, userId }) {
    const userPrompt = buildUserPrompt({ questionText, expectedAnswer, keyConcepts, studentAnswer, maxMarks, scoringRubric });

    let lastRaw    = null;
    let retryCount = 0;
    const maxRetries = 2;

    // ── Attempt with retries ────────────────────────────────────────────────
    while (retryCount <= maxRetries) {
        let rawContent = null;

        try {
            const result = await groqService.call({
                userId,
                userRole:     'system',
                endpointName: 'sentence-answer-eval',
                model:        GROQ_MODELS.ANALYSIS,
                systemPrompt: SYSTEM_PROMPT,
                userPrompt,
                parseResponse: (content) => {
                    rawContent = content;
                    // First try direct parse
                    try {
                        return JSON.parse(content.trim());
                    } catch (_) {
                        // Try structural repair
                        const repaired = safeRepair(content, maxMarks);
                        if (repaired) return repaired;
                        throw new Error('Could not parse AI response as JSON');
                    }
                },
            });

            const parsed = result.data;
            const { valid, errors, repairedData } = validateAIResponse(parsed, maxMarks);

            if (valid) {
                logger.info('SentenceAnswerEvaluator: evaluation succeeded', {
                    userId, retryCount, score: repairedData.score, confidence: repairedData.confidence
                });
                return {
                    success:    true,
                    retryCount,
                    rawContent,
                    evaluation: repairedData,
                };
            }

            logger.warn('SentenceAnswerEvaluator: validation failed, retrying', { errors, retryCount });
            lastRaw = rawContent;
            retryCount++;

        } catch (err) {
            logger.warn('SentenceAnswerEvaluator: AI call failed', { error: err.message, retryCount });
            lastRaw = rawContent;
            retryCount++;
        }
    }

    // ── All retries exhausted — safe default ───────────────────────────────
    logger.error('SentenceAnswerEvaluator: all retries failed — returning safe default', { userId });
    return {
        success:    false,
        retryCount: retryCount - 1,
        rawContent: lastRaw,
        evaluation: {
            score:               0,
            maxScore:            maxMarks,
            conceptCoverage:     0,
            correctness:         0,
            relevance:           0,
            explanationQuality:  0,
            coveredConcepts:     [],
            missingConcepts:     keyConcepts || [],
            incorrectConcepts:   [],
            feedback:            'AI evaluation was unavailable. This answer requires teacher review.',
            confidence:          'LOW',
        },
    };
}

// ── Orchestrator: evaluate all sentence_answer questions in an attempt ─────────
/**
 * Evaluate all sentence_answer questions in a submitted attempt and persist
 * SentenceAnswerEval documents for each.
 *
 * @param {Object} params
 * @param {string} params.attemptHistoryId
 * @param {string} params.studentId
 * @param {string} params.testId
 * @param {string} [params.subjectId]
 * @param {string} [params.schoolId]
 * @param {Array}  params.questions    - test.questions array
 * @param {Array}  params.submissions  - student submission array (index-aligned)
 * @returns {Promise<{ evalIds: ObjectId[], pendingCount: number }>}
 */
async function evaluateAllSentenceAnswers({ attemptHistoryId, studentId, testId, subjectId, schoolId, questions, submissions }) {
    const evalIds      = [];
    let pendingCount   = 0;

    for (let i = 0; i < questions.length; i++) {
        const q   = questions[i];
        const sub = submissions[i] || {};

        if (q.questionType !== 'sentence_answer') continue;

        const studentAnswer = typeof sub.studentAnswer === 'string' ? sub.studentAnswer : '';

        // Create the eval document in PENDING state first
        const evalDoc = new SentenceAnswerEval({
            attemptHistoryId,
            studentId,
            testId,
            subjectId,
            schoolId,
            questionIndex:   i,
            questionText:    q.questionText,
            topic:           q.topic || 'General',
            subtopic:        q.subtopic || null,
            expectedAnswer:  q.expectedAnswer || '',
            keyConcepts:     q.keyConcepts || [],
            scoringRubric:   q.scoringRubric || DEFAULT_RUBRIC,
            maxMarks:        q.marks || 10,
            studentAnswer,
            validationStatus: 'PENDING_TEACHER_REVIEW',
        });

        await evalDoc.save();
        evalIds.push(evalDoc._id);
        pendingCount++;

        // AI evaluation is fire-and-forget from the HTTP response perspective
        // but we await it here to populate fields before returning
        try {
            const result = await evaluateSentenceAnswer({
                questionText:  q.questionText,
                expectedAnswer: q.expectedAnswer || '',
                keyConcepts:   q.keyConcepts || [],
                studentAnswer,
                maxMarks:      q.marks || 10,
                scoringRubric: q.scoringRubric || null,
                userId:        String(studentId),
            });

            const ev = result.evaluation;

            // Update the eval document with AI results
            // Status stays PENDING_TEACHER_REVIEW — teacher validation is mandatory
            await SentenceAnswerEval.findByIdAndUpdate(evalDoc._id, {
                aiScore:              ev.score,
                aiConceptCoverage:    ev.conceptCoverage,
                aiCorrectness:        ev.correctness,
                aiRelevance:          ev.relevance,
                aiExplanationQuality: ev.explanationQuality,
                coveredConcepts:      ev.coveredConcepts,
                missingConcepts:      ev.missingConcepts,
                incorrectConcepts:    ev.incorrectConcepts,
                aiFeedback:           ev.feedback,
                aiConfidence:         ev.confidence,
                aiEvaluatedAt:        new Date(),
                aiRetryCount:         result.retryCount,
                aiRawResponse:        result.rawContent ? result.rawContent.substring(0, 2000) : null,
                // Status remains PENDING_TEACHER_REVIEW — mandatory teacher validation
                validationStatus: 'PENDING_TEACHER_REVIEW',
            });

        } catch (err) {
            logger.error('SentenceAnswerEvaluator: failed to evaluate question', {
                questionIndex: i, error: err.message
            });
            // evalDoc remains with null AI fields — teacher still must validate
        }
    }

    // Update the attempt history record with eval IDs and completion status
    if (evalIds.length > 0) {
        await TestAttemptHistory.findByIdAndUpdate(attemptHistoryId, {
            $push: { sentenceEvalIds: { $each: evalIds } },
            $set: {
                pendingSentenceEvals:       pendingCount,
                assessmentCompletionStatus: 'TEACHER_REVIEW_PENDING',
            }
        });
    }

    return { evalIds, pendingCount };
}

module.exports = {
    evaluateSentenceAnswer,
    evaluateAllSentenceAnswers,
    DEFAULT_RUBRIC,
};
