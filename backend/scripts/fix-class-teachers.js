/**
 * Assigns class teachers to classes that are missing them.
 * Matches teachers by their email (teacher1@school.com → Class 6 Section A, etc.)
 */
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const path     = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

require('../models/teacherSchema');
const Sclass  = require('../models/sclassSchema');
const Teacher = require('../models/teacherSchema');

async function fix() {
    await mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 15000 });
    console.log('Connected');

    const classes  = await Sclass.find({}).lean();
    const teachers = await Teacher.find({}).lean();

    console.log(`Found ${classes.length} classes, ${teachers.length} teachers`);

    // Sort classes by name so they get a deterministic teacher assignment
    const sorted = [...classes].sort((a, b) =>
        (a.sclassName || '').localeCompare(b.sclassName || '')
    );

    // Sort teachers by email (teacher1, teacher2, ...)
    const sortedTeachers = [...teachers].sort((a, b) =>
        (a.email || '').localeCompare(b.email || '')
    );

    let updated = 0;
    for (let i = 0; i < sorted.length; i++) {
        const cls     = sorted[i];
        const teacher = sortedTeachers[i % sortedTeachers.length];
        await Sclass.findByIdAndUpdate(cls._id, { classTeacher: teacher._id });
        console.log(`  ${cls.sclassName} → ${teacher.name} (${teacher.email})`);
        updated++;
    }

    console.log(`\nUpdated ${updated} classes with class teachers.`);
    await mongoose.disconnect();
    process.exit(0);
}

fix().catch(e => { console.error(e.message); process.exit(1); });
