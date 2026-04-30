const mongoose = require('mongoose');

/**
 * Topic — standalone collection for subject topics.
 *
 * Replaces the embedded topics[] array inside subjectSchema.
 * Enables:
 *   - Weak topic detection per class
 *   - AI question generation per topic
 *   - Performance tracking per topic
 *   - Difficulty-level filtering
 *
 * The existing subjectSchema.topics[] array is kept for backward compatibility.
 * New features should use this collection.
 */
const topicSchema = new mongoose.Schema({
    topicName: {
        type: String,
        required: true,
        trim: true,
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'subject',
        required: true,
        index: true,
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'sclass',
        index: true,
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        index: true,
    },
    difficultyLevel: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium',
    },
    description: {
        type: String,
        default: '',
    },
    // Order within the subject curriculum
    order: {
        type: Number,
        default: 0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Compound index: all topics for a subject in a class
topicSchema.index({ subjectId: 1, classId: 1 });
// Unique topic name per subject per class
topicSchema.index({ topicName: 1, subjectId: 1, classId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('topic', topicSchema);
