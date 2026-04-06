const {
    validateQuestionText,
    validateOptionCount,
    validateCorrectAnswer,
    validateMarks,
    validateQuestion,
} = require("../controllers/test-controller");

describe("Question Validation Helper Functions", () => {
    describe("validateQuestionText", () => {
        test("should return error for empty question text", () => {
            expect(validateQuestionText("")).toBe("Question text cannot be empty");
            expect(validateQuestionText("   ")).toBe("Question text cannot be empty");
            expect(validateQuestionText(null)).toBe("Question text cannot be empty");
            expect(validateQuestionText(undefined)).toBe("Question text cannot be empty");
        });

        test("should return null for valid question text", () => {
            expect(validateQuestionText("What is 2+2?")).toBeNull();
            expect(validateQuestionText("A")).toBeNull();
        });
    });

    describe("validateOptionCount", () => {
        test("should return error for invalid option count", () => {
            expect(validateOptionCount([])).toBe("Questions must have 2-6 options");
            expect(validateOptionCount(["A"])).toBe("Questions must have 2-6 options");
            expect(validateOptionCount(["A", "B", "C", "D", "E", "F", "G"])).toBe("Questions must have 2-6 options");
            expect(validateOptionCount(null)).toBe("Questions must have 2-6 options");
            expect(validateOptionCount(undefined)).toBe("Questions must have 2-6 options");
            expect(validateOptionCount("not an array")).toBe("Questions must have 2-6 options");
        });

        test("should return null for valid option count", () => {
            expect(validateOptionCount(["A", "B"])).toBeNull();
            expect(validateOptionCount(["A", "B", "C"])).toBeNull();
            expect(validateOptionCount(["A", "B", "C", "D"])).toBeNull();
            expect(validateOptionCount(["A", "B", "C", "D", "E"])).toBeNull();
            expect(validateOptionCount(["A", "B", "C", "D", "E", "F"])).toBeNull();
        });
    });

    describe("validateCorrectAnswer", () => {
        test("should return error for invalid correctAnswer index", () => {
            expect(validateCorrectAnswer(null, ["A", "B"])).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(undefined, ["A", "B"])).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(-1, ["A", "B"])).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(2, ["A", "B"])).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(5, ["A", "B", "C"])).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(0, null)).toBe("Correct answer must be a valid option index");
            expect(validateCorrectAnswer(0, undefined)).toBe("Correct answer must be a valid option index");
        });

        test("should return null for valid correctAnswer index", () => {
            expect(validateCorrectAnswer(0, ["A", "B"])).toBeNull();
            expect(validateCorrectAnswer(1, ["A", "B"])).toBeNull();
            expect(validateCorrectAnswer(2, ["A", "B", "C"])).toBeNull();
            expect(validateCorrectAnswer(5, ["A", "B", "C", "D", "E", "F"])).toBeNull();
        });
    });

    describe("validateMarks", () => {
        test("should return error for invalid marks value", () => {
            expect(validateMarks(0)).toBe("Marks must be greater than 0");
            expect(validateMarks(-1)).toBe("Marks must be greater than 0");
            expect(validateMarks(-10)).toBe("Marks must be greater than 0");
            expect(validateMarks(null)).toBe("Marks must be greater than 0");
            expect(validateMarks(undefined)).toBe("Marks must be greater than 0");
        });

        test("should return null for valid marks value", () => {
            expect(validateMarks(1)).toBeNull();
            expect(validateMarks(5)).toBeNull();
            expect(validateMarks(10)).toBeNull();
            expect(validateMarks(0.5)).toBeNull();
        });
    });

    describe("validateQuestion", () => {
        test("should return error for question with empty text", () => {
            const question = {
                questionText: "",
                options: ["A", "B"],
                correctAnswer: 0,
                marks: 1,
            };
            expect(validateQuestion(question, 0)).toBe("Question 1: Question text cannot be empty");
        });

        test("should return error for question with invalid option count", () => {
            const question = {
                questionText: "What is 2+2?",
                options: ["A"],
                correctAnswer: 0,
                marks: 1,
            };
            expect(validateQuestion(question, 0)).toBe("Question 1: Questions must have 2-6 options");
        });

        test("should return error for question with invalid correctAnswer", () => {
            const question = {
                questionText: "What is 2+2?",
                options: ["A", "B"],
                correctAnswer: 5,
                marks: 1,
            };
            expect(validateQuestion(question, 0)).toBe("Question 1: Correct answer must be a valid option index");
        });

        test("should return error for question with invalid marks", () => {
            const question = {
                questionText: "What is 2+2?",
                options: ["A", "B"],
                correctAnswer: 0,
                marks: 0,
            };
            expect(validateQuestion(question, 0)).toBe("Question 1: Marks must be greater than 0");
        });

        test("should return null for valid question", () => {
            const question = {
                questionText: "What is 2+2?",
                options: ["3", "4", "5", "6"],
                correctAnswer: 1,
                marks: 1,
            };
            expect(validateQuestion(question, 0)).toBeNull();
        });

        test("should include correct question number in error message", () => {
            const question = {
                questionText: "",
                options: ["A", "B"],
                correctAnswer: 0,
                marks: 1,
            };
            expect(validateQuestion(question, 4)).toBe("Question 5: Question text cannot be empty");
        });
    });
});
