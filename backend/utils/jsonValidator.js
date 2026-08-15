/**
 * JSON Validator for LLM Outputs
 *
 * Validates, repairs, and retries malformed LLM JSON responses.
 * Ensures no invalid AI output is persisted to MongoDB.
 *
 * Validation flow:
 *   1. Parse raw JSON string
 *   2. Validate against schema (required fields + types)
 *   3. If invalid → attempt safe repair (defaults, coercion)
 *   4. If still invalid → signal retry needed
 *   5. Never store malformed AI output
 *
 * Schemas:
 *   A. StudentAnalysisSchema
 *   B. StudyPlanSchema
 *   C. StaffReportSchema
 *   D. AssessmentBlueprintSchema
 */

'use strict';

const { logger } = require('./serverLogger');

// ── Schema definitions ────────────────────────────────────────────────────────

/**
 * Each schema entry: { field, type, required, default, arrayItemType }
 * type: 'string' | 'number' | 'boolean' | 'array' | 'object'
 */

const STUDENT_ANALYSIS_FIELDS = [
    { field: 'overall_status',         type: 'string',  required: true,  default: 'adequate' },
    { field: 'overall_summary',        type: 'string',  required: true,  default: '' },
    { field: 'strengths',              type: 'array',   required: true,  default: [] },
    { field: 'weaknesses',             type: 'array',   required: true,  default: [] },
    { field: 'improving_topics',       type: 'array',   required: false, default: [] },
    { field: 'declining_topics',       type: 'array',   required: false, default: [] },
    { field: 'retention_risks',        type: 'array',   required: false, default: [] },
    { field: 'confidence_insights',    type: 'array',   required: false, default: [] },
    { field: 'difficulty_analysis',    type: 'object',  required: false, default: {} },
    { field: 'learning_trend',         type: 'object',  required: false, default: {} },
    { field: 'key_patterns',           type: 'array',   required: false, default: [] },
    { field: 'recommended_actions',    type: 'array',   required: true,  default: [] },
    { field: 'study_priorities',       type: 'array',   required: false, default: [] },
    { field: 'recommended_next_difficulty', type: 'string', required: false, default: 'medium' },
    { field: 'readiness_assessment',   type: 'object',  required: false, default: {} },
];

const STUDY_PLAN_FIELDS = [
    { field: 'summary',                type: 'string',  required: true,  default: '' },
    { field: 'totalWeeks',             type: 'number',  required: true,  default: 2 },
    { field: 'estimatedHours',         type: 'number',  required: false, default: 0 },
    { field: 'immediate_priorities',   type: 'array',   required: true,  default: [] },
    { field: 'short_term_revision',    type: 'array',   required: false, default: [] },
    { field: 'practice_activities',    type: 'array',   required: false, default: [] },
    { field: 'reinforcement_activities', type: 'array', required: false, default: [] },
    { field: 'assessment_preparation', type: 'array',   required: false, default: [] },
    { field: 'dailySchedule',         type: 'array',   required: false, default: [] },
    { field: 'revisionOrder',         type: 'array',   required: true,  default: [] },
    { field: 'practiceRecommendations', type: 'array',  required: false, default: [] },
    { field: 'motivationTips',         type: 'array',   required: false, default: [] },
    { field: 'completionTimeline',     type: 'string',  required: false, default: 'Not specified' },
    { field: 'prerequisite_warnings',  type: 'array',   required: false, default: [] },
    // Backward compatibility with old schema
    { field: 'topicPriority',          type: 'array',   required: false, default: [] },
];

const STAFF_REPORT_FIELDS = [
    { field: 'report_type',            type: 'string',  required: true,  default: 'post_assessment' },
    { field: 'overall_performance',    type: 'object',  required: true,  default: {} },
    { field: 'subject_performance',    type: 'array',   required: false, default: [] },
    { field: 'topic_analysis',         type: 'object',  required: true,  default: {} },
    { field: 'confidence_analysis',    type: 'object',  required: false, default: {} },
    { field: 'learning_trend',         type: 'object',  required: false, default: {} },
    { field: 'difficulty_recommendation', type: 'object', required: false, default: {} },
    { field: 'immediate_intervention_required', type: 'boolean', required: true, default: false },
    { field: 'intervention_details',   type: 'string',  required: false, default: '' },
    { field: 'recommended_teacher_actions', type: 'array', required: true, default: [] },
    { field: 'recommended_student_actions', type: 'array', required: false, default: [] },
    { field: 'next_assessment_recommendation', type: 'object', required: false, default: {} },
];

const ASSESSMENT_BLUEPRINT_FIELDS = [
    { field: 'total_questions',        type: 'number',  required: true,  default: 10 },
    { field: 'total_marks',            type: 'number',  required: false, default: 0 },
    { field: 'duration_minutes',       type: 'number',  required: false, default: 30 },
    { field: 'subject_distribution',   type: 'array',   required: true,  default: [] },
    { field: 'adaptive_rationale',     type: 'object',  required: false, default: {} },
];

// ── Core validation logic ─────────────────────────────────────────────────────

/**
 * Parse raw string to JSON, stripping markdown code fences if present.
 *
 * @param {string} raw — raw LLM output
 * @returns {Object} parsed JSON
 * @throws {SyntaxError} if unparseable
 */
function parseRawJSON(raw) {
    if (!raw || typeof raw !== 'string') {
        throw new SyntaxError('Empty or non-string input');
    }

    // Strip markdown code fences
    let clean = raw
        .replace(/^```(?:json)?\s*/im, '')
        .replace(/\s*```\s*$/im, '')
        .trim();

    // Sometimes the LLM wraps the response in extra text before/after the JSON
    // Try to extract the JSON object
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        clean = clean.substring(firstBrace, lastBrace + 1);
    }

    return JSON.parse(clean);
}

/**
 * Validate and repair a parsed object against a field schema.
 *
 * @param {Object} parsed — parsed JSON object
 * @param {Array} fieldSchema — array of field definitions
 * @returns {{ valid: boolean, repaired: Object, errors: string[] }}
 */
function validateAndRepair(parsed, fieldSchema) {
    const errors = [];
    const repaired = { ...parsed };

    for (const { field, type, required, default: defaultVal } of fieldSchema) {
        const value = repaired[field];

        // Missing field
        if (value === undefined || value === null) {
            if (required) {
                errors.push(`Missing required field: ${field}`);
            }
            repaired[field] = defaultVal;
            continue;
        }

        // Type check and coercion
        switch (type) {
            case 'string':
                if (typeof value !== 'string') {
                    repaired[field] = String(value);
                    errors.push(`Field ${field}: coerced to string`);
                }
                break;

            case 'number':
                if (typeof value !== 'number') {
                    const num = Number(value);
                    if (isNaN(num)) {
                        repaired[field] = defaultVal;
                        errors.push(`Field ${field}: invalid number, using default`);
                    } else {
                        repaired[field] = num;
                    }
                }
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    repaired[field] = Boolean(value);
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    repaired[field] = defaultVal;
                    errors.push(`Field ${field}: expected array, using default`);
                }
                break;

            case 'object':
                if (typeof value !== 'object' || Array.isArray(value)) {
                    repaired[field] = defaultVal;
                    errors.push(`Field ${field}: expected object, using default`);
                }
                break;
        }
    }

    // Count critical errors (missing required fields that couldn't be defaulted meaningfully)
    const criticalErrors = errors.filter(e => e.startsWith('Missing required'));
    const valid = criticalErrors.length === 0;

    return { valid, repaired, errors };
}

// ── Public API: schema-specific validators ────────────────────────────────────

/**
 * Validate a student analysis response.
 *
 * @param {string} raw — raw LLM output string
 * @returns {{ valid: boolean, data: Object|null, errors: string[] }}
 */
function validateStudentAnalysis(raw) {
    try {
        const parsed = parseRawJSON(raw);
        const result = validateAndRepair(parsed, STUDENT_ANALYSIS_FIELDS);
        return { valid: result.valid, data: result.repaired, errors: result.errors };
    } catch (err) {
        return { valid: false, data: null, errors: [`Parse error: ${err.message}`] };
    }
}

/**
 * Validate a study plan response.
 *
 * @param {string} raw — raw LLM output string
 * @returns {{ valid: boolean, data: Object|null, errors: string[] }}
 */
function validateStudyPlan(raw) {
    try {
        const parsed = parseRawJSON(raw);
        const result = validateAndRepair(parsed, STUDY_PLAN_FIELDS);
        return { valid: result.valid, data: result.repaired, errors: result.errors };
    } catch (err) {
        return { valid: false, data: null, errors: [`Parse error: ${err.message}`] };
    }
}

/**
 * Validate a staff report response.
 *
 * @param {string} raw — raw LLM output string
 * @returns {{ valid: boolean, data: Object|null, errors: string[] }}
 */
function validateStaffReport(raw) {
    try {
        const parsed = parseRawJSON(raw);
        const result = validateAndRepair(parsed, STAFF_REPORT_FIELDS);
        return { valid: result.valid, data: result.repaired, errors: result.errors };
    } catch (err) {
        return { valid: false, data: null, errors: [`Parse error: ${err.message}`] };
    }
}

/**
 * Validate an assessment blueprint response.
 *
 * @param {string} raw — raw LLM output string
 * @returns {{ valid: boolean, data: Object|null, errors: string[] }}
 */
function validateAssessmentBlueprint(raw) {
    try {
        const parsed = parseRawJSON(raw);
        const result = validateAndRepair(parsed, ASSESSMENT_BLUEPRINT_FIELDS);
        return { valid: result.valid, data: result.repaired, errors: result.errors };
    } catch (err) {
        return { valid: false, data: null, errors: [`Parse error: ${err.message}`] };
    }
}

/**
 * Wrapper that attempts validation, repair, and signals whether retry is needed.
 *
 * @param {string} raw — raw LLM output
 * @param {string} schemaType — 'student_analysis' | 'study_plan' | 'staff_report' | 'assessment_blueprint'
 * @returns {{ success: boolean, data: Object|null, errors: string[], needsRetry: boolean }}
 */
function validateLLMOutput(raw, schemaType) {
    const validators = {
        student_analysis:      validateStudentAnalysis,
        study_plan:            validateStudyPlan,
        staff_report:          validateStaffReport,
        assessment_blueprint:  validateAssessmentBlueprint,
    };

    const validator = validators[schemaType];
    if (!validator) {
        return { success: false, data: null, errors: [`Unknown schema type: ${schemaType}`], needsRetry: false };
    }

    const result = validator(raw);

    if (result.valid && result.data) {
        if (result.errors.length > 0) {
            logger.warn(`jsonValidator: ${schemaType} had minor issues (repaired)`, { errors: result.errors });
        }
        return { success: true, data: result.data, errors: result.errors, needsRetry: false };
    }

    // Parse succeeded but validation failed — retry
    if (result.data) {
        logger.warn(`jsonValidator: ${schemaType} validation failed, repairable`, { errors: result.errors });
        return { success: false, data: result.data, errors: result.errors, needsRetry: true };
    }

    // Parse failed entirely — retry
    logger.warn(`jsonValidator: ${schemaType} parse failed entirely`, { errors: result.errors });
    return { success: false, data: null, errors: result.errors, needsRetry: true };
}

module.exports = {
    parseRawJSON,
    validateAndRepair,
    validateStudentAnalysis,
    validateStudyPlan,
    validateStaffReport,
    validateAssessmentBlueprint,
    validateLLMOutput,
};
