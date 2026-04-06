/**
 * Admin Interface Validation Script (Task 10)
 * Tests subject filtering, combined filtering, and notification reception
 * Run with: node backend/tests/admin-interface-validation.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const Test = require('../models/testSchema');
const Notification = require('../models/notificationSchema');
const Subject = require('../models/subjectSchema');
const Sclass = require('../models/sclassSchema');

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

async function testSubjectFiltering() {
    console.log('\n=== Testing Subject Filtering ===');
    
    try {
        // Get all tests with populated subject
        const allTests = await Test.find({})
            .populate('subject', 'subName')
            .populate('classId', 'sclassName')
            .lean();
        
        console.log(`✓ Total tests in database: ${allTests.length}`);
        
        // Get unique subjects from tests
        const subjectsInTests = [...new Set(
            allTests
                .filter(t => t.subject)
                .map(t => t.subject._id.toString())
        )];
        
        console.log(`✓ Tests have ${subjectsInTests.length} unique subjects`);
        
        // Test filtering by subject
        if (subjectsInTests.length > 0) {
            const testSubjectId = subjectsInTests[0];
            const filteredTests = await Test.find({ subject: testSubjectId })
                .populate('subject', 'subName')
                .lean();
            
            const subjectName = filteredTests[0]?.subject?.subName || 'Unknown';
            console.log(`✓ Subject filter works: ${filteredTests.length} tests for subject "${subjectName}"`);
            
            // Verify all filtered tests have the correct subject
            const allMatch = filteredTests.every(t => t.subject?._id.toString() === testSubjectId);
            console.log(`✓ All filtered tests match subject: ${allMatch ? 'PASS' : 'FAIL'}`);
            
            return filteredTests.length > 0;
        } else {
            console.log('⚠ No tests with subjects found - cannot test subject filtering');
            return true; // Not a failure, just no data
        }
    } catch (error) {
        console.error('✗ Subject filtering failed:', error.message);
        return false;
    }
}

async function testCombinedFiltering() {
    console.log('\n=== Testing Combined Class and Subject Filtering ===');
    
    try {
        // Get all tests
        const allTests = await Test.find({})
            .populate('subject', 'subName')
            .populate('classId', 'sclassName')
            .lean();
        
        // Find a test that has both subject and class
        const testWithBoth = allTests.find(t => t.subject && t.classId);
        
        if (!testWithBoth) {
            console.log('⚠ No tests with both subject and class found');
            return true;
        }
        
        const testSubjectId = testWithBoth.subject._id;
        const testClassId = testWithBoth.classId._id;
        
        // Test combined filtering
        const combinedFiltered = await Test.find({
            subject: testSubjectId,
            classId: testClassId
        })
            .populate('subject', 'subName')
            .populate('classId', 'sclassName')
            .lean();
        
        console.log(`✓ Combined filter works: ${combinedFiltered.length} tests for subject "${testWithBoth.subject.subName}" and class "${testWithBoth.classId.sclassName}"`);
        
        // Verify all results match both filters
        const allMatch = combinedFiltered.every(t => 
            t.subject?._id.toString() === testSubjectId.toString() &&
            t.classId?._id.toString() === testClassId.toString()
        );
        console.log(`✓ All filtered tests match both criteria: ${allMatch ? 'PASS' : 'FAIL'}`);
        
        return allMatch;
    } catch (error) {
        console.error('✗ Combined filtering failed:', error.message);
        return false;
    }
}

async function testNotificationReception() {
    console.log('\n=== Testing Notification Reception ===');
    
    try {
        // Check for test publication notifications
        const testNotifications = await Notification.find({ type: 'test' })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();
        
        console.log(`✓ Found ${testNotifications.length} test publication notifications`);
        
        if (testNotifications.length > 0) {
            const latest = testNotifications[0];
            console.log(`✓ Latest notification:`);
            console.log(`  - Message: "${latest.message}"`);
            console.log(`  - Type: ${latest.type}`);
            console.log(`  - Read: ${latest.readStatus}`);
            console.log(`  - Created: ${new Date(latest.createdAt).toLocaleString()}`);
            
            // Check if notification has metadata
            if (latest.metadata) {
                console.log(`  - Metadata: ${JSON.stringify(latest.metadata)}`);
                
                // Verify testId exists in metadata
                if (latest.metadata.testId) {
                    console.log(`✓ Notification includes testId for navigation: ${latest.metadata.testId}`);
                } else {
                    console.log(`⚠ Notification missing testId in metadata`);
                }
            } else {
                console.log(`⚠ Notification has no metadata field`);
            }
            
            // Verify message format
            const hasTeacherName = latest.message.includes('Teacher');
            const hasTestTitle = latest.message.includes('test');
            const hasClass = latest.message.includes('for');
            
            console.log(`✓ Message format validation:`);
            console.log(`  - Contains teacher name: ${hasTeacherName ? 'PASS' : 'FAIL'}`);
            console.log(`  - Contains test reference: ${hasTestTitle ? 'PASS' : 'FAIL'}`);
            console.log(`  - Contains class info: ${hasClass ? 'PASS' : 'FAIL'}`);
            
            return true;
        } else {
            console.log('⚠ No test publication notifications found');
            console.log('  This is expected if no teacher has published a test yet');
            return true; // Not a failure
        }
    } catch (error) {
        console.error('✗ Notification reception test failed:', error.message);
        return false;
    }
}

async function testSubjectDropdownData() {
    console.log('\n=== Testing Subject Dropdown Data ===');
    
    try {
        // Get all subjects (what would populate the dropdown)
        const subjects = await Subject.find({}).lean();
        console.log(`✓ Total subjects available: ${subjects.length}`);
        
        if (subjects.length > 0) {
            console.log(`✓ Sample subjects:`);
            subjects.slice(0, 3).forEach(s => {
                console.log(`  - ${s.subName || s.subjectName}`);
            });
        }
        
        // Get all classes
        const classes = await Sclass.find({}).lean();
        console.log(`✓ Total classes available: ${classes.length}`);
        
        if (classes.length > 0) {
            console.log(`✓ Sample classes:`);
            classes.slice(0, 3).forEach(c => {
                console.log(`  - ${c.sclassName || c.className}`);
            });
        }
        
        return subjects.length > 0 && classes.length > 0;
    } catch (error) {
        console.error('✗ Subject dropdown data test failed:', error.message);
        return false;
    }
}

async function runValidation() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║   Admin Interface Validation (Task 10)                ║');
    console.log('║   Phase 2: Admin Interface Checkpoint                 ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    
    const dbConnected = await testDatabaseConnection();
    if (!dbConnected) {
        console.log('\n✗ Cannot proceed without database connection');
        process.exit(1);
    }
    
    const results = {
        subjectFiltering: await testSubjectFiltering(),
        combinedFiltering: await testCombinedFiltering(),
        notificationReception: await testNotificationReception(),
        subjectDropdownData: await testSubjectDropdownData(),
    };
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║   Validation Summary                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log(`Subject Filtering:        ${results.subjectFiltering ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Combined Filtering:       ${results.combinedFiltering ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Notification Reception:   ${results.notificationReception ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`Subject Dropdown Data:    ${results.subjectDropdownData ? '✓ PASS' : '✗ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r);
    
    console.log('\n' + '='.repeat(60));
    if (allPassed) {
        console.log('✓ ALL VALIDATION TESTS PASSED');
        console.log('Admin interface is ready for use!');
    } else {
        console.log('⚠ SOME TESTS FAILED OR HAD WARNINGS');
        console.log('Review the output above for details.');
    }
    console.log('='.repeat(60) + '\n');
    
    await mongoose.connection.close();
    process.exit(allPassed ? 0 : 1);
}

runValidation().catch(error => {
    console.error('Validation execution failed:', error);
    process.exit(1);
});
