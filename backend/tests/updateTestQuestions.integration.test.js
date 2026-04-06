const mongoose = require("mongoose");
const Test = require("../models/testSchema");
const Teacher = require("../models/teacherSchema");

// Mock the models
jest.mock("../models/testSchema");
jest.mock("../models/teacherSchema");

// Import after mocking
const { updateTestQuestions } = require("../controllers/test-controller");

/**
 * Integration Tests for updateTestQuestions endpoint
 * 
 * **Validates: Requirements 2.6, 2.7, 6.6**
 * 
 * Tests the PUT /Test/:id/questions endpoint that allows teachers to add/update
 * questions for existing tests. Covers successful question addition, metadata
 * preservation, validation error responses, and authorization checks.
 */
describe("updateTestQuestions Integration Tests", () => {
    let req, res;

    beforeEach(() => {
        req = {
            params: { id: "test123" },
            body: {
                teacherId: "teacher123",
                questions: [
                    {
                        questionText: "What is 2+2?",
                        options: ["3", "4", "5", "6"],
                        correctAnswer: 1,
                        marks: 1,
                    },
                ],
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        jest.clearAllMocks();
    });

    describe("Successful Question Addition", () => {
        test("should successfully add questions to an empty test", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(Test.findById).toHaveBeenCalledWith("test123");
            expect(Teacher.findById).toHaveBeenCalledWith("teacher123");
            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                })
            );
        });

        test("should successfully update existing questions", async () => {
            const existingQuestions = [
                {
                    questionText: "Old question?",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: existingQuestions,
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.questions).toEqual(req.body.questions);
            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("should handle multiple questions correctly", async () => {
            req.body.questions = [
                {
                    questionText: "What is 2+2?",
                    options: ["3", "4", "5", "6"],
                    correctAnswer: 1,
                    marks: 1,
                },
                {
                    questionText: "What is 3+3?",
                    options: ["5", "6", "7", "8"],
                    correctAnswer: 1,
                    marks: 2,
                },
                {
                    questionText: "What is 5+5?",
                    options: ["8", "9", "10", "11"],
                    correctAnswer: 2,
                    marks: 3,
                },
            ];

            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.questions).toEqual(req.body.questions);
            expect(mockTest.questions.length).toBe(3);
            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("should handle questions with varying option counts (2-6)", async () => {
            req.body.questions = [
                {
                    questionText: "True or False?",
                    options: ["True", "False"],
                    correctAnswer: 0,
                    marks: 1,
                },
                {
                    questionText: "Pick one of six",
                    options: ["A", "B", "C", "D", "E", "F"],
                    correctAnswer: 3,
                    marks: 2,
                },
            ];

            const mockTest = {
                _id: "test123",
                title: "Mixed Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Mixed Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("Metadata Preservation", () => {
        test("should preserve all test metadata when updating questions", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                subject: "subject123",
                classId: "class123",
                school: "school123",
                durationMinutes: 30,
                createdBy: "admin123",
                isActive: false,
                shuffleQuestions: true,
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    subject: "subject123",
                    classId: "class123",
                    school: "school123",
                    durationMinutes: 30,
                    createdBy: "admin123",
                    isActive: false,
                    shuffleQuestions: true,
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            // Verify only questions were updated
            expect(mockTest.questions).toEqual(req.body.questions);
            expect(mockTest.title).toBe("Math Quiz");
            expect(mockTest.subject).toBe("subject123");
            expect(mockTest.classId).toBe("class123");
            expect(mockTest.school).toBe("school123");
            expect(mockTest.durationMinutes).toBe(30);
            expect(mockTest.createdBy).toBe("admin123");
            expect(mockTest.isActive).toBe(false);
            expect(mockTest.shuffleQuestions).toBe(true);
        });

        test("should not modify createdBy field when teacher adds questions", async () => {
            const adminId = "admin123";
            const mockTest = {
                _id: "test123",
                title: "Admin Created Test",
                classId: "class123",
                createdBy: adminId,
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Admin Created Test",
                    createdBy: adminId,
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.createdBy).toBe(adminId);
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("Validation Error Responses", () => {
        test("should return 400 for missing questions array", async () => {
            req.body.questions = undefined;

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Questions array is required",
            });
        });

        test("should return 400 for non-array questions", async () => {
            req.body.questions = "not an array";

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Questions array is required",
            });
        });

        test("should return 400 for empty question text", async () => {
            req.body.questions = [
                {
                    questionText: "",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Question text cannot be empty",
            });
        });

        test("should return 400 for whitespace-only question text", async () => {
            req.body.questions = [
                {
                    questionText: "   ",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Question text cannot be empty",
            });
        });

        test("should return 400 for too few options (1 option)", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["Only one"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Questions must have 2-6 options",
            });
        });

        test("should return 400 for too many options (7 options)", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["A", "B", "C", "D", "E", "F", "G"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Questions must have 2-6 options",
            });
        });

        test("should return 400 for invalid correctAnswer index (negative)", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["A", "B", "C"],
                    correctAnswer: -1,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Correct answer must be a valid option index",
            });
        });

        test("should return 400 for invalid correctAnswer index (out of range)", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["A", "B", "C"],
                    correctAnswer: 5,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Correct answer must be a valid option index",
            });
        });

        test("should return 400 for zero marks", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 0,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Marks must be greater than 0",
            });
        });

        test("should return 400 for negative marks", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question?",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: -5,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Marks must be greater than 0",
            });
        });

        test("should identify the correct question number in validation errors", async () => {
            req.body.questions = [
                {
                    questionText: "Valid question 1?",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
                {
                    questionText: "Valid question 2?",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
                {
                    questionText: "",
                    options: ["A", "B"],
                    correctAnswer: 0,
                    marks: 1,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 3: Question text cannot be empty",
            });
        });

        test("should stop at first validation error", async () => {
            req.body.questions = [
                {
                    questionText: "",
                    options: ["A"],
                    correctAnswer: 5,
                    marks: 0,
                },
            ];

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            // Should report the first error (empty text)
            expect(res.json).toHaveBeenCalledWith({
                message: "Question 1: Question text cannot be empty",
            });
        });
    });

    describe("Authorization Checks", () => {
        test("should return 404 for non-existent test", async () => {
            Test.findById.mockResolvedValue(null);

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                message: "Test not found",
            });
        });

        test("should return 403 for unauthorized teacher (different class)", async () => {
            const mockTest = {
                _id: "test123",
                classId: "class123",
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class456"], // Different class
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: "Unauthorized: Teacher does not teach this class",
            });
        });

        test("should return 403 when teacher not found", async () => {
            const mockTest = {
                _id: "test123",
                classId: "class123",
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(null);

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: "Unauthorized: Teacher not found",
            });
        });

        test("should authorize teacher with teachSclass (backward compatibility)", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachSclass: "class123", // Using old field
                teachClasses: null,
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("should authorize teacher when class is in teachClasses array", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockResolvedValue({
                    _id: "test123",
                    title: "Math Quiz",
                    questions: req.body.questions,
                    populate: jest.fn().mockReturnThis(),
                }),
                populate: jest.fn().mockReturnThis(),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class456", "class123", "class789"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe("Error Handling", () => {
        test("should return 500 for database errors during test lookup", async () => {
            Test.findById.mockRejectedValue(new Error("Database connection failed"));

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Database connection failed",
            });
        });

        test("should return 500 for database errors during save", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: "class123",
                questions: [],
                save: jest.fn().mockRejectedValue(new Error("Save failed")),
            };

            const mockTeacher = {
                _id: "teacher123",
                teachClasses: ["class123"],
            };

            Test.findById.mockResolvedValue(mockTest);
            Teacher.findById.mockResolvedValue(mockTeacher);

            await updateTestQuestions(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Save failed",
            });
        });
    });
});
