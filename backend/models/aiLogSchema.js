const mongoose = require('mongoose');

/**
 * AILog — persistent log of every Groq API call made by the system.
 *
 * Captures: who called, which endpoint, prompt sent, response received,
 * token usage, response time, and any errors.
 *
 * Used by the Admin AI Logs viewer at GET /api/ai/logs
 */
const aiLogSchema = new mongoose.Schema({
    // Who triggered the call
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    userRole: {
        type: String,
        enum: ['teacher', 'student', 'admin', 'system'],
        required: true,
    },

    // Which endpoint / feature
    endpointName: {
        type: String,
        required: true,
        index: true,
        // e.g. 'generate-notes', 'predict-student-risk', 'generate-study-plan'
    },

    // Groq model used
    model: {
        type: String,
        default: '',
    },

    // Prompt sent to Groq (truncated to 2000 chars to save space)
    promptSummary: {
        type: String,
        default: '',
        maxlength: 2000,
    },

    // Response received (truncated to 2000 chars)
    responseSummary: {
        type: String,
        default: '',
        maxlength: 2000,
    },

    // Token usage from Groq response
    promptTokens: {
        type: Number,
        default: 0,
    },
    completionTokens: {
        type: Number,
        default: 0,
    },
    totalTokens: {
        type: Number,
        default: 0,
    },

    // Performance
    responseTimeMs: {
        type: Number,
        default: 0,
    },

    // Whether the call succeeded
    success: {
        type: Boolean,
        default: true,
        index: true,
    },

    // Error message if failed
    errorMessage: {
        type: String,
        default: '',
    },

    // Whether this was served from cache (no Groq call made)
    fromCache: {
        type: Boolean,
        default: false,
    },

    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        // Auto-delete logs after 90 days
        expires: 60 * 60 * 24 * 90,
    },
});

// Compound index for admin log viewer queries
aiLogSchema.index({ createdAt: -1, endpointName: 1 });
aiLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('aiLog', aiLogSchema);
