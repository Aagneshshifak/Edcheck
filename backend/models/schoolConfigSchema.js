const mongoose = require("mongoose");

const gradingScaleEntrySchema = new mongoose.Schema({
    letter: { type: String },
    min:    { type: Number },
    max:    { type: Number },
}, { _id: false });

const schoolConfigSchema = new mongoose.Schema({
    schoolId: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      "admin",
        required: true,
        unique:   true,
    },
    academicYear: { type: String },
    termStart:    { type: Date },
    termEnd:      { type: Date },
    gradingScale: { type: [gradingScaleEntrySchema], default: [] },
    featureToggles: {
        leaderboard:  { type: Boolean, default: true },
        parentPortal: { type: Boolean, default: true },
        fileUploads:  { type: Boolean, default: true },
        testRetake:   { type: Boolean, default: true },
    },
}, { timestamps: true });

schoolConfigSchema.index({ schoolId: 1 }, { unique: true });

module.exports = mongoose.model("schoolConfig", schoolConfigSchema);
