const assert = require('assert');
const {
    buildStudentAnalysisPrompt,
    buildStaffReportPrompt,
    buildAssessmentBlueprintPrompt
} = require('../../utils/aiPromptTemplates');

describe('AI Prompt Templates', () => {
    describe('buildStudentAnalysisPrompt', () => {
        it('should build prompt for High Mastery vs Weak Student', () => {
            const highMasteryDSKP = {
                overallMastery: 0.95,
                readinessScore: 0.90,
                weakTopics: [],
                strongTopics: [{ topic: 'Algebra', masteryScore: 0.95 }]
            };
            const prompt1 = buildStudentAnalysisPrompt(highMasteryDSKP);
            assert.strictEqual(prompt1.includes('Overall Mastery: 95.0%'), true);
            assert.strictEqual(prompt1.includes('None identified'), true); // for weak topics

            const weakStudentDSKP = {
                overallMastery: 0.30,
                readinessScore: 0.20,
                weakTopics: [{ topic: 'Algebra', masteryScore: 0.30, trendType: 'declining', reason: 'poor score' }],
                strongTopics: []
            };
            const prompt2 = buildStudentAnalysisPrompt(weakStudentDSKP);
            assert.strictEqual(prompt2.includes('Overall Mastery: 30.0%'), true);
            assert.strictEqual(prompt2.includes('Algebra: mastery=30.0%, trend=declining'), true);
        });

        it('should handle Improving vs Declining vs Forgetting student', () => {
            const dskp = {
                topicDetails: [
                    { topic: 'Topic A', masteryScore: 0.8, trendType: 'improving' },
                    { topic: 'Topic B', masteryScore: 0.4, trendType: 'declining' },
                    { topic: 'Topic C', masteryScore: 0.6, trendType: 'forgetting', forgettingFactor: 0.7 }
                ]
            };
            const prompt = buildStudentAnalysisPrompt(dskp);
            assert.strictEqual(prompt.includes('Topic A: mastery=80.0%, trend=improving'), true);
            assert.strictEqual(prompt.includes('Topic B: mastery=40.0%, trend=declining'), true);
            assert.strictEqual(prompt.includes('Topic C: mastery=60.0%, trend=forgetting'), true);
            assert.strictEqual(prompt.includes('forgetting=70.0%'), true);
        });

        it('should handle Confidence mismatch (High confidence/low performance vs Low confidence/high performance)', () => {
            const dskp = {
                topicDetails: [
                    { topic: 'Topic A', masteryScore: 0.4, confidenceScore: 0.9 }, // overconfident
                    { topic: 'Topic B', masteryScore: 0.9, confidenceScore: 0.3 }  // underconfident
                ]
            };
            const prompt = buildStudentAnalysisPrompt(dskp);
            assert.strictEqual(prompt.includes('mastery=40.0%'), true);
            assert.strictEqual(prompt.includes('confidence=90.0%'), true);
            assert.strictEqual(prompt.includes('mastery=90.0%'), true);
            assert.strictEqual(prompt.includes('confidence=30.0%'), true);
        });

        it('should handle Inconsistent student', () => {
            const dskp = {
                overallMastery: 0.6,
                consistencyScore: 0.2 // Very inconsistent
            };
            const prompt = buildStudentAnalysisPrompt(dskp);
            assert.strictEqual(prompt.includes('Consistency Score: 20.0%'), true);
        });

        it('should handle Strong vs Weak across multiple subjects', () => {
            const dskp = {
                weakTopics: [{ topic: 'Biology', masteryScore: 0.4, trendType: 'stable' }],
                strongTopics: [{ topic: 'Math', masteryScore: 0.9 }]
            };
            const prompt = buildStudentAnalysisPrompt(dskp);
            assert.strictEqual(prompt.includes('Biology: mastery=40.0%'), true);
            assert.strictEqual(prompt.includes('Math: mastery=90.0%'), true);
        });
    });

    describe('buildStaffReportPrompt', () => {
        it('should format staff report correctly', () => {
            const result = buildStaffReportPrompt({
                dskp: { overallMastery: 0.8 },
                assessmentMetrics: { scorePercentage: 0.85, totalCorrect: 17, totalQuestions: 20 },
                assessmentTitle: 'Midterm',
                assessmentDate: '2023-10-01'
            });
            assert.strictEqual(result.includes('Score: 85.0%'), true);
            assert.strictEqual(result.includes('Correct: 17/20'), true);
            assert.strictEqual(result.includes('Overall Mastery: 80.0%'), true);
        });
    });
});
