/**
 * AdaptiveStudyPlan Schema
 *
 * Stores the output of the LLM Reasoning Layer.
 * The LLM never sees raw quiz answers — only the structured analytics
 * produced by the earlier pipeline stages.
 *
 * Each document represents one complete study plan generation event,
 * enabling version comparison and ablation across LLM providers/prompts.
 *
 * Structure:
 *   - analyticsSnapshot  : the exact structured data sent to the LLM
 *   - promptUsed         : full prompt text (for reproducibility)
 *   - plan               : parsed plan output
 *   - metadata           : model name, latency, token counts
 */

const mongoose = require('mongoose');

// ── Sub-schema: daily schedule entry ─────────────────────────────────────────
const dailyScheduleEntrySchema = new mongoose.Schema({
    day:       { type: String },   // "Monday", "Day 1", etc.
    duration:  { type: Number },   // minutes
    topics:    { type: [String], default: [] },
    activities: { type: [String], default: [] },
    goal:      { type: String },
}, { _id: false });

// ── Sub-schema: topic recommendation ─────────────────────────────────────────
const topicRecommendationSchema = new mongoose.Schema({
    topic:          { type: String, required: true },
    priority:       { type: String, enum: ['critical', 'high', 'medium', 'low'] },
    reason:         { type: String },
    studyStrategy:  { type: String },
    estimatedHours: { type: Number },
}, { _id: false });

const adaptiveStudyPlanSchema = new mongoose.Schema({
    studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'student',  required: true },
    subjectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },

    // ── Analytics sent to LLM (full snapshot, never raw answers) ──────────
    analyticsSnapshot: {
        overallMastery:      { type: Number },
        readinessScore:      { type: Number },
        consistencyScore:    { type: Number },
        learningPace:        { type: String },  // "slow" | "medium" | "fast"

        weakTopics: [{
            topic:        { type: String },
            masteryScore: { type: Number },
            trendType:    { type: String },
            reason:       { type: String },
        }],

        strongTopics: [{
            topic:        { type: String },
            masteryScore: { type: Number },
        }],

        difficultyRecommendations: [{
            topic:      { type: String },
            difficulty: { type: String },
            reason:     { type: String },
        }],

        upcomingExams:    { type: [String], default: [] },
        availableStudyHoursPerWeek: { type: Number },
        learningObjectives: { type: [String], default: [] },
    },

    // ── Full prompt used (for research reproducibility) ───────────────────
    promptUsed: { type: String },

    // ── Structured plan output ────────────────────────────────────────────
    plan: {
        summary:         { type: String },  // 2–3 sentence overview
        totalWeeks:      { type: Number },
        estimatedHours:  { type: Number },

        topicPriority:   { type: [topicRecommendationSchema], default: [] },
        dailySchedule:   { type: [dailyScheduleEntrySchema],  default: [] },

        revisionOrder:   { type: [String], default: [] },  // topics in order to revise
        practiceRecommendations: { type: [String], default: [] },
        motivationTips:  { type: [String], default: [] },
        completionTimeline: { type: String },  // e.g. "2 weeks before exam"
    },

    // ── LLM metadata ─────────────────────────────────────────────────────
    llmMeta: {
        provider:    { type: String, default: 'groq' },
        model:       { type: String },
        latencyMs:   { type: Number },
        promptTokens:    { type: Number },
        completionTokens: { type: Number },
    },

    // Raw LLM response (stored for debugging / ablation)
    rawLLMResponse: { type: String },

    generatedAt: { type: Date, default: Date.now },
    isActive:    { type: Boolean, default: true },  // false when superseded by newer plan

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────
adaptiveStudyPlanSchema.index({ studentId: 1, generatedAt: -1 });
adaptiveStudyPlanSchema.index({ studentId: 1, isActive: 1 });
adaptiveStudyPlanSchema.index({ subjectId: 1 });

module.exports = mongoose.model('adaptiveStudyPlan', adaptiveStudyPlanSchema);
