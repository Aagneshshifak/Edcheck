const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true },
    question:  { type: String, required: true },
    solution:  { type: Object, required: true }, // { steps, logic, finalAnswer }
    createdAt: { type: Date, default: Date.now },
}, { timestamps: false });
schema.index({ studentId: 1, createdAt: -1 });
module.exports = mongoose.model('studentassignmenthelp', schema);
