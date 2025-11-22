const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb'); 
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const mongoose = require('mongoose');

// Import Models
const User = require('./models/user');
const Subject = require('./models/Subject');
const Room = require('./models/Room');
const Batch = require('./models/Batch');
const Attendance = require('./models/Attendance'); // <--- NEW

const { generateAndSaveTimetable } = require('./timetable_generator'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [CONNECTION STRING]
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// 1. Connect Mongoose
mongoose.connect(uri)
    .then(() => console.log("✅ Mongoose Connected"))
    .catch(err => console.error("❌ Mongoose Error:", err));

// 2. Connect Native Client
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  tlsInsecure: true 
});
let db;
client.connect().then(() => { db = client.db("test"); console.log("✅ Native Client Connected"); });

// =================================================================
// AUTHENTICATION & PASSWORD MANAGEMENT
// =================================================================

app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    try {
        const user = await User.findOne({ 
            $or: [
                { email: { $regex: new RegExp(`^${identifier}$`, 'i') } }, 
                { usn: { $regex: new RegExp(`^${identifier}$`, 'i') } }
            ] 
        });
        if (!user) return res.status(401).json({ message: "User not found" });
        
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
        
        let pid = user._id;
        if (user.role === 'student') pid = user.section || "Not Assigned"; 
        if (user.role === 'faculty') pid = user.facultyId || user._id;
        
        res.status(200).json({ 
            message: "Login successful", 
            user: { name: user.name, email: user.email, role: user.role, profileId: pid, department: user.department, usn: user.usn } 
        });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// NEW: Change Password
app.post('/api/change-password', async (req, res) => {
    const { email, newPassword } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.updateOne({ email }, { $set: { passwordHash: hashedPassword } });
        res.json({ message: "Password updated successfully" });
    } catch (err) { res.status(500).json({ message: "Update failed" }); }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, role, usn, facultyId } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            _id: email, name, email, passwordHash: hashedPassword, role,
            usn: role === 'student' ? usn : null,
            facultyId: role === 'faculty' ? facultyId : null,
            verified: true
        });
        await newUser.save();
        res.status(201).json({ message: "User created" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// =================================================================
// ATTENDANCE & SUBSTITUTION API (NEW)
// =================================================================

app.post('/api/attendance', async (req, res) => {
    // Expected body: { date: "2023-11-01", facultyId: "...", status: "absent", substitutions: [] }
    const { date, facultyId, status, substitutions } = req.body;
    try {
        await Attendance.findOneAndUpdate(
            { date, facultyId },
            { status, substitutions },
            { upsert: true, new: true }
        );
        res.json({ message: "Attendance updated" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/attendance/:date', async (req, res) => {
    try {
        const records = await Attendance.find({ date: req.params.date });
        res.json(records);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// =================================================================
// CRUD DATA API (With Mapping Fixes)
// =================================================================

// Courses (Subjects)
app.get('/api/courses', async (req, res) => {
    const subjects = await Subject.find({});
    res.json(subjects.map(s => ({
        _id: s.subjectCode, 
        course_name: s.name, 
        course_type: s.type, 
        credits: s.credits,
        lectures_per_week: s.weeklyHours || 3, 
        tutorials_per_week: 0, 
        practicals_per_week: 0
    })));
});

app.post('/api/courses', async(req,res) => {
    try {
        const { course_name, course_type, lectures_per_week, credits } = req.body;
        const code = course_name.substring(0,3).toUpperCase() + Math.floor(100+Math.random()*900);
        await new Subject({
            subjectCode: code, name: course_name, type: (course_type||'theory').toLowerCase(),
            department: "CSE", semester: 1, credits: credits||4, weeklyHours: lectures_per_week||4
        }).save();
        res.status(201).json({message: "Course Added"});
    } catch(e){ res.status(500).json({message:e.message}); }
});
app.delete('/api/courses/:id', async(req,res) => { await Subject.deleteOne({subjectCode:req.params.id}); res.json({message:"Deleted"}); });

// Rooms
app.get('/api/rooms', async(req,res) => res.json(await Room.find({})));
app.post('/api/rooms', async(req,res) => {
    try {
        const { roomNumber, capacity, type } = req.body;
        await new Room({_id: roomNumber, name: roomNumber, capacity, type}).save();
        res.status(201).json({message:"Room Added"});
    } catch(e){ res.status(500).json({message:e.message}); }
});
app.delete('/api/rooms/:id', async(req,res)=>{ await Room.findByIdAndDelete(req.params.id); res.json({message:"Deleted"}); });

// Sections
app.get('/api/sections', async(req,res) => {
    const batches = await Batch.find({});
    res.json(batches.map(b => ({ _id: b._id, section_name: b.name, department: b.department, semester: b.semester, size: b.size })));
});
app.post('/api/sections', async(req,res) => {
    try {
        const { section_name, department, semester, size } = req.body;
        await new Batch({ _id: section_name, name: section_name, department, semester, size }).save();
        res.status(201).json({message:"Section Added"});
    } catch(e){ res.status(500).json({message:e.message}); }
});
app.delete('/api/sections/:id', async(req,res) => { await Batch.findByIdAndDelete(req.params.id); res.json({message:"Deleted"}); });

// Faculty & Users
app.get('/api/faculty', async(req,res) => res.json(await User.find({role:'faculty'})));
app.post('/api/faculty', async(req,res) => {
    try {
        const { name, email, facultyId, department } = req.body;
        const pass = await bcrypt.hash("password123", 10);
        await new User({ _id: email, name, email, passwordHash: pass, role: 'faculty', facultyId, department }).save();
        res.status(201).json({message:"Faculty Added"});
    } catch(e){ res.status(500).json({message:e.message}); }
});
app.delete('/api/faculty/:id', async(req,res) => { await User.findByIdAndDelete(req.params.id); res.json({message:"Deleted"}); });
app.get('/api/users', async(req,res) => res.json(await User.find({})));
app.delete('/api/users/:id', async(req,res) => { await User.findByIdAndDelete(req.params.id); res.json({message:"Deleted"}); });

// =================================================================
// TIMETABLE GENERATION
// =================================================================

app.post('/api/timetable/generate', async (req, res) => {
    if (!db) return res.status(500).json({ message: "DB not ready" });
    try {
        const data = await generateAndSaveTimetable(db);
        res.status(201).json({ message: "Published", data });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/timetable', async (req, res) => {
    if (!db) return res.status(500).json({ message: "DB not ready" });
    const doc = await db.collection('timetables').findOne({ _id: 'main' });
    res.json(doc || { data: {} });
});

app.get('/api/timetable/section/:id', async (req, res) => {
    if (!db) return res.json({ data: {} });
    const main = await db.collection('timetables').findOne({ _id: 'main' });
    if (!main) return res.json({ data: {} });

    const filtered = {};
    for (const day in main.data) {
        filtered[day] = {};
        for (const time in main.data[day]) {
            const slots = main.data[day][time] || [];
            // Matches Exact Section (CSE-5A) OR Batch (CSE-5A-B1)
            const matches = slots.filter(s => s.section === req.params.id || (s.batch && s.batch.startsWith(req.params.id)));
            if (matches.length > 0) filtered[day][time] = matches;
        }
    }
    res.json({ data: filtered });
});

app.get('/api/timetable/faculty/:id', async (req, res) => {
    if (!db) return res.json({ data: {} });
    const main = await db.collection('timetables').findOne({ _id: 'main' });
    if (!main) return res.json({ data: {} });
    
    const user = await User.findOne({ $or: [{ _id: req.params.id }, { facultyId: req.params.id }] });
    const nameToFind = user ? user.name : req.params.id;

    const filtered = {};
    for (const day in main.data) {
        filtered[day] = {};
        for (const time in main.data[day]) {
            const slots = main.data[day][time] || [];
            const match = slots.find(s => s.facultyId === req.params.id || s.faculty === nameToFind);
            if (match) filtered[day][time] = [match];
        }
    }
    res.json({ data: filtered });
});

// Serve Frontend
app.use(express.static(path.join(__dirname, '../front-end')));
app.get('*', (req, res) => {
    if(!req.path.startsWith('/api')) res.sendFile(path.join(__dirname, '../front-end/login.html'));
    else res.status(404).json({message:"API Not Found"});
});

app.listen(port, () => { console.log(`✅ Server running on ${port}`); });