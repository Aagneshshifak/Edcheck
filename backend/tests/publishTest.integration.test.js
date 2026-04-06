const mongoose = require("mongoose");
const Test = require("../models/testSchema");
const Teacher = require("../models/teacherSchema");
const Admin = require("../models/adminSchema");

jest.mock("../models/testSchema");
jest.mock("../models/teacherSchema");
jest.mock("../models/adminSchema");

jest.mock("../controllers/notification-controller", () => ({
    createNotifications: jest.fn().mockResolvedValue(undefined),
}));

const { publishTest } = require("../controllers/test-controller");
const { createNotifications } = require("../controllers/notification-controller");

/**
 * Integration Tests for publishTest endpoint
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.8**
 */
describe("publishTest Integration Tests", () => {
    let req, res;

    const createMockQuery = (resolvedValue) => {
        const mockQuery = {
            populate: jest.fn(function() {
                return this;
            }),
        };
        // The second populate call should resolve with the value
        mockQuery.populate.mockImplementationOnce(function() { return this; });
        mockQuery.populate.mockResolvedValueOnce(resolvedValue);
        return mockQuery;
    };

    beforeEach(() => {
        req = { params: { id: "test123" }, body: { teacherId: "teacher123" } };
        res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        jest.clearAllMocks();
    });

    describe("Successful Test Publication", () => {
        test("should successfully publish test with questions", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: { _id: "class123", sclassName: "Class 10A" },
                subject: { subName: "Mathematics" },
                school: "school123",
                durationMinutes: 30,
                questions: [{ questionText: "Q1", options: ["A", "B"], correctAnswer: 0, marks: 1 }],
                isActive: false,
                save: jest.fn().mockResolvedValue(true),
            };
            const mockTeacher = { _id: "teacher123", name: "John Doe", teachClasses: ["class123"] };
            const mockAdmin = { _id: "admin123" };

            Test.findById.mockReturnValue(createMockQuery(mockTest));
            Teacher.findById.mockResolvedValue(mockTeacher);
            Admin.findById.mockResolvedValue(mockAdmin);

            await publishTest(req, res);

            expect(mockTest.isActive).toBe(true);
            expect(mockTest.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test("should create notification with correct format", async () => {
            const mockTest = {
                _id: "test123",
                title: "Math Quiz",
                classId: { _id: "class123", sclassName: "Class 10A" },
                subject: { subName: "Mathematics" },
                school: "school123",
                durationMinutes: 30,
                questions: [{ questionText: "Q1", options: ["A", "B"], correctAnswer: 0, marks: 1 }],
                isActive: false,
                save: jest.fn().mockResolvedValue(true),
            };
            const mockTeacher = { _id: "teacher123", name: "John Doe", teachClasses: ["class123"] };
            const mockAdmin = { _id: "admin123" };

            Test.findById.mockReturnValue(createMockQuery(mockTest));
            Teacher.findById.mockResolvedValue(mockTeacher);
            Admin.findById.mockResolvedValue(mockAdmin);

            await publishTest(req, res);

            expect(createNotifications).toHaveBeenCalledWith(
                ["admin123"],
                "Teacher John Doe published test 'Math Quiz' for Class 10A - Mathematics (30 min)",
                "test",
                { metadata: { testId: "test123", teacherId: "teacher123", teacherName: "John Doe" } }
            );
        });
    });

    describe("Validation Errors", () => {
        test("should return 400 when test has no questions", async () => {
            const mockTest = { _id: "test123", classId: { _id: "class123" }, questions: [], isActive: false };
            Test.findById.mockReturnValue(createMockQuery(mockTest));

            await publishTest(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ message: "Cannot publish test with no questions" });
        });

        test("should return 404 when test not found", async () => {
            Test.findById.mockReturnValue(createMockQuery(null));

            await publishTest(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ message: "Test not found" });
        });
    });

    describe("Authorization Checks", () => {
        test("should return 403 when teacher not found", async () => {
            const mockTest = {
                _id: "test123",
                classId: { _id: "class123" },
                questions: [{ questionText: "Q1", options: ["A", "B"], correctAnswer: 0, marks: 1 }],
            };
            Test.findById.mockReturnValue(createMockQuery(mockTest));
            Teacher.findById.mockResolvedValue(null);

            await publishTest(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized: Teacher not found" });
        });

        test("should return 403 when teacher does not teach the class", async () => {
            const mockTest = {
                _id: "test123",
                classId: { _id: "class123" },
                questions: [{ questionText: "Q1", options: ["A", "B"], correctAnswer: 0, marks: 1 }],
            };
            const mockTeacher = { _id: "teacher123", teachClasses: ["class456"] };

            Test.findById.mockReturnValue(createMockQuery(mockTest));
            Teacher.findById.mockResolvedValue(mockTeacher);

            await publishTest(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized: Teacher does not teach this class" });
        });
    });
});
