const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");
const dotenv   = require("dotenv");
const path     = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Admin   = require("../models/adminSchema");
const Sclass  = require("../models/sclassSchema");
const Subject = require("../models/subjectSchema");
const Teacher = require("../models/teacherSchema");
const Student = require("../models/studentSchema");
const Parent  = require("../models/parentSchema");

const h = pw => bcrypt.hash(pw, 10);

// "Class 6 Section A" format
const CLASS_DEFS = [
    { grade: 6, section: "A" }, { grade: 6, section: "B" },
    { grade: 7, section: "A" }, { grade: 7, section: "B" },
    { grade: 8, section: "A" }, { grade: 8, section: "B" },
    { grade: 9, section: "A" }, { grade: 9, section: "B" },
    { grade: 10, section: "A" }, { grade: 10, section: "B" },
];
const className = (def) => `Class ${def.grade} Section ${def.section}`;

const SUBJECT_DEFS = [
    { name:"Mathematics",      code:"MATH", topics:["Algebra","Geometry","Trigonometry","Statistics"] },
    { name:"Physics",          code:"PHY",  topics:["Mechanics","Optics","Thermodynamics","Electricity"] },
    { name:"Chemistry",        code:"CHEM", topics:["Organic","Inorganic","Physical Chemistry","Reactions"] },
    { name:"Biology",          code:"BIO",  topics:["Cell Biology","Genetics","Ecology","Human Body"] },
    { name:"English",          code:"ENG",  topics:["Grammar","Literature","Writing","Comprehension"] },
    { name:"French",           code:"FRE",  topics:["Vocabulary","Grammar","Conversation","Reading"] },
    { name:"Computer Science", code:"CS",   topics:["Programming","Data Structures","Algorithms","Databases"] },
];

const TEACHER_NAMES = [
    "Mr. Rajan Kumar","Ms. Priya Nair","Mr. David Samuel","Ms. Ananya Iyer",
    "Mr. Suresh Pillai","Ms. Kavitha Menon","Mr. Arjun Reddy","Ms. Deepa Sharma",
    "Mr. Vikram Singh","Ms. Lakshmi Rao","Mr. Mohan Das","Ms. Sunita Verma",
    "Mr. Rajesh Gupta","Ms. Meena Krishnan","Mr. Arun Nambiar","Ms. Pooja Patel",
    "Mr. Sanjay Mehta","Ms. Rekha Nair","Mr. Kiran Kumar","Ms. Divya Pillai"
];

const FIRST_NAMES = [
    "Aagnesh","Rahul","Sneha","Arjun","Divya","Karthik","Preethi","Rohan","Ananya","Vijay",
    "Meera","Siddharth","Kavya","Aditya","Nisha","Pranav","Shreya","Akash","Pooja","Nikhil",
    "Riya","Harish","Swathi","Deepak","Lavanya","Suresh","Bhavana","Manoj","Keerthi","Varun",
    "Ishaan","Tanvi","Gautam","Pallavi","Rithvik","Sana","Abhishek","Nandini","Vivek","Amrita",
    "Chirag","Sowmya","Yash","Kritika","Sriram"
];
const LAST_NAMES = ["Sharma","Patel","Nair","Reddy","Kumar","Singh","Iyer","Menon","Rao","Pillai"];

const PARENT_FIRST = [
    "Ramesh","Sunita","Vijay","Meena","Arun","Kavitha","Suresh","Priya","Mohan","Lakshmi",
    "Rajesh","Deepa","Sanjay","Rekha","Kiran","Divya","Harish","Swathi","Manoj","Bhavana",
    "Naresh","Anitha","Prakash","Usha","Ganesh","Saritha","Venkat","Padma","Ravi","Geetha",
    "Ashok","Nirmala","Balu","Shanthi","Dinesh","Vimala","Sunil","Radha","Praveen","Kamala",
    "Murali","Vasantha","Babu","Sumathi","Selvam"
];

// Generate a random Indian-style phone number
const randPhone = (i) => `9${String(800000000 + i * 7 + 13).slice(0, 9)}`;

async function seed() {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    await Promise.all([
        Sclass.deleteMany({}),
        Subject.deleteMany({}),
        Teacher.deleteMany({}),
        Student.deleteMany({}),
        Parent.deleteMany({}),
    ]);

    try {
        await Student.collection.dropIndex("rollNum_1_schoolId_1");
        console.log("Dropped rollNum_schoolId unique index");
    } catch(e) { /* may not exist */ }

    console.log("Cleared existing data");

    // Admin — upsert so _id stays stable across reseeds
    let admin = await Admin.findOne({ email: "admin@school.com" });
    if (admin) {
        admin.name = "Principal Aagnesh";
        admin.schoolName = "Edcheck Academy";
        admin.schoolAddress = "123 Learning Lane, Chennai";
        admin.phone = "9876543210";
        await admin.save();
        console.log("Reusing existing admin _id: " + admin._id);
    } else {
        admin = await Admin.create({
            name: "Principal Aagnesh", email: "admin@school.com",
            password: await h("admin123"), schoolName: "Edcheck Academy",
            schoolAddress: "123 Learning Lane, Chennai", phone: "9876543210",
        });
        console.log("Created new admin _id: " + admin._id);
    }

    // 10 Classes with proper "Class 6 Section A" naming
    const classes = await Sclass.insertMany(
        CLASS_DEFS.map(def => ({
            sclassName: className(def),
            className:  className(def),
            section:    def.section,
            school:     admin._id,
            schoolId:   admin._id,
        }))
    );
    console.log("Created " + classes.length + " classes");

    // 7 Subjects × 10 classes = 70 subject records, each with a handling teacher
    // Teacher assignment: teacher index = (classIndex * 7 + subjectIndex) % 20
    const allSubjects = [];
    for (let ci = 0; ci < classes.length; ci++) {
        const cls = classes[ci];
        for (let si = 0; si < SUBJECT_DEFS.length; si++) {
            const def = SUBJECT_DEFS[si];
            allSubjects.push({
                subName:     def.name, subjectName: def.name,
                subCode:     def.code, subjectCode: def.code,
                sessions:    30,
                topics:      def.topics,
                school:      admin._id,
                schoolId:    admin._id,
                classId:     cls._id,
                sclassName:  cls._id,
                // placeholder — will be updated after teachers are created
            });
        }
    }
    const subjects = await Subject.insertMany(allSubjects);
    console.log("Created " + subjects.length + " subjects (" + SUBJECT_DEFS.length + " per class × " + classes.length + " classes)");

    // 20 Teachers — each specialises in 2 subjects
    const teacherDocs = [];
    for (let i = 0; i < 20; i++) {
        // Each teacher handles a primary subject (by index mod 7)
        const primarySubIdx = i % 7;
        teacherDocs.push({
            name:  TEACHER_NAMES[i],
            email: `teacher${i + 1}@school.com`,
            password: await h("teacher123"),
            phone: randPhone(i + 100),
            school: admin._id, schoolId: admin._id,
        });
    }
    const teachers = await Teacher.insertMany(teacherDocs);
    console.log("Created " + teachers.length + " teachers");

    // Assign handling teacher to each subject:
    // For each class, subject[si] → teacher whose primary subject index matches si
    // Teachers 0-6 handle subjects 0-6 respectively across all classes
    // Teachers 7-13 handle the same subjects for the second set of classes, etc.
    const subjectUpdates = [];
    for (let ci = 0; ci < classes.length; ci++) {
        for (let si = 0; si < SUBJECT_DEFS.length; si++) {
            const subjectIdx = ci * SUBJECT_DEFS.length + si;
            const subject    = subjects[subjectIdx];
            // Assign teacher: rotate through teachers, each teacher handles one subject type
            const teacherIdx = (si * 2 + Math.floor(ci / 2)) % 20;
            const teacher    = teachers[teacherIdx];
            subjectUpdates.push(
                Subject.findByIdAndUpdate(subject._id, {
                    teacherId: teacher._id,
                    teacher:   teacher._id,
                })
            );
            // Add subject to teacher's list
            await Teacher.findByIdAndUpdate(teacher._id, {
                $addToSet: { teachSubjects: subject._id, teachClasses: classes[ci]._id }
            });
        }
    }
    await Promise.all(subjectUpdates);
    console.log("Assigned handling teachers to all subjects");

    // Assign one class teacher per class (teacher i → class i for first 10)
    for (let i = 0; i < 10; i++) {
        await Sclass.findByIdAndUpdate(classes[i]._id, { classTeacher: teachers[i]._id });
        console.log(`  Class teacher: ${TEACHER_NAMES[i]} → ${className(CLASS_DEFS[i])}`);
    }

    // 45 Students per class + parents
    let totalStudents = 0;
    let totalParents  = 0;
    let phoneIdx = 0;

    for (let ci = 0; ci < classes.length; ci++) {
        const cls = classes[ci];
        const batch = [];

        for (let si = 0; si < 45; si++) {
            const firstName = FIRST_NAMES[si];
            const lastName  = LAST_NAMES[si % LAST_NAMES.length];
            const roll      = si + 1;
            const attRate   = 55 + Math.floor(Math.random() * 45);
            const totalSess = 21;
            const presentN  = Math.round((attRate / 100) * totalSess);
            const attendance = [];
            // Use this class's subjects for attendance
            const classSubjects = subjects.slice(ci * SUBJECT_DEFS.length, (ci + 1) * SUBJECT_DEFS.length);
            for (let d = 0; d < totalSess; d++) {
                attendance.push({
                    date:        new Date(2025, 0, 10 + d),
                    subjectId:   classSubjects[d % classSubjects.length]._id,
                    status:      d < presentN ? "Present" : "Absent",
                    sessionType: "lecture",
                });
            }

            const parentFirstName = PARENT_FIRST[si];
            const parentPhone     = randPhone(phoneIdx++);

            batch.push({
                name:        firstName + " " + lastName,
                rollNum:     roll,
                password:    await h("student123"),
                sclassName:  cls._id,
                classId:     cls._id,
                school:      admin._id,
                schoolId:    admin._id,
                status:      "active",
                parentName:  parentFirstName + " " + lastName,
                parentPhone: parentPhone,
                attendance,
                examResult: classSubjects.slice(0, 5).map(sub => ({
                    subjectId: sub._id,
                    marks:     35 + Math.floor(Math.random() * 65),
                    maxMarks:  100,
                })),
            });
        }

        const inserted = await Student.insertMany(batch);
        totalStudents += inserted.length;

        // Create one parent per student and link them
        const parentDocs = [];
        for (let si = 0; si < inserted.length; si++) {
            const student = inserted[si];
            parentDocs.push({
                name:     student.parentName,
                email:    `parent.${student.rollNum}.class${ci + 1}@school.com`,
                password: await h("parent123"),
                phone:    student.parentPhone,
                school:   admin._id,
                children: [student._id],
            });
        }
        const insertedParents = await Parent.insertMany(parentDocs);
        totalParents += insertedParents.length;

        // Link parentId back to each student
        for (let si = 0; si < inserted.length; si++) {
            await Student.findByIdAndUpdate(inserted[si]._id, { parentId: insertedParents[si]._id });
        }

        await Sclass.findByIdAndUpdate(cls._id, { students: inserted.map(s => s._id) });
        console.log(`  ${className(CLASS_DEFS[ci])}: ${inserted.length} students, ${insertedParents.length} parents`);
    }

    console.log("\n=== SEED COMPLETE ===");
    console.log("Admin:    admin@school.com  |  admin123");
    console.log("Teachers: teacher1@school.com ... teacher20@school.com  |  teacher123");
    console.log("Students: Roll 1-45 per class  |  student123");
    console.log("Parents:  parent.{roll}.class{n}@school.com  |  parent123");
    console.log(`Classes: ${classes.length} | Subjects: ${subjects.length} (${SUBJECT_DEFS.length}/class) | Teachers: ${teachers.length} | Students: ${totalStudents} | Parents: ${totalParents}`);

    await mongoose.disconnect();
    process.exit(0);
}

seed().catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
