const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const cors = require('cors');
const bcrypt = require('bcrypt');

// Import our generator logic
const { generateAndSaveTimetable } = require('./timetable_generator'); 

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
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
    // ================== AUTHENTICATION ==================
    app.post('/api/signup', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const { name, email, password, role, profileId } = req.body;
            if (!name || !email || !password || !role) {
                return res.status(400).json({ message: "Missing required fields" });
            }
            if (role === 'student' && !profileId) {
                return res.status(400).json({ message: "Missing Section ID" });
            }
            if (!['admin', 'student'].includes(role)) {
                return res.status(400).json({ message: "Invalid role for public signup." });
            }

            const usersCollection = db.collection('users');
            const existingUser = await usersCollection.findOne({ email: email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use." });
            }
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = {
                name: name,
                email: email,
                password: hashedPassword,
                role: role,
                _id: email,
                profileId: role === 'admin' ? null : profileId
            };
            
            await usersCollection.insertOne(newUser);
            res.status(201).json({ message: "User created successfully!" });

        } catch (err) {
            console.error("Error signing up user:", err);
            res.status(500).json({ message: "Error saving user to database" });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: "Missing email or password" });
            }
            
            const user = await db.collection('users').findOne({ _id: email });
            if (!user) {
                return res.status(404).json({ message: "Invalid email or password." });
            }
            
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password." });
            }
            
            res.status(200).json({ 
                message: "Login successful!", 
                user: { 
                    name: user.name, 
                    email: user.email,
                    role: user.role, 
                    profileId: user.profileId 
                } 
            });
        } catch (err) {
            console.error("Error logging in user:", err);
            res.status(500).json({ message: "Error logging in" });
        }
    });

    // Get all users (for admin panel)
    app.get('/api/users', async (req, res) => {
        try {
          if (!db) return res.status(500).json({ message: "Database not connected" });
          const users = await db.collection('users').find({}, { 
              projection: { _id: 1, name: 1, email: 1, role: 1, profileId: 1 } 
          }).toArray();
          res.json(users);
        } catch (err) {
          console.error("Error fetching users:", err);
          res.status(500).json({ message: "Error fetching user data" });
        }
    });

    // Create login for faculty
    app.post('/api/users/create-faculty-login', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const { email, password, facultyId } = req.body;
            if (!email || !password || !facultyId) {
                return res.status(400).json({ message: "Missing fields" });
            }

            const existingUser = await db.collection('users').findOne({ _id: email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use." });
            }

            const faculty = await db.collection('faculty').findOne({ _id: facultyId });
            if (!faculty) {
                return res.status(404).json({ message: "Faculty ID not found." });
            }

            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            
            const newUser = {
                name: faculty.name,
                email: email,
                password: hashedPassword,
                role: 'faculty',
                _id: email,
                profileId: facultyId 
            };
            
            await db.collection('users').insertOne(newUser);
            res.status(201).json({ message: `Login for ${faculty.name} created!` });

        } catch (err) {
            console.error("Error creating faculty login:", err);
            res.status(500).json({ message: "Error saving user to database" });
        }
    });

    // [NEW] Delete a user
    app.delete('/api/users/:email', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const email = req.params.email;
            
            // Safety check: Don't let the last admin delete themselves
            const userToDelete = await db.collection('users').findOne({ _id: email });
            if (userToDelete && userToDelete.role === 'admin') {
                const adminCount = await db.collection('users').countDocuments({ role: 'admin' });
                if (adminCount <= 1) {
                    return res.status(400).json({ message: "Cannot delete the last admin account." });
                }
            }
            
            const result = await db.collection('users').deleteOne({ _id: email });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: "User not found." });
            }

            res.status(200).json({ message: "User deleted successfully." });
        } catch (err) {
            console.error("Error deleting user:", err);
            res.status(500).json({ message: "Error deleting user" });
        }
    });


    // ================== COURSES ==================
    app.get('/api/courses', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const courses = await db.collection('courses').find({}).toArray();
            res.json(courses);
        } catch (err) { res.status(500).json({ message: "Error fetching courses" }); }
    });
    app.post('/api/courses', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newCourse = req.body;
            newCourse._id = newCourse.course_code;
            newCourse.credits = parseInt(newCourse.credits);
            newCourse.lectures_per_week = parseInt(newCourse.lectures_per_week);
            newCourse.tutorials_per_week = parseInt(newCourse.tutorials_per_week);
            newCourse.practicals_per_week = parseInt(newCourse.practicals_per_week);
            
            delete newCourse.duration; // Remove old field

            await db.collection('courses').insertOne(newCourse);
            res.status(201).json(newCourse);
        } catch (err) { res.status(500).json({ message: `Failed to add course: ${err.message}` }); }
    });
    app.put('/api/courses/:code', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { code } = req.params;
            const { course_name, credits, course_type, lectures_per_week, tutorials_per_week, practicals_per_week } = req.body;
            
            await db.collection('courses').updateOne(
                { _id: code },
                { $set: { 
                    course_name, 
                    credits: parseInt(credits), 
                    course_type, 
                    lectures_per_week: parseInt(lectures_per_week), 
                    tutorials_per_week: parseInt(tutorials_per_week), 
                    practicals_per_week: parseInt(practicals_per_week)
                  },
                  $unset: { duration: "" } // Remove the old duration field
                }
            );
            res.json({ message: "Course updated" });
        } catch (err) { res.status(500).json({ message: `Failed to update: ${err.message}` }); }
    });
    app.delete('/api/courses/:code', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            await db.collection('courses').deleteOne({ _id: req.params.code });
            res.status(204).send();
        } catch (err) { res.status(500).json({ message: `Failed to delete: ${err.message}` }); }
    });

    // ================== FACULTY ==================
    app.get('/api/faculty', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const faculty = await db.collection('faculty').find({}).toArray();
            res.json(faculty);
        } catch (err) { res.status(500).json({ message: "Error fetching faculty" }); }
    });
    app.post('/api/faculty', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newFaculty = req.body;
            newFaculty._id = newFaculty.faculty_id;
            await db.collection('faculty').insertOne(newFaculty);
            res.status(201).json(newFaculty);
        } catch (err) { res.status(500).json({ message: `Failed to add faculty: ${err.message}` }); }
    });
    app.put('/api/faculty/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { name, department, designation } = req.body;
            await db.collection('faculty').updateOne(
                { _id: req.params.id },
                { $set: { name, department, designation } }
            );
            res.json({ message: "Faculty updated" });
        } catch (err) { res.status(500).json({ message: `Failed to update: ${err.message}` }); }
    });
    app.delete('/api/faculty/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            await db.collection('faculty').deleteOne({ _id: req.params.id });
            res.status(204).send();
        } catch (err) { res.status(500).json({ message: `Failed to delete: ${err.message}` }); }
    });

    // ================== ROOMS ==================
    app.get('/api/rooms', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const rooms = await db.collection('rooms').find({}).toArray();
            res.json(rooms);
        } catch (err) { res.status(500).json({ message: "Error fetching rooms" }); }
    });
    app.post('/api/rooms', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newRoom = req.body;
            newRoom._id = newRoom.room_number;
            newRoom.capacity = parseInt(newRoom.capacity);
            await db.collection('rooms').insertOne(newRoom);
            res.status(201).json(newRoom);
        } catch (err) { res.status(500).json({ message: `Failed to add room: ${err.message}` }); }
    });
    app.put('/api/rooms/:number', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { capacity, type } = req.body;
            await db.collection('rooms').updateOne(
                { _id: req.params.number },
                { $set: { capacity: parseInt(capacity), type } }
            );
            res.json({ message: "Room updated" });
        } catch (err) { res.status(500).json({ message: `Failed to update: ${err.message}` }); }
    });
    app.delete('/api/rooms/:number', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            await db.collection('rooms').deleteOne({ _id: req.params.number });
            res.status(204).send();
        } catch (err) { res.status(500).json({ message: `Failed to delete: ${err.message}` }); }
    });
    
    // ================== SECTIONS ==================
    app.get('/api/sections', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const sections = await db.collection('sections').find({}).toArray();
            res.json(sections);
        } catch (err) { res.status(500).json({ message: "Error fetching sections" }); }
    });
    app.get('/api/sections/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const section = await db.collection('sections').findOne({ _id: req.params.id });
            res.json(section);
        } catch (err) { res.status(500).json({ message: `Error fetching section: ${err.message}` }); }
    });
    app.post('/api/sections', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newSection = req.body;
            newSection._id = newSection.section_id;
            newSection.assignments = [];
            newSection.batches = Array.isArray(newSection.batches) ? newSection.batches : [];
            await db.collection('sections').insertOne(newSection);
            res.status(201).json(newSection);
        } catch (err) { res.status(500).json({ message: `Failed to add section: ${err.message}` }); }
    });
    app.put('/api/sections/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { department, semester, section_name, batches } = req.body;
            await db.collection('sections').updateOne(
                { _id: req.params.id },
                { $set: { department, semester: parseInt(semester), section_name, batches } }
            );
            res.json({ message: "Section updated" });
        } catch (err) { res.status(500).json({ message: `Failed to update: ${err.message}` }); }
    });
    app.delete('/api/sections/:id', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            await db.collection('sections').deleteOne({ _id: req.params.id });
            res.status(204).send();
        } catch (err) { res.status(500).json({ message: `Failed to delete: ${err.message}` }); }
    });

    app.put('/api/sections/:id/assign', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { courseId, facultyId, courseName, facultyName, batch } = req.body;
            const newAssignment = { _id: new ObjectId(), courseId, facultyId, courseName, facultyName, batch };
            await db.collection('sections').updateOne(
                { _id: req.params.id },
                { $push: { assignments: newAssignment } }
            );
            res.status(201).json(newAssignment);
        } catch (err) { res.status(500).json({ message: `Failed to assign: ${err.message}` }); }
    });
    app.delete('/api/sections/:id/unassign', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { assignmentId } = req.body;
            await db.collection('sections').updateOne(
                { _id: req.params.id },
                { $pull: { assignments: { _id: new ObjectId(assignmentId) } } }
            );
            res.status(204).send();
        } catch (err) { res.status(500).json({ message: `Failed to unassign: ${err.message}` }); }
    });

    // ================== TIMETABLE ==================
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
                    const match = slots.find(s => s.section === req.params.sectionId);
                    if (match) filtered[day][time] = [match]; // Send as array
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
            for (const day in main.data) {
                filtered[day] = {};
                for (const time in main.data[day]) {
                    const slots = main.data[day][time] || [];
                    const match = slots.find(s => s.facultyId === req.params.facultyId);
                    if (match) filtered[day][time] = [match]; // Send as array
                }
            }
            res.json({ data: filtered, generatedAt: main.generatedAt });
        } catch (err) { res.status(500).json({ message: `Failed to filter: ${err.message}` }); }
    });

    app.post('/api/timetable/update-slot', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { day, time, courseId, facultyId, roomId, sectionId, batch } = req.body;
            
            const course = await db.collection('courses').findOne({ _id: courseId });
            const faculty = await db.collection('faculty').findOne({ _id: facultyId });
            if (!course || !faculty) return res.status(404).json({ message: "Course or Faculty not found" });

            const newSlotData = {
                course: course.course_name,
                faculty: faculty.name,
                room: roomId,
                section: sectionId,
                facultyId: facultyId,
                batch: batch,
                // Use L/T/P to determine duration
                duration: course.practicals_per_week > 0 ? course.practicals_per_week : (course.lectures_per_week || 1),
                conflict: false // Admin override
            };

            const mainDoc = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainDoc) return res.status(404).json({ message: "Main timetable not found." });

            let currentSlots = (mainDoc.data[day] && mainDoc.data[day][time]) ? mainDoc.data[day][time] : [];
            
            // Remove old slot for this section, then add the new one
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

            const { day, time, sectionId } = req.body; // sectionId is crucial
            if (!day || !time || !sectionId) {
                return res.status(400).json({ message: "Missing day, time, or sectionId." });
            }

            const mainDoc = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainDoc) return res.status(404).json({ message: "Timetable not found." });

            let currentSlots = (mainDoc.data[day] && mainDoc.data[day][time]) ? mainDoc.data[day][time] : [];
            
            // Remove the slot for this section
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

    // --- Start Server ---
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
});