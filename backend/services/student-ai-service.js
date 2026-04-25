/**
 * Student AI Service
 * Uses Groq llama-3.3-70b-versatile for all student AI features.
 */
const { groq } = require('../config/groq');
const MODEL = 'llama-3.3-70b-versatile';

async function callGroq(systemPrompt, userPrompt) {
    const response = await groq.chat.completions.create({
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
        ],
    });
    const content = response.choices?.[0]?.message?.content ?? '';
    // Strip markdown code fences if present
    const clean = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
        return JSON.parse(clean);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }
}

// ── 1. Class Notes ────────────────────────────────────────────────────────────
async function generateClassNotes(subjectName, topic) {
    const system = `You are an expert teacher creating student-friendly class notes.
Respond ONLY with valid JSON matching:
{
  "explanation": string,
  "keyConcepts": string[],
  "examples": string[],
  "formulas": string[],
  "commonMistakes": string[],
  "summary": string
}`;
    const user = `Subject: ${subjectName}\nTopic: ${topic}\n\nGenerate comprehensive, student-friendly notes.`;
    return callGroq(system, user);
}

// ── 2. Study Plan ─────────────────────────────────────────────────────────────
async function generateStudyPlan(studentData) {
    const system = `You are an academic advisor creating personalized study plans.
Respond ONLY with valid JSON matching:
{
  "weakSubjectFocus": [{ "subject": string, "hoursPerDay": number, "priority": "high"|"medium"|"low" }],
  "dailyRevisionHours": number,
  "topicPriorities": string[],
  "subjectImprovementPlan": [{ "subject": string, "strategy": string }],
  "weeklySchedule": { "monday": string, "tuesday": string, "wednesday": string, "thursday": string, "friday": string, "saturday": string, "sunday": string }
}`;
    const user = `Student Performance Data:\n${JSON.stringify(studentData, null, 2)}\n\nCreate a personalized study plan.`;
    return callGroq(system, user);
}

// ── 3. Daily Routine ──────────────────────────────────────────────────────────
async function generateDailyRoutine(routineData) {
    const system = `You are a lifestyle coach creating balanced daily routines for students.
Respond ONLY with valid JSON matching:
{
  "wakeUpTime": string,
  "schedule": [{ "time": string, "activity": string, "duration": string, "category": "school"|"study"|"break"|"exercise"|"meal"|"sleep" }],
  "sleepTime": string,
  "totalStudyHours": number,
  "healthTips": string[]
}`;
    const user = `Student Data:\n${JSON.stringify(routineData, null, 2)}\n\nCreate a balanced daily routine including sleep cycle.`;
    return callGroq(system, user);
}

// ── 4. Test Preparation ───────────────────────────────────────────────────────
async function generateTestPrep(testData) {
    const system = `You are a test preparation expert.
Respond ONLY with valid JSON matching:
{
  "importantTopics": [{ "topic": string, "estimatedDifficulty": "easy"|"medium"|"hard", "weightage": string }],
  "revisionSequence": string[],
  "practiceSchedule": [{ "day": string, "topics": string[], "hours": number }],
  "quickTips": string[]
}`;
    const user = `Test Data:\n${JSON.stringify(testData, null, 2)}\n\nCreate a test preparation guide.`;
    return callGroq(system, user);
}

// ── 5. Assignment Help ────────────────────────────────────────────────────────
async function generateAssignmentHelp(question) {
    const system = `You are a helpful tutor explaining solutions step by step.
Respond ONLY with valid JSON matching:
{
  "steps": string[],
  "logic": string,
  "finalAnswer": string
}`;
    const user = `Question: ${String(question).trim().slice(0, 1000)}\n\nProvide a clear step-by-step explanation.`;
    return callGroq(system, user);
}

module.exports = {
    generateClassNotes,
    generateStudyPlan,
    generateDailyRoutine,
    generateTestPrep,
    generateAssignmentHelp,
};
