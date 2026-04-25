const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'sclass',  required: true },
    subjectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'subject', required: true },
    topic:        { type: String, required: true },
    notesContent: { type: Object, required: true }, // { explanation, keyConcepts, examples, formulas, commonMistakes, summary }
    generatedAt:  { type: Date, default: Date.now },
}, { timestamps: false });
schema.index({ classId: 1, subjectId: 1, topic: 1 }, { unique: true });
module.exports = mongoose.model('studentnotes', schema);
