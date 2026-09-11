/**
 * StaffStudentReport Schema
 *
 * Stores structured post-assessment reports generated for teachers/staff.
 * Each report is tied to a specific student, staff member, assessment, and timestamp.
 * Historical reports are preserved — never overwritten.
 *
 * Report structure:
 *   - analyticsSnapshot: deterministic data from the pipeline (FACTS)
 *   - Granular hierarchical analytics from postAssessmentAnalyticsEngine (FACTS)
 *   - aiAnalysis: LLM-generated analysis and recommendations (AI)
 *   These are explicitly separated so the teacher knows what is data vs recommendation.
 */

'use strict';

const mongoose = require('mongoose');

const staffStudentReportSchema = new mongoose.Schema({
    // Core references
    studentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'student',        required: true },
    staffId:         { type: mongoose.Schema.Types.ObjectId, ref: 'teacher',        required: true },
    assessmentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'test',           required: true },
    attemptDetailId: { type: mongoose.Schema.Types.ObjectId, ref: 'quizAttemptDetail' },
    subjectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'subject' },
    schoolId:        { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
    classId:         { type: mongoose.Schema.Types.ObjectId, ref: 'sclass' },

    // Assessment info
    assessmentTitle: { type: String },
    assessmentDate:  { type: Date },

    // FACTS: Legacy analytics snapshot (from deterministic pipeline)
    analyticsSnapshot: {
        scorePercentage:     { type: Number },
        totalCorrect:        { type: Number },
        totalQuestions:      { type: Number },
        completionRate:      { type: Number },
        overallMastery:      { type: Number },
        readinessScore:      { type: Number },
        consistencyScore:    { type: Number },
        confidenceScore:     { type: Number },
        retentionEstimate:   { type: Number },
        learningPace:        { type: String },
        topicBreakdown:      { type: mongoose.Schema.Types.Mixed, default: {} },
        difficultyBreakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
        weakTopics:          { type: mongoose.Schema.Types.Mixed, default: [] },
        strongTopics:        { type: mongoose.Schema.Types.Mixed, default: [] },
        alerts:              { type: mongoose.Schema.Types.Mixed, default: [] },
    },

    // FACTS: Granular overall performance (from postAssessmentAnalyticsEngine)
    overallPerformance: {
        score:          { type: Number },
        accuracy:       { type: Number },
        mastery:        { type: Number },
        confidence:     { type: Number },
        consistency:    { type: Number },
        retention:      { type: Number },
        engagement:     { type: Number },
        completionRate: { type: Number },
        trend:          { type: String },
        totalQuestions: { type: Number },
        totalCorrect:   { type: Number },
    },

    // FACTS: Hierarchical analytics (deterministic)
    subjectAnalysis:  { type: mongoose.Schema.Types.Mixed, default: [] },
    chapterAnalysis:  { type: mongoose.Schema.Types.Mixed, default: [] },
    subtopicAnalysis: { type: mongoose.Schema.Types.Mixed, default: [] },
    conceptAnalysis:  { type: mongoose.Schema.Types.Mixed, default: [] },

    // FACTS: Ranked weak areas with full curriculum path + priority score
    weakAreas: {
        type: [{
            topicKey:           { type: String },
            subject:            { type: String },
            domain:             { type: String },
            chapter:            { type: String },
            subtopic:           { type: String },
            concept:            { type: String },
            mastery:            { type: Number },
            accuracy:           { type: Number },
            confidence:         { type: Number },
            consistency:        { type: Number },
            retention:          { type: Number },
            forgettingFactor:   { type: Number },
            trend:              { type: String },
            severity:           { type: String, enum: ['CRITICAL', 'WEAK', 'DEVELOPING', 'STRONG'] },
            priorityScore:      { type: Number },
            questionCount:      { type: Number },
            attemptedCount:     { type: Number },
            correctCount:       { type: Number },
            repeatedErrors:     { type: Number },
            confidenceMismatch: { type: String },
        }],
        default: [],
    },

    strongAreas:              { type: mongoose.Schema.Types.Mixed, default: [] },
    trendAnalysis:            { type: mongoose.Schema.Types.Mixed, default: [] },
    retentionRisks:           { type: mongoose.Schema.Types.Mixed, default: [] },
    confidenceMismatch:       { type: mongoose.Schema.Types.Mixed, default: [] },
    difficultyAnalysis:       { type: mongoose.Schema.Types.Mixed, default: [] },
    recommendedInterventions: { type: mongoose.Schema.Types.Mixed, default: [] },

    // AI: Generated analysis and recommendations (LLM output — never overwrites FACTS)
    aiAnalysis: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },

    // LLM metadata
    llmMeta: {
        provider:         { type: String, default: 'groq' },
        model:            { type: String },
        latencyMs:        { type: Number },
        promptTokens:     { type: Number },
        completionTokens: { type: Number },
        error:            { type: String },
    },

    // Generation tracking
    generationStatus: {
        type: String,
        enum: ['PROCESSING', 'COMPLETED', 'COMPLETED_WITHOUT_AI', 'FAILED'],
        default: 'PROCESSING',
    },
    generationStartedAt:   { type: Date },
    generationCompletedAt: { type: Date },
    generationDurationMs:  { type: Number },
    reportVersion:         { type: Number, default: 1 },

    // Legacy status field (backward compat)
    status: {
        type: String,
        enum: ['generated', 'reviewed', 'action_taken'],
        default: 'generated',
    },
    generatedAt: { type: Date, default: Date.now },
    staffNotes:  { type: String, default: '' },

}, { timestamps: true });

// Indexes
staffStudentReportSchema.index({ studentId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ staffId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ assessmentId: 1 });
staffStudentReportSchema.index({ schoolId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ studentId: 1, staffId: 1 });
staffStudentReportSchema.index({ studentId: 1, subjectId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ classId: 1, generatedAt: -1 });
staffStudentReportSchema.index({ generationStatus: 1, staffId: 1 });

module.exports = mongoose.model('staffStudentReport', staffStudentReportSchema);
