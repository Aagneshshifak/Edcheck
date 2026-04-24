/**
 * Integration Smoke Tests: AI Teaching Controller
 *
 * Tests controller functions directly with mocked Groq SDK and Mongoose models.
 * Verifies:
 *   - Correct model is selected per endpoint
 *   - Prompt templates are populated with correct values
 *   - Malformed Groq response returns 500
 *   - Missing fields return 400
 *   - No attempts returns 404
 *   - GROQ_API_KEY does not appear in any response body
 */

// ── Mock groq config before any imports ──────────────────────────────────────

const mockCreate = jest.fn();

jest.mock('../config/groq', () => ({
    groq: {
        chat: {
            completions: {
                create: mockCreate,
            },
        },
    },
    GROQ_MODELS: {
        FAST: 'llama3-8b-8192',
        BALANCED: 'mixtral-8x7b-32768',
        POWERFUL: 'llama3-70b-8192',
    },
}));

// ── Mock Mongoose models ──────────────────────────────────────────────────────

const mockSubjectFindById = jest.fn();
const mockTestFind = jest.fn();
const mockTestAttemptFind = jest.fn();
const mockTeacherFindById = jest.fn();

jest.mock('../models/subjectSchema', () => ({
    findById: (...args) => mockSubjectFindById(...args),
}));

jest.mock('../models/testSchema', () => ({
    find: (...args) => mockTestFind(...args),
}));

jest.mock('../models/testAttemptSchema', () => ({
    find: (...args) => mockTestAttemptFind(...args),
}));

jest.mock('../models/teacherSchema', () => ({
    findById: (...args) => mockTeacherFindById(...args),
}));

// ── Import controller after mocks are set up ─────────────────────────────────

const {
    getNoteSuggestions,
    detectWeakTopics,
    generateQuestions,
} = require('../controllers/ai-teaching-controller');

// ── Test helpers ──────────────────────────────────────────────────────────────

const MOCK_API_KEY = 'test-api-key';

const mockReq = (body, user = { id: 'teacher-id' }) => ({ body, user });

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

/** Build a chainable findById mock that resolves with the given value */
function chainableFindById(value) {
    const chain = { select: jest.fn().mockResolvedValue(value) };
    return jest.fn().mockReturnValue(chain);
}

/** Build a chainable find mock that resolves with the given value */
function chainableFind(value) {
    return jest.fn().mockResolvedValue(value);
}

/** Groq response wrapper */
function groqResponse(content) {
    return { choices: [{ message: { content } }] };
}

/** Capture the messages array passed to groq.chat.completions.create */
function captureMessages() {
    return mockCreate.mock.calls[0][0].messages;
}

/** Capture the model passed to groq.chat.completions.create */
function captureModel() {
    return mockCreate.mock.calls[0][0].model;
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
    // Set a fake API key in the environment so we can verify it never leaks
    process.env.GROQ_API_KEY = MOCK_API_KEY;
});

// ─────────────────────────────────────────────────────────────────────────────
// getNoteSuggestions
// ─────────────────────────────────────────────────────────────────────────────

describe('getNoteSuggestions', () => {
    describe('missing fields → 400', () => {
        test('missing subjectId returns 400', async () => {
            const req = mockReq({ topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'subjectId and topic are required',
            });
        });

        test('missing topic returns 400', async () => {
            const req = mockReq({ subjectId: 'sub-1' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'subjectId and topic are required',
            });
        });
    });

    describe('teacher not assigned to subject → 403', () => {
        test('returns 403 when subject not in teachSubjects', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['other-subject-id'],
                }),
            });

            const req = mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: 'Access denied: subject not assigned to this teacher',
            });
        });
    });

    describe('malformed Groq response → 500', () => {
        test('non-JSON content from Groq returns 500', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });
            mockCreate.mockResolvedValue(groqResponse('this is not json'));

            const req = mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: 'AI returned an unexpected response format',
            });
        });
    });

    describe('Groq unavailable → 503', () => {
        test('Groq error with status property returns 503', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });
            const groqError = new Error('Service unavailable');
            groqError.status = 503;
            mockCreate.mockRejectedValue(groqError);

            const req = mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({
                message: 'AI service temporarily unavailable. Please try again.',
            });
        });
    });

    describe('happy path → 200 with correct model', () => {
        test('uses GROQ_MODELS.FAST (llama3-8b-8192) and returns 200', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });

            const aiResult = {
                suggestions: ['Use diagrams', 'Start with analogy', 'Group activity'],
                keyPoints: ['Light reactions', 'Calvin cycle', 'ATP', 'NADPH', 'Chlorophyll'],
                resources: ['Diagram of chloroplast', 'Short video'],
            };
            mockCreate.mockResolvedValue(groqResponse(JSON.stringify(aiResult)));

            const req = mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(captureModel()).toBe('llama3-8b-8192');
        });

        test('prompt contains subjectName and topic values', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });

            const aiResult = {
                suggestions: ['s1', 's2', 's3'],
                keyPoints: ['k1', 'k2', 'k3', 'k4', 'k5'],
                resources: ['r1', 'r2'],
            };
            mockCreate.mockResolvedValue(groqResponse(JSON.stringify(aiResult)));

            const req = mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' });
            const res = mockRes();

            await getNoteSuggestions(req, res);

            const messages = captureMessages();
            const allContent = messages.map((m) => m.content).join('\n');
            expect(allContent).toContain('Biology');
            expect(allContent).toContain('Photosynthesis');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// detectWeakTopics
// ─────────────────────────────────────────────────────────────────────────────

describe('detectWeakTopics', () => {
    describe('missing fields → 400', () => {
        test('missing subjectId returns 400', async () => {
            const req = mockReq({ classId: 'class-1' });
            const res = mockRes();

            await detectWeakTopics(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'subjectId and classId are required',
            });
        });

        test('missing classId returns 400', async () => {
            const req = mockReq({ subjectId: 'sub-1' });
            const res = mockRes();

            await detectWeakTopics(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'subjectId and classId are required',
            });
        });
    });

    describe('no attempts → 404', () => {
        test('returns 404 when TestAttempt.find returns empty array', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });
            mockTestFind.mockResolvedValue([
                { _id: 'test-1', questions: [{ questionText: 'Photosynthesis q', correctAnswer: 0 }] },
            ]);
            mockTestAttemptFind.mockResolvedValue([]);

            const req = mockReq({ subjectId: 'sub-1', classId: 'class-1' });
            const res = mockRes();

            await detectWeakTopics(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: 'No test attempts found for this subject/class',
            });
        });
    });

    describe('happy path → 200 with correct model', () => {
        test('uses GROQ_MODELS.BALANCED (mixtral-8x7b-32768) and returns 200', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });
            mockTestFind.mockResolvedValue([
                {
                    _id: 'test-1',
                    questions: [{ questionText: 'Photosynthesis question', correctAnswer: 0 }],
                },
            ]);
            mockTestAttemptFind.mockResolvedValue([
                { testId: 'test-1', answers: [0] },
            ]);

            const aiResult = {
                weakTopics: [{ topic: 'Photosynthesis', scorePercent: 40, severity: 'high' }],
                clarificationSuggestions: [{ topic: 'Photosynthesis', suggestion: 'Re-teach with diagrams' }],
            };
            mockCreate.mockResolvedValue(groqResponse(JSON.stringify(aiResult)));

            const req = mockReq({ subjectId: 'sub-1', classId: 'class-1' });
            const res = mockRes();

            await detectWeakTopics(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(captureModel()).toBe('mixtral-8x7b-32768');
        });

        test('prompt contains subjectName and topic score data', async () => {
            mockTeacherFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    teachSubjects: ['sub-1'],
                }),
            });
            mockSubjectFindById.mockReturnValue({
                select: jest.fn().mockResolvedValue({
                    _id: 'sub-1',
                    subjectName: 'Biology',
                    topics: ['Photosynthesis'],
                }),
            });
            mockTestFind.mockResolvedValue([
                {
                    _id: 'test-1',
                    questions: [{ questionText: 'Photosynthesis question', correctAnswer: 0 }],
                },
            ]);
            mockTestAttemptFind.mockResolvedValue([
                { testId: 'test-1', answers: [1] }, // wrong answer
            ]);

            const aiResult = {
                weakTopics: [{ topic: 'Photosynthesis', scorePercent: 0, severity: 'high' }],
                clarificationSuggestions: [{ topic: 'Photosynthesis', suggestion: 'Re-teach' }],
            };
            mockCreate.mockResolvedValue(groqResponse(JSON.stringify(aiResult)));

            const req = mockReq({ subjectId: 'sub-1', classId: 'class-1' });
            const res = mockRes();

            await detectWeakTopics(req, res);

            const messages = captureMessages();
            const allContent = messages.map((m) => m.content).join('\n');
            expect(allContent).toContain('Biology');
            // Topic score data should be in the prompt
            expect(allContent).toContain('Photosynthesis');
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateQuestions
// ─────────────────────────────────────────────────────────────────────────────

describe('generateQuestions', () => {
    describe('missing fields → 400', () => {
        test('missing topic returns 400', async () => {
            const req = mockReq({ subjectName: 'Biology', difficulty: 'easy', count: 3 });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'topic, subjectName, difficulty, and count are required',
            });
        });

        test('missing subjectName returns 400', async () => {
            const req = mockReq({ topic: 'Photosynthesis', difficulty: 'easy', count: 3 });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'topic, subjectName, difficulty, and count are required',
            });
        });

        test('missing difficulty returns 400', async () => {
            const req = mockReq({ topic: 'Photosynthesis', subjectName: 'Biology', count: 3 });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'topic, subjectName, difficulty, and count are required',
            });
        });

        test('missing count returns 400', async () => {
            const req = mockReq({ topic: 'Photosynthesis', subjectName: 'Biology', difficulty: 'easy' });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'topic, subjectName, difficulty, and count are required',
            });
        });
    });

    describe('invalid difficulty → 400', () => {
        test('difficulty "extreme" returns 400', async () => {
            const req = mockReq({
                topic: 'Photosynthesis',
                subjectName: 'Biology',
                difficulty: 'extreme',
                count: 3,
            });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: 'difficulty must be easy, medium, or hard',
            });
        });
    });

    describe('happy path → 200 with correct model', () => {
        function makeQuestion(overrides = {}) {
            return {
                questionText: 'Which organelle performs photosynthesis?',
                options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Ribosome'],
                correctAnswer: 1,
                explanation: 'Chloroplasts contain chlorophyll.',
                ...overrides,
            };
        }

        test('uses GROQ_MODELS.POWERFUL (llama3-70b-8192) and returns 200', async () => {
            const questions = [makeQuestion(), makeQuestion(), makeQuestion()];
            mockCreate.mockResolvedValue(
                groqResponse(JSON.stringify({ questions }))
            );

            const req = mockReq({
                topic: 'Photosynthesis',
                subjectName: 'Biology',
                difficulty: 'medium',
                count: 3,
            });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(captureModel()).toBe('llama3-70b-8192');
        });

        test('prompt contains topic, subjectName, difficulty, and count', async () => {
            const questions = [makeQuestion(), makeQuestion()];
            mockCreate.mockResolvedValue(
                groqResponse(JSON.stringify({ questions }))
            );

            const req = mockReq({
                topic: 'Cell Division',
                subjectName: 'Biology',
                difficulty: 'hard',
                count: 2,
            });
            const res = mockRes();

            await generateQuestions(req, res);

            const messages = captureMessages();
            const allContent = messages.map((m) => m.content).join('\n');
            expect(allContent).toContain('Cell Division');
            expect(allContent).toContain('Biology');
            expect(allContent).toContain('hard');
            expect(allContent).toContain('2');
        });

        test('response body contains questions array', async () => {
            const questions = [makeQuestion()];
            mockCreate.mockResolvedValue(
                groqResponse(JSON.stringify({ questions }))
            );

            const req = mockReq({
                topic: 'Photosynthesis',
                subjectName: 'Biology',
                difficulty: 'easy',
                count: 1,
            });
            const res = mockRes();

            await generateQuestions(req, res);

            expect(res.json).toHaveBeenCalledWith({ questions });
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12.2 — GROQ_API_KEY must not appear in any response body
// ─────────────────────────────────────────────────────────────────────────────

describe('GROQ_API_KEY not in response bodies', () => {
    /**
     * Helper: collect all JSON strings passed to res.json() across a controller call
     * and assert none contain the mock API key.
     */
    async function assertKeyNotLeaked(controllerFn, req) {
        const res = mockRes();
        await controllerFn(req, res);
        const calls = res.json.mock.calls;
        for (const [body] of calls) {
            const serialised = JSON.stringify(body);
            expect(serialised).not.toContain(MOCK_API_KEY);
        }
    }

    test('getNoteSuggestions 400 response does not contain API key', async () => {
        await assertKeyNotLeaked(
            getNoteSuggestions,
            mockReq({ topic: 'Photosynthesis' }) // missing subjectId → 400
        );
    });

    test('detectWeakTopics 400 response does not contain API key', async () => {
        await assertKeyNotLeaked(
            detectWeakTopics,
            mockReq({ classId: 'class-1' }) // missing subjectId → 400
        );
    });

    test('generateQuestions 400 response does not contain API key', async () => {
        await assertKeyNotLeaked(
            generateQuestions,
            mockReq({ subjectName: 'Biology', difficulty: 'easy', count: 3 }) // missing topic → 400
        );
    });

    test('getNoteSuggestions 503 response does not contain API key', async () => {
        mockTeacherFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({ teachSubjects: ['sub-1'] }),
        });
        mockSubjectFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: 'sub-1',
                subjectName: 'Biology',
                topics: [],
            }),
        });
        const groqError = new Error('Auth failed');
        groqError.status = 401;
        mockCreate.mockRejectedValue(groqError);

        await assertKeyNotLeaked(
            getNoteSuggestions,
            mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' })
        );
    });

    test('getNoteSuggestions 500 response does not contain API key', async () => {
        mockTeacherFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({ teachSubjects: ['sub-1'] }),
        });
        mockSubjectFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: 'sub-1',
                subjectName: 'Biology',
                topics: [],
            }),
        });
        mockCreate.mockResolvedValue(groqResponse('not valid json'));

        await assertKeyNotLeaked(
            getNoteSuggestions,
            mockReq({ subjectId: 'sub-1', topic: 'Photosynthesis' })
        );
    });

    test('detectWeakTopics 404 response does not contain API key', async () => {
        mockTeacherFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({ teachSubjects: ['sub-1'] }),
        });
        mockSubjectFindById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: 'sub-1',
                subjectName: 'Biology',
                topics: [],
            }),
        });
        mockTestFind.mockResolvedValue([]);
        mockTestAttemptFind.mockResolvedValue([]);

        await assertKeyNotLeaked(
            detectWeakTopics,
            mockReq({ subjectId: 'sub-1', classId: 'class-1' })
        );
    });
});
