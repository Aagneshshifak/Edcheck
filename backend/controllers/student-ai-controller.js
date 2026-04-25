const NodeCache = require('node-cache');
const Student         = require('../models/studentSchema');
const Subject         = require('../models/subjectSchema');
const Test            = require('../models/testSchema');
const TestAttempt     = require('../models/testAttemptSchema');
const Assignment      = require('../models/assignmentSchema');
const StudentNotes    = require('../models/studentNotesSchema');
const StudentStudyPlan= require('../models/studentStudyPlanSchema');
const StudentRoutine  = require('../models/studentDailyRoutineSchema');
const StudentTestPrep = require('../models/studentTestPrepSchema');
const AssignmentHelp  = require('../models/studentAssignmentHelpSchema');
const {
    generateClassNotes, generateStudyPlan, generateDailyRoutine,
    generateTestPrep, generateAssignmentHelp,
} = require('../services/student-ai-service');

// Cache: TTL 6 hours
const cache = new NodeCache({ stdTTL: 21600 });

function isGroqError(err) {
    return err && (typeof err.status === 'number' || /^E(CONN|TIMEOUT|NOTFOUND)/.test(err.code || ''));
}

function errResponse(res, err) {
    if (err.message === 'AI returned an unexpected response format')
        return res.status(500).json({ message: err.message });
    if (isGroqError(err))
        return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again.' });
    return res.status(500).json({ message: err.message });
}

// ── 1. Generate Class Notes ───────────────────────────────────────────────────
const generateClassNotesHandler = async (req, res) => {
    try {
        const { classId, subjectId, topic } = req.body;
        if (!classId || !subjectId || !topic)
            return res.status(400).json({ message: 'classId, subjectId, and topic are required' });

        const cacheKey = `notes:${classId}:${subjectId}:${topic}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.status(200).json(cached);

        const subject = await Subject.findById(subjectId).select('subjectName subName').lean();
        const subjectName = subject?.subjectName || subject?.subName || 'Unknown Subject';

        const notesContent = await generateClassNotes(subjectName, topic);

        const doc = await StudentNotes.findOneAndUpdate(
            { classId, subjectId, topic },
            { $set: { notesContent, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        cache.set(cacheKey, doc);
        return res.status(200).json(doc);
    } catch (err) { return errResponse(res, err); }
};

// ── 2. Generate Study Plan ────────────────────────────────────────────────────
const generateStudyPlanHandler = async (req, res) => {
    try {
        const { studentId, regenerate } = req.body;
        if (!studentId) return res.status(400).json({ message: 'studentId is required' });

        // Skip cache if regenerate=true
        const cacheKey = `studyplan:${studentId}`;
        if (!regenerate) {
            const cached = cache.get(cacheKey);
            if (cached) return res.status(200).json(cached);
        } else {
            cache.del(cacheKey);
        }

        const student = await Student.findById(studentId)
            .select('name examResult attendance classId')
            .lean();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // ── Resolve subject names ──────────────────────────────────────────
        const subjectIds = [...new Set((student.examResult || []).map(r => String(r.subjectId)))];
        const subjects = await Subject.find({ _id: { $in: subjectIds } })
            .select('subjectName subName').lean();
        const subjectNameMap = {};
        subjects.forEach(s => { subjectNameMap[String(s._id)] = s.subjectName || s.subName; });

        // ── Per-subject exam performance ───────────────────────────────────
        const subjectScores = {};
        for (const r of student.examResult || []) {
            const id = String(r.subjectId);
            if (!subjectScores[id]) subjectScores[id] = { total: 0, max: 0, count: 0 };
            subjectScores[id].total += r.marks;
            subjectScores[id].max   += r.maxMarks;
            subjectScores[id].count += 1;
        }

        // ── Attendance % ───────────────────────────────────────────────────
        const totalAtt   = student.attendance?.length || 0;
        const presentAtt = student.attendance?.filter(a => a.status === 'Present').length || 0;
        const attendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

        // ── Test attempts with subject names ───────────────────────────────
        const attempts = await TestAttempt.find({ studentId })
            .populate({ path: 'testId', select: 'title subject', populate: { path: 'subject', select: 'subjectName subName' } })
            .select('score totalMarks submittedAt testId')
            .sort({ submittedAt: -1 })
            .limit(20)
            .lean();

        const testResults = attempts.map(a => ({
            testTitle:   a.testId?.title || 'Test',
            subject:     a.testId?.subject?.subjectName || a.testId?.subject?.subName || 'Unknown',
            scorePercent: a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0,
            date:        a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : 'N/A',
        }));

        // ── Build rich subject performance with names ──────────────────────
        const subjectPerformance = Object.entries(subjectScores).map(([id, v]) => ({
            subject:    subjectNameMap[id] || `Subject ${id.slice(-4)}`,
            percentage: v.max > 0 ? Math.round((v.total / v.max) * 100) : 0,
            attempts:   v.count,
            status:     v.max > 0 && (v.total / v.max) < 0.5 ? 'weak' :
                        v.max > 0 && (v.total / v.max) < 0.7 ? 'average' : 'strong',
        }));

        const avgTestScore = testResults.length
            ? Math.round(testResults.reduce((s, t) => s + t.scorePercent, 0) / testResults.length)
            : 0;

        const studentData = {
            name: student.name,
            attendancePercentage: attendancePct,
            averageTestScore: avgTestScore,
            recentTestResults: testResults.slice(0, 5),
            subjectPerformance,
            weakSubjects:   subjectPerformance.filter(s => s.status === 'weak').map(s => s.subject),
            averageSubjects: subjectPerformance.filter(s => s.status === 'average').map(s => s.subject),
            strongSubjects:  subjectPerformance.filter(s => s.status === 'strong').map(s => s.subject),
        };

        const studyPlan = await generateStudyPlan(studentData);

        const doc = await StudentStudyPlan.findOneAndUpdate(
            { studentId },
            { $set: { studyPlan, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        cache.set(cacheKey, doc);
        return res.status(200).json(doc);
    } catch (err) { return errResponse(res, err); }
};

// ── 3. Generate Daily Routine ─────────────────────────────────────────────────
const generateDailyRoutineHandler = async (req, res) => {
    try {
        const { studentId, regenerate } = req.body;
        if (!studentId) return res.status(400).json({ message: 'studentId is required' });

        const cacheKey = `routine:${studentId}`;
        if (!regenerate) {
            const cached = cache.get(cacheKey);
            if (cached) return res.status(200).json(cached);
        } else {
            cache.del(cacheKey);
        }

        const student = await Student.findById(studentId).select('name classId examResult').lean();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        // ── Resolve weak subject names ─────────────────────────────────────
        const subjectScores = {};
        for (const r of student.examResult || []) {
            const id = String(r.subjectId);
            if (!subjectScores[id]) subjectScores[id] = { total: 0, max: 0 };
            subjectScores[id].total += r.marks;
            subjectScores[id].max   += r.maxMarks;
        }
        const weakSubjectIds = Object.entries(subjectScores)
            .filter(([, v]) => v.max > 0 && (v.total / v.max) < 0.6)
            .map(([id]) => id);

        const weakSubjectDocs = await Subject.find({ _id: { $in: weakSubjectIds } })
            .select('subjectName subName').lean();
        const weakSubjectNames = weakSubjectDocs.map(s => s.subjectName || s.subName);

        // ── Study plan summary ─────────────────────────────────────────────
        const studyPlan = await StudentStudyPlan.findOne({ studentId }).lean();
        const dailyRevisionHours = studyPlan?.studyPlan?.dailyRevisionHours || 2;
        const weakFocus = studyPlan?.studyPlan?.weakSubjectFocus || [];

        // ── Homework workload ──────────────────────────────────────────────
        const assignments = await Assignment.find({ classId: student.classId }).lean();

        // ── Today's timetable ──────────────────────────────────────────────
        const Timetable = require('../models/timetableSchema');
        const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
        const timetable = await Timetable.findOne({ classId: student.classId, day: today })
            .populate('periods.subject', 'subjectName subName').lean();
        const schoolPeriods = timetable?.periods?.map(p => ({
            period:    p.periodNumber,
            subject:   p.subject?.subjectName || p.subject?.subName || 'Class',
            startTime: p.startTime,
            endTime:   p.endTime,
        })) || [];

        const routineData = {
            studentName:        student.name,
            homeworkWorkload:   assignments.length > 3 ? 'heavy' : assignments.length > 1 ? 'moderate' : 'light',
            pendingAssignments: assignments.length,
            dailyRevisionHours,
            weakSubjects:       weakSubjectNames,
            weakSubjectFocus:   weakFocus.map(w => `${w.subject}: ${w.hoursPerDay}h/day`),
            schoolPeriodsToday: schoolPeriods.length,
            schoolSchedule:     schoolPeriods,
            sleepRequirement:   '8 hours',
            gradeLevel:         'school student',
            instructions:       'Generate a detailed hour-by-hour schedule from 6:00 AM to 10:30 PM. Include specific subject names for revision slots. Balance study with health.',
        };

        const routine = await generateDailyRoutine(routineData);

        const doc = await StudentRoutine.findOneAndUpdate(
            { studentId },
            { $set: { routine, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        cache.set(cacheKey, doc);
        return res.status(200).json(doc);
    } catch (err) { return errResponse(res, err); }
};

// ── 4. Prepare for Next Test ──────────────────────────────────────────────────
const prepareNextTestHandler = async (req, res) => {
    try {
        const { studentId, testId } = req.body;
        if (!studentId || !testId) return res.status(400).json({ message: 'studentId and testId are required' });

        const cacheKey = `testprep:${studentId}:${testId}`;
        const cached = cache.get(cacheKey);
        if (cached) return res.status(200).json(cached);

        const test = await Test.findById(testId).populate('subject', 'subjectName subName').lean();
        if (!test) return res.status(404).json({ message: 'Test not found' });

        // Previous attempts for this student on this test
        const prevAttempts = await TestAttempt.find({ studentId, testId }).lean();
        const avgPrev = prevAttempts.length
            ? Math.round(prevAttempts.reduce((s, a) => s + (a.score / (a.totalMarks || 1)) * 100, 0) / prevAttempts.length)
            : null;

        const testData = {
            testTitle: test.title,
            subject: test.subject?.subjectName || test.subject?.subName || 'Unknown',
            topics: [...new Set((test.questions || []).map(q => q.questionText?.split(' ').slice(0, 3).join(' ')))].slice(0, 10),
            questionCount: test.questions?.length || 0,
            durationMinutes: test.durationMinutes,
            previousAverageScore: avgPrev,
        };

        const revisionPlan = await generateTestPrep(testData);

        const doc = await StudentTestPrep.findOneAndUpdate(
            { studentId, testId },
            { $set: { revisionPlan, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        cache.set(cacheKey, doc);
        return res.status(200).json(doc);
    } catch (err) { return errResponse(res, err); }
};

// ── 5. Assignment Help ────────────────────────────────────────────────────────
const assignmentHelpHandler = async (req, res) => {
    try {
        const { studentId, question } = req.body;
        if (!studentId || !question) return res.status(400).json({ message: 'studentId and question are required' });

        const solution = await generateAssignmentHelp(question);

        const doc = await AssignmentHelp.create({ studentId, question, solution });
        return res.status(200).json(doc);
    } catch (err) { return errResponse(res, err); }
};

// ── GET endpoints (fetch stored results) ──────────────────────────────────────
const getStudentNotes = async (req, res) => {
    try {
        const { classId, subjectId } = req.query;
        const filter = {};
        if (classId)   filter.classId   = classId;
        if (subjectId) filter.subjectId = subjectId;
        const notes = await StudentNotes.find(filter).sort({ generatedAt: -1 }).lean();
        return res.status(200).json({ notes });
    } catch (err) { return res.status(500).json({ message: err.message }); }
};

const getStudentStudyPlan = async (req, res) => {
    try {
        const doc = await StudentStudyPlan.findOne({ studentId: req.params.studentId }).lean();
        return res.status(200).json(doc || {});
    } catch (err) { return res.status(500).json({ message: err.message }); }
};

const getStudentRoutine = async (req, res) => {
    try {
        const doc = await StudentRoutine.findOne({ studentId: req.params.studentId }).lean();
        return res.status(200).json(doc || {});
    } catch (err) { return res.status(500).json({ message: err.message }); }
};

const getStudentTestPrep = async (req, res) => {
    try {
        const { studentId, testId } = req.params;
        const doc = await StudentTestPrep.findOne({ studentId, testId }).lean();
        return res.status(200).json(doc || {});
    } catch (err) { return res.status(500).json({ message: err.message }); }
};

const getAssignmentHelp = async (req, res) => {
    try {
        const logs = await AssignmentHelp.find({ studentId: req.params.studentId })
            .sort({ createdAt: -1 }).limit(20).lean();
        return res.status(200).json({ logs });
    } catch (err) { return res.status(500).json({ message: err.message }); }
};

module.exports = {
    generateClassNotesHandler,
    generateStudyPlanHandler,
    generateDailyRoutineHandler,
    prepareNextTestHandler,
    assignmentHelpHandler,
    getStudentNotes,
    getStudentStudyPlan,
    getStudentRoutine,
    getStudentTestPrep,
    getAssignmentHelp,
};
