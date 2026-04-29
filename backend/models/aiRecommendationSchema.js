const mongoose = require('mongoose');

const aiRecommendationSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin',
        required: true,
        unique: true,
    },
    recommendations: [
        {
            title: { type: String },
            description: { type: String },
            priority: {
                type: String,
                enum: ['High', 'Medium', 'Low'],
            },
        },
    ],
    generatedAt: {
        type: Date,
        default: Date.now,
    },
});

aiRecommendationSchema.index({ schoolId: 1 }, { unique: true });

module.exports = mongoose.model('aiRecommendation', aiRecommendationSchema);
