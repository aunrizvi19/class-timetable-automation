const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // <--- Added this line
  name: { type: String, required: true, unique: true }, 
  department: { type: String, required: true },
  year: { type: Number, required: true },
  semester: { type: Number, required: true },
  size: { type: Number, required: true }
});

module.exports = mongoose.model("Batch", batchSchema);