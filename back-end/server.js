const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb'); // Import MongoClient
const cors = require('cors'); // <-- Import cors
const bcrypt = require('bcrypt'); // <-- Import bcrypt for password hashing

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // <-- Enable CORS for all origins
app.use(express.json()); // <-- Parse JSON request bodies

// --- MongoDB Connection ---
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db; // Variable to hold the database connection

async function connectDB() {
  try {
    // Connect the client to the server
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Specify the database you want to use
    db = client.db("timetableDB");
    console.log("Connected to database:", db.databaseName);

  } catch (err) {
      console.error("Failed to connect to MongoDB", err);
      process.exit(1); // Exit the process if connection fails
  }
}

// Connect to the database when the server starts
connectDB().then(() => {
    // --- API Routes ---

    // ================== AUTHENTICATION ==================
    // POST Route to SIGNUP a new user
    app.post('/api/signup', async (req, res) => {
        console.log("Received request for POST /api/signup");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const { name, email, password } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ message: "Missing required fields (name, email, password)" });
            }

            const usersCollection = db.collection('users');

            // Check if user already exists
            const existingUser = await usersCollection.findOne({ email: email });
            if (existingUser) {
                return res.status(409).json({ message: "Email already in use." });
            }

            // Hash the password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Insert new user
            const newUser = {
                name: name,
                email: email,
                password: hashedPassword, // Store the hashed password
                _id: email // Use email as unique ID
            };
            
            const result = await usersCollection.insertOne(newUser);
            console.log("Insert result:", result);

            if (result.insertedId) {
                // Don't send the password back to the client
                res.status(201).json({ message: "User created successfully!", user: { name: name, email: email } });
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

            // Find the user by email
            const user = await usersCollection.findOne({ _id: email });
            if (!user) {
                return res.status(404).json({ message: "Invalid email or password." });
            }

            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: "Invalid email or password." });
            }
            
            // Successful login
            // In a real app, you'd create a JWT here. For now, just send success.
            console.log(`User ${user.email} logged in successfully`);
            res.status(200).json({ 
                message: "Login successful!", 
                user: { name: user.name, email: user.email } 
            });

        } catch (err) {
            console.error("Error logging in user:", err);
            res.status(500).json({ message: "Error logging in" });
        }
    });

    // ================== COURSES ==================
    // GET Route to fetch all courses
    app.get('/api/courses', async (req, res) => {
      console.log("Received request for GET /api/courses");
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const coursesCollection = db.collection('courses');
        const courses = await coursesCollection.find({}).toArray();
        res.json(courses);
        console.log("Sent courses data:", courses.length > 0 ? courses.length + " courses" : "empty array");
      } catch (err) {
        console.error("Error fetching courses:", err);
        res.status(500).json({ message: "Error fetching data from database" });
      }
    });

    // POST Route to ADD a new course
    app.post('/api/courses', async (req, res) => {
        console.log("Received request for POST /api/courses");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newCourse = req.body;
            console.log("Data received:", newCourse);
            if (!newCourse.course_code || !newCourse.course_name || newCourse.credits == null) {
                return res.status(400).json({ message: "Missing required course fields (course_code, course_name, credits)" });
            }
            newCourse._id = newCourse.course_code;
            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.insertOne(newCourse);
            console.log("Insert result:", result);
            if (result.insertedId) {
                res.status(201).json(newCourse);
            } else {
                res.status(500).json({ message: "Failed to insert course" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 console.error("Error inserting course: Duplicate key", err.keyValue);
                 res.status(409).json({ message: `Course with code ${req.body.course_code} already exists.` });
            } else {
                console.error("Error inserting course:", err);
                res.status(500).json({ message: "Error saving data to database" });
            }
        }
    });

    // PUT Route to UPDATE an existing course by course_code
    app.put('/api/courses/:code', async (req, res) => {
        const courseCode = req.params.code;
        const updatedData = req.body;
        console.log(`Received request for PUT /api/courses/${courseCode}`, updatedData);
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            if (!updatedData.course_name || updatedData.credits == null) {
                return res.status(400).json({ message: "Missing required fields for update (course_name, credits)" });
            }
            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.updateOne(
                { _id: courseCode },
                { $set: { course_name: updatedData.course_name, credits: parseInt(updatedData.credits) } }
            );
            console.log("Update result:", result);
            if (result.matchedCount === 0) {
                return res.status(404).json({ message: `Course with code ${courseCode} not found.` });
            }
            res.json({ message: "Course updated successfully", code: courseCode });
        } catch (err) {
            console.error("Error updating course:", err);
            res.status(500).json({ message: "Error updating data in database" });
        }
    });

    // DELETE Route to REMOVE a course by course_code
    app.delete('/api/courses/:code', async (req, res) => {
        const courseCode = req.params.code;
        console.log(`Received request for DELETE /api/courses/${courseCode}`);
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const coursesCollection = db.collection('courses');
            const result = await coursesCollection.deleteOne({ _id: courseCode });
            console.log("Delete result:", result);
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Course with code ${courseCode} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting course:", err);
            res.status(500).json({ message: "Error deleting data from database" });
        }
    });
    // ================== END COURSES ==================


    // ================== FACULTY ==================
    app.get('/api/faculty', async (req, res) => {
      console.log("Received request for GET /api/faculty");
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const facultyCollection = db.collection('faculty'); // Use 'faculty' collection
        const facultyMembers = await facultyCollection.find({}).toArray();
        res.json(facultyMembers);
        console.log("Sent faculty data:", facultyMembers.length > 0 ? facultyMembers.length + " faculty" : "empty array");
      } catch (err) {
        console.error("Error fetching faculty:", err);
        res.status(500).json({ message: "Error fetching faculty data from database" });
      }
    });

    app.post('/api/faculty', async (req, res) => {
        console.log("Received request for POST /api/faculty");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newFaculty = req.body;
            console.log("Data received:", newFaculty);

            // --- UPDATED VALIDATION ---
            if (!newFaculty.faculty_id || !newFaculty.name || !newFaculty.department || !newFaculty.designation) {
                return res.status(400).json({ message: "Missing required fields (faculty_id, name, department, designation)" });
            }
            // Use faculty_id as the unique _id
            newFaculty._id = newFaculty.faculty_id;

            const facultyCollection = db.collection('faculty');
            const result = await facultyCollection.insertOne(newFaculty);
            console.log("Insert result:", result);

            if (result.insertedId) {
                res.status(201).json(newFaculty);
            } else {
                res.status(500).json({ message: "Failed to insert faculty member" });
            }
        } catch (err) {
            if (err.code === 11000) { // Duplicate key
                 console.error("Error inserting faculty: Duplicate key", err.keyValue);
                 res.status(409).json({ message: `Faculty with ID ${req.body.faculty_id} already exists.` });
            } else {
                console.error("Error inserting faculty:", err);
                res.status(500).json({ message: "Error saving faculty data to database" });
            }
        }
    });

    app.put('/api/faculty/:id', async (req, res) => {
        const facultyId = req.params.id; // Get ID from URL parameter
        const updatedData = req.body;
        console.log(`Received request for PUT /api/faculty/${facultyId}`, updatedData);
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            
            // --- UPDATED VALIDATION ---
            if (!updatedData.name || !updatedData.department || !updatedData.designation) {
                return res.status(400).json({ message: "Missing required fields for update (name, department, designation)" });
            }
            
            const facultyCollection = db.collection('faculty');
            
            // --- UPDATED $set ---
            const result = await facultyCollection.updateOne(
                { _id: facultyId }, // Filter by _id (which is faculty_id)
                { $set: { 
                    name: updatedData.name, 
                    department: updatedData.department,
                    designation: updatedData.designation // Add designation to the update
                } }
            );
            
            console.log("Update result:", result);
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
        const facultyId = req.params.id; // Get ID from URL parameter
        console.log(`Received request for DELETE /api/faculty/${facultyId}`);
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const facultyCollection = db.collection('faculty');
            const result = await facultyCollection.deleteOne({ _id: facultyId }); // Delete by _id
            console.log("Delete result:", result);
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Faculty with ID ${facultyId} not found.` });
            }
            res.status(204).send(); // Success, no content
        } catch (err) {
            console.error("Error deleting faculty:", err);
            res.status(500).json({ message: "Error deleting faculty data from database" });
        }
    });
    // ================== END FACULTY ==================


    // ================== ROOMS ==================
    app.get('/api/rooms', async (req, res) => {
      console.log("Received request for GET /api/rooms");
      try {
        if (!db) return res.status(500).json({ message: "Database not connected" });
        const roomsCollection = db.collection('rooms');
        const rooms = await roomsCollection.find({}).toArray();
        res.json(rooms);
        console.log("Sent rooms data:", rooms.length > 0 ? rooms.length + " rooms" : "empty array");
      } catch (err) {
        console.error("Error fetching rooms:", err);
        res.status(500).json({ message: "Error fetching room data from database" });
      }
    });

    app.post('/api/rooms', async (req, res) => {
        console.log("Received request for POST /api/rooms");
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const newRoom = req.body;
            console.log("Data received:", newRoom);

            if (!newRoom.room_number || newRoom.capacity == null || !newRoom.type) {
                return res.status(400).json({ message: "Missing required fields (room_number, capacity, type)" });
            }
            // Use room_number as the unique _id
            newRoom._id = newRoom.room_number;
            // Ensure capacity is a number
            newRoom.capacity = parseInt(newRoom.capacity);

            const roomsCollection = db.collection('rooms');
            const result = await roomsCollection.insertOne(newRoom);
            console.log("Insert result:", result);

            if (result.insertedId) {
                res.status(201).json(newRoom);
            } else {
                res.status(500).json({ message: "Failed to insert room" });
            }
        } catch (err) {
            if (err.code === 11000) {
                 console.error("Error inserting room: Duplicate key", err.keyValue);
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
        console.log(`Received request for PUT /api/rooms/${roomNumber}`, updatedData);
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
            console.log("Update result:", result);
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
        console.log(`Received request for DELETE /api/rooms/${roomNumber}`);
        try {
            if (!db) return res.status(500).json({ message: "Database not connected" });
            const roomsCollection = db.collection('rooms');
            const result = await roomsCollection.deleteOne({ _id: roomNumber });
            console.log("Delete result:", result);
            if (result.deletedCount === 0) {
                return res.status(404).json({ message: `Room with number ${roomNumber} not found.` });
            }
            res.status(204).send();
        } catch (err) {
            console.error("Error deleting room:", err);
            res.status(500).json({ message: "Error deleting data from database" });
        }
    });
    // ================== END ROOMS ==================


    // --- Start Server ---
    app.listen(port, () => {
      console.log(`Server listening at http://localhost:${port}`);
    });
});

// Graceful shutdown: Close MongoDB connection when Node.js process exits
process.on('SIGINT', async () => {
    console.log('Closing MongoDB connection...');
    if (client) { // Check if client exists before trying to close
       await client.close();
       console.log('MongoDB connection closed.');
    }
    process.exit(0);
});