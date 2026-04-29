/**
 * Admin AI Scheduler
 *
 * Runs nightly at 02:00 IST to:
 *  1. Find all schools with test activity in the last 24 hours
 *  2. Run school-wide performance summary generation for each school
 *  3. Enforce a 1500ms delay between consecutive Groq calls
 *
 * Mirrors the pattern in ai-analysis-scheduler.js.
 */

const cron = require('node-cron');
const { groq, GROQ_MODELS } = require('../config/groq');
const { logger } = require('../utils/serverLogger');

const Admin                  = require('../models/adminSchema');
const Sclass                 = require('../models/sclassSchema');
const Student                = require('../models/studentSchema');
const Test                   = require('../models/testSchema');
const TestAttempt            = require('../models/testAttemptSchema');
const SchoolPerformanceReport = require('../models/schoolPerformanceReportSchema');

const {
    sanitiseForGroq,
    buildSchoolSummaryPrompt,
    parseSchoolSummaryResponse,
} = require('./admin-ai-intelligence-service');

// ── Core analysis function ────────────────────────────────────────────────────

/**
 * Run school-wide performance summary for a single school and upsert the result.
 * This mirrors the logic in generateSchoolSummary controller but runs directly
 * without HTTP overhead.
 *
 * @param {string|ObjectId} schoolId
 */
async function runSchoolSummaryForSchool(schoolId) {
    const school = await Admin.findById(schoolId).lean();
    if (!school) return;

    // Fetch all classes for this school
    const classes = await Sclass.find({ schoolId }).lean();

    // Fetch all tests for this school
    const tests = await Test.find({ school: schoolId }).lean();
    const testIds = tests.map(t => t._id);

    // Fetch all attempts
    const attempts = testIds.length > 0
        ? await TestAttempt.find({ testId: { $in: testIds } }).lean()
        : [];

    // Class averages
    const classAverages = classes.map(cls => {
        const classTests = tests.filter(t => String(t.classId) === String(cls._id));
        const classTestIds = classTests.map(t => String(t._id));
        const classAttempts = attempts.filter(a => classTestIds.includes(String(a.testId)));
        const scores = classAttempts.map(a => {
            if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
            return a.score || 0;
        });
        const avgScore = scores.length > 0
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
            : 0;
        return { classId: String(cls._id), className: cls.className, avgScore };
    });

    // Subject averages
    const subjectScoreMap = {};
    for (const test of tests) {
        const subjectId = String(test.subject);
        const testAttempts = attempts.filter(a => String(a.testId) === String(test._id));
        const scores = testAttempts.map(a => {
            if (a.totalMarks && a.totalMarks > 0) return (a.score / a.totalMarks) * 100;
            return a.score || 0;
        });
        if (scores.length === 0) continue;
        if (!subjectScoreMap[subjectId]) subjectScoreMap[subjectId] = [];
        subjectScoreMap[subjectId].push(...scores);
    }
    const subjectAverages = Object.entries(subjectScoreMap).map(([subjectId, scores]) => ({
        subjectId,
        avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
    }));

    // 30-day attendance trend
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const students = await Student.find({ schoolId }).select('attendance').lean();
    const dateMap = {};
    for (const student of students) {
        for (const record of (student.attendance || [])) {
            if (record.date >= thirtyDaysAgo) {
                const dateStr = new Date(record.date).toISOString().split('T')[0];
                if (!dateMap[dateStr]) dateMap[dateStr] = { present: 0, total: 0 };
                dateMap[dateStr].total++;
                if (record.status === 'Present') dateMap[dateStr].present++;
            }
        }
    }
    const attendanceTrend30d = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({
            date,
            attendanceRate: Math.round((counts.present / counts.total) * 100),
        }));

    const schoolData = {
        schoolId: String(schoolId),
        schoolName: school.schoolName,
        classAverages,
        subjectAverages,
        attendanceTrend30d,
    };

    // Sanitise and call Groq
    const sanitised = sanitiseForGroq(schoolData);
    const { systemPrompt, userPrompt } = buildSchoolSummaryPrompt(sanitised);

    const response = await groq.chat.completions.create({
        model: GROQ_MODELS.BALANCED,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    });

    const content = response.choices?.[0]?.message?.content ?? '';
    const parsed = parseSchoolSummaryResponse(content);

    // Upsert SchoolPerformanceReport
    await SchoolPerformanceReport.findOneAndUpdate(
        { schoolId },
        {
            $set: {
                schoolId,
                overallAverageScore: parsed.overallAverageScore,
                topClasses: parsed.topClasses,
                weakSubjects: parsed.weakSubjects,
                academicTrend: parsed.academicTrend,
                generatedAt: new Date(),
            },
        },
        { upsert: true }
    );
}

// ── Full nightly job ──────────────────────────────────────────────────────────

/**
 * Run nightly admin AI analysis for all schools with recent test activity.
 * Exported for manual trigger via POST /api/ai/admin/run-nightly-analysis.
 */
async function runAdminNightlyAnalysis() {
    logger.info('admin-ai-scheduler: nightly job started');
    const jobStart = Date.now();

    try {
        // Find all schools with test activity in the last 24 hours
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const recentTests = await Test.find({
            $or: [
                { createdAt: { $gte: twentyFourHoursAgo } },
                { updatedAt: { $gte: twentyFourHoursAgo } },
            ],
        }).select('school').lean();

        const schoolIds = [...new Set(recentTests.map(t => String(t.school)).filter(Boolean))];

        logger.info(`admin-ai-scheduler: found ${schoolIds.length} schools with recent test activity`);

        let errors = 0;

        for (const schoolId of schoolIds) {
            try {
                await runSchoolSummaryForSchool(schoolId);
                logger.info(`admin-ai-scheduler: completed school summary for schoolId=${schoolId}`);
            } catch (err) {
                errors++;
                logger.error('admin-ai-scheduler: error processing school', {
                    schoolId,
                    err: err.message,
                });
            }

            // Enforce 1500ms delay between consecutive Groq calls to avoid rate-limiting
            await new Promise(r => setTimeout(r, 1500));
        }

        const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
        logger.info(`admin-ai-scheduler: nightly job complete — ${schoolIds.length} schools processed, ${errors} errors, ${elapsed}s`);

    } catch (err) {
        logger.error('admin-ai-scheduler: fatal error in nightly job', { err: err.message });
    }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Register the nightly cron job at 02:00 IST.
 * Called once during server startup inside the MongoDB connect().then() callback.
 */
function startAdminAIScheduler() {
    cron.schedule('0 2 * * *', () => {
        runAdminNightlyAnalysis().catch(err =>
            logger.error('admin-ai-scheduler: unhandled rejection', { err: err.message })
        );
    }, { timezone: 'Asia/Kolkata' });

    logger.info('admin-ai-scheduler: scheduled (runs nightly at 02:00 IST)');
}

module.exports = { startAdminAIScheduler, runAdminNightlyAnalysis };
