const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Curriculum = require('../models/curriculumSchema');

dotenv.config();

const CBSE_DATA = [
    // ── Class 10 Science (Integrated but with domains) ────────────
    {
        board: 'CBSE',
        classLevel: 10,
        subject: 'Science',
        domain: 'Physics',
        chapter: 'Light Reflection and Refraction',
        subtopics: [
            { name: 'Reflection of Light', concepts: ['Laws of Reflection', 'Plane Mirrors'] },
            { name: 'Spherical Mirrors', concepts: ['Concave Mirror', 'Convex Mirror', 'Image Formation'] },
            { name: 'Refraction of Light', concepts: ['Snells Law', 'Refractive Index', 'Lenses'] }
        ]
    },
    {
        board: 'CBSE',
        classLevel: 10,
        subject: 'Science',
        domain: 'Chemistry',
        chapter: 'Acids, Bases and Salts',
        subtopics: [
            { name: 'Properties of Acids and Bases', concepts: ['Indicators', 'Reactions with Metals'] },
            { name: 'pH Scale', concepts: ['Strong/Weak Acids', 'Importance in Everyday Life'] },
            { name: 'Salts', concepts: ['Family of Salts', 'pH of Salts', 'Chemicals from Common Salt'] }
        ]
    },
    {
        board: 'CBSE',
        classLevel: 10,
        subject: 'Science',
        domain: 'Biology',
        chapter: 'Life Processes',
        subtopics: [
            { name: 'Nutrition', concepts: ['Autotrophic', 'Heterotrophic', 'Digestion in Humans'] },
            { name: 'Respiration', concepts: ['Aerobic', 'Anaerobic', 'Human Respiratory System'] },
            { name: 'Transportation', concepts: ['Heart', 'Blood Vessels', 'Transportation in Plants'] },
            { name: 'Excretion', concepts: ['Human Excretory System', 'Excretion in Plants'] }
        ]
    },

    // ── Class 10 Mathematics ────────────
    {
        board: 'CBSE',
        classLevel: 10,
        subject: 'Mathematics',
        domain: 'Algebra',
        chapter: 'Quadratic Equations',
        subtopics: [
            { name: 'Standard Form', concepts: ['Identifying Quadratic Equations'] },
            { name: 'Solution by Factorisation', concepts: ['Splitting the middle term'] },
            { name: 'Solution by Quadratic Formula', concepts: ['Formula application'] },
            { name: 'Nature of Roots', concepts: ['Discriminant', 'Real vs Imaginary roots'] }
        ]
    },
    {
        board: 'CBSE',
        classLevel: 10,
        subject: 'Mathematics',
        domain: 'Trigonometry',
        chapter: 'Introduction to Trigonometry',
        subtopics: [
            { name: 'Trigonometric Ratios', concepts: ['Sine', 'Cosine', 'Tangent'] },
            { name: 'Trigonometric Ratios of Specific Angles', concepts: ['0, 30, 45, 60, 90 degrees'] },
            { name: 'Trigonometric Identities', concepts: ['Pythagorean Identities'] }
        ]
    },

    // ── Class 11 Physics (Separate Subject) ────────────
    {
        board: 'CBSE',
        classLevel: 11,
        subject: 'Physics',
        domain: 'Mechanics',
        chapter: 'Motion in a Straight Line',
        subtopics: [
            { name: 'Position, Path Length and Displacement', concepts: ['Distance vs Displacement'] },
            { name: 'Average Velocity and Average Speed', concepts: ['Calculations'] },
            { name: 'Kinematic Equations', concepts: ['Uniformly Accelerated Motion'] }
        ]
    },

    // ── Class 7 Science (Integrated) ────────────
    {
        board: 'CBSE',
        classLevel: 7,
        subject: 'Science',
        domain: 'Physics',
        chapter: 'Heat',
        subtopics: [
            { name: 'Hot and Cold', concepts: ['Temperature'] },
            { name: 'Measuring Temperature', concepts: ['Clinical Thermometer', 'Laboratory Thermometer'] },
            { name: 'Transfer of Heat', concepts: ['Conduction', 'Convection', 'Radiation'] }
        ]
    }
];

async function seedCurriculum() {
    try {
        await mongoose.connect(process.env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');

        for (const data of CBSE_DATA) {
            await Curriculum.updateOne(
                { 
                    board: data.board, 
                    classLevel: data.classLevel, 
                    subject: data.subject, 
                    domain: data.domain, 
                    chapter: data.chapter 
                },
                { $set: data },
                { upsert: true }
            );
        }

        console.log('✅ CBSE Curriculum seed completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedCurriculum();
