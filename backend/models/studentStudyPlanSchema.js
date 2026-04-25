const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'student', required: true, unique: true },
    studyPlan:   { type: Object, required: true },
    generatedAt: { type: Date, default: Date.now },
}, { timestamps: false });
module.exports = mongoose.model('studentstudyplan', schema);
