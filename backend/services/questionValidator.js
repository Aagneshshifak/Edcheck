'use strict';

const { groqService, GROQ_MODELS } = require('./groqService');
const { QUESTION_VALIDATION_SYSTEM_PROMPT, buildQuestionValidationPrompt } = require('../utils/aiPromptTemplates');
const { validateLLMOutput } = require('../utils/jsonValidator');
const { logger } = require('../utils/serverLogger');

const AI_QUALITY_THRESHOLD = 0.85; // Configurable threshold

/**
 * Deterministic Validation for a single question
 * Checks for missing required fields, correct answer bounds, and marks.
 */
function runDeterministicValidation(q) {
    const issues = [];
    
    if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
        issues.push("questionText is empty or missing");
    }
    
    if (!q.marks || q.marks <= 0) {
        issues.push("marks must be greater than 0");
    }
    
    if (!q.difficulty || !['easy', 'medium', 'hard', 'challenge'].includes(q.difficulty)) {
        issues.push(`invalid difficulty: ${q.difficulty}`);
    }

    if (q.questionType === 'mcq') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
            issues.push("mcq must have at least 2 options");
        } else {
            // Check for duplicate options (case insensitive)
            const optSet = new Set(q.options.map(o => o.toLowerCase().trim()));
            if (optSet.size !== q.options.length) {
                issues.push("mcq options contain duplicates");
            }
        }
        if (q.correctAnswer == null || typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer >= (q.options?.length || 0)) {
            issues.push(`correctAnswer index (${q.correctAnswer}) is out of bounds or missing`);
        }
    } else if (q.questionType === 'true_false') {
        // usually mapped as 0 for false, 1 for true. Or boolean.
        if (q.correctAnswer == null) {
            issues.push("true_false must have a correctAnswer");
        }
    } else if (q.questionType === 'sentence_answer') {
        if (!q.expectedAnswer || q.expectedAnswer.trim() === '') {
            issues.push("sentence_answer must have an expectedAnswer");
        }
        if (!Array.isArray(q.keyConcepts) || q.keyConcepts.length === 0) {
            issues.push("sentence_answer must have at least one keyConcept");
        }
    } else if (q.questionType === 'numerical') {
        if (q.correctAnswer == null) {
            issues.push("numerical must have a correctAnswer");
        }
    }

    // Check Curriculum Meta
    if (!q.curriculumMeta || !q.curriculumMeta.classId || !q.curriculumMeta.subjectId || !q.curriculumMeta.chapter) {
        issues.push("Missing basic curriculum metadata (classId, subjectId, chapter)");
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Validates a batch of questions using hybrid (deterministic + AI) validation.
 * @param {Array} questions - The generated questions with `curriculumMeta` attached.
 * @param {string} studentId - For LLM logging
 * @returns {Promise<Array>} Array of validated questions with validationStatus and validationDetails updated.
 */
async function validateQuestionsBatch(questions, studentId) {
    if (!questions || questions.length === 0) return [];

    const validatedQuestions = [];
    const aiBatch = [];

    // ── 1. Deterministic Validation ──
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        // Ensure standard ID for mapping
        q._tempId = q._tempId || `q_${Date.now()}_${i}`;

        const detCheck = runDeterministicValidation(q);
        if (!detCheck.valid) {
            q.validationStatus = 'INVALID';
            q.validationScore = 0;
            q.validationDetails = {
                reason: 'Failed deterministic validation',
                issues: detCheck.issues
            };
            validatedQuestions.push(q);
        } else {
            // Passed deterministic, queue for AI
            aiBatch.push(q);
        }
    }

    if (aiBatch.length === 0) {
        return validatedQuestions;
    }

    // ── 2. Batch AI Semantic Validation ──
    // Process in batches of 5 to avoid overwhelming the LLM and respect rate limits.
    const BATCH_SIZE = 5;
    for (let i = 0; i < aiBatch.length; i += BATCH_SIZE) {
        const currentBatch = aiBatch.slice(i, i + BATCH_SIZE);
        
        // Prepare simplified payload for LLM to save tokens
        const llmPayload = currentBatch.map(q => ({
            id: q._tempId,
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            expectedAnswer: q.expectedAnswer,
            keyConcepts: q.keyConcepts,
            questionType: q.questionType,
            difficulty: q.difficulty,
            curriculum: q.curriculumMeta
        }));

        try {
            const userPrompt = buildQuestionValidationPrompt(llmPayload);
            const aiResult = await groqService.call({
                userId: studentId || 'system',
                userRole: 'system',
                endpointName: 'validate-questions',
                model: GROQ_MODELS.ANALYSIS,
                systemPrompt: QUESTION_VALIDATION_SYSTEM_PROMPT,
                userPrompt,
                parseResponse: (content) => {
                    const validated = validateLLMOutput(content, 'question_validation_batch');
                    if (validated.success || validated.data) return validated.data;
                    throw new Error(`AI Batch validation JSON schema failed: ${validated.errors.join(', ')}`);
                }
            });

            const resultsMap = new Map();
            if (aiResult.data && Array.isArray(aiResult.data.results)) {
                for (const res of aiResult.data.results) {
                    resultsMap.set(res.id, res);
                }
            }

            // Map results back to the original objects
            for (const q of currentBatch) {
                const aiEval = resultsMap.get(q._tempId);
                if (!aiEval) {
                    // LLM forgot to return this ID. Fallback to REQUIRES_REVIEW.
                    q.validationStatus = 'REQUIRES_REVIEW';
                    q.validationScore = 0;
                    q.validationDetails = { reason: 'AI failed to return validation for this ID', issues: [] };
                } else {
                    // Calculate status based on strict thresholds
                    const isFullyAligned = (
                        aiEval.subjectMatch &&
                        aiEval.topicMatch &&
                        aiEval.subtopicMatch &&
                        aiEval.difficultyMatch &&
                        aiEval.answerCorrect &&
                        aiEval.optionsValid &&
                        !aiEval.duplicate
                    );

                    q.validationDetails = aiEval;
                    q.validationScore = aiEval.questionQuality || 0;

                    if (aiEval.valid && isFullyAligned && q.validationScore >= AI_QUALITY_THRESHOLD) {
                        q.validationStatus = 'VALID';
                    } else if (q.validationScore >= 0.70 && q.validationScore < AI_QUALITY_THRESHOLD) {
                        q.validationStatus = 'REQUIRES_REVIEW';
                    } else {
                        q.validationStatus = 'INVALID';
                    }
                }
                validatedQuestions.push(q);
            }
        } catch (err) {
            logger.warn('QuestionValidator: AI Batch validation failed. Marking batch as REQUIRES_REVIEW.', { error: err.message });
            // Fallback: If AI completely fails, we can't publish these safely.
            for (const q of currentBatch) {
                q.validationStatus = 'REQUIRES_REVIEW';
                q.validationScore = 0;
                q.validationDetails = { reason: `AI Exception: ${err.message}`, issues: [] };
                validatedQuestions.push(q);
            }
        }
    }

    return validatedQuestions;
}

module.exports = {
    runDeterministicValidation,
    validateQuestionsBatch
};
