const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

// Models
const Admin   = require("../models/adminSchema");
const Sclass  = require("../models/sclassSchema");
const Subject = require("../models/subjectSchema");
const Teacher = require("../models/teacherSchema");
const Student = require("../models/studentSchema");

const hash = (pw) => bcrypt.hash(pw, 10);

async function seed() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected to MongoDB");

    // ── Wipe existing seed data ──────────────────────────────────────────────
    await Promise.all([
        Admin.deleteMany({}),
        Sclass.deleteMany({}),
        Subject.deleteMany({}),
        Teacher.deleteMany({}),
        Student.deleteMany({}),
    ]);

    // Drop conflicting indexes to avoid duplicate key errors on re-seed
    try {
        await Student.collection.dropIndexes();
    } catch (e) { /* ignore if no indexes */ }

    console.log("🗑️  Cleared existing data");

    // ── 1. Admin ─────────────────────────────────────────────────────────────
    const admin = await Admin.create({
        name:          "Principal Aagnesh",
        email:         "admin@school.com",
        password:      await hash("admin123"),
        schoolName:    "Edcheck Academy",
        schoolAddress: "123 Learning Lane, Chennai",
        phone:         "9876543210",
    });
    console.log("👤 Admin created  →  email: admin@school.com  |  password: admin123");

    // ── 2. Classes ───────────────────────────────────────────────────────────
    const [classA, classB] = await Sclass.insertMany([
        { sclassName: "Class 10-A", school: admin._id },
        { sclassName: "Class 10-B", school: admin._id },
    ]);
    console.log("🏫 Classes created → Class 10-A, Class 10-B");

    // ── 3. Subjects (no teacher yet) ─────────────────────────────────────────
    const [maths, science, english] = await Subject.insertMany([
        {
            subName: "Mathematics", subCode: "MATH10", sessions: 40,
            topics: ["Algebra", "Geometry", "Trigonometry", "Statistics"],
            sclassName: classA._id, school: admin._id,
        },
        {
            subName: "Science", subCode: "SCI10", sessions: 35,
            topics: ["Physics", "Chemistry", "Biology"],
            sclassName: classA._id, school: admin._id,
        },
        {
            subName: "English", subCode: "ENG10", sessions: 30,
            topics: ["Grammar", "Literature", "Writing"],
            sclassName: classB._id, school: admin._id,
        },
    ]);
    console.log("📚 Subjects created → Mathematics, Science, English");

    // ── 4. Teachers ──────────────────────────────────────────────────────────
    const [teacherMath, teacherSci, teacherEng] = await Teacher.insertMany([
        {
            name: "Mr. Rajan Kumar",
            email: "rajan@school.com",
            password: await hash("teacher123"),
            school: admin._id,
            teachSubject: maths._id,
            teachSclass: classA._id,
            teachSubjects: [maths._id],
            teachClasses: [classA._id],
        },
        {
            name: "Ms. Priya Nair",
            email: "priya@school.com",
            password: await hash("teacher123"),
            school: admin._id,
            teachSubject: science._id,
            teachSclass: classA._id,
            teachSubjects: [science._id],
            teachClasses: [classA._id],
        },
        {
            name: "Mr. David Samuel",
            email: "david@school.com",
            password: await hash("teacher123"),
            school: admin._id,
            teachSubject: english._id,
            teachSclass: classB._id,
            teachSubjects: [english._id],
            teachClasses: [classB._id],
        },
    ]);
    console.log("👨‍🏫 Teachers created:");
    console.log("   rajan@school.com  (Maths)   |  password: teacher123");
    console.log("   priya@school.com  (Science) |  password: teacher123");
    console.log("   david@school.com  (English) |  password: teacher123");

    // Assign teachers back to subjects
    await Subject.findByIdAndUpdate(maths._id,   { teacher: teacherMath._id });
    await Subject.findByIdAndUpdate(science._id, { teacher: teacherSci._id });
    await Subject.findByIdAndUpdate(english._id, { teacher: teacherEng._id });

    // ── 5. Students ──────────────────────────────────────────────────────────
    const studentsData = [
        // Class 10-A students
        {
            name: "Aagnesh Shifak", rollNum: 1,
            password: await hash("student123"),
            sclassName: classA._id, school: admin._id,
            behaviorScore: 85, focusIndex: 8,
            conceptMastery: { Algebra: 90, Geometry: 75, Physics: 80 },
            learningFlags: [{ flag: "excelling", subject: maths._id }],
            examResult: [
                { subName: maths._id,   topic: "Algebra",  marksObtained: 92, maxMarks: 100 },
                { subName: science._id, topic: "Physics",  marksObtained: 85, maxMarks: 100 },
            ],
            attendance: [
                { date: new Date("2025-01-10"), subName: maths._id,   status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-11"), subName: science._id, status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-12"), subName: maths._id,   status: "Present", sessionType: "lab" },
            ],
        },
        {
            name: "Rahul Sharma", rollNum: 2,
            password: await hash("student123"),
            sclassName: classA._id, school: admin._id,
            behaviorScore: 60, focusIndex: 5,
            conceptMastery: { Algebra: 55, Geometry: 60, Physics: 45 },
            learningFlags: [{ flag: "struggling", subject: science._id }],
            examResult: [
                { subName: maths._id,   topic: "Algebra", marksObtained: 58, maxMarks: 100 },
                { subName: science._id, topic: "Physics", marksObtained: 47, maxMarks: 100 },
            ],
            attendance: [
                { date: new Date("2025-01-10"), subName: maths._id,   status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-11"), subName: science._id, status: "Absent",  sessionType: "lecture" },
                { date: new Date("2025-01-12"), subName: maths._id,   status: "Late",    sessionType: "lab" },
            ],
        },
        {
            name: "Sneha Patel", rollNum: 3,
            password: await hash("student123"),
            sclassName: classA._id, school: admin._id,
            behaviorScore: 78, focusIndex: 7,
            conceptMastery: { Algebra: 80, Geometry: 85, Chemistry: 70 },
            learningFlags: [{ flag: "improving", subject: maths._id }],
            examResult: [
                { subName: maths._id,   topic: "Geometry",  marksObtained: 82, maxMarks: 100 },
                { subName: science._id, topic: "Chemistry", marksObtained: 71, maxMarks: 100 },
            ],
            attendance: [
                { date: new Date("2025-01-10"), subName: maths._id,   status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-11"), subName: science._id, status: "Present", sessionType: "lecture" },
            ],
        },
        // Class 10-B students
        {
            name: "Arjun Mehta", rollNum: 1,
            password: await hash("student123"),
            sclassName: classB._id, school: admin._id,
            behaviorScore: 70, focusIndex: 6,
            conceptMastery: { Grammar: 75, Literature: 65 },
            learningFlags: [],
            examResult: [
                { subName: english._id, topic: "Grammar", marksObtained: 74, maxMarks: 100 },
            ],
            attendance: [
                { date: new Date("2025-01-10"), subName: english._id, status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-11"), subName: english._id, status: "Present", sessionType: "lecture" },
            ],
        },
        {
            name: "Divya Krishnan", rollNum: 2,
            password: await hash("student123"),
            sclassName: classB._id, school: admin._id,
            behaviorScore: 90, focusIndex: 9,
            conceptMastery: { Grammar: 95, Literature: 90, Writing: 88 },
            learningFlags: [{ flag: "excelling", subject: english._id }],
            examResult: [
                { subName: english._id, topic: "Literature", marksObtained: 95, maxMarks: 100 },
            ],
            attendance: [
                { date: new Date("2025-01-10"), subName: english._id, status: "Present", sessionType: "lecture" },
                { date: new Date("2025-01-11"), subName: english._id, status: "Present", sessionType: "lecture" },
            ],
        },
    ];

    const students = await Student.insertMany(studentsData);
    console.log("🎓 Students created (password: student123 for all):");
    students.forEach(s => console.log(`   Roll ${s.rollNum} → ${s.name}`));

    // Update classes with student references
    await Sclass.findByIdAndUpdate(classA._id, {
        students: students.filter(s => s.sclassName.equals(classA._id)).map(s => s._id)
    });
    await Sclass.findByIdAndUpdate(classB._id, {
        students: students.filter(s => s.sclassName.equals(classB._id)).map(s => s._id)
    });

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Seed complete! Login credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("ADMIN    → admin@school.com       | admin123");
    console.log("TEACHER  → rajan@school.com       | teacher123  (Maths, 10-A)");
    console.log("TEACHER  → priya@school.com       | teacher123  (Science, 10-A)");
    console.log("TEACHER  → david@school.com       | teacher123  (English, 10-B)");
    console.log("STUDENT  → Roll 1, Aagnesh Shifak | student123  (10-A)");
    console.log("STUDENT  → Roll 2, Rahul Sharma   | student123  (10-A)");
    console.log("STUDENT  → Roll 3, Sneha Patel    | student123  (10-A)");
    console.log("STUDENT  → Roll 1, Arjun Mehta    | student123  (10-B)");
    console.log("STUDENT  → Roll 2, Divya Krishnan | student123  (10-B)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
});
