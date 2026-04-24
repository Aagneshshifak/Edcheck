/**
 * AI Teaching Service
 *
 * Stateless service module — no direct MongoDB access.
 * All required data is passed in by the controller.
 */

const { groq, GROQ_MODELS } = require('../config/groq');

/**
 * Compute per-topic scores from test questions and student attempt answers.
 *
 * Pure function — no side effects, no I/O.
 *
 * Keyword matching: for each question, check if questionText (case-insensitive)
 * contains any word from subjectTopics. Unmatched questions are grouped under "General".
 *
 * @param {Array} tests          - Array of Test documents, each with a questions[] array
 * @param {Array} attempts       - Array of TestAttempt documents, each with answers[] (array of selected answer indices)
 * @param {string[]} subjectTopics - Array of topic strings from the Subject document
 * @returns {Object} TopicScoreMap keyed by topic string:
 *   { [topic]: { totalQuestions, totalAttempts, correctCount, scorePercent } }
 */
function computeTopicScores(tests, attempts, subjectTopics) {
    const topicMap = {};

    // Helper: get or initialise a topic entry
    function getEntry(topic) {
        if (!topicMap[topic]) {
            topicMap[topic] = {
                totalQuestions: 0,
                totalAttempts: 0,
                correctCount: 0,
                scorePercent: 0,
            };
        }
        return topicMap[topic];
    }

    // Build a lookup: testId (string) → { questions[], questionIndexOffset }
    // We need to map attempt answers (positional array) back to questions.
    const testById = {};
    for (const test of tests) {
        const id = test._id ? test._id.toString() : String(test._id);
        testById[id] = test;
    }

    // Step 1: Assign each question to a topic via keyword matching
    // Build: testId → questionIndex → topic
    const questionTopics = {}; // { testId: [topic, topic, ...] }

    for (const test of tests) {
        const id = test._id ? test._id.toString() : String(test._id);
        const questions = test.questions || [];
        questionTopics[id] = questions.map((q) => assignTopic(q.questionText, subjectTopics));

        // Count totalQuestions per topic
        for (const topic of questionTopics[id]) {
            getEntry(topic).totalQuestions += 1;
        }
    }

    // Step 2: Walk through attempts and accumulate totalAttempts + correctCount
    for (const attempt of attempts) {
        const testId = attempt.testId ? attempt.testId.toString() : String(attempt.testId);
        const test = testById[testId];
        if (!test) continue;

        const questions = test.questions || [];
        const answers = attempt.answers || [];
        const topics = questionTopics[testId] || [];

        for (let i = 0; i < questions.length; i++) {
            const topic = topics[i];
            if (topic === undefined) continue;

            const entry = getEntry(topic);
            // Only count if the student actually answered this question
            if (i < answers.length && answers[i] !== undefined && answers[i] !== null) {
                entry.totalAttempts += 1;
                if (answers[i] === questions[i].correctAnswer) {
                    entry.correctCount += 1;
                }
            }
        }
    }

    // Step 3: Compute scorePercent for each topic
    for (const topic of Object.keys(topicMap)) {
        const entry = topicMap[topic];
        entry.scorePercent =
            entry.totalAttempts > 0
                ? (entry.correctCount / entry.totalAttempts) * 100
                : 0;
    }

    return topicMap;
}

/**
 * Assign a question to a topic using keyword matching.
 * Returns the first matching topic, or "General" if none match.
 *
 * @param {string} questionText
 * @param {string[]} subjectTopics
 * @returns {string}
 */
function assignTopic(questionText, subjectTopics) {
    if (!questionText || !subjectTopics || subjectTopics.length === 0) {
        return 'General';
    }

    const lowerText = questionText.toLowerCase();

    for (const topic of subjectTopics) {
        if (!topic) continue;
        // Split topic into individual words and check if any appear in the question text
        const words = topic.toLowerCase().split(/\s+/).filter(Boolean);
        for (const word of words) {
            if (lowerText.includes(word)) {
                return topic;
            }
        }
    }

    return 'General';
}

/**
 * Suggest teaching notes and resources for a given subject and topic.
 *
 * @param {string} subjectName - The name of the subject
 * @param {string} topic       - The topic to prepare notes for
 * @returns {Promise<{ suggestions: string[], keyPoints: string[], resources: string[] }>}
 */
async function suggestNotes(subjectName, topic) {
    // Trim and cap inputs to 200 chars each
    const safeSubject = String(subjectName).trim().slice(0, 200);
    const safeTopic = String(topic).trim().slice(0, 200);

    const systemPrompt = `You are an expert curriculum designer helping school teachers prepare lessons.
Respond ONLY with valid JSON matching this schema:
{
  "suggestions": string[],
  "keyPoints": string[],
  "resources": string[]
}`;

    const userPrompt = `Subject: ${safeSubject}
Topic: ${safeTopic}

Provide 3-5 teaching approach suggestions, 5-7 key points a student must understand,
and 2-3 resource types the teacher should prepare.
Keep suggestions practical and classroom-ready.`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODELS.FAST,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (
        !Array.isArray(parsed.suggestions) ||
        !Array.isArray(parsed.keyPoints) ||
        !Array.isArray(parsed.resources)
    ) {
        throw new Error('AI returned an unexpected response format');
    }

    return parsed;
}

/**
 * Analyze weak topics for a class based on test results.
 *
 * @param {Array} tests          - Array of Test documents with questions[]
 * @param {Array} attempts       - Array of TestAttempt documents with answers[]
 * @param {string[]} subjectTopics - Array of topic strings from the Subject document
 * @param {string} subjectName   - The name of the subject
 * @returns {Promise<{ weakTopics: Array, clarificationSuggestions: Array }>}
 */
async function analyzeWeakTopics(tests, attempts, subjectTopics, subjectName) {
    const topicScoreMap = computeTopicScores(tests, attempts, subjectTopics);

    const topicScoreJson = JSON.stringify(
        Object.entries(topicScoreMap).map(([topic, data]) => ({
            topic,
            scorePercent: Math.round(data.scorePercent * 100) / 100,
            totalAttempts: data.totalAttempts,
            totalQuestions: data.totalQuestions,
        })),
        null,
        2
    );

    const systemPrompt = `You are an educational data analyst. Given topic-level score data for a class,
identify weak topics and suggest targeted re-teaching strategies.
Respond ONLY with valid JSON matching this schema:
{
  "weakTopics": [{ "topic": string, "scorePercent": number, "severity": "low"|"medium"|"high" }],
  "clarificationSuggestions": [{ "topic": string, "suggestion": string }]
}
Severity rules: high < 50%, medium 50-70%, low > 70% (only include low if explicitly weak).`;

    const userPrompt = `Subject: ${String(subjectName).trim().slice(0, 200)}
Class average topic scores:
${topicScoreJson}

Identify topics needing attention and suggest one specific re-teaching strategy per weak topic.`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODELS.BALANCED,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (!Array.isArray(parsed.weakTopics) || !Array.isArray(parsed.clarificationSuggestions)) {
        throw new Error('AI returned an unexpected response format');
    }

    // Enforce severity thresholds based on scorePercent
    parsed.weakTopics = parsed.weakTopics.map((item) => {
        const score = item.scorePercent;
        let severity;
        if (score < 50) {
            severity = 'high';
        } else if (score <= 70) {
            severity = 'medium';
        } else {
            severity = 'low';
        }
        return { ...item, severity };
    });

    // Ensure clarificationSuggestions.length === weakTopics.length
    const targetLen = parsed.weakTopics.length;
    if (parsed.clarificationSuggestions.length > targetLen) {
        parsed.clarificationSuggestions = parsed.clarificationSuggestions.slice(0, targetLen);
    } else {
        while (parsed.clarificationSuggestions.length < targetLen) {
            const missingTopic = parsed.weakTopics[parsed.clarificationSuggestions.length].topic;
            parsed.clarificationSuggestions.push({
                topic: missingTopic,
                suggestion: 'Review and re-teach this topic with additional practice exercises.',
            });
        }
    }

    return {
        weakTopics: parsed.weakTopics,
        clarificationSuggestions: parsed.clarificationSuggestions,
    };
}

/**
 * Generate MCQ practice questions for a given topic.
 *
 * @param {string} topic        - The topic to generate questions for
 * @param {string} subjectName  - The name of the subject
 * @param {'easy'|'medium'|'hard'} difficulty - Difficulty level
 * @param {number} count        - Number of questions to generate
 * @returns {Promise<Array<{ questionText: string, options: string[], correctAnswer: number, explanation: string }>>}
 */
async function generatePracticeQuestions(topic, subjectName, difficulty, count) {
    const safeTopic = String(topic).trim().slice(0, 200);
    const safeSubject = String(subjectName).trim().slice(0, 200);

    const systemPrompt = `You are an expert question paper setter for school-level education.
Generate exactly ${count} multiple-choice questions.
Respond ONLY with valid JSON:
{ "questions": [{ "questionText": string, "options": string[4], "correctAnswer": number, "explanation": string }] }
correctAnswer is the 0-based index of the correct option.`;

    const userPrompt = `Subject: ${safeSubject}
Topic: ${safeTopic}
Difficulty: ${difficulty}
Count: ${count}

Generate ${count} ${difficulty}-level MCQ questions on "${safeTopic}".
Each question must have exactly 4 options with one correct answer.
Include a brief explanation for the correct answer.`;

    const response = await groq.chat.completions.create({
        model: GROQ_MODELS.POWERFUL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('AI returned an unexpected response format');
    }

    if (!Array.isArray(parsed.questions)) {
        throw new Error('AI returned an unexpected response format');
    }

    // Validate each question's structure
    for (const q of parsed.questions) {
        if (
            typeof q.questionText !== 'string' ||
            !Array.isArray(q.options) ||
            q.options.length !== 4 ||
            !q.options.every((o) => typeof o === 'string') ||
            !Number.isInteger(q.correctAnswer) ||
            q.correctAnswer < 0 ||
            q.correctAnswer > 3 ||
            typeof q.explanation !== 'string'
        ) {
            throw new Error('AI returned an unexpected response format');
        }
    }

    // Verify returned count matches requested count
    if (parsed.questions.length !== count) {
        throw new Error('AI returned an unexpected response format');
    }

    return parsed.questions;
}

module.exports = { computeTopicScores, suggestNotes, analyzeWeakTopics, generatePracticeQuestions };
