// Kept for backward compatibility — routes still reference this
// New feedback system uses feedbackSchema.js
const mongoose = require('mongoose');

const complainSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'student',
        required: true
    },
    date: { type: Date, required: true },
    complaint: { type: String, required: true },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
    }
});

module.exports = mongoose.model("complain", complainSchema);
