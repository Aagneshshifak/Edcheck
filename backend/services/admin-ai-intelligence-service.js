/**
 * Admin AI Intelligence Service
 *
 * Stateless service module — no direct MongoDB access.
 * All required data is passed in by the controller or scheduler.
 *
 * Provides prompt builders and response parsers for five AI analysis types:
 *   1. Student failure-risk prediction
 *   2. Class performance analysis
 *   3. Teacher effectiveness analysis
 *   4. School-wide performance summary
 *   5. Strategic recommendation engine
 */

// ── Input Sanitisation ────────────────────────────────────────────────────────

/**
 * Recursively truncate all string fields in an object to max 500 characters.
 * Non-string fields are left unchanged.
 *
 * @param {*} obj - Any value (object, array, primitive)
 * @returns {*} Sanitised copy
 */
function sanitiseForGroq(obj) {
    if (typeof obj === 'string') {
        return obj.slice(0, 500);
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitiseForGroq);
    }
    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const key of Object.keys(obj)) {
            result[key] = sanitiseForGroq(obj[key]);
        }
        return result;
    }
    return obj;
}

// ── Student Risk ──────────────────────────────────────────────────────────────

/**
 * Build Groq prompt for student failure-risk prediction.
 *
 * @param {Array<{ studentId, name, attendancePct, assignmentCompletionRate, lastFiveScores }>} studentsData
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildStudentRiskPrompt(studentsData) {
    const systemPrompt = `You are an educational data analyst specialising in student risk assessment.
Analyse the provided student academic data and predict failure risk for each student.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "students": [
    {
      "studentId": "string",
      "riskLevel": "Low" | "Medium" | "High",
      "weakSubjects": ["string"],
      "suggestedActions": ["string"]
    }
  ]
}`;

    const userPrompt = `Analyse the following student data and return a risk assessment for each student.
For each student, provide:
- "studentId": the student's ID (string, unchanged from input)
- "riskLevel": one of "Low", "Medium", or "High" based on attendance, scores, and completion rate
- "weakSubjects": array of subject names where the student is struggling
- "suggestedActions": array of concrete intervention actions for the teacher/admin

Student data:
${JSON.stringify(studentsData, null, 2)}`;

    return { systemPrompt, userPrompt };
}

/**
 * Parse and validate Groq response for student risk prediction.
 *
 * @param {string} content - Raw string from Groq
 * @returns {Array<{ studentId, riskLevel, weakSubjects, suggestedActions }>}
 * @throws {Error} If response format is invalid
 */
function parseStudentRiskResponse(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (!parsed || !Array.isArray(parsed.students)) {
        throw new Error('AI returned an unexpected response format');
    }

    const validRiskLevels = new Set(['Low', 'Medium', 'High']);

    for (const item of parsed.students) {
        if (
            typeof item.studentId !== 'string' ||
            !validRiskLevels.has(item.riskLevel) ||
            !Array.isArray(item.weakSubjects) ||
            !Array.isArray(item.suggestedActions)
        ) {
            throw new Error('AI returned an unexpected response format');
        }
    }

    return parsed.students;
}

// ── Class Performance ─────────────────────────────────────────────────────────

/**
 * Build Groq prompt for class performance analysis.
 *
 * @param {{ classId, className, avgScoresBySubject, attendanceRates, assignmentCompletionRate }} classData
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildClassPerformancePrompt(classData) {
    const systemPrompt = `You are an educational data analyst specialising in class performance evaluation.
Analyse the provided class academic data and generate a performance report.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "averageScore": number,
  "weakSubjects": ["string"],
  "recommendations": ["string"]
}`;

    const userPrompt = `Analyse the following class data and return a performance report.
Provide:
- "averageScore": overall class average score (0–100, number)
- "weakSubjects": array of subject names where the class is underperforming
- "recommendations": array of actionable recommendations to improve class performance

Class data:
${JSON.stringify(classData, null, 2)}`;

    return { systemPrompt, userPrompt };
}

/**
 * Parse and validate Groq response for class performance analysis.
 *
 * @param {string} content - Raw string from Groq
 * @returns {{ averageScore: number, weakSubjects: string[], recommendations: string[] }}
 * @throws {Error} If response format is invalid
 */
function parseClassPerformanceResponse(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (
        !parsed ||
        typeof parsed.averageScore !== 'number' ||
        !Array.isArray(parsed.weakSubjects) ||
        !Array.isArray(parsed.recommendations)
    ) {
        throw new Error('AI returned an unexpected response format');
    }

    return {
        averageScore: parsed.averageScore,
        weakSubjects: parsed.weakSubjects,
        recommendations: parsed.recommendations,
    };
}

// ── Teacher Performance ───────────────────────────────────────────────────────

/**
 * Build Groq prompt for teacher performance analysis.
 *
 * @param {{ teacherId, name, subjectResults, improvementTrends, gradingPatterns }} teacherData
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildTeacherPerformancePrompt(teacherData) {
    const systemPrompt = `You are an educational data analyst specialising in teacher effectiveness evaluation.
Analyse the provided teacher data and generate a performance report.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "performanceScore": number,
  "subjectPerformanceTrend": "string",
  "recommendations": ["string"]
}`;

    const userPrompt = `Analyse the following teacher data and return a performance report.
Provide:
- "performanceScore": overall teacher effectiveness score (0–100, number)
- "subjectPerformanceTrend": a descriptive string summarising the trend in student performance across the teacher's subjects
- "recommendations": array of actionable recommendations to help the teacher improve

Teacher data:
${JSON.stringify(teacherData, null, 2)}`;

    return { systemPrompt, userPrompt };
}

/**
 * Parse and validate Groq response for teacher performance analysis.
 *
 * @param {string} content - Raw string from Groq
 * @returns {{ performanceScore: number, subjectPerformanceTrend: string, recommendations: string[] }}
 * @throws {Error} If response format is invalid
 */
function parseTeacherPerformanceResponse(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (
        !parsed ||
        typeof parsed.performanceScore !== 'number' ||
        parsed.performanceScore < 0 ||
        parsed.performanceScore > 100 ||
        typeof parsed.subjectPerformanceTrend !== 'string' ||
        !Array.isArray(parsed.recommendations)
    ) {
        throw new Error('AI returned an unexpected response format');
    }

    return {
        performanceScore: parsed.performanceScore,
        subjectPerformanceTrend: parsed.subjectPerformanceTrend,
        recommendations: parsed.recommendations,
    };
}

// ── School Summary ────────────────────────────────────────────────────────────

/**
 * Build Groq prompt for school-wide performance summary.
 *
 * @param {{ schoolId, classAverages, subjectAverages, attendanceTrend30d }} schoolData
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildSchoolSummaryPrompt(schoolData) {
    const systemPrompt = `You are an educational data analyst specialising in school-wide performance evaluation.
Analyse the provided school data and generate a comprehensive performance summary.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "overallAverageScore": number,
  "topClasses": ["string"],
  "weakSubjects": ["string"],
  "academicTrend": "string"
}`;

    const userPrompt = `Analyse the following school-wide data and return a performance summary.
Provide:
- "overallAverageScore": school-wide average score across all classes (0–100, number)
- "topClasses": array of class names that are performing best
- "weakSubjects": array of subject names where the school is underperforming
- "academicTrend": a descriptive string summarising the overall academic trend (e.g. improving, declining, stable)

School data:
${JSON.stringify(schoolData, null, 2)}`;

    return { systemPrompt, userPrompt };
}

/**
 * Parse and validate Groq response for school performance summary.
 *
 * @param {string} content - Raw string from Groq
 * @returns {{ overallAverageScore: number, topClasses: string[], weakSubjects: string[], academicTrend: string }}
 * @throws {Error} If response format is invalid
 */
function parseSchoolSummaryResponse(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (
        !parsed ||
        typeof parsed.overallAverageScore !== 'number' ||
        !Array.isArray(parsed.topClasses) ||
        !Array.isArray(parsed.weakSubjects) ||
        typeof parsed.academicTrend !== 'string'
    ) {
        throw new Error('AI returned an unexpected response format');
    }

    return {
        overallAverageScore: parsed.overallAverageScore,
        topClasses: parsed.topClasses,
        weakSubjects: parsed.weakSubjects,
        academicTrend: parsed.academicTrend,
    };
}

// ── Recommendations ───────────────────────────────────────────────────────────

/**
 * Build Groq prompt for strategic recommendations.
 *
 * @param {{ riskProfiles, classReports, teacherReports, schoolReport }} reportsData
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
function buildRecommendationsPrompt(reportsData) {
    const systemPrompt = `You are an educational strategy consultant helping school administrators improve academic outcomes.
Analyse the provided AI-generated reports and generate strategic recommendations.
Respond ONLY with valid JSON matching this exact schema — no markdown, no explanation:
{
  "recommendations": [
    {
      "title": "string",
      "description": "string",
      "priority": "High" | "Medium" | "Low"
    }
  ]
}`;

    const userPrompt = `Based on the following AI-generated school reports, provide strategic recommendations.
For each recommendation, provide:
- "title": a short, actionable title (string)
- "description": a detailed description of the recommended action (string)
- "priority": one of "High", "Medium", or "Low" based on urgency and impact

Reports data:
${JSON.stringify(reportsData, null, 2)}`;

    return { systemPrompt, userPrompt };
}

/**
 * Parse and validate Groq response for strategic recommendations.
 *
 * @param {string} content - Raw string from Groq
 * @returns {Array<{ title: string, description: string, priority: string }>}
 * @throws {Error} If response format is invalid
 */
function parseRecommendationsResponse(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (!parsed || !Array.isArray(parsed.recommendations)) {
        throw new Error('AI returned an unexpected response format');
    }

    const validPriorities = new Set(['High', 'Medium', 'Low']);

    for (const item of parsed.recommendations) {
        if (
            typeof item.title !== 'string' ||
            typeof item.description !== 'string' ||
            !validPriorities.has(item.priority)
        ) {
            throw new Error('AI returned an unexpected response format');
        }
    }

    return parsed.recommendations;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    sanitiseForGroq,
    buildStudentRiskPrompt,
    parseStudentRiskResponse,
    buildClassPerformancePrompt,
    parseClassPerformanceResponse,
    buildTeacherPerformancePrompt,
    parseTeacherPerformanceResponse,
    buildSchoolSummaryPrompt,
    parseSchoolSummaryResponse,
    buildRecommendationsPrompt,
    parseRecommendationsResponse,
};
