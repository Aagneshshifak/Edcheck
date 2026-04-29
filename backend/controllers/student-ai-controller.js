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
const TopicPerformance= require('../models/topicPerformanceSchema');
const {
    generateClassNotes, generateStudyPlan, generateDailyRoutine,
    generateTestPrep, generateAssignmentHelp,
} = require('../services/student-ai-service');
const { withAICache } = require('../services/ai-cache-service');

// Legacy in-memory cache (kept for generate-notes which is class-scoped, not user-scoped)
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

        // Force-invalidate if regenerate requested
        if (regenerate) {
            const { invalidateByUserId } = require('../services/ai-cache-service');
            await invalidateByUserId(studentId).catch(() => {});
            cache.del(`studyplan:${studentId}`);
        }

        const student = await Student.findById(studentId)
            .select('name examResult attendance classId sclassName')
            .lean();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const classId = student.classId || student.sclassName;

        const Sclass = require('../models/sclassSchema');
        const sclass = await Sclass.findById(classId).populate('subjects', 'subjectName subName').lean();
        const classSubjects = sclass?.subjects || [];

        const subjectNameMap = {};
        classSubjects.forEach(s => {
            subjectNameMap[String(s._id)] = s.subjectName || s.subName || 'Unknown Subject';
        });

        const subjectScores = {};
        for (const r of student.examResult || []) {
            const id = String(r.subjectId);
            if (!subjectScores[id]) subjectScores[id] = { total: 0, max: 0, count: 0 };
            subjectScores[id].total += r.marks;
            subjectScores[id].max   += r.maxMarks;
            subjectScores[id].count += 1;
        }

        const subjectPerformance = classSubjects.map(s => {
            const id = String(s._id);
            const name = s.subjectName || s.subName || 'Unknown';
            const scores = subjectScores[id];
            if (!scores || scores.max === 0) {
                return { subject: name, percentage: null, attempts: 0, status: 'no data' };
            }
            const pct = Math.round((scores.total / scores.max) * 100);
            return {
                subject:    name,
                percentage: pct,
                attempts:   scores.count,
                status:     pct < 50 ? 'weak' : pct < 70 ? 'average' : 'strong',
            };
        });

        const totalAtt   = student.attendance?.length || 0;
        const presentAtt = student.attendance?.filter(a => a.status === 'Present').length || 0;
        const attendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

        const attempts = await TestAttempt.find({ studentId })
            .populate({ path: 'testId', select: 'title subject', populate: { path: 'subject', select: 'subjectName subName' } })
            .select('score totalMarks submittedAt testId')
            .sort({ submittedAt: -1 })
            .limit(20)
            .lean();

        const testResults = attempts.map(a => ({
            testTitle:    a.testId?.title || 'Test',
            subject:      a.testId?.subject?.subjectName || a.testId?.subject?.subName || 'Unknown',
            scorePercent: a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0,
            date:         a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : 'N/A',
        }));

        const avgTestScore = testResults.length
            ? Math.round(testResults.reduce((s, t) => s + t.scorePercent, 0) / testResults.length)
            : 0;

        const studentData = {
            name:                student.name,
            attendancePercentage: attendancePct,
            averageTestScore:    avgTestScore,
            recentTestResults:   testResults.slice(0, 5),
            subjectPerformance,
            allSubjects:         classSubjects.map(s => s.subjectName || s.subName),
            weakSubjects:        subjectPerformance.filter(s => s.status === 'weak').map(s => s.subject),
            averageSubjects:     subjectPerformance.filter(s => s.status === 'average').map(s => s.subject),
            strongSubjects:      subjectPerformance.filter(s => s.status === 'strong').map(s => s.subject),
            noDataSubjects:      subjectPerformance.filter(s => s.status === 'no data').map(s => s.subject),
        };

        const { data: studyPlan, fromCache, cachedAt } = await withAICache({
            endpointName: 'generate-study-plan',
            userId:       studentId,
            userRole:     'student',
            inputObj:     { studentId, subjectPerformance: studentData.subjectPerformance, avgTestScore },
            relatedTestId: null,
            fn: () => generateStudyPlan(studentData),
        });

        const doc = await StudentStudyPlan.findOneAndUpdate(
            { studentId },
            { $set: { studyPlan, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ ...doc.toObject(), fromCache, cachedAt });
    } catch (err) { return errResponse(res, err); }
};

// ── 3. Generate Daily Routine ─────────────────────────────────────────────────
const generateDailyRoutineHandler = async (req, res) => {
    try {
        const { studentId, regenerate } = req.body;
        if (!studentId) return res.status(400).json({ message: 'studentId is required' });

        if (regenerate) {
            cache.del(`routine:${studentId}`);
        }

        const student = await Student.findById(studentId).select('name classId sclassName examResult').lean();
        if (!student) return res.status(404).json({ message: 'Student not found' });

        const classId = student.classId || student.sclassName;

        const Sclass = require('../models/sclassSchema');
        const sclass = await Sclass.findById(classId).populate('subjects', 'subjectName subName').lean();
        const classSubjects = (sclass?.subjects || []).map(s => s.subjectName || s.subName);

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
            .select('subjectName subName topics').lean();
        const weakSubjectNames = weakSubjectDocs.map(s => s.subjectName || s.subName);

        async function buildWeakTopicsPerSubject(subjectDocs, cId) {
            const subjectIds = subjectDocs.map(s => s._id);
            const topicPerfs = await TopicPerformance.find({
                subjectId: { $in: subjectIds },
                classId: cId,
            }).lean();

            const perfMap = {};
            for (const tp of topicPerfs) {
                const key = String(tp.subjectId);
                if (!perfMap[key]) perfMap[key] = [];
                perfMap[key].push({ topic: tp.topic, score: tp.averageScore, severity: tp.severity });
            }

            const result = {};
            for (const subj of subjectDocs) {
                const id = String(subj._id);
                const name = subj.subjectName || subj.subName;
                const perfs = perfMap[id] || [];
                const weakTopics = perfs
                    .filter(p => p.severity === 'high' || p.score < 60)
                    .sort((a, b) => a.score - b.score)
                    .map(p => p.topic)
                    .slice(0, 4);
                result[name] = weakTopics.length > 0
                    ? weakTopics
                    : (subj.topics || []).slice(0, 3);
            }
            return result;
        }

        const weakTopicsPerSubject = await buildWeakTopicsPerSubject(weakSubjectDocs, classId);

        const studyPlan = await StudentStudyPlan.findOne({ studentId }).lean();
        const dailyRevisionHours = studyPlan?.studyPlan?.dailyRevisionHours || 2;
        const weakFocus = studyPlan?.studyPlan?.weakSubjectFocus || [];

        const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const todayName = days[new Date().getDay()];
        const todayStudyPlan = studyPlan?.studyPlan?.weeklySchedule?.[todayName] || '';

        const assignments = await Assignment.find({ classId }).lean();

        const Timetable = require('../models/timetableSchema');
        const today = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
        const timetable = await Timetable.findOne({ classId, day: today })
            .populate('periods.subject', 'subjectName subName').lean();
        const schoolPeriods = timetable?.periods?.map(p => ({
            period:    p.periodNumber,
            subject:   p.subject?.subjectName || p.subject?.subName || 'Class',
            startTime: p.startTime,
            endTime:   p.endTime,
        })) || [];

        const routineData = {
            studentName:          student.name,
            allSubjects:          classSubjects,
            weakSubjects:         weakSubjectNames.length > 0 ? weakSubjectNames : classSubjects.slice(0, 2),
            weakTopicsPerSubject,
            weakSubjectFocus:     weakFocus.map(w => `${w.subject}: ${w.hoursPerDay}h/day`),
            todayStudyPlanNote:   todayStudyPlan || `Focus on ${weakSubjectNames[0] || classSubjects[0] || 'weak subjects'}`,
            homeworkWorkload:     assignments.length > 3 ? 'heavy' : assignments.length > 1 ? 'moderate' : 'light',
            pendingAssignments:   assignments.length,
            dailyRevisionHours,
            schoolPeriodsToday:  schoolPeriods.length,
            schoolSchedule:      schoolPeriods,
            sleepRequirement:    '8 hours',
        };

        const { data: routine, fromCache, cachedAt } = await withAICache({
            endpointName: 'generate-daily-routine',
            userId:       studentId,
            userRole:     'student',
            inputObj:     { studentId, weakSubjectNames, todayName, pendingAssignments: assignments.length },
            relatedTestId: null,
            fn: () => generateDailyRoutine(routineData),
        });

        const doc = await StudentRoutine.findOneAndUpdate(
            { studentId },
            { $set: { routine, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ ...doc.toObject(), fromCache, cachedAt });
    } catch (err) { return errResponse(res, err); }
};

// ── 4. Prepare for Next Test ──────────────────────────────────────────────────
const prepareNextTestHandler = async (req, res) => {
    try {
        const { studentId, testId } = req.body;
        if (!studentId || !testId) return res.status(400).json({ message: 'studentId and testId are required' });

        const test = await Test.findById(testId).populate('subject', 'subjectName subName').lean();
        if (!test) return res.status(404).json({ message: 'Test not found' });

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

        const { data: revisionPlan, fromCache, cachedAt } = await withAICache({
            endpointName:  'prepare-next-test',
            userId:        studentId,
            userRole:      'student',
            inputObj:      { studentId, testId, avgPrev },
            relatedTestId: testId,
            fn: () => generateTestPrep(testData),
        });

        const doc = await StudentTestPrep.findOneAndUpdate(
            { studentId, testId },
            { $set: { revisionPlan, generatedAt: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ ...doc.toObject(), fromCache, cachedAt });
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
