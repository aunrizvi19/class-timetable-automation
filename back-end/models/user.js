const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // <--- Added this line
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }, 
  role: { type: String, enum: ["admin", "faculty", "student"], required: true },
  department: { type: String },
  verified: { type: Boolean, default: false }
});

module.exports = mongoose.model("User", userSchema);