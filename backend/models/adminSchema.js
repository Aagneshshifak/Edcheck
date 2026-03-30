const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
    name:          { type: String, required: true },
    email:         { type: String, unique: true, required: true },
    password:      { type: String, required: true }, // bcrypt hashed
    role:          { type: String, default: "Admin" },
    schoolName:    { type: String, unique: true, required: true },
    schoolAddress: { type: String },
    phone:         { type: String },
    logoUrl:       { type: String },
}, { timestamps: true }); // createdAt + updatedAt auto-added

adminSchema.index({ email: 1 });
adminSchema.index({ schoolName: 1 });

module.exports = mongoose.model("admin", adminSchema);
