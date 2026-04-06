# Task 10: Admin Interface Browser Validation Guide

## Overview
This guide provides step-by-step instructions to validate the admin interface enhancements implemented in Phase 2 (Tasks 7-9).

## Prerequisites
- Backend server running on port 5000
- Frontend server running on port 3000
- Admin account credentials
- Teacher account credentials (for testing notification flow)

## Validation Tests

### Test 1: Subject Filtering in Admin Test Oversight

**Objective**: Verify that the subject filter dropdown works correctly

**Steps**:
1. Log in as an administrator
2. Navigate to Admin Dashboard → Tests (or `/Admin/tests`)
3. Locate the filter controls at the top of the page
4. Verify you see two dropdowns:
   - **Class** filter (existing)
   - **Subject** filter (new)

**Expected Results**:
- ✓ Subject dropdown is visible next to Class dropdown
- ✓ Subject dropdown shows "All Subjects" as default option
- ✓ Subject dropdown is populated with subjects from the database
- ✓ Subjects list includes: Physics, Computer Science, Mathematics, etc.

**Test Actions**:
1. Select a specific subject from the dropdown (e.g., "Computer Science")
2. Observe the test list updates

**Expected Results**:
- ✓ Test list filters to show only tests for the selected subject
- ✓ All displayed tests have the selected subject
- ✓ Test count updates to reflect filtered results

**Test Actions**:
1. Select "All Subjects" from the dropdown

**Expected Results**:
- ✓ Test list shows all tests again (no subject filter applied)

---

### Test 2: Combined Class and Subject Filtering

**Objective**: Verify that class and subject filters work together correctly

**Steps**:
1. From the Admin Test Oversight page
2. Select a specific class from the Class dropdown (e.g., "Class 6 Section A")
3. Observe the filtered results
4. Now select a specific subject from the Subject dropdown (e.g., "Computer Science")

**Expected Results**:
- ✓ Test list shows only tests that match BOTH filters
- ✓ All displayed tests belong to the selected class AND subject
- ✓ If no tests match both criteria, "No tests found" message appears

**Test Actions**:
1. Change the class filter while keeping subject filter active
2. Observe the results update

**Expected Results**:
- ✓ Test list updates to show tests for new class + same subject
- ✓ Filters work independently and combine correctly

**Test Actions**:
1. Reset both filters to "All Classes" and "All Subjects"

**Expected Results**:
- ✓ All tests are displayed again

---

### Test 3: Notification Reception When Teacher Publishes Test

**Objective**: Verify that admin receives notification when teacher publishes a test

**Prerequisites**:
- You need access to both admin and teacher accounts
- Teacher account should have permission to add questions to tests

**Steps (Admin Side)**:
1. Log in as administrator
2. Navigate to Admin Dashboard
3. Locate the notification bell icon in the top-right corner
4. Note the current notification count (if any)
5. Keep this browser tab/window open

**Steps (Teacher Side)**:
1. Open a new browser window/tab (or use incognito mode)
2. Log in as a teacher
3. Navigate to Teacher Dashboard → Tests
4. Find a test with 0 questions (or create a test shell as admin first)
5. Click "Add Questions" button
6. Add at least one question:
   - Question text: "What is 2+2?"
   - Options: ["3", "4", "5", "6"]
   - Correct answer: Index 1 (which is "4")
   - Marks: 1
7. Click "Save Questions"
8. Click "Publish Test" button
9. Confirm the publication

**Expected Results (Teacher Side)**:
- ✓ Success message appears: "Test published successfully"
- ✓ Test status changes to "Active"
- ✓ Page redirects or updates to show published status

**Expected Results (Admin Side)**:
1. Switch back to the admin browser window
2. Observe the notification bell

**Expected Results**:
- ✓ Notification bell badge count increases by 1
- ✓ A toast notification appears in the bottom-right corner (if SSE is working)
- ✓ Toast shows: "Teacher [Name] published test '[Title]' for [Class] - [Subject] ([Duration] min)"
- ✓ Toast disappears after ~5 seconds

**Test Actions (Admin Side)**:
1. Click the notification bell icon
2. Observe the notification dropdown

**Expected Results**:
- ✓ Dropdown opens showing notification list
- ✓ New notification appears at the top
- ✓ Notification is marked as unread (blue indicator/highlight)
- ✓ Notification message format: "Teacher [Name] published test '[Title]' for [Class] - [Subject] ([Duration] min)"
- ✓ Notification shows timestamp

**Test Actions**:
1. Click on the notification

**Expected Results**:
- ✓ Notification is marked as read
- ✓ Browser navigates to the test detail page (`/Admin/tests/[testId]`)
- ✓ Test detail page shows the published test with questions

---

### Test 4: Subject Filter Persistence

**Objective**: Verify that filter selections persist during navigation

**Steps**:
1. From Admin Test Oversight page
2. Select a specific subject filter
3. Click on a test to view details
4. Use browser back button to return to test list

**Expected Results**:
- ✓ Subject filter selection is maintained (still shows selected subject)
- ✓ Test list remains filtered

---

### Test 5: Edge Cases

**Test 5a: No Tests for Selected Subject**
1. Select a subject that has no tests
2. **Expected**: "No tests found" message appears

**Test 5b: Subject Filter with Empty Subject**
1. If any tests have no subject assigned
2. Select "All Subjects"
3. **Expected**: Tests without subjects are still displayed

**Test 5c: Multiple Rapid Filter Changes**
1. Rapidly change subject filter multiple times
2. **Expected**: UI updates smoothly without errors or race conditions

---

## Validation Checklist

Use this checklist to track your validation progress:

- [ ] Subject filter dropdown is visible and populated
- [ ] Subject filter correctly filters tests by subject
- [ ] "All Subjects" option shows all tests
- [ ] Class filter still works correctly
- [ ] Combined class + subject filtering works correctly
- [ ] Filters can be reset independently
- [ ] Admin receives notification when teacher publishes test
- [ ] Notification appears in real-time (SSE working)
- [ ] Notification bell badge count updates
- [ ] Notification message format is correct
- [ ] Clicking notification navigates to test detail page
- [ ] Notification is marked as read after clicking
- [ ] Filter selections persist during navigation
- [ ] Edge cases handled gracefully

---

## Troubleshooting

### Subject Filter Not Showing
- Check browser console for errors
- Verify `/AllSubjects/:schoolId` API endpoint is working
- Check that subjects exist in the database

### Filters Not Working
- Check browser console for errors
- Verify `/Admin/tests/:schoolId?classId=X&subjectId=Y` API endpoint is working
- Check network tab to see if API calls are being made

### Notifications Not Appearing
- Verify SSE connection is established (check Network tab → EventSource)
- Check that notification was created in database
- Verify admin user ID matches notification recipient
- Check browser console for SSE errors

### Toast Not Appearing
- SSE connection may be down (notifications will still appear in bell dropdown)
- Check browser console for errors
- Verify `REACT_APP_BASE_URL` environment variable is set correctly

---

## Success Criteria

All validation tests pass when:
1. ✓ Subject filtering works correctly in isolation
2. ✓ Combined class and subject filtering works correctly
3. ✓ Admin receives notifications when teacher publishes test
4. ✓ Notification navigation works correctly
5. ✓ No console errors during normal operation
6. ✓ UI is responsive and updates smoothly

---

## Notes

- The backend validation script has already confirmed that:
  - Database queries for subject filtering work correctly
  - Combined filtering logic works correctly
  - Subject and class data is available
  
- This browser validation focuses on:
  - Frontend UI components
  - User interactions
  - Real-time notification delivery
  - End-to-end workflow

---

## Reporting Issues

If any validation test fails, please note:
1. Which test failed
2. What was expected
3. What actually happened
4. Any error messages in browser console
5. Screenshots if applicable

This information will help diagnose and fix any issues quickly.
