const { validateQuestionsBatch } = require('../../services/questionValidator');
const groqService = require('../../services/groqService');

jest.mock('../../services/groqService');
jest.mock('../../utils/serverLogger');

describe('Semantic Validation (AI)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should correctly process a passing AI batch', async () => {
        const batch = [{
            _tempId: 'temp_1',
            questionText: 'What is photosynthesis?',
            questionType: 'sentence',
            curriculumMeta: { chapter: 'Biology' }
        }];

        groqService.evaluateWithGroq.mockResolvedValue(JSON.stringify({
            results: [{
                id: 'temp_1',
                valid: true,
                questionQuality: 0.90,
                subjectMatch: true,
                chapterMatch: true,
                subtopicMatch: true,
                difficultyMatch: true,
                answerCorrect: true,
                optionsValid: true,
                duplicate: false,
                issues: [],
                reason: 'Looks good'
            }]
        }));

        const validated = await validateQuestionsBatch(batch, 'test_source');
        
        expect(validated.length).toBe(1);
        expect(validated[0].validationStatus).toBe('VALID');
        expect(validated[0].validationScore).toBe(0.9);
    });

    it('should mark question as REQUIRES_REVIEW if quality is 0.75', async () => {
        const batch = [{
            _tempId: 'temp_2',
            questionText: 'Is this somewhat okay?',
            questionType: 'mcq'
        }];

        groqService.evaluateWithGroq.mockResolvedValue(JSON.stringify({
            results: [{
                id: 'temp_2',
                valid: true,
                questionQuality: 0.75, // Below 0.85, above 0.70
                subjectMatch: true,
                chapterMatch: true,
                subtopicMatch: true,
                difficultyMatch: true,
                answerCorrect: true,
                optionsValid: true,
                duplicate: false,
                issues: [],
                reason: 'Borderline'
            }]
        }));

        const validated = await validateQuestionsBatch(batch, 'test_source');
        expect(validated[0].validationStatus).toBe('REQUIRES_REVIEW');
    });

    it('should mark question as INVALID if quality is 0.50', async () => {
        const batch = [{
            _tempId: 'temp_3',
            questionText: 'Bad question',
            questionType: 'mcq'
        }];

        groqService.evaluateWithGroq.mockResolvedValue(JSON.stringify({
            results: [{
                id: 'temp_3',
                valid: false,
                questionQuality: 0.50,
                subjectMatch: true,
                chapterMatch: true,
                subtopicMatch: true,
                difficultyMatch: true,
                answerCorrect: false, // AI flags wrong answer
                optionsValid: true,
                duplicate: false,
                issues: ['Answer is incorrect'],
                reason: 'Bad'
            }]
        }));

        const validated = await validateQuestionsBatch(batch, 'test_source');
        expect(validated[0].validationStatus).toBe('INVALID');
    });
});
