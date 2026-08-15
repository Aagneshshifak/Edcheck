require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('../models/studentSchema');
const Subject = require('../models/subjectSchema');
const Test = require('../models/testSchema');
require('../models/sclassSchema');

const MONGODB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017/edcheck';

async function run() {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected.\n');

        // 1. Find a student to target their classId
        const student = await Student.findOne({}).populate('sclassName');
        if (!student) {
            console.log('No students found in DB.');
            process.exit(1);
        }

        const classId = student.classId || student.sclassName._id || student.sclassName;
        const schoolId = student.schoolId || student.school;

        console.log(`Targeting Class: ${classId} (Student: ${student.name})\n`);

        // 2. Find all subjects for this class
        const subjects = await Subject.find({ sclassName: classId }).lean();
        console.log(`Found ${subjects.length} subjects for this class.`);

        let createdCount = 0;

        for (const sub of subjects) {
            const subName = sub.subjectName || sub.subName;
            const topics = sub.topics || [];
            
            if (topics.length === 0) {
                // If subject has no topics defined in DB, create some dummy topics based on subject name
                topics.push({ topicName: `${subName} Basics` }, { topicName: `Advanced ${subName}` });
            }

            console.log(`\nCreating comprehensive test for ${subName}...`);

            const testQuestions = [];
            
            // Build 1 question per topic
            topics.forEach((t, i) => {
                const topicName = typeof t === 'string' ? t : (t.topicName || `Topic ${i+1}`);
                
                testQuestions.push({
                    questionText: `What is a key concept in ${topicName}? (Auto-generated comprehensive question)`,
                    options: [
                        `Correct concept for ${topicName}`,
                        `Incorrect option A`,
                        `Incorrect option B`,
                        `Incorrect option C`
                    ],
                    correctAnswer: 1, 
                    marks: 10,
                    topic: topicName,
                    questionType: 'mcq',
                    difficulty: 'medium'
                });
            });

            // Add one short answer question for every subject
            testQuestions.push({
                questionText: `In 3-4 sentences, summarize the core principles of ${subName}.`,
                options: [],
                correctAnswer: null,
                marks: 20,
                topic: 'General Overview',
                questionType: 'short_answer',
                difficulty: 'hard'
            });

            // Add one document upload question for Math
            if (subName.toLowerCase().includes('math')) {
                testQuestions.push({
                    questionText: `Please solve the following differential equation step-by-step on a piece of paper, and upload a document or clear photo of your work.`,
                    options: [],
                    correctAnswer: null,
                    marks: 30,
                    topic: 'Advanced Calculus',
                    questionType: 'file_upload',
                    difficulty: 'challenge'
                });
            }

            const newTest = new Test({
                title: `Comprehensive ${subName} Evaluation`,
                subject: sub._id,
                classId: classId,
                school: schoolId,
                // studentId: student._id, // Assign to class generally so ANY student in class sees it
                durationMinutes: 60,
                questions: testQuestions,
                shuffleQuestions: false,
                isActive: true
            });

            await newTest.save();
            console.log(` ✅ Saved Test: "Comprehensive ${subName} Evaluation" with ${testQuestions.length} topic questions.`);
            createdCount++;
        }

        console.log(`\nSuccessfully created ${createdCount} comprehensive tests! They are now visible in the Student Dashboard.`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding tests:', error);
        process.exit(1);
    }
}

run();
