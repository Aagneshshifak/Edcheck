/**
 * migrate-attempt-history.js
 *
 * Backfill: reads every document in the legacy `testAttempt` collection
 * and creates a matching record in `testAttemptHistory` (if one does not
 * already exist for the same attempt).
 *
 * Run from the backend directory:
 *   node scripts/migrate-attempt-history.js
 */

'use strict';

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');

// Must require all models referenced by populate() before running any query
require('../models/subjectSchema');          // registers 'subject'
require('../models/teacherSchema');          // registers 'teacher'
require('../models/sclassSchema');           // registers 'sclass'
require('../models/adminSchema');            // registers 'admin'

const TestAttempt        = require('../models/testAttemptSchema');
const TestAttemptHistory = require('../models/testAttemptHistorySchema');
const Test               = require('../models/testSchema');
const Student            = require('../models/studentSchema');

function gradeFromPct(pct) {
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B';
    if (pct >= 60) return 'C';
    if (pct >= 50) return 'D';
    return 'F';
}

async function migrate() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');

    const attempts = await TestAttempt.find({}).lean();
    console.log(`Found ${attempts.length} legacy attempt(s) to process`);

    let created = 0;
    let skipped = 0;
    let errors  = 0;

    for (const attempt of attempts) {
        try {
            // Skip if already migrated
            const exists = await TestAttemptHistory.findOne({ attemptId: attempt._id });
            if (exists) {
                console.log(`  SKIP  ${attempt._id} — already in history`);
                skipped++;
                continue;
            }

            const test = await Test.findById(attempt.testId)
                .populate('subject',   'subName subjectName')
                .populate('createdBy', 'name')
                .populate('classId',   'sclassName className')
                .lean();

            const student = await Student.findById(attempt.studentId).lean();

            if (!test || !student) {
                console.warn(`  SKIP  ${attempt._id} — test or student not found`);
                skipped++;
                continue;
            }

            const questions  = test.questions || [];
            const answers    = attempt.answers || [];
            const totalMarks = attempt.totalMarks || questions.reduce((s, q) => s + (q.marks || 1), 0);
            const finalScore = attempt.score ?? 0;
            const percentage = totalMarks > 0
                ? parseFloat(((finalScore / totalMarks) * 100).toFixed(2))
                : 0;

            // Build per-question responses
            const questionResponses = questions.map((q, idx) => {
                const raw           = answers[idx];
                const studentAnswer = (raw === undefined || raw === null || raw === -1) ? null : raw;
                const isSkipped     = studentAnswer === null;
                const isCorrect     = !isSkipped && Number(studentAnswer) === Number(q.correctAnswer);
                return {
                    questionIndex:    idx,
                    questionText:     q.questionText || '',
                    questionType:     q.questionType || 'mcq',
                    topic:            q.topic || 'General',
                    difficulty:       q.difficulty || 'medium',
                    studentAnswer,
                    correctAnswer:    q.correctAnswer,
                    isCorrect,
                    isSkipped,
                    marksObtained:    isCorrect ? (q.marks || 1) : 0,
                    maxMarks:         q.marks || 1,
                    responseTimeMs:   0,
                    numberOfAttempts: 1,
                };
            });

            const correctAnswers     = questionResponses.filter(r => r.isCorrect).length;
            const skippedQuestions   = questionResponses.filter(r => r.isSkipped).length;
            const wrongAnswers       = questions.length - correctAnswers - skippedQuestions;
            const attemptedQuestions = questions.length - skippedQuestions;

            // Build topic-wise breakdown
            const topicMap = {};
            for (const qr of questionResponses) {
                const t = qr.topic || 'General';
                if (!topicMap[t]) topicMap[t] = { topic: t, totalQuestions: 0, correctAnswers: 0, wrongAnswers: 0, skipped: 0, marksObtained: 0, maxMarks: 0 };
                topicMap[t].totalQuestions++;
                topicMap[t].maxMarks      += qr.maxMarks;
                topicMap[t].marksObtained += qr.marksObtained;
                if (qr.isSkipped)      topicMap[t].skipped++;
                else if (qr.isCorrect) topicMap[t].correctAnswers++;
                else                   topicMap[t].wrongAnswers++;
            }
            const topicPerformance = Object.values(topicMap).map(tp => ({
                ...tp,
                accuracy: tp.totalQuestions > 0
                    ? parseFloat((tp.correctAnswers / tp.totalQuestions).toFixed(4))
                    : 0,
            }));

            const teacherName      = test.createdBy?.name || '';
            const subjectName      = test.subject?.subName || test.subject?.subjectName || '';
            const className        = test.classId?.sclassName || test.classId?.className || '';
            const timeTakenSeconds = attempt.startedAt && attempt.submittedAt
                ? Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 1000)
                : 0;

            await TestAttemptHistory.create({
                studentId:          attempt.studentId,
                testId:             attempt.testId,
                attemptId:          attempt._id,
                subjectId:          test.subject?._id   || null,
                classId:            test.classId?._id   || null,
                teacherId:          test.createdBy?._id || null,
                schoolId:           test.school         || null,
                testTitle:          test.title          || '',
                subjectName,
                teacherName,
                className,
                startedAt:          attempt.startedAt   || null,
                submittedAt:        attempt.submittedAt || attempt.createdAt,
                timeTakenSeconds,
                totalQuestions:     questions.length,
                attemptedQuestions,
                correctAnswers,
                wrongAnswers,
                skippedQuestions,
                finalScore,
                maxScore:           totalMarks,
                percentage,
                grade:              gradeFromPct(percentage),
                difficultyLevel:    'mixed',
                submissionType:     attempt.submissionType || 'manual',
                status:             'completed',
                accuracyRate:       questions.length > 0
                    ? parseFloat((correctAnswers / questions.length).toFixed(4)) : 0,
                completionRate:     questions.length > 0
                    ? parseFloat((attemptedQuestions / questions.length).toFixed(4)) : 0,
                avgResponseTimeMs:  0,
                topicPerformance,
                questionResponses,
            });

            console.log(`  OK    ${attempt._id}  student=${student.name}  score=${finalScore}/${totalMarks}  ${percentage}%`);
            created++;

        } catch (e) {
            console.error(`  ERR   ${attempt._id}:`, e.message);
            errors++;
        }
    }

    console.log('\n--- Migration complete ---');
    console.log(`  Created : ${created}`);
    console.log(`  Skipped : ${skipped}`);
    console.log(`  Errors  : ${errors}`);
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
