require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/studentSchema');
const Subject = require('../models/subjectSchema');
const { generateAssessment } = require('../services/assessmentGenerator');
const pipeline = require('../services/adaptiveLearning/adaptivePipeline');

const MONGODB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017/edcheck'; // fallback

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected.');

        const students = await Student.find({}).lean();
        console.log(`Found ${students.length} students in the database.`);

        let count = 0;

        for (const student of students) {
            const classId = student.classId || student.sclassName;
            if (!classId) {
                console.log(`Skipping student ${student.name} (${student._id}): no class assigned`);
                continue;
            }

            const schoolId = student.schoolId || student.school;

            // Find subjects for this class
            const subjectsDoc = await Subject.find({ sclassName: classId }).lean();
            if (!subjectsDoc || subjectsDoc.length === 0) {
                console.log(`Skipping student ${student.name} (${student._id}): no subjects found for class`);
                continue;
            }

            console.log(`Processing student ${student.name} (${student._id}) — found ${subjectsDoc.length} subjects`);

            const analytics = await pipeline.getStudentAnalytics(student._id.toString());
            const dskp = analytics.profile ? {
                overallMastery: analytics.profile.scores?.overallMastery || 0,
                readinessScore: analytics.profile.scores?.readinessScore || 0,
                consistencyScore: analytics.profile.scores?.consistencyScore || 0,
                engagementScore: analytics.profile.scores?.engagementScore || 0,
                confidenceScore: analytics.profile.scores?.confidenceScore || 0,
                learningPace: analytics.profile.scores?.learningPace || 0,
                retentionEstimate: analytics.profile.scores?.retentionEstimate || 0,
                weakTopics: analytics.profile.weakTopics || [],
                strongTopics: analytics.profile.strongTopics || [],
                topicDetails: analytics.masteryRecords || [],
                difficultyRecommendations: analytics.latestDiffRecs || []
            } : {
                overallMastery: 0,
                readinessScore: 0,
                consistencyScore: 0,
                engagementScore: 0,
                confidenceScore: 0,
                learningPace: 0,
                retentionEstimate: 0,
                weakTopics: [],
                strongTopics: [],
                topicDetails: [],
                difficultyRecommendations: []
            };

            for (const subjectDoc of subjectsDoc) {
                const subjectsArr = [{
                    name: subjectDoc.subjectName || subjectDoc.subName || 'Subject',
                    topics: subjectDoc.topics || []
                }];

                try {
                    await generateAssessment({
                        studentId: student._id.toString(),
                        subjectId: subjectDoc._id.toString(),
                        classId: classId.toString(),
                        schoolId: schoolId ? schoolId.toString() : undefined,
                        totalQuestions: 10,
                        durationMinutes: 30,
                        dskp,
                        subjects: subjectsArr
                    });
                    console.log(` - Generated test for subject: ${subjectsArr[0].name}`);
                    count++;
                } catch (err) {
                    console.error(` - Error generating test for subject ${subjectsArr[0].name}:`, err.message);
                }
            }
        }

        console.log(`\nSuccessfully generated ${count} personalized tests across all students.`);
        process.exit(0);

    } catch (err) {
        console.error('Fatal Error:', err);
        process.exit(1);
    }
}

run();
