const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path'); // Required for serving frontend files

// Import the updated generator logic
const { generateAndSaveTimetable } = require('./timetable_generator'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// [CONNECTION STRING]
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tlsInsecure: true 
});

let db;

async function connectDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    db = client.db("timetableDB");
  } catch (err) {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1);
  }
}

connectDB().then(() => {

    // =================================================================
    // 1. AUTHENTICATION (Login & Signup)
    // =================================================================
    
    app.post('/api/login', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { email, password } = req.body;
            
            // Look up by 'email' field
            const user = await db.collection('users').findOne({ email: email });
            
            if (!user) {
                return res.status(404).json({ message: "Invalid email or password." });
            }
            
            // Check password
            const isMatch = await bcrypt.compare(password, user.password || user.passwordHash);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password." });
            }
            
            res.status(200).json({ 
                message: "Login successful!", 
                user: { 
                    name: user.name, 
                    email: user.email,
                    role: user.role, 
                    profileId: user.profileId || user._id 
                } 
            });
        } catch (err) {
            console.error("Login Error:", err);
            res.status(500).json({ message: "Error logging in" });
        }
    });

    // [FIX] Re-added Signup for Students
    app.post('/api/signup', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const { name, email, password, role, profileId } = req.body;
            
            // Basic Validation
            if (!name || !email || !password || !role) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            if (role === 'student' && !profileId) {
                return res.status(400).json({ message: "Missing Section ID for student." });
            }

            const usersCollection = db.collection('users');
            const existingUser = await usersCollection.findOne({ email: email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use." });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = {
                _id: email, // Use email as ID for consistency with seed data
                name: name,
                email: email,
                password: hashedPassword, // Use 'password' field for new signups to match login check logic
                // Store hash in both fields to be safe given schema differences
                passwordHash: hashedPassword, 
                role: role,
                profileId: role === 'admin' ? null : profileId,
                verified: true 
            };
            
            await usersCollection.insertOne(newUser);
            res.status(201).json({ message: "User created successfully!" });

        } catch (err) {
            console.error("Error signing up user:", err);
            res.status(500).json({ message: "Error saving user to database" });
        }
    });

    app.get('/api/users', async (req, res) => {
        try {
          if (!db) return res.status(500).json({ message: "Database not connected" });
          const users = await db.collection('users').find({}).toArray();
          res.json(users);
        } catch (err) { res.status(500).json({ message: "Error fetching users" }); }
    });


    // =================================================================
    // 2. DATA MAPPING ENDPOINTS
    // =================================================================

    // GET COURSES -> Maps from 'subjects' collection
    app.get('/api/courses', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const subjects = await db.collection('subjects').find({}).toArray();
            
            const mappedCourses = subjects.map(s => ({
                _id: s.subjectCode,
                course_name: s.name,
                course_type: s.type.charAt(0).toUpperCase() + s.type.slice(1),
                credits: s.credits,
                lectures_per_week: s.type === 'theory' ? s.weeklyHours : 0,
                practicals_per_week: s.type === 'lab' ? s.weeklyHours : 0,
                tutorials_per_week: 0
            }));

            res.json(mappedCourses);
        } catch (err) { res.status(500).json({ message: "Error fetching courses" }); }
    });

    app.get('/api/faculty', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const faculty = await db.collection('users').find({ role: 'faculty' }).toArray();
            res.json(faculty);
        } catch (err) { res.status(500).json({ message: "Error fetching faculty" }); }
    });

    app.get('/api/rooms', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const rooms = await db.collection('rooms').find({}).toArray();
            res.json(rooms);
        } catch (err) { res.status(500).json({ message: "Error fetching rooms" }); }
    });
    
    // GET SECTIONS -> Maps from 'batches' collection
    app.get('/api/sections', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const batches = await db.collection('batches').find({}).toArray();
            
            const mappedSections = batches.map(b => ({
                _id: b.name,
                section_name: b.name,
                department: b.department,
                semester: b.semester,
                size: b.size,
                batches: [b.name],
                assignments: [] 
            }));

            res.json(mappedSections);
        } catch (err) { res.status(500).json({ message: "Error fetching sections" }); }
    });
    
    app.get('/api/sections/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            let batch = await db.collection('batches').findOne({ name: req.params.id });
            if (!batch) {
                batch = await db.collection('batches').findOne({ _id: req.params.id });
            }
            
            if (batch) {
                 res.json({
                    _id: batch.name,
                    section_name: batch.name,
                    department: batch.department,
                    semester: batch.semester,
                    batches: [batch.name],
                    assignments: []
                 });
            } else {
                res.status(404).json({ message: "Section not found" });
            }
        } catch (err) { res.status(500).json({ message: `Error fetching section: ${err.message}` }); }
    });


    // =================================================================
    // 3. TIMETABLE OPERATIONS
    // =================================================================

    app.post('/api/timetable/generate', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const data = await generateAndSaveTimetable(db);
            res.status(201).json({ message: "Timetable generated!", data });
        } catch (err) { 
            console.error("Error in /api/timetable/generate:", err);
            res.status(500).json({ message: `Failed to generate: ${err.message}` }); 
        }
    });

    app.get('/api/timetable', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const timetable = await db.collection('timetables').findOne({ _id: 'main' });
            if (!timetable) return res.status(404).json({ message: "No timetable found." });
            res.json(timetable);
        } catch (err) { res.status(500).json({ message: `Failed to fetch: ${err.message}` }); }
    });

    app.get('/api/timetable/section/:sectionId', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const main = await db.collection('timetables').findOne({ _id: 'main' });
            if (!main) return res.status(404).json({ message: "No timetable found." });

            const filtered = {};
            for (const day in main.data) {
                filtered[day] = {};
                for (const time in main.data[day]) {
                    const slots = main.data[day][time] || [];
                    const match = slots.find(s => s.section === req.params.sectionId || s.batch === req.params.sectionId);
                    if (match) filtered[day][time] = [match];
                }
            }
            res.json({ data: filtered, generatedAt: main.generatedAt });
        } catch (err) { res.status(500).json({ message: `Failed to filter: ${err.message}` }); }
    });
    
    app.get('/api/timetable/faculty/:facultyId', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const main = await db.collection('timetables').findOne({ _id: 'main' });
            if (!main) return res.status(404).json({ message: "No timetable found." });

            const filtered = {};
            const facultyUser = await db.collection('users').findOne({ _id: req.params.facultyId });
            const facultyName = facultyUser ? facultyUser.name : req.params.facultyId;

            for (const day in main.data) {
                filtered[day] = {};
                for (const time in main.data[day]) {
                    const slots = main.data[day][time] || [];
                    const match = slots.find(s => 
                        s.facultyId === req.params.facultyId || 
                        s.faculty === facultyName
                    );
                    if (match) filtered[day][time] = [match]; 
                }
            }
            res.json({ data: filtered, generatedAt: main.generatedAt });
        } catch (err) { res.status(500).json({ message: `Failed to filter: ${err.message}` }); }
    });

    // Manual Edit (Admin)
    app.post('/api/timetable/update-slot', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { day, time, courseId, facultyId, roomId, sectionId, batch } = req.body;
            
            const course = await db.collection('subjects').findOne({ subjectCode: courseId });
            const faculty = await db.collection('users').findOne({ _id: facultyId });
            
            const newSlotData = {
                id: new ObjectId(),
                course: course ? course.name : courseId,
                faculty: faculty ? faculty.name : facultyId,
                room: roomId,
                section: sectionId,
                facultyId: facultyId,
                batch: batch,
                duration: (course && course.type === 'lab') ? 2 : 1,
                conflict: false 
            };

            const mainDoc = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainDoc) return res.status(404).json({ message: "Main timetable not found." });

            let currentSlots = (mainDoc.data[day] && mainDoc.data[day][time]) ? mainDoc.data[day][time] : [];
            
            // Remove old slot for this section, add new
            currentSlots = currentSlots.filter(slot => slot.section !== sectionId);
            currentSlots.push(newSlotData);

            const updateKey = `data.${day}.${time}`;
            await db.collection('timetables').updateOne(
                { _id: 'main' },
                { $set: { [updateKey]: currentSlots } }
            );

            res.status(200).json({ message: "Slot updated!", updatedSlot: newSlotData });

        } catch (err) {
            console.error("Error updating slot:", err);
            res.status(500).json({ message: "Error saving data" });
        }
    });

    app.post('/api/timetable/delete-slot', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { day, time, sectionId } = req.body;

            const mainDoc = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainDoc) return res.status(404).json({ message: "Timetable not found." });

            let currentSlots = (mainDoc.data[day] && mainDoc.data[day][time]) ? mainDoc.data[day][time] : [];
            
            const newSlots = currentSlots.filter(slot => slot.section !== sectionId);

            const updateKey = `data.${day}.${time}`;
            await db.collection('timetables').updateOne(
                { _id: 'main' },
                { $set: { [updateKey]: newSlots } }
            );

            res.status(200).json({ message: "Slot deleted!" });
        } catch (err) {
            console.error("Error deleting slot:", err);
            res.status(500).json({ message: "Error updating database" });
        }
    });

    // =================================================================
    // 4. STATIC FILE SERVING (Fix for 404s)
    // =================================================================
    
    // Point to the 'front-end' folder relative to 'back-end'
    app.use(express.static(path.join(__dirname, '../front-end')));

    // Catch-all handler to serve index.html for any unknown routes (optional for SPA behavior)
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../front-end/index.html'));
    });

    // --- Start Server ---
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
});