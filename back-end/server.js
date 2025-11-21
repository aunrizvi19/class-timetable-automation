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

const { generateAndSaveTimetable } = require('./timetable_generator'); 

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// [CONNECTION STRING]
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// 1. Connect Mongoose
mongoose.connect(uri)
    .then(() => console.log("✅ Mongoose Connected (Dashboard Ready)"))
    .catch(err => console.error("❌ Mongoose Error:", err));

// 2. Connect Native Client (For Generator)
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  tlsInsecure: true 
});
let db;
client.connect().then(() => { 
    db = client.db("test"); 
    console.log("✅ Native MongoDB Client Connected (Generator Ready)");
}).catch(err => console.error("❌ Native Client Error:", err));


// =================================================================
// 1. AUTHENTICATION API
// =================================================================

app.post('/api/login', async (req, res) => {
    console.log("📝 Login Attempt:", req.body.identifier);
    const { identifier, password } = req.body;
    try {
        if (!identifier || !password) return res.status(400).json({ message: "Missing credentials" });

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
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                profileId: pid,
                department: user.department,
                usn: user.usn
            } 
        });
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: err.message });
    }
});

app.post('/api/signup', async (req, res) => {
    try {
        const { name, email, password, role, usn, facultyId } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            _id: email, 
            name, email, passwordHash: hashedPassword, role,
            usn: role === 'student' ? usn : null,
            facultyId: role === 'faculty' ? facultyId : null,
            verified: true
        });
        
        await newUser.save();
        res.status(201).json({ message: "User created" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// =================================================================
// 2. CRUD API (With Fixes for Missing Fields)
// =================================================================

// --- COURSES ---
app.get('/api/courses', async (req, res) => {
    try {
        const subjects = await Subject.find({});
        // Robust mapping that won't crash if fields are missing
        const mapped = subjects.map(s => ({
            _id: s.subjectCode || "NO_ID", 
            course_name: s.name || "Unnamed Course",
            course_type: s.type ? (s.type.charAt(0).toUpperCase() + s.type.slice(1)) : 'Theory',
            credits: s.credits || 0,
            lectures_per_week: s.weeklyHours || s.lectures_per_week || 0,
            tutorials_per_week: 0,
            practicals_per_week: 0
        }));
        res.json(mapped);
    } catch(e) {
        console.error("GET /courses error:", e);
        res.status(500).json({message: e.message});
    }
});

app.post('/api/courses', async (req, res) => {
    try {
        console.log("Adding Course:", req.body);
        const { course_name, course_type, lectures_per_week, credits } = req.body;
        
        // AUTO-GENERATE MISSING REQUIRED FIELDS
        const code = course_name.substring(0,3).toUpperCase() + Math.floor(100 + Math.random() * 900); 
        
        const newSub = new Subject({
            subjectCode: code,
            name: course_name,
            type: (course_type || 'theory').toLowerCase(),
            department: "CSE", // Defaulting to CSE since UI doesn't send it yet
            semester: 1,       // Default
            year: 1,           // Default
            credits: credits || 4,
            weeklyHours: lectures_per_week || 4
        });
        
        await newSub.save();
        res.status(201).json({ message: "Course Added" });
    } catch(err) { 
        console.error("POST /courses Failed:", err);
        res.status(500).json({ message: "Error adding course: " + err.message }); 
    }
});

app.delete('/api/courses/:id', async (req, res) => {
    await Subject.deleteOne({ subjectCode: req.params.id });
    res.json({ message: "Deleted" });
});

// --- ROOMS ---
app.get('/api/rooms', async (req, res) => {
    const rooms = await Room.find({});
    res.json(rooms);
});

app.post('/api/rooms', async (req, res) => {
    try {
        const { roomNumber, capacity, type } = req.body;
        const newRoom = new Room({
            _id: roomNumber, 
            name: roomNumber,
            capacity: capacity || 60,
            floor: 1, // Default
            type: type || 'Lecture'
        });
        await newRoom.save();
        res.status(201).json({ message: "Room Added" });
    } catch(err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/rooms/:id', async (req, res) => {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// --- SECTIONS (BATCHES) ---
app.get('/api/sections', async (req, res) => {
    const batches = await Batch.find({});
    const mapped = batches.map(b => ({
        _id: b._id,
        section_name: b.name,
        department: b.department,
        semester: b.semester,
        size: b.size
    }));
    res.json(mapped);
});

app.post('/api/sections', async (req, res) => {
    try {
        console.log("Adding Section:", req.body);
        const { section_name, department, semester, size } = req.body;
        const newBatch = new Batch({
            _id: section_name,
            name: section_name,
            department: department || "CSE",
            year: Math.ceil((semester || 1)/2), // Calculate year from sem
            semester: semester || 1,
            size: size || 60
        });
        await newBatch.save();
        res.status(201).json({ message: "Section Added" });
    } catch(err) { 
        console.error("POST /sections Failed:", err);
        res.status(500).json({ message: err.message }); 
    }
});

app.delete('/api/sections/:id', async (req, res) => {
    await Batch.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});

// --- USERS / FACULTY ---
app.get('/api/users', async(req, res) => res.json(await User.find({})));
app.get('/api/faculty', async(req, res) => res.json(await User.find({ role: 'faculty' })));

app.post('/api/faculty', async (req, res) => {
    try {
        const { name, email, facultyId, department } = req.body;
        const hashedPassword = await bcrypt.hash("password123", 10); 
        
        const newFac = new User({
            _id: email,
            name, email, passwordHash: hashedPassword, role: 'faculty',
            facultyId, department, verified: true
        });
        await newFac.save();
        res.status(201).json({ message: "Faculty Added" });
    } catch(err) { res.status(500).json({ message: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});
app.delete('/api/faculty/:id', async (req, res) => {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});


// =================================================================
// 3. TIMETABLE GENERATION
// =================================================================

app.post('/api/timetable/generate', async (req, res) => {
    if (!db) return res.status(500).json({ message: "Database not connected yet." });
    try {
        const data = await generateAndSaveTimetable(db);
        res.status(201).json({ message: "Timetable Published!", data });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ message: "Generation Failed: " + err.message }); 
    }
});

app.get('/api/timetable', async (req, res) => {
    if (!db) return res.status(500).json({ message: "Database not connected yet." });
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
            const match = slots.find(s => s.section === req.params.id);
            if (match) filtered[day][time] = [match];
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

// 4. SERVE FRONTEND
app.use(express.static(path.join(__dirname, '../front-end')));

app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, '../front-end/login.html'));
    } else {
        res.status(404).json({ message: "Endpoint not found" });
    }
});

app.listen(port, () => { console.log(`✅ Server running at http://localhost:${port}`); });