const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // We use Email as the ID
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true }, 
  role: { type: String, enum: ["admin", "faculty", "student"], required: true },
  
  // Specific Fields
  usn: { type: String },          // For Students
  section: { type: String },      // For Students (e.g., "CSE-3A")
  facultyId: { type: String },    // For Faculty
  department: { type: String },   // For Faculty
  
  verified: { type: Boolean, default: true }
});

module.exports = mongoose.model("User", userSchema);