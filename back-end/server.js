const express = require('express');
// Import ObjectId from mongodb
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb'); 
const cors = require('cors');
const bcrypt = require('bcrypt');

// Import our new generator logic
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
    console.log("Connected to database:", db.databaseName);
  } catch (err) {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1);
  }
}

connectDB().then(() => {
    // --- API Routes ---

    // ================== AUTHENTICATION ==================
    // POST Route to SIGNUP a new user
    app.post('/api/signup', async (req, res) => {
        console.log("Received request for POST /api/signup");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            // Faculty role removed from public signup
            const { name, email, password, role, profileId } = req.body;
            if (!name || !email || !password || !role) {
                return res.status(400).json({ message: "Missing required fields (name, email, password, role)" });
            }
            if (role === 'student' && !profileId) {
                return res.status(400).json({ message: "Missing required profileId (Section ID)" });
            }
            if (!['admin', 'student'].includes(role)) {
                return res.status(400).json({ message: "Invalid role specified for signup." });
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
                role: role, // Save the role
                _id: email,
                profileId: role === 'admin' ? null : profileId // Save the profileId
            };
            
            const result = await usersCollection.insertOne(newUser);
            if (result.insertedId) {
                res.status(201).json({ message: "User created successfully!", user: { name: name, email: email, role: role, profileId: newUser.profileId } });
            } else {
                res.status(500).json({ message: "Failed to create user" });
            }
        } catch (err) {
            console.error("Error signing up user:", err);
            res.status(500).json({ message: "Error saving user to database" });
        }
    });

    // POST Route to LOGIN a user
    app.post('/api/login', async (req, res) => {
        console.log("Received request for POST /api/login");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: "Missing required fields (email, password)" });
            }
            const usersCollection = db.collection('users');
            const user = await usersCollection.findOne({ _id: email });
            if (!user) {
                return res.status(404).json({ message: "Invalid email or password." });
            }
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password." });
            }
            
            console.log(`User ${user.email} (${user.role}) logged in successfully`);
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

    // GET Route to fetch all users (for admin panel)
    app.get('/api/users', async (req, res) => {
        try {
          if (!db) return res.status(500).json({ message: "Database not connected" });
          const usersCollection = db.collection('users');
          // We only project the fields we need for security
          const users = await usersCollection.find({}, { projection: { _id: 1, email: 1, role: 1, profileId: 1 } }).toArray();
          res.json(users);
        } catch (err) {
          console.error("Error fetching users:", err);
          res.status(500).json({ message: "Error fetching user data from database" });
        }
    });


    // ================== COURSES ==================
    app.get('/api/courses', async (req, res) => {
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const coursesCollection = db.collection('courses');
        const courses = await coursesCollection.find({}).toArray();
        res.json(courses);
      } catch (err) {
        console.error("Error fetching courses:", err);
        res.status(500).json({ message: "Error fetching data from database" });
      }
    });
    app.post('/api/courses', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newCourse = req.body;
            if (!newCourse.course_code || !newCourse.course_name || newCourse.credits == null || !newCourse.course_type || newCourse.duration == null) {
                return res.status(400).json({ message: "Missing required course fields (course_code, course_name, credits, course_type, duration)" });
            }
            newCourse._id = newCourse.course_code;
            newCourse.duration = parseInt(newCourse.duration);
            newCourse.credits = parseInt(newCourse.credits);

            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.insertOne(newCourse);
            if (result.insertedId) {
                res.status(201).json(newCourse);
            } else {
                res.status(500).json({ message: "Failed to insert course" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 res.status(409).json({ message: `Course with code ${req.body.course_code} already exists.` });
            } else {
                console.error("Error inserting course:", err);
                res.status(500).json({ message: "Error saving data to database" });
            }
        }
    });
    app.put('/api/courses/:code', async (req, res) => {
        const courseCode = req.params.code;
        const updatedData = req.body;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            if (!updatedData.course_name || updatedData.credits == null || !updatedData.course_type || updatedData.duration == null) {
                return res.status(400).json({ message: "Missing required fields for update (course_name, credits, course_type, duration)" });
            }
            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.updateOne(
                { _id: courseCode },
                { $set: { 
                    course_name: updatedData.course_name, 
                    credits: parseInt(updatedData.credits),
                    course_type: updatedData.course_type,
                    duration: parseInt(updatedData.duration)
                } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Course with code ${courseCode} not found.` });
            }
            res.json({ message: "Course updated successfully", code: courseCode });
        } catch (err) {
            console.error("Error updating course:", err);
            res.status(500).json({ message: "Error updating data in database" });
        }
    });
    app.delete('/api/courses/:code', async (req, res) => {
        const courseCode = req.params.code;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.deleteOne({ _id: courseCode });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Course with code ${courseCode} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting course:", err);
            res.status(500).json({ message: "Error deleting data from database" });
        }
    });

    // ================== FACULTY ==================
    app.get('/api/faculty', async (req, res) => {
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const facultyCollection = db.collection('faculty');
        const facultyMembers = await facultyCollection.find({}).toArray();
        res.json(facultyMembers);
      } catch (err) {
        console.error("Error fetching faculty:", err);
        res.status(500).json({ message: "Error fetching faculty data from database" });
      }
    });
    app.post('/api/faculty', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newFaculty = req.body;
            if (!newFaculty.faculty_id || !newFaculty.name || !newFaculty.department || !newFaculty.designation) {
                return res.status(400).json({ message: "Missing required fields (faculty_id, name, department, designation)" });
            }
            newFaculty._id = newFaculty.faculty_id;
            const facultyCollection = db.collection('faculty');
            const result = await facultyCollection.insertOne(newFaculty);
            if (result.insertedId) {
                res.status(201).json(newFaculty);
            } else {
                res.status(500).json({ message: "Failed to insert faculty member" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 res.status(409).json({ message: `Faculty with ID ${req.body.faculty_id} already exists.` });
            } else {
                console.error("Error inserting faculty:", err);
                res.status(500).json({ message: "Error saving faculty data to database" });
            }
        }
    });
    app.put('/api/faculty/:id', async (req, res) => {
        const facultyId = req.params.id;
        const updatedData = req.body;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            if (!updatedData.name || !updatedData.department || !updatedData.designation) {
                return res.status(400).json({ message: "Missing required fields for update (name, department, designation)" });
            }
            const facultyCollection = db.collection('faculty');
            const result = await facultyCollection.updateOne(
                { _id: facultyId },
                { $set: { 
                    name: updatedData.name, 
                    department: updatedData.department,
                    designation: updatedData.designation
                } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Faculty with ID ${facultyId} not found.` });
            }
            res.json({ message: "Faculty member updated successfully", id: facultyId });
        } catch (err) {
            console.error("Error updating faculty:", err);
            res.status(500).json({ message: "Error updating faculty data in database" });
        }
    });
    app.delete('/api/faculty/:id', async (req, res) => {
        const facultyId = req.params.id;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const facultyCollection = db.collection('faculty');
            const result = await facultyCollection.deleteOne({ _id: facultyId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Faculty with ID ${facultyId} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting faculty:", err);
            res.status(500).json({ message: "Error deleting faculty data from database" });
        }
    });

    // ================== ROOMS ==================
    app.get('/api/rooms', async (req, res) => {
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const roomsCollection = db.collection('rooms');
        const rooms = await roomsCollection.find({}).toArray();
        res.json(rooms);
      } catch (err) {
        console.error("Error fetching rooms:", err);
        res.status(500).json({ message: "Error fetching room data from database" });
      }
    });
    app.post('/api/rooms', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newRoom = req.body;
            if (!newRoom.room_number || newRoom.capacity == null || !newRoom.type) {
                return res.status(400).json({ message: "Missing required fields (room_number, capacity, type)" });
            }
            newRoom._id = newRoom.room_number;
            newRoom.capacity = parseInt(newRoom.capacity);
            const roomsCollection = db.collection('rooms');
            const result = await roomsCollection.insertOne(newRoom);
            if (result.insertedId) {
                res.status(201).json(newRoom);
            } else {
                res.status(500).json({ message: "Failed to insert room" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 res.status(409).json({ message: `Room with number ${req.body.room_number} already exists.` });
            } else {
                console.error("Error inserting room:", err);
                res.status(500).json({ message: "Error saving room data to database" });
            }
        }
    });
    app.put('/api/rooms/:number', async (req, res) => {
        const roomNumber = req.params.number;
        const updatedData = req.body;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            if (updatedData.capacity == null || !updatedData.type) {
                return res.status(400).json({ message: "Missing required fields for update (capacity, type)" });
            }
            const roomsCollection = db.collection('rooms');
            const result = await roomsCollection.updateOne(
                { _id: roomNumber },
                { $set: { capacity: parseInt(updatedData.capacity), type: updatedData.type } }
            );
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Room with number ${roomNumber} not found.` });
            }
            res.json({ message: "Room updated successfully", id: roomNumber });
        } catch (err) {
            console.error("Error updating room:", err);
            res.status(500).json({ message: "Error updating room data in database" });
        }
    });
    app.delete('/api/rooms/:number', async (req, res) => {
        const roomNumber = req.params.number;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const roomsCollection = db.collection('rooms');
            const result = await roomsCollection.deleteOne({ _id: roomNumber });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Room with number ${roomNumber} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting room:", err);
            res.status(500).json({ message: "Error deleting data from database" });
        }
    });
    
    // ================== SECTIONS ==================
    app.get('/api/sections', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const sectionsCollection = db.collection('sections');
            const sections = await sectionsCollection.find({}).toArray();
            res.json(sections);
        } catch (err) {
            console.error("Error fetching sections:", err);
            res.status(500).json({ message: "Error fetching section data from database" });
        }
    });

    app.get('/api/sections/:id', async (req, res) => {
        const sectionId = req.params.id;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const sectionsCollection = db.collection('sections');
            
            const section = await sectionsCollection.findOne({ _id: sectionId });
            
            if (!section) {
                return res.status(404).json({ message: `Section with ID ${sectionId} not found.` });
            }
            res.json(section);
        } catch (err) {
            console.error("Error fetching section:", err);
            res.status(500).json({ message: "Error fetching section data from database" });
        }
    });

    app.post('/api/sections', async (req, res) => {
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newSection = req.body;
            if (!newSection.section_id || !newSection.department || newSection.semester == null || !newSection.section_name) {
                return res.status(400).json({ message: "Missing required fields (section_id, department, semester, section_name)" });
            }
            newSection._id = newSection.section_id;
            newSection.semester = parseInt(newSection.semester);
            newSection.assignments = []; // Initialize assignments array
            // Save batches, default to empty array if not provided
            newSection.batches = Array.isArray(newSection.batches) ? newSection.batches : []; 

            const sectionsCollection = db.collection('sections');
            const result = await sectionsCollection.insertOne(newSection);
            if (result.insertedId) {
                res.status(201).json(newSection);
            } else {
                res.status(500).json({ message: "Failed to insert section" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 res.status(409).json({ message: `Section with ID ${req.body.section_id} already exists.` });
            } else {
                console.error("Error inserting section:", err);
                res.status(500).json({ message: "Error saving section data to database" });
            }
        }
    });
    app.put('/api/sections/:id', async (req, res) => {
        const sectionId = req.params.id;
        const updatedData = req.body;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            if (!updatedData.department || updatedData.semester == null || !updatedData.section_name) {
                return res.status(400).json({ message: "Missing required fields for update (department, semester, section_name)" });
            }
            const sectionsCollection = db.collection('sections');
            const result = await sectionsCollection.updateOne(
                { _id: sectionId },
                { $set: { 
                    department: updatedData.department, 
                    semester: parseInt(updatedData.semester),
                    section_name: updatedData.section_name,
                    batches: Array.isArray(updatedData.batches) ? updatedData.batches : [] // Save updated batches
                } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Section with ID ${sectionId} not found.` });
            }
            res.json({ message: "Section updated successfully", id: sectionId });
        } catch (err) {
            console.error("Error updating section:", err);
            res.status(500).json({ message: "Error updating section data in database" });
        }
    });
    app.delete('/api/sections/:id', async (req, res) => {
        const sectionId = req.params.id;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const sectionsCollection = db.collection('sections');
            const result = await sectionsCollection.deleteOne({ _id: sectionId });
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Section with ID ${sectionId} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting section:", err);
            res.status(500).json({ message: "Error deleting data from database" });
        }
    });

    app.put('/api/sections/:id/assign', async (req, res) => {
        const sectionId = req.params.id;
        const { courseId, facultyId, courseName, facultyName, batch } = req.body;
        
        if (!courseId || !facultyId || !courseName || !facultyName || !batch) {
            return res.status(400).json({ message: "Missing courseId, facultyId, courseName, facultyName, or batch" });
        }

        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const newAssignment = {
                _id: new ObjectId(), // Create a unique ID for this assignment
                courseId: courseId,
                facultyId: facultyId,
                courseName: courseName,
                facultyName: facultyName,
                batch: batch // Save the batch
            };

            const sectionsCollection = db.collection('sections');
            const result = await sectionsCollection.updateOne(
                { _id: sectionId },
                { $push: { assignments: newAssignment } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Section with ID ${sectionId} not found.` });
            }
            
            res.status(201).json(newAssignment); 

        } catch (err) {
            console.error("Error assigning to section:", err);
            res.status(500).json({ message: "Error saving assignment to database" });
        }
    });

    app.delete('/api/sections/:id/unassign', async (req, res) => {
        const sectionId = req.params.id;
        const { assignmentId } = req.body; // We need the unique ID of the assignment

        if (!assignmentId) {
            return res.status(400).json({ message: "Missing assignmentId" });
        }

        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const sectionsCollection = db.collection('sections');
            const result = await sectionsCollection.updateOne(
                { _id: sectionId },
                { $pull: { assignments: { _id: new ObjectId(assignmentId) } } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Section with ID ${sectionId} not found.` });
            }
            if (result.modifiedCount === 0) {
                return res.status(404).json({ message: `Assignment with ID ${assignmentId} not found in this section.` });
            }
            
            res.status(204).send(); // Success, no content

        } catch (err) {
            console.error("Error unassigning from section:", err);
            res.status(500).json({ message: "Error deleting assignment from database" });
        }
    });


    // ================== TIMETABLE GENERATION ==================
    
    // POST /api/timetable/generate
    app.post('/api/timetable/generate', async (req, res) => {
        console.log("Received request for POST /api/timetable/generate");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            // Call the generator function (passing in the db connection)
            const generatedData = await generateAndSaveTimetable(db);
            
            // Send the newly generated data back to the frontend
            res.status(201).json({ message: "Timetable generated successfully!", data: generatedData });

        } catch (err) {
            console.error("Error in /api/timetable/generate route:", err);
            res.status(500).json({ message: `Failed to generate timetable: ${err.message}` });
        }
    });

    // GET /api/timetable
    app.get('/api/timetable', async (req, res) => {
        console.log("Received request for GET /api/timetable");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });

            const timetablesCollection = db.collection('timetables');
            const mainTimetable = await timetablesCollection.findOne({ _id: 'main' });

            if (!mainTimetable) {
                return res.status(404).json({ message: "No timetable found. Please generate one first." });
            }

            res.status(200).json(mainTimetable);

        } catch (err) {
            console.error("Error in /api/timetable route:", err);
            res.status(500).json({ message: `Failed to fetch timetable: ${err.message}` });
        }
    });
    
    // ================== FILTERED TIMETABLE ROUTES ==================

    // GET /api/timetable/section/:sectionId
    app.get('/api/timetable/section/:sectionId', async (req, res) => {
        const { sectionId } = req.params;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const mainTimetable = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainTimetable) return res.status(404).json({ message: "No timetable found." });

            const filteredData = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            for (const day of days) {
                filteredData[day] = {};
                if (mainTimetable.data[day]) {
                    for (const time in mainTimetable.data[day]) {
                        const slot = mainTimetable.data[day][time];
                        if (slot.section === sectionId) {
                            filteredData[day][time] = slot;
                        }
                    }
                }
            }
            res.status(200).json({ data: filteredData, generatedAt: mainTimetable.generatedAt });
        } catch (err) {
            res.status(500).json({ message: `Failed to fetch section timetable: ${err.message}` });
        }
    });

    // GET /api/timetable/faculty/:facultyId
    app.get('/api/timetable/faculty/:facultyId', async (req, res) => {
        const { facultyId } = req.params;
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const mainTimetable = await db.collection('timetables').findOne({ _id: 'main' });
            if (!mainTimetable) return res.status(404).json({ message: "No timetable found." });

            const filteredData = {};
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            
            for (const day of days) {
                filteredData[day] = {};
                if (mainTimetable.data[day]) {
                    for (const time in mainTimetable.data[day]) {
                        const slot = mainTimetable.data[day][time];
                        if (slot.facultyId === facultyId) {
                            filteredData[day][time] = slot;
                        }
                    }
                }
            }
            res.status(200).json({ data: filteredData, generatedAt: mainTimetable.generatedAt });
        } catch (err) {
            res.status(500).json({ message: `Failed to fetch faculty timetable: ${err.message}` });
        }
    });

    // ================== ADMIN USER CREATION ==================

    // POST /api/users/create-faculty-login
    app.post('/api/users/create-faculty-login', async (req, res) => {
        console.log("Received request for POST /api/users/create-faculty-login");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const { email, password, facultyId } = req.body;
            if (!email || !password || !facultyId) {
                return res.status(400).json({ message: "Missing required fields (email, password, facultyId)" });
            }

            const usersCollection = db.collection('users');
            const facultyCollection = db.collection('faculty');

            const existingUser = await usersCollection.findOne({ _id: email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use." });
            }

            const faculty = await facultyCollection.findOne({ _id: facultyId });
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
            
            const result = await usersCollection.insertOne(newUser);
            if (result.insertedId) {
                res.status(201).json({ message: `Login for ${faculty.name} created successfully!` });
            } else {
                res.status(500).json({ message: "Failed to create user" });
            }
        } catch (err) {
            console.error("Error creating faculty login:", err);
            res.status(500).json({ message: "Error saving user to database" });
        }
    });

    // ================== [NEW] TIMETABLE MODIFICATION ROUTES ==================

    // POST /api/timetable/update-slot
    app.post('/api/timetable/update-slot', async (req, res) => {
        console.log("Received request for POST /api/timetable/update-slot");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            const { day, time, courseId, facultyId, roomId, sectionId, batch } = req.body;

            if (!day || !time || !courseId || !facultyId || !roomId || !sectionId || !batch) {
                return res.status(400).json({ message: "Missing required fields for slot update." });
            }

            const course = await db.collection('courses').findOne({ _id: courseId });
            const faculty = await db.collection('faculty').findOne({ _id: facultyId });

            if (!course) return res.status(404).json({ message: "Course not found." });
            if (!faculty) return res.status(404).json({ message: "Faculty not found." });

            const newSlotData = {
                course: course.course_name,
                faculty: faculty.name,
                room: roomId,
                section: sectionId,
                facultyId: facultyId,
                batch: batch,
                duration: parseInt(course.duration) || 1,
                conflict: false 
            };

            const timetablesCollection = db.collection('timetables');
            // IMPORTANT: We update the specific slot using dot notation
            const updateKey = `data.${day}.${time}`;

            const result = await timetablesCollection.updateOne(
                { _id: 'main' },
                { $set: { [updateKey]: newSlotData } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Main timetable document not found. Generate one first." });
            }

            res.status(200).json({ message: "Timetable slot updated successfully!", updatedSlot: newSlotData });

        } catch (err) {
            console.error("Error updating timetable slot:", err);
            res.status(500).json({ message: "Error saving data to database" });
        }
    });

    // POST /api/timetable/delete-slot
    app.post('/api/timetable/delete-slot', async (req, res) => {
        console.log("Received request for POST /api/timetable/delete-slot");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });

            const { day, time } = req.body;
            if (!day || !time) {
                return res.status(400).json({ message: "Missing 'day' or 'time' for slot deletion." });
            }

            const timetablesCollection = db.collection('timetables');
            const updateKey = `data.${day}.${time}`;

            const result = await timetablesCollection.updateOne(
                { _id: 'main' },
                { $unset: { [updateKey]: "" } }
            );

            if (result.matchedCount === 0) {
                return res.status(404).json({ message: "Main timetable document not found." });
            }

            res.status(200).json({ message: "Timetable slot deleted successfully!" });

        } catch (err) {
            console.error("Error deleting timetable slot:", err);
            res.status(500).json({ message: "Error updating database" });
        }
    });


    // --- Start Server ---
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
});

process.on('SIGINT', async () => {
    console.log('Closing MongoDB connection...');
    if (client) {
       await client.close();
       console.log('MongoDB connection closed.');
    }
    process.exit(0);
});