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
    const system = `You are an expert academic advisor creating highly detailed, personalized study plans for school students.
You MUST use ONLY the exact subject names provided in the student data. NEVER invent subject names like "Subject 1" or "Subject 2".
If no exam data exists for a subject, treat it as needing balanced attention.

Respond ONLY with valid JSON matching this exact schema:
{
  "weakSubjectFocus": [{ "subject": string, "hoursPerDay": number, "priority": "high"|"medium"|"low", "reason": string, "specificTopics": string[] }],
  "dailyRevisionHours": number,
  "topicPriorities": string[],
  "subjectImprovementPlan": [{ "subject": string, "currentScore": number, "targetScore": number, "strategy": string, "dailyActions": string[] }],
  "weeklySchedule": {
    "monday": string, "tuesday": string, "wednesday": string,
    "thursday": string, "friday": string, "saturday": string, "sunday": string
  },
  "motivationalTip": string
}

Rules:
- Use ONLY the exact subject names from allSubjects list
- Assign more hours to weak subjects (score < 60%)
- Each weekday entry should name specific subjects to study that day
- dailyActions should be concrete (e.g. "Solve 10 algebra problems", "Read chapter 3")`;

    const user = `Student: ${studentData.name}
Attendance: ${studentData.attendancePercentage}%
Average Test Score: ${studentData.averageTestScore}%

ALL SUBJECTS IN CLASS: ${studentData.allSubjects?.join(', ') || 'Not available'}

Subject Performance:
${JSON.stringify(studentData.subjectPerformance, null, 2)}

Recent Test Results:
${JSON.stringify(studentData.recentTestResults, null, 2)}

Weak Subjects (score < 60%): ${studentData.weakSubjects?.join(', ') || 'None identified yet'}
Average Subjects (60-70%): ${studentData.averageSubjects?.join(', ') || 'None'}
Strong Subjects (>70%): ${studentData.strongSubjects?.join(', ') || 'None'}
Subjects with no test data yet: ${studentData.noDataSubjects?.join(', ') || 'None'}

Create a detailed personalized study plan using ONLY the subject names listed above.`;
    return callGroq(system, user);
}

// ── 3. Daily Routine ──────────────────────────────────────────────────────────

/**
 * Builds the weak topics section string for the routine prompt.
 * Exported as a pure helper to enable unit/property testing without calling Groq.
 *
 * @param {Object} weakTopicsPerSubject - Map of subject name → string[]
 * @returns {string} Formatted multi-line section for inclusion in the user prompt
 */
function buildRoutineTopicsSection(weakTopicsPerSubject) {
    const entries = Object.entries(weakTopicsPerSubject || {});
    if (entries.length === 0) {
        return `Weak Topics Per Subject (use these in study slot activity names):
  None available — use subject-level revision`;
    }
    const topicsSection = entries
        .map(([subj, topics]) =>
            topics.length > 0
                ? `  ${subj}: ${topics.join(', ')}`
                : `  ${subj}: (no specific topics — use general revision)`
        )
        .join('\n');
    return `Weak Topics Per Subject (use these in study slot activity names):
${topicsSection}`;
}

async function generateDailyRoutine(routineData) {
    const system = `You are a lifestyle and academic coach creating a VERY DETAILED hour-by-hour daily routine for a school student.

Respond ONLY with valid JSON matching:
{
  "wakeUpTime": string,
  "schedule": [{
    "time": string,
    "endTime": string,
    "activity": string,
    "details": string,
    "duration": string,
    "category": "school"|"study"|"break"|"exercise"|"meal"|"sleep"|"personal"
  }],
  "sleepTime": string,
  "totalStudyHours": number,
  "subjectRevisionBreakdown": [{ "subject": string, "minutes": number, "timeSlot": string }],
  "healthTips": string[],
  "motivationalNote": string
}

STRICT RULES:
- Generate EVERY slot from 6:00 AM to 10:30 PM — no gaps allowed
- Use EXACT subject names from the data (e.g. "Mathematics Revision", "Science Practice")
- Today's study plan note must be reflected in the revision slots
- Weak subjects get MORE revision time (45-60 min each)
- Strong subjects get lighter revision (20-30 min)
- Include: morning routine, school, homework for specific subjects, subject-specific revision, short breaks, exercise, meals, dinner, wind-down, sleep
- Each activity must have a "details" field explaining WHAT to do (e.g. "Solve 15 algebra equations from chapter 4")
- time format: "6:00 AM", endTime: "6:30 AM"
- Study slot "activity" names MUST follow the format "Subject: Topic — action" (e.g. "Mathematics: Quadratic Equations — solve 10 practice problems")`;

    const topicsBlock = buildRoutineTopicsSection(routineData.weakTopicsPerSubject);

    const user = `Student: ${routineData.studentName}
All Subjects: ${routineData.allSubjects?.join(', ') || 'Not specified'}
Weak Subjects (need more time): ${routineData.weakSubjects?.join(', ') || 'None'}
Today's Study Focus: ${routineData.todayStudyPlanNote}
Weak Subject Focus from Plan: ${routineData.weakSubjectFocus?.join(' | ') || 'None'}
Daily Revision Hours Target: ${routineData.dailyRevisionHours} hours
Homework Workload: ${routineData.homeworkWorkload} (${routineData.pendingAssignments} pending assignments)
School Periods Today: ${routineData.schoolPeriodsToday}
${routineData.schoolSchedule?.length > 0 ? `School Schedule: ${JSON.stringify(routineData.schoolSchedule)}` : 'No timetable data — assume school 8:45 AM to 3:30 PM'}
Sleep Requirement: ${routineData.sleepRequirement}

${topicsBlock}

Generate a COMPLETE detailed daily routine. Name every study slot with the specific subject. Give weak subjects priority revision slots in the evening.`;
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
    buildRoutineTopicsSection,
};
