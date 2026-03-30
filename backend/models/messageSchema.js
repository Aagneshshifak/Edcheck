const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "senderModel"
    },
    senderModel: {
        type: String,
        required: true,
        enum: ["admin", "teacher", "student", "parent"]
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: "receiverModel"
    },
    receiverModel: {
        type: String,
        required: true,
        enum: ["admin", "teacher", "student", "parent"]
    },
    conversationId: {
        type: String,
        required: true
        // format: "userId1_userId2" sorted alphabetically
    },
    message:    { type: String, required: true },
    timestamp:  { type: Date, default: Date.now },
    readStatus: { type: Boolean, default: false },
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
}, { timestamps: true });

messageSchema.index({ conversationId: 1, timestamp: -1 });
messageSchema.index({ receiverId: 1, readStatus: 1 });
messageSchema.index({ school: 1 });

module.exports = mongoose.model("message", messageSchema);
