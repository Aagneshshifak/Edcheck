const mongoose = require("mongoose");

const documentEntrySchema = new mongoose.Schema({
    documentName: { type: String, required: true },
    fileUrl:      { type: String, required: true },
    fileType:     { type: String },
    publicId:     { type: String },
    size:         { type: Number },
    uploadedAt:   { type: Date, default: Date.now },
}, { _id: false });

const studentDocumentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "student",
        required: true,
        unique: true,   // one document record per student
    },
    documents: { type: [documentEntrySchema], default: [] },
}, { timestamps: true });

studentDocumentSchema.index({ studentId: 1 });

module.exports = mongoose.model("studentDocument", studentDocumentSchema);
