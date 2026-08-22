const fs = require('fs');
const path = require('path');
const { parseXML } = require('../../services/questionImporter');

describe('Question Importer - XML & XLS Parsers', () => {
    
    describe('parseXML', () => {
        let questions;

        beforeAll(() => {
            const xmlPath = path.join(__dirname, '../fixtures/questions.xml');
            const buffer = fs.readFileSync(xmlPath);
            questions = parseXML(buffer);
        });

        it('should correctly parse a valid MCQ from XML', () => {
            const mcq = questions[0];
            expect(mcq.questionType).toBe('mcq');
            expect(mcq.questionText).toContain('relationship between voltage');
            expect(mcq.options.length).toBe(4);
            expect(mcq.correctAnswer).toBe(0); // 'A' becomes 0
            expect(mcq.curriculumMeta.classId).toBe('10');
            expect(mcq.curriculumMeta.chapter).toBe('Electricity');
        });

        it('should correctly parse an invalid MCQ with missing options', () => {
            const invalidMcq = questions[1];
            expect(invalidMcq.options.length).toBe(0);
        });

        it('should correctly parse a Sentence question', () => {
            const sq = questions[2];
            expect(sq.questionType).toBe('sentence');
            expect(sq.expectedAnswer).toBeDefined();
            expect(sq.keyConcepts.length).toBe(3);
            expect(sq.scoringRubric.length).toBe(2);
        });
    });
});
