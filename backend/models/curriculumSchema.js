const mongoose = require("mongoose");

/**
 * CurriculumSchema
 * 
 * Defines the strict academic hierarchy for CBSE/NCERT.
 * This is the source of truth for all assessments, question generation, and DSKP tracking.
 * 
 * Hierarchy:
 * Class -> Subject -> Domain -> Chapter -> Subtopic -> Concept
 */
const curriculumSchema = new mongoose.Schema({
    board: { 
        type: String, 
        required: true, 
        default: 'CBSE' 
    },
    classLevel: { 
        type: Number, // e.g., 6, 7, 10, 12
        required: true 
    },
    subject: { 
        type: String, 
        required: true 
        // For 6-10: "Science", "Mathematics", "Social Science", "English"
        // For 11-12: "Physics", "Chemistry", "Mathematics", "Biology", "English"
    },
    domain: { 
        type: String, 
        default: null 
        // e.g. "Physics", "Chemistry", "History" 
        // Critical for Classes 9-10 Science, and 6-10 Social Science.
    },
    chapter: { 
        type: String, 
        required: true 
        // e.g. "Electricity", "Quadratic Equations"
    },
    subtopics: [{
        name: { type: String, required: true },
        // e.g. "Ohm's Law", "Discriminant"
        concepts: [{ type: String }] // e.g. ["Resistance", "Current", "Voltage"]
    }],
    academicYear: { 
        type: String, 
        default: '2026-27' 
    },
    source: { 
        type: String, 
        default: 'CBSE/NCERT' 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

// Compound index for exact curriculum resolution
curriculumSchema.index({ classLevel: 1, subject: 1, domain: 1, chapter: 1 }, { unique: true });

module.exports = mongoose.model("curriculum", curriculumSchema);
