/**
 * Manual API Test Script
 * Tests the key endpoints implemented in Phase 1
 * Run with: node tests/manual-api-test.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Test = require('../models/testSchema');
const { validateQuestion } = require('../controllers/test-controller');

async function testDatabaseConnection() {
    console.log('\n=== Testing Database Connection ===');
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('✓ Database connected successfully');
        return true;
    } catch (error) {
        console.error('✗ Database connection failed:', error.message);
        return false;
    }
}

async function testQuestionValidation() {
    console.log('\n=== Testing Question Validation ===');
    
    // Test valid question
    const validQuestion = {
        questionText: "What is 2+2?",
        options: ["3", "4", "5", "6"],
        correctAnswer: 1,
        marks: 1
    };
    const validResult = validateQuestion(validQuestion);
    console.log('✓ Valid question:', validResult === null ? 'PASS' : 'FAIL');
    
    // Test invalid question (empty text)
    const invalidQuestion = {
        questionText: "",
        options: ["A", "B"],
        correctAnswer: 0,
        marks: 1
    };
    const invalidResult = validateQuestion(invalidQuestion);
    console.log('✓ Invalid question detection:', invalidResult !== null ? 'PASS' : 'FAIL');
    
    return true;
}

async function testTestModel() {
    console.log('\n=== Testing Test Model Operations ===');
    
    try {
        // Count existing tests
        const count = await Test.countDocuments();
        console.log(`✓ Found ${count} existing tests in database`);
        
        // Test query with filters (subject and class)
        const testsWithFilters = await Test.find({})
            .populate('subject', 'subName')
            .populate('classId', 'sclassName')
            .limit(5)
            .lean();
        
        console.log(`✓ Query with population works: ${testsWithFilters.length} tests retrieved`);
        
        if (testsWithFilters.length > 0) {
            const sample = testsWithFilters[0];
            console.log(`  Sample test: "${sample.title}"`);
            console.log(`  - Questions: ${sample.questions?.length || 0}`);
            console.log(`  - Active: ${sample.isActive}`);
            console.log(`  - Subject: ${sample.subject?.subName || 'N/A'}`);
            console.log(`  - Class: ${sample.classId?.sclassName || 'N/A'}`);
        }
        
        return true;
    } catch (error) {
        console.error('✗ Test model operations failed:', error.message);
        return false;
    }
}

async function testSubjectFiltering() {
    console.log('\n=== Testing Subject Filtering ===');
    
    try {
        // Get all tests
        const allTests = await Test.find({}).lean();
        console.log(`✓ Total tests: ${allTests.length}`);
        
        // Get unique subjects
        const subjects = [...new Set(allTests.map(t => t.subject?.toString()).filter(Boolean))];
        console.log(`✓ Unique subjects: ${subjects.length}`);
        
        // Test filtering by subject
        if (subjects.length > 0) {
            const testSubject = subjects[0];
            const filtered = await Test.find({ subject: testSubject }).lean();
            console.log(`✓ Filtering by subject works: ${filtered.length} tests for subject ${testSubject}`);
        }
        
        return true;
    } catch (error) {
        console.error('✗ Subject filtering failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('Starting Backend API Validation Tests...');
    console.log('==========================================');
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.log('\n✗ Cannot proceed without database connection');
        process.exit(1);
    }
    
    await testQuestionValidation();
    await testTestModel();
    await testSubjectFiltering();
    
    console.log('\n==========================================');
    console.log('Backend API Validation Complete!');
    console.log('==========================================\n');
    
    await mongoose.connection.close();
    process.exit(0);
}

runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
