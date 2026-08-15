/**
 * StudyPlanFeedback Schema
 *
 * Captures student feedback on individual study plan recommendations.
 * This feedback is fed back into the DSKP context for future study plan generation.
 *
 * Feedback types:
 *   - completed: student completed the recommendation
 *   - partially_completed: student did some of it
 *   - skipped: student skipped it
 *   - useful: student found it helpful
 *   - too_difficult: recommendation was too hard
 *   - too_easy: recommendation was too simple
 */

const mongoose = require('mongoose');

const studyPlanFeedbackSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true,
    },
    studyPlanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'adaptiveStudyPlan',
        required: true,
    },
    topic: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['completed', 'partially_completed', 'skipped', 'not_started'],
        default: 'not_started',
    },
    usefulness: {
        type: String,
        enum: ['very_useful', 'useful', 'neutral', 'not_useful', null],
        default: null,
    },
    difficulty_feedback: {
        type: String,
        enum: ['too_easy', 'appropriate', 'too_difficult', null],
        default: null,
    },
    comment: {
        type: String,
        maxlength: 500,
        default: '',
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
studyPlanFeedbackSchema.index({ studentId: 1, studyPlanId: 1 });
studyPlanFeedbackSchema.index({ studentId: 1, topic: 1 });
studyPlanFeedbackSchema.index({ studyPlanId: 1 });

module.exports = mongoose.model('studyPlanFeedback', studyPlanFeedbackSchema);
