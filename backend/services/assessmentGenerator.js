/**
 * Assessment Generator Service
 *
 * Implements the full dynamic blueprint assessment generation flow:
 * Curriculum Validation -> Blueprint -> Question Gen -> Batch AI Validation -> Dup Check -> Coverage Check -> Save
 */

'use strict';

const Test = require('../models/testSchema');
const AIQuestionBank = require('../models/aiQuestionBankSchema');
const TestAttemptHistory = require('../models/testAttemptHistorySchema');
const Curriculum = require('../models/curriculumSchema');
const { groqService, GROQ_MODELS } = require('./groqService');
const { ASSESSMENT_BLUEPRINT_SYSTEM_PROMPT, buildAssessmentBlueprintPrompt } = require('../utils/aiPromptTemplates');
const { validateLLMOutput } = require('../utils/jsonValidator');
const { validateBlueprint, autoFixQuestionCounts } = require('./blueprintValidator');
const { generatePracticeQuestions } = require('./ai-teaching-service');
const { validateQuestionsBatch } = require('./questionValidator');
const { validateTestCoverageAndDuplicates } = require('./testCoverageValidator');
const { logger } = require('../utils/serverLogger');

/**
 * Generate a new assessment using a validated blueprint.
 *
 * @param {Object} params
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

    // ── 0. Strict Curriculum Validation ────────────────────────────────────
    const curriculumSubject = subjects.find(s => s._id.toString() === subjectId.toString());
    if (!curriculumSubject) throw new Error('Subject not found');

    const classCurriculum = await Curriculum.find({
        classLevel: curriculumSubject.classLevel, // assuming this exists in mapping
        subject: curriculumSubject.name
    }).lean();

    if (!classCurriculum || classCurriculum.length === 0) {
        logger.error('AssessmentGenerator: No strictly defined curriculum found', { classLevel: curriculumSubject.classLevel, subject: curriculumSubject.name });
        throw new Error('Curriculum missing. Admin must configure curriculum before generating assessments.');
    }

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
    const validation = validateBlueprint(blueprint, { totalQuestions, durationMinutes });
    if (!validation.valid && validation.fixable.some(f => f.type === 'question_count')) {
        blueprint = autoFixQuestionCounts(blueprint, totalQuestions);
    }

    // ── 2. Select / Generate questions ───────────────────────────────────────
    let allGeneratedQuestions = [];

    const subjectDist = blueprint.subject_distribution || [];
    for (const subj of subjectDist) {
        for (const topicConfig of (subj.topics || [])) {
            const topicName = topicConfig.topic; // Chapter/Topic Name
            const countNeeded = topicConfig.question_count || 0;
            if (countNeeded <= 0) continue;

            const diff = Object.keys(topicConfig.difficulty_distribution || { medium: 1 })[0] || 'medium';

            // Find matching curriculum config
            const currConfig = classCurriculum.find(c => c.chapter.toLowerCase() === topicName.toLowerCase());
            const domainName = currConfig ? currConfig.domain : subj.subject;
            
            let questionsForTopic = [];
            let attempts = 0;
            const MAX_RETRIES = 3;

            while (questionsForTopic.length < countNeeded && attempts < MAX_RETRIES) {
                attempts++;
                const needed = countNeeded - questionsForTopic.length;
                
                let batch = [];
                try {
                    const newQs = await generatePracticeQuestions(topicName, subj.subject, diff, needed);
                    batch = newQs.map((q, idx) => ({
                        questionText: q.questionText,
                        options: q.options,
                        correctAnswer: q.correctAnswer,
                        explanation: q.explanation,
                        topic: topicName,
                        difficulty: diff,
                        marks: 2,
                        questionType: 'mcq',
                        source: 'AI_GENERATED',
                        curriculumMeta: {
                            classId,
                            subjectId,
                            domain: domainName,
                            chapter: topicName,
                            subtopic: q.subtopic || 'General',
                            source: 'CBSE'
                        },
                        _tempId: `gen_${Date.now()}_${idx}`
                    }));
                } catch (err) {
                    logger.warn('AssessmentGenerator: LLM generation failed', { error: err.message });
                    continue;
                }

                // ── 3. Validate Batch ───────────────────────────────────────
                const validatedBatch = await validateQuestionsBatch(batch, studentId);
                
                for (const vq of validatedBatch) {
                    if (vq.validationStatus === 'VALID' || vq.validationStatus === 'REQUIRES_REVIEW') {
                        questionsForTopic.push(vq);
                    }
                    if (questionsForTopic.length === countNeeded) break;
                }
            }
            allGeneratedQuestions.push(...questionsForTopic);
        }
    }

    // ── 4. Final Coverage & Duplicate Checks ───────────────────────────────
    const coverageResult = await validateTestCoverageAndDuplicates(blueprint, allGeneratedQuestions, totalQuestions);

    const testStatus = coverageResult.isTestValid ? 'PUBLISHED' : 'REQUIRES_REVIEW';

    // ── 5. Finalize Assessment ─────────────────────────────────────────────
    const test = new Test({
        title: `Adaptive Assessment — ${new Date().toLocaleDateString()}`,
        subject: subjectId,
        classId,
        school: schoolId,
        studentId,
        durationMinutes,
        questions: coverageResult.finalQuestions,
        status: testStatus,
        validationMetadata: coverageResult.meta,
        isActive: true
    });

    await test.save();
    logger.info('AssessmentGenerator: assessment created successfully', { testId: test._id, status: testStatus });
    return test;
}

module.exports = {
    generateAssessment
};
