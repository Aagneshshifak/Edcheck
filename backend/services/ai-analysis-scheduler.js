/**
 * AI Analysis Scheduler
 *
 * Runs nightly at 02:00 to:
 *  1. Find all active subject+class combinations that have test attempts
 *  2. Run weak-topic detection via computeTopicScores
 *  3. Call Groq to generate clarification suggestions
 *  4. Upsert results into the TopicPerformance collection
 */

const cron = require('node-cron');
const Subject          = require('../models/subjectSchema');
const Test             = require('../models/testSchema');
const TestAttempt      = require('../models/testAttemptSchema');
const TopicPerformance = require('../models/topicPerformanceSchema');
const { computeTopicScores, analyzeWeakTopics } = require('./ai-teaching-service');
const { logger } = require('../utils/serverLogger');

// ── Core analysis function ────────────────────────────────────────────────────

/**
 * Run weak-topic analysis for a single subject+class pair and upsert results.
 * Returns the number of topics upserted.
 */
async function analyzeSubjectClass(subjectId, classId) {
    const subject = await Subject.findById(subjectId).select('subjectName subName topics').lean();
    if (!subject) return 0;

    const tests = await Test.find({ classId, subject: subjectId }).lean();
    if (!tests.length) return 0;

    const testIds = tests.map(t => t._id);
    const attempts = await TestAttempt.find({ testId: { $in: testIds } }).lean();
    if (!attempts.length) return 0;

    const subjectName  = subject.subjectName || subject.subName || '';
    const subjectTopics = subject.topics || [];

    // Call AI service — this calls Groq for clarification suggestions
    const result = await analyzeWeakTopics(tests, attempts, subjectTopics, subjectName);

    if (!result.weakTopics?.length) return 0;

    const now = new Date();
    const ops = result.weakTopics.map(wt => {
        const suggestion = result.clarificationSuggestions?.find(c => c.topic === wt.topic)?.suggestion || '';

        // Count students who got every question on this topic wrong
        const weakStudents = attempts.filter(a => {
            const test = tests.find(t => t._id.toString() === (a.testId || '').toString());
            if (!test) return false;
            const qIdxs = (test.questions || []).reduce((acc, q, i) => {
                const words = (wt.topic || '').toLowerCase().split(' ').filter(Boolean);
                if (words.some(w => (q.questionText || '').toLowerCase().includes(w))) acc.push(i);
                return acc;
            }, []);
            if (!qIdxs.length) return false;
            const answers = a.answers || [];
            return qIdxs.every(i => answers[i] !== test.questions[i].correctAnswer);
        }).length;

        return {
            updateOne: {
                filter: { subjectId, classId, topic: wt.topic },
                update: {
                    $set: {
                        averageScore:  wt.scorePercent,
                        severity:      wt.severity,
                        weakStudents,
                        suggestion,
                        lastAnalyzed:  now,
                    },
                },
                upsert: true,
            },
        };
    });

    await TopicPerformance.bulkWrite(ops);
    return ops.length;
}

// ── Full nightly job ──────────────────────────────────────────────────────────

async function runNightlyAnalysis() {
    logger.info('ai-analysis-scheduler: nightly job started');
    const jobStart = Date.now();

    try {
        // Find all distinct subject+class pairs that have at least one test attempt
        const pairs = await TestAttempt.aggregate([
            {
                $lookup: {
                    from: 'tests',
                    localField: 'testId',
                    foreignField: '_id',
                    as: 'test',
                },
            },
            { $unwind: '$test' },
            {
                $group: {
                    _id: { subjectId: '$test.subject', classId: '$test.classId' },
                },
            },
            {
                $project: {
                    _id: 0,
                    subjectId: '$_id.subjectId',
                    classId:   '$_id.classId',
                },
            },
        ]);

        logger.info(`ai-analysis-scheduler: found ${pairs.length} subject+class pairs to analyse`);

        let totalTopics = 0;
        let errors = 0;

        for (const { subjectId, classId } of pairs) {
            if (!subjectId || !classId) continue;
            try {
                const count = await analyzeSubjectClass(subjectId, classId);
                totalTopics += count;
                logger.info(`ai-analysis-scheduler: analysed subject=${subjectId} class=${classId} → ${count} topics`);
            } catch (err) {
                errors++;
                logger.error('ai-analysis-scheduler: error analysing pair', {
                    subjectId: String(subjectId),
                    classId:   String(classId),
                    err:       err.message,
                });
            }

            // Small delay between Groq calls to avoid rate-limiting
            await new Promise(r => setTimeout(r, 1500));
        }

        const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
        logger.info(`ai-analysis-scheduler: nightly job complete — ${totalTopics} topics updated, ${errors} errors, ${elapsed}s`);

    } catch (err) {
        logger.error('ai-analysis-scheduler: fatal error in nightly job', { err: err.message });
    }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

function startAIAnalysisScheduler() {
    // Run every night at 02:00
    cron.schedule('0 2 * * *', () => {
        runNightlyAnalysis().catch(err =>
            logger.error('ai-analysis-scheduler: unhandled rejection', { err: err.message })
        );
    }, { timezone: 'Asia/Kolkata' });

    logger.info('ai-analysis-scheduler: scheduled (runs nightly at 02:00 IST)');
}

module.exports = { startAIAnalysisScheduler, runNightlyAnalysis };
