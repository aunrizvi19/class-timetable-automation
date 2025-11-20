const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  year: { type: Number, required: true },
  semester: { type: Number, required: true },
  credits: { type: Number, required: true },
  weeklyHours: { type: Number, required: true },
  type: { type: String, enum: ["theory", "lab"], required: true }
});

module.exports = mongoose.model("Subject", subjectSchema);