const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');
const mongoose = require('mongoose');

// Models
const User = require('./models/user');
const Subject = require('./models/Subject');
const Room = require('./models/Room');
const Batch = require('./models/Batch');

const { generateAndSaveTimetable } = require('./timetable_generator'); 

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [CONNECTION STRING]
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Connect Mongoose
mongoose.connect(uri)
    .then(() => console.log("✅ Mongoose Connected"))
    .catch(err => console.error("❌ Mongoose Error:", err));

// Connect Native Client (for generator)
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  tlsInsecure: true 
});
let db;
client.connect().then(() => { 
    db = client.db("timetableDB"); 
    console.log("✅ Native MongoDB Client Connected");
});

// =================================================================
// 1. AUTHENTICATION ROUTES
// =================================================================

// LOGIN
app.post('/api/login', async (req, res) => {
    console.log(`🔹 Login Attempt: ${req.body.email}`);
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            console.log("❌ User not found");
            return res.status(401).json({ message: "User not found" });
        }
        
        const isMatch = await bcrypt.compare(password, user.passwordHash || user.password);
        if (!isMatch) {
            console.log("❌ Invalid password");
            return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // Determine Profile ID based on role
        let pid = user._id;
        if (user.role === 'student') pid = user.section || null; 
        if (user.role === 'faculty') pid = user.facultyId || user._id;
        
        res.status(200).json({ 
            message: "Login successful", 
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                profileId: pid,
                usn: user.usn
            } 
        });
    } catch (err) {
        console.error("Server Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

// SIGNUP
app.post('/api/signup', async (req, res) => {
    console.log("🔹 Signup Attempt:", req.body);
    try {
        const { name, email, password, role, usn, facultyId } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: "Missing required fields." });
        }
        
        // Role-Specific Validation
        if (role === 'student' && !usn) {
             return res.status(400).json({ message: "Students must provide a USN." });
        }
        if (role === 'faculty' && !facultyId) {
             return res.status(400).json({ message: "Faculty must provide a Faculty ID." });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            console.log("❌ Email exists");
            return res.status(409).json({ message: "Email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            _id: email,
            name,
            email,
            passwordHash: hashedPassword,
            role,
            usn: role === 'student' ? usn : null,
            facultyId: role === 'faculty' ? facultyId : null,
            section: null, // Student selects this later on dashboard
            verified: true
        });
        
        await newUser.save();
        console.log("✅ User created successfully");
        res.status(201).json({ message: "Account created! Please log in." });

    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ message: "Signup failed: " + err.message });
    }
});


// =================================================================
// 2. DATA API (CRUD)
// =================================================================

// USERS
app.get('/api/users', async (req, res) => {
    const users = await User.find({});
    res.json(users);
});
app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.deleteOne({ _id: req.params.id });
        res.json({ message: "User deleted" });
    } catch(e) { res.status(500).json({message: e.message}); }
});

// COURSES
app.get('/api/courses', async (req, res) => {
    const subjects = await Subject.find({});
    res.json(subjects.map(s => ({
        _id: s.subjectCode,
        course_name: s.name,
        course_type: s.type.charAt(0).toUpperCase() + s.type.slice(1),
        credits: s.credits,
        lectures_per_week: s.weeklyHours
    })));
});
app.post('/api/courses', async (req, res) => {
    try {
        const code = "SUB" + Math.floor(Math.random() * 10000);
        const newSub = new Subject({
            subjectCode: req.body._id || code, 
            name: req.body.course_name,
            type: req.body.course_type.toLowerCase(),
            weeklyHours: parseInt(req.body.lectures_per_week) || 0,
            credits: parseInt(req.body.credits) || 0,
            department: "CSE", year: 1, semester: 1
        });
        await newSub.save();
        res.status(201).json({ message: "Course added" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.delete('/api/courses/:id', async (req, res) => {
    await Subject.deleteOne({ subjectCode: req.params.id });
    res.json({ message: "Course deleted" });
});

// FACULTY
app.get('/api/faculty', async (req, res) => {
    const faculty = await User.find({ role: 'faculty' });
    res.json(faculty);
});
app.post('/api/faculty', async (req, res) => {
    try {
        const { name, email, facultyId, department } = req.body;
        const hashedPassword = await bcrypt.hash("password123", 10);
        const newUser = new User({
            _id: email,
            name, email, 
            passwordHash: hashedPassword,
            role: 'faculty',
            facultyId, department, verified: true
        });
        await newUser.save();
        res.status(201).json({ message: "Faculty added" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.delete('/api/faculty/:id', async (req, res) => {
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: "Faculty deleted" });
});

// ROOMS
app.get('/api/rooms', async (req, res) => {
    const rooms = await Room.find({});
    res.json(rooms);
});
app.post('/api/rooms', async (req, res) => {
    try {
        const newRoom = new Room({
            _id: req.body.roomNumber,
            name: req.body.roomNumber,
            capacity: req.body.capacity,
            type: req.body.type,
            floor: 1
        });
        await newRoom.save();
        res.status(201).json({ message: "Room added" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.delete('/api/rooms/:id', async (req, res) => {
    await Room.deleteOne({ _id: req.params.id });
    res.json({ message: "Room deleted" });
});

// SECTIONS
app.get('/api/sections', async (req, res) => {
    const batches = await Batch.find({});
    res.json(batches.map(b => ({
        _id: b.name,
        section_name: b.name,
        department: b.department,
        semester: b.semester,
        size: b.size,
        batches: [b.name]
    })));
});
app.post('/api/sections', async (req, res) => {
    try {
        const newBatch = new Batch({
            _id: req.body.section_name,
            name: req.body.section_name,
            department: req.body.department || "CSE",
            semester: parseInt(req.body.semester) || 1,
            year: Math.ceil((parseInt(req.body.semester)||1)/2),
            size: req.body.size || 60
        });
        await newBatch.save();
        res.status(201).json({ message: "Section added" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
app.delete('/api/sections/:id', async (req, res) => {
    await Batch.deleteOne({ _id: req.params.id });
    res.json({ message: "Section deleted" });
});


// =================================================================
// 3. TIMETABLE OPERATIONS
// =================================================================

app.post('/api/timetable/generate', async (req, res) => {
    if (!db) return res.status(500).json({ message: "No DB" });
    try {
        const data = await generateAndSaveTimetable(db);
        res.status(201).json({ message: "Timetable Generated!", data });
    } catch (err) { 
        res.status(500).json({ message: "Generation Failed: " + err.message }); 
    }
});

app.get('/api/timetable', async (req, res) => {
    if (!db) return res.status(500).json({ message: "No DB" });
    const doc = await db.collection('timetables').findOne({ _id: 'main' });
    res.json(doc || { data: {} });
});

// Student Filter
app.get('/api/timetable/section/:id', async (req, res) => {
    if (!db) return res.json({ data: {} });
    const main = await db.collection('timetables').findOne({ _id: 'main' });
    if (!main) return res.json({ data: {} });

    const filtered = {};
    for (const day in main.data) {
        filtered[day] = {};
        for (const time in main.data[day]) {
            const slots = main.data[day][time] || [];
            const match = slots.find(s => s.section === req.params.id);
            if (match) filtered[day][time] = [match];
        }
    }
    res.json({ data: filtered });
});

// Faculty Filter
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

// =================================================================
// 4. SERVE FRONTEND (The Fix for 404s)
// =================================================================
app.use(express.static(path.join(__dirname, '../front-end')));

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../front-end/login.html'));
    } else {
        res.status(404).json({ message: "Endpoint not found" });
    }
});

app.listen(port, () => { console.log(`✅ Server running at http://localhost:${port}`); });