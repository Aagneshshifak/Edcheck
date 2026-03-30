const mongoose = require("mongoose");

const parentSchema = new mongoose.Schema({
    name:     { type: String, required: true },
    email:    { type: String, unique: true, required: true },
    password: { type: String, required: true }, // bcrypt hashed
    phone:    { type: String, required: true },
    role:     { type: String, default: "Parent" },
    children: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "student"
    }],
    school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin",
        required: true
    },
}, { timestamps: true });

parentSchema.index({ email: 1 });
parentSchema.index({ school: 1 });

module.exports = mongoose.model("parent", parentSchema);
