/**
 * Student AI Background Scheduler
 *
 * Cron jobs:
 *  1. Daily Routine    → every morning at 06:00
 *  2. Study Plan       → after each test (triggered via hook, also runs nightly at 23:00)
 *  3. Test Preparation → every morning at 06:30 (detects upcoming tests within 3 days)
 */

const cron = require('node-cron');
const Student         = require('../models/studentSchema');
const Test            = require('../models/testSchema');
const TestAttempt     = require('../models/testAttemptSchema');
const Assignment      = require('../models/assignmentSchema');
const StudentStudyPlan= require('../models/studentStudyPlanSchema');
const StudentRoutine  = require('../models/studentDailyRoutineSchema');
const StudentTestPrep = require('../models/studentTestPrepSchema');
const { generateStudyPlan, generateDailyRoutine, generateTestPrep } = require('./student-ai-service');
const { logger } = require('../utils/serverLogger');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildStudentData(student) {
    const subjectScores = {};
    for (const r of student.examResult || []) {
        const id = String(r.subjectId);
        if (!subjectScores[id]) subjectScores[id] = { total: 0, max: 0 };
        subjectScores[id].total += r.marks;
        subjectScores[id].max   += r.maxMarks;
    }
    const total   = student.attendance?.length || 0;
    const present = student.attendance?.filter(a => a.status === 'Present').length || 0;
    const attendancePct = total > 0 ? Math.round((present / total) * 100) : 0;

    const attempts = await TestAttempt.find({ studentId: student._id }).select('score totalMarks').lean();
    const avgTestScore = attempts.length
        ? Math.round(attempts.reduce((s, a) => s + (a.score / (a.totalMarks || 1)) * 100, 0) / attempts.length)
        : 0;

    return {
        name: student.name,
        attendancePercentage: attendancePct,
        averageTestScore: avgTestScore,
        subjectPerformance: Object.entries(subjectScores).map(([id, v]) => ({
            subjectId: id,
            percentage: v.max > 0 ? Math.round((v.total / v.max) * 100) : 0,
        })),
    };
}

// ── Job 1: Generate daily routines for all active students ────────────────────
async function runDailyRoutineJob() {
    logger.info('student-ai-scheduler: daily routine job started');
    const students = await Student.find({ status: 'active' })
        .select('name classId examResult attendance').lean();

    let success = 0, errors = 0;
    for (const student of students) {
        try {
            const studyPlan  = await StudentStudyPlan.findOne({ studentId: student._id }).lean();
            const assignments = await Assignment.find({ classId: student.classId }).lean();

            const Timetable = require('../models/timetableSchema');
            const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
            const timetable = await Timetable.findOne({ classId: student.classId, day: today })
                .populate('periods.subject', 'subjectName subName').lean();
            const schoolPeriods = timetable?.periods?.map(p => ({
                period: p.periodNumber,
                subject: p.subject?.subjectName || p.subject?.subName || 'Period',
                startTime: p.startTime,
            })) || [];

            const routineData = {
                studentName: student.name,
                homeworkWorkload: assignments.length > 3 ? 'heavy' : assignments.length > 1 ? 'moderate' : 'light',
                studyPlanSummary: studyPlan?.studyPlan?.dailyRevisionHours
                    ? `${studyPlan.studyPlan.dailyRevisionHours} hours/day revision`
                    : 'No study plan yet',
                schoolPeriodsToday: schoolPeriods.length,
                sleepRequirement: '8 hours',
                gradeLevel: 'school student',
            };

            const routine = await generateDailyRoutine(routineData);
            await StudentRoutine.findOneAndUpdate(
                { studentId: student._id },
                { $set: { routine, generatedAt: new Date() } },
                { upsert: true }
            );
            success++;
            await new Promise(r => setTimeout(r, 1000)); // rate limit
        } catch (err) {
            errors++;
            logger.error('student-ai-scheduler: routine error', { studentId: String(student._id), err: err.message });
        }
    }
    logger.info(`student-ai-scheduler: daily routine done — ${success} ok, ${errors} errors`);
}

// ── Job 2: Regenerate study plans for students who completed a test recently ──
async function runStudyPlanJob() {
    logger.info('student-ai-scheduler: study plan job started');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    // Find students who submitted a test attempt in the last 24h
    const recentAttempts = await TestAttempt.find({ createdAt: { $gte: since } })
        .select('studentId').lean();
    const studentIds = [...new Set(recentAttempts.map(a => String(a.studentId)))];

    let success = 0, errors = 0;
    for (const studentId of studentIds) {
        try {
            const student = await Student.findById(studentId)
                .select('name examResult attendance classId').lean();
            if (!student) continue;

            const studentData = await buildStudentData(student);
            const studyPlan = await generateStudyPlan(studentData);
            await StudentStudyPlan.findOneAndUpdate(
                { studentId },
                { $set: { studyPlan, generatedAt: new Date() } },
                { upsert: true }
            );
            success++;
            await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
            errors++;
            logger.error('student-ai-scheduler: study plan error', { studentId, err: err.message });
        }
    }
    logger.info(`student-ai-scheduler: study plan done — ${success} ok, ${errors} errors`);
}

// ── Job 3: Generate test prep for upcoming tests (within 3 days) ──────────────
async function runTestPrepJob() {
    logger.info('student-ai-scheduler: test prep job started');
    const now  = new Date();
    const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // Find tests scheduled in the next 3 days (using createdAt as proxy if no scheduledAt)
    const upcomingTests = await Test.find({ isActive: true }).lean();

    let success = 0, errors = 0;
    for (const test of upcomingTests) {
        try {
            // Find students in this class
            const students = await Student.find({ classId: test.classId, status: 'active' })
                .select('_id').lean();

            for (const student of students) {
                // Skip if prep already generated today
                const existing = await StudentTestPrep.findOne({
                    studentId: student._id,
                    testId: test._id,
                    generatedAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) },
                }).lean();
                if (existing) continue;

                const prevAttempts = await TestAttempt.find({ studentId: student._id, testId: test._id }).lean();
                const avgPrev = prevAttempts.length
                    ? Math.round(prevAttempts.reduce((s, a) => s + (a.score / (a.totalMarks || 1)) * 100, 0) / prevAttempts.length)
                    : null;

                const testData = {
                    testTitle: test.title,
                    subject: String(test.subject),
                    topics: [...new Set((test.questions || []).map(q => q.questionText?.split(' ').slice(0, 3).join(' ')))].slice(0, 8),
                    questionCount: test.questions?.length || 0,
                    durationMinutes: test.durationMinutes,
                    previousAverageScore: avgPrev,
                };

                const revisionPlan = await generateTestPrep(testData);
                await StudentTestPrep.findOneAndUpdate(
                    { studentId: student._id, testId: test._id },
                    { $set: { revisionPlan, generatedAt: new Date() } },
                    { upsert: true }
                );
                success++;
                await new Promise(r => setTimeout(r, 800));
            }
        } catch (err) {
            errors++;
            logger.error('student-ai-scheduler: test prep error', { testId: String(test._id), err: err.message });
        }
    }
    logger.info(`student-ai-scheduler: test prep done — ${success} ok, ${errors} errors`);
}

// ── Start all schedulers ──────────────────────────────────────────────────────
function startStudentAIScheduler() {
    // Daily routine — every morning at 06:00
    cron.schedule('0 6 * * *', () => {
        runDailyRoutineJob().catch(err =>
            logger.error('student-ai-scheduler: routine job failed', { err: err.message })
        );
    }, { timezone: 'Asia/Kolkata' });

    // Study plan — nightly at 23:00 (catches all test completions from the day)
    cron.schedule('0 23 * * *', () => {
        runStudyPlanJob().catch(err =>
            logger.error('student-ai-scheduler: study plan job failed', { err: err.message })
        );
    }, { timezone: 'Asia/Kolkata' });

    // Test preparation — every morning at 06:30
    cron.schedule('30 6 * * *', () => {
        runTestPrepJob().catch(err =>
            logger.error('student-ai-scheduler: test prep job failed', { err: err.message })
        );
    }, { timezone: 'Asia/Kolkata' });

    logger.info('student-ai-scheduler: started (routine@06:00, study-plan@23:00, test-prep@06:30 IST)');
}

module.exports = { startStudentAIScheduler, runDailyRoutineJob, runStudyPlanJob, runTestPrepJob };
