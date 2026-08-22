const mongoose = require('mongoose');
const { computeAggregateMetrics } = require('../../services/adaptiveLearning/evaluationEngine');
const TopicMastery = require('../../models/adaptiveLearning/topicMasterySchema');

describe('DSKP Subtopic Tracking', () => {

    it('should extract Curriculum Meta (Domain, Chapter, Subtopic, Concept) and aggregate properly', () => {
        const studentId = new mongoose.Types.ObjectId();
        const testId = new mongoose.Types.ObjectId();

        const evaluatedQuestions = [
            {
                questionId: new mongoose.Types.ObjectId(),
                domain: 'Physics',
                chapter: 'Electricity',
                subtopic: "Ohm's Law",
                concept: 'Resistance',
                isCorrect: true,
                maxMarks: 1,
                earnedScore: 1,
                timeSpentMs: 3000,
                difficultyLevel: 'medium',
                confidence: 4,
                topic: 'Electricity' // Legacy fallback
            },
            {
                questionId: new mongoose.Types.ObjectId(),
                domain: 'Physics',
                chapter: 'Electricity',
                subtopic: 'Electric Current',
                concept: 'Charge',
                isCorrect: false,
                maxMarks: 1,
                earnedScore: 0,
                timeSpentMs: 5000,
                difficultyLevel: 'hard',
                confidence: 2,
                topic: 'Electricity'
            }
        ];

        const metrics = computeAggregateMetrics(evaluatedQuestions);

        // Verify the fallback topics
        expect(metrics.topicBreakdown).toBeDefined();

        // Topic breakdown should group by subtopic first, then chapter, then legacy topic
        // We expect Ohm's Law and Electric Current to be present
        expect(metrics.topicBreakdown["Ohm's Law"]).toBeDefined();
        expect(metrics.topicBreakdown["Electric Current"]).toBeDefined();

        expect(metrics.topicBreakdown["Ohm's Law"].correct).toBe(1);
        expect(metrics.topicBreakdown["Ohm's Law"].total).toBe(1);

        expect(metrics.topicBreakdown["Electric Current"].correct).toBe(0);
        expect(metrics.topicBreakdown["Electric Current"].total).toBe(1);
    });
});
