const { processImport } = require('../../services/questionImporter');
const AIQuestionBank = require('../../models/aiQuestionBankSchema');
const Curriculum = require('../../models/curriculumSchema');
const questionValidator = require('../../services/questionValidator');

jest.mock('../../models/aiQuestionBankSchema');
jest.mock('../../models/curriculumSchema');
jest.mock('../../services/questionValidator');

describe('Question Importer - Deterministic Validation', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock Curriculum matches all
        Curriculum.find.mockResolvedValue([{
            classLevel: '10',
            subject: 'Science',
            chapter: 'Electricity',
            subtopic: "Ohm's Law",
            concept: 'Resistance'
        }]);

        // Mock no duplicates
        AIQuestionBank.findOne.mockReturnValue({
            select: jest.fn().mockResolvedValue(null)
        });

        // Mock AI batch semantic passing
        questionValidator.validateQuestionsBatch.mockImplementation(async (batch) => {
            return batch.map(q => ({
                ...q,
                validationStatus: 'VALID',
                validationScore: 0.95
            }));
        });
    });

    it('should reject questions with missing curriculum data', async () => {
        const q1 = {
            questionText: 'Is this real?',
            curriculumMeta: { classId: '10' } // Missing subject, etc.
        };
        const report = await processImport([q1], 'school1', 'teacher1');
        expect(report.invalidRows).toBe(1);
        expect(report.errors[0].error).toMatch(/Missing subject/);
    });

    it('should reject MCQ with missing options', async () => {
        const q2 = {
            questionText: 'What is it?',
            questionType: 'mcq',
            options: ['A'], // Only 1 option
            correctAnswer: 0,
            curriculumMeta: { classId: '10', subjectId: 'Science', chapter: 'C', subtopic: 'S' }
        };
        const report = await processImport([q2], 'school1', 'teacher1');
        expect(report.invalidRows).toBe(1);
        expect(report.errors[0].error).toMatch(/MCQ requires at least 2 options/);
    });

    it('should reject MCQ with duplicate options', async () => {
        const q3 = {
            questionText: 'What is it?',
            questionType: 'mcq',
            options: ['Apple', 'Banana', 'Apple'],
            correctAnswer: 0,
            curriculumMeta: { classId: '10', subjectId: 'Science', chapter: 'C', subtopic: 'S' }
        };
        const report = await processImport([q3], 'school1', 'teacher1');
        expect(report.invalidRows).toBe(1);
        expect(report.errors[0].error).toMatch(/MCQ contains duplicate options/);
    });

    it('should reject SENTENCE question missing expected answer', async () => {
        const q4 = {
            questionText: 'Explain it.',
            questionType: 'sentence',
            curriculumMeta: { classId: '10', subjectId: 'Science', chapter: 'C', subtopic: 'S' }
        };
        const report = await processImport([q4], 'school1', 'teacher1');
        expect(report.invalidRows).toBe(1);
        expect(report.errors[0].error).toMatch(/Sentence question missing expected answer/);
    });
});
