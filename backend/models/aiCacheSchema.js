const mongoose = require('mongoose');
const crypto   = require('crypto');

/**
 * AICache — persistent MongoDB cache for AI-generated responses.
 *
 * Cache lifecycle:
 *   isValid = true  → cache hit, return cachedResponse
 *   isValid = false → cache miss, call Groq and refresh
 *
 * Invalidation is triggered when a test attempt is submitted:
 *   all entries with relatedTestId matching the completed test are set isValid = false.
 */
const aiCacheSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    userRole: {
        type: String,
        enum: ['teacher', 'student', 'admin'],
        required: true,
    },
    endpointName: {
        type: String,
        required: true,
        // e.g. 'generate-notes', 'generate-study-plan', 'predict-student-risk'
    },
    inputHash: {
        type: String,
        required: true,
        // SHA-256 hex of the serialised request input
    },
    cachedResponse: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    relatedTestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'test',
        default: null,
        index: true,
    },
    isValid: {
        type: Boolean,
        default: true,
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        // TTL index: auto-delete documents after 30 days regardless of isValid
        expires: 60 * 60 * 24 * 30,
    },
});

// Compound index for fast cache lookups
aiCacheSchema.index({ userId: 1, endpointName: 1, inputHash: 1 });
// Index for invalidation queries (find all entries for a test)
aiCacheSchema.index({ relatedTestId: 1, isValid: 1 });

/**
 * Static helper: generate a SHA-256 hash of any input object.
 * Used to produce a stable, compact cache key from request parameters.
 */
aiCacheSchema.statics.hashInput = function (inputObj) {
    const str = JSON.stringify(inputObj, Object.keys(inputObj).sort());
    return crypto.createHash('sha256').update(str).digest('hex');
};

module.exports = mongoose.model('aiCache', aiCacheSchema);
