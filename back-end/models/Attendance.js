const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    date: { type: String, required: true }, // Format: "YYYY-MM-DD"
    facultyId: { type: String, required: true }, // The absent teacher
    status: { type: String, enum: ['present', 'absent'], default: 'absent' },
    substitutions: [{
        slot: String,       // e.g., "09:30"
        substituteId: String, // The teacher taking the class
        substituteName: String
    }]
});

// Ensure one record per teacher per day
attendanceSchema.index({ date: 1, facultyId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);