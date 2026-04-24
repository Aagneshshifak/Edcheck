const mongoose = require('mongoose');

const aiNoteSuggestionSchema = new mongoose.Schema({
    subjectId:   { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    topic:       { type: String, required: true },
    suggestions: { type: [String], default: [] },
    keyPoints:   { type: [String], default: [] },
    resources:   { type: [String], default: [] },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'teacher', required: true },
    lastFetched: { type: Date, default: Date.now },
}, { timestamps: false });

// One cached entry per teacher+subject+topic
aiNoteSuggestionSchema.index({ subjectId: 1, topic: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('ainotesuggestion', aiNoteSuggestionSchema);
