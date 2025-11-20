const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // <--- Added this line
  name: { type: String, required: true, unique: true }, 
  capacity: { type: Number, required: true },
  floor: { type: Number, required: true },
  type: { type: String, required: true } 
});

module.exports = mongoose.model("Room", roomSchema);