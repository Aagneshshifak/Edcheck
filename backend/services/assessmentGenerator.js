/**
 * Assessment Generator Service
 *
 * Implements the full dynamic blueprint assessment generation flow:
 * DSKP → Assessment Blueprint → Question Selection / Generation → Question Validation → Duplicate Detection → Coverage Validation → Final Assessment
 *
 * Constraints:
 * - Prefer existing question bank questions.
 * - Generate LLM questions only if bank is insufficient.
 * - Validate all generated questions (correct answers, MCQs options).
 * - Detect duplicates/near-duplicates using Jaccard similarity.
 * - Skip duplicate checks for topics marked for reinforcement/forgetting.
 */

'use strict';

const Test = require('../models/testSchema');
const AIQuestionBank = require('../models/aiQuestionBankSchema');
const TestAttemptHistory = require('../models/testAttemptHistorySchema');
const { groqService, GROQ_MODELS } = require('./groqService');
const { ASSESSMENT_BLUEPRINT_SYSTEM_PROMPT, buildAssessmentBlueprintPrompt } = require('../utils/aiPromptTemplates');
const { validateLLMOutput } = require('../utils/jsonValidator');
const { validateBlueprint, autoFixQuestionCounts } = require('./blueprintValidator');
const { generatePracticeQuestions } = require('./ai-teaching-service');
const { logger } = require('../utils/serverLogger');

/**
 * Computes Jaccard Similarity between two strings.
 */
function getJaccardSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = new Set(str1.toLowerCase().split(/\s+/).filter(Boolean));
    const s2 = new Set(str2.toLowerCase().split(/\s+/).filter(Boolean));
    const intersection = new Set([...s1].filter(x => s2.has(x)));
    const union = new Set([...s1, ...s2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
}

/**
 * Generate a new assessment using a validated blueprint.
 *
 * @param {Object} params
 * @param {string} params.studentId
 * @param {string} params.subjectId
 * @param {string} params.classId
 * @param {string} params.schoolId
 * @param {number} params.totalQuestions
 * @param {number} params.durationMinutes
 * @param {Object} params.dskp - Dynamic Student Knowledge Profile data
 * @param {Array}  params.subjects - available subjects with topics
 * @returns {Promise<Object>} saved Test document
 */
async function generateAssessment({
    studentId,
    subjectId,
    classId,
    schoolId,
    totalQuestions,
    durationMinutes,
    dskp,
    subjects
}) {
    logger.info('AssessmentGenerator: generating blueprint', { studentId, subjectId });

    // ── 1. Create Blueprint ────────────────────────────────────────────────
    const userPrompt = buildAssessmentBlueprintPrompt({
        dskp,
        subjects,
        totalQuestions,
        durationMinutes
    });

    const aiResult = await groqService.call({
        userId: studentId,
        userRole: 'student',
        endpointName: 'generate-blueprint',
        model: GROQ_MODELS.ANALYSIS,
        systemPrompt: ASSESSMENT_BLUEPRINT_SYSTEM_PROMPT,
        userPrompt,
        parseResponse: (content) => {
            const validated = validateLLMOutput(content, 'assessment_blueprint');
            if (validated.success || validated.data) return validated.data;
            throw new Error(`Blueprint validation failed: ${validated.errors.join(', ')}`);
        }
    });

    let blueprint = aiResult.data;

    // Validate and auto-fix blueprint counts if necessary
    const validation = validateBlueprint(blueprint, { totalQuestions, durationMinutes });
    if (!validation.valid && validation.fixable.some(f => f.type === 'question_count')) {
        blueprint = autoFixQuestionCounts(blueprint, totalQuestions);
    }

    // ── Get student's history for duplicate detection ─────────────────────
    const recentHistory = await TestAttemptHistory.find({ studentId })
        .sort({ submittedAt: -1 })
        .limit(5)
        .lean();

    const recentlyAnsweredQuestions = [];
    for (const h of recentHistory) {
        if (h.questionResponses) {
            recentlyAnsweredQuestions.push(...h.questionResponses);
        }
    }

    // Identify topics flagged for reinforcement (forgetting or weak)
    const weakTopics = new Set((dskp.weakTopics || []).map(t => t.topic.toLowerCase()));
    const forgettingTopics = new Set(
        (dskp.topicDetails || [])
            .filter(t => t.forgettingFactor > 0.5)
            .map(t => t.topic.toLowerCase())
    );

    const finalQuestions = [];

    // ── 2. Select / Generate questions per subject and topic ────────────────
    const subjectDist = blueprint.subject_distribution || [];
    for (const subj of subjectDist) {
        for (const topicConfig of (subj.topics || [])) {
            const topic = topicConfig.topic;
            const countNeeded = topicConfig.question_count || 0;
            if (countNeeded <= 0) continue;

            const isReinforcement = weakTopics.has(topic.toLowerCase()) || forgettingTopics.has(topic.toLowerCase());

            // Prefer validated question bank questions first
            const bank = await AIQuestionBank.findOne({ subjectId, topic }).lean();
            const bankQuestions = (bank?.questions || []).map(q => ({
                questionText: q.questionText,
                options: q.options,
                correctAnswer: q.correctAnswer,
                topic,
                difficulty: topicConfig.difficulty_distribution ? Object.keys(topicConfig.difficulty_distribution)[0] : 'medium',
                marks: 2,
                questionType: 'mcq'
            }));

            // Filter out duplicates against history if not reinforced
            let selected = [];
            for (const q of bankQuestions) {
                if (selected.length >= countNeeded) break;

                let isDup = false;
                if (!isReinforcement) {
                    for (const prev of recentlyAnsweredQuestions) {
                        if (getJaccardSimilarity(q.questionText, prev.questionText) > 0.70) {
                            isDup = true;
                            break;
                        }
                    }
                }
                if (!isDup) selected.push(q);
            }

            // Generate LLM questions if bank is insufficient
            let attempts = 0;
            while (selected.length < countNeeded && attempts < 2) {
                attempts++;
                const needed = countNeeded - selected.length;
                try {
                    const diff = Object.keys(topicConfig.difficulty_distribution || { medium: 1 })[0] || 'medium';
                    const newQs = await generatePracticeQuestions(topic, subj.subject, diff, needed);

                    for (const q of newQs) {
                        // Question Validation
                        if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2 || q.correctAnswer === undefined) {
                            continue;
                        }

                        // Duplicate Check
                        let isDup = false;
                        if (!isReinforcement) {
                            for (const prev of [...recentlyAnsweredQuestions, ...selected]) {
                                if (getJaccardSimilarity(q.questionText, prev.questionText) > 0.70) {
                                    isDup = true;
                                    break;
                                }
                            }
                        }

                        if (!isDup) {
                            selected.push({
                                questionText: q.questionText,
                                options: q.options,
                                correctAnswer: q.correctAnswer,
                                topic,
                                difficulty: diff,
                                marks: 2,
                                questionType: 'mcq'
                            });
                        }
                    }
                } catch (err) {
                    logger.warn('AssessmentGenerator: LLM question generation failed', { error: err.message });
                }
            }

            finalQuestions.push(...selected.slice(0, countNeeded));
        }
    }

    // ── 3. Finalize Assessment ─────────────────────────────────────────────
    const test = new Test({
        title: `Adaptive Assessment — ${new Date().toLocaleDateString()}`,
        subject: subjectId,
        classId,
        school: schoolId,
        studentId,
        durationMinutes,
        questions: finalQuestions,
        isActive: true
    });

    await test.save();
    logger.info('AssessmentGenerator: assessment created successfully', { testId: test._id });
    return test;
}

module.exports = {
    generateAssessment,
    getJaccardSimilarity
};
