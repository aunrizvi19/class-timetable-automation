const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Subject = require("./models/Subject");
const User = require("./models/user");
const Room = require("./models/Room");
const Batch = require("./models/Batch");

// Hardcode URI if dotenv fails, or ensure process.env.MONGO_URI is set
const uri = "mongodb+srv://mohammadaunrizvi19_db_user:305YJ8h9IsNVu9Ad@cluster0.khbsgco.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

async function seed() {
  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB via Mongoose");

    // -----------------------------------------
    // 1. SEED SUBJECTS
    // -----------------------------------------
    const subjects = [
      // 🧮 YEAR 1 - SEM 1
      { subjectCode: "23MAT11A", name: "Calculus, Differential Equations & Linear Algebra", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23PHI12A", name: "Physics of Applied Science", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23EET13A", name: "Fundamentals of Electrical Engineering", department: "CSE", year: 1, semester: 1, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23MET14A", name: "Essentials of Mechanical Engineering", department: "CSE", year: 1, semester: 1, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CPI15A", name: "Problem Solving Using C", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 4, type: "theory" },

      // 🧮 YEAR 1 - SEM 2
      { subjectCode: "23MAT21B", name: "Multivariable Calculus & Vector Analysis", department: "CSE", year: 1, semester: 2, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23PHI22B", name: "Physics Laboratory", department: "CSE", year: 1, semester: 2, credits: 2, weeklyHours: 2, type: "lab" },
      { subjectCode: "23EET23B", name: "Electrical Engineering Laboratory", department: "CSE", year: 1, semester: 2, credits: 2, weeklyHours: 2, type: "lab" },
      { subjectCode: "23CPI25B", name: "Problem Solving Using C++", department: "CSE", year: 1, semester: 2, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23ENG26B", name: "Technical English", department: "CSE", year: 1, semester: 2, credits: 2, weeklyHours: 2, type: "theory" },

      // 🧮 YEAR 2 - SEM 3
      { subjectCode: "23CDI301", name: "Discrete Mathematics and Graph Theory", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDT302", name: "Data Structures and its Applications", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDI303", name: "Digital Design & Computer Organization", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDI304", name: "Operating Systems", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDL305", name: "Data Structures Lab", department: "CSE", year: 2, semester: 3, credits: 2, weeklyHours: 2, type: "lab" },

      // 🧮 YEAR 2 - SEM 4
      { subjectCode: "23CDT311", name: "Object Oriented Programming with Java", department: "CSE", year: 2, semester: 4, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDE312", name: "Python Programming for Data Science", department: "CSE", year: 2, semester: 4, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDE313", name: "Data Analytics with R", department: "CSE", year: 2, semester: 4, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDE314", name: "Introduction to Cyber Security", department: "CSE", year: 2, semester: 4, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDL315", name: "Java & Python Lab", department: "CSE", year: 2, semester: 4, credits: 2, weeklyHours: 2, type: "lab" },

      // 🧮 YEAR 3 - SEM 5
      { subjectCode: "23CDT401", name: "Probability Distributions & Statistical Methods", department: "CSE", year: 3, semester: 5, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDT402", name: "Analysis & Design of Algorithms", department: "CSE", year: 3, semester: 5, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDI403", name: "Data Science for Engineers", department: "CSE", year: 3, semester: 5, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDI404", name: "Database Management Systems", department: "CSE", year: 3, semester: 5, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDL405", name: "Algorithms Lab", department: "CSE", year: 3, semester: 5, credits: 2, weeklyHours: 2, type: "lab" },

      // 🧮 YEAR 3 - SEM 6
      { subjectCode: "23CDT411", name: "Software Engineering", department: "CSE", year: 3, semester: 6, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDT412", name: "Artificial Intelligence", department: "CSE", year: 3, semester: 6, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDI413", name: "Machine Learning", department: "CSE", year: 3, semester: 6, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDL415", name: "ML & AI Lab", department: "CSE", year: 3, semester: 6, credits: 2, weeklyHours: 2, type: "lab" },

      // 🧮 YEAR 4 - SEM 7
      { subjectCode: "23CDE404", name: "Cloud Computing", department: "CSE", year: 4, semester: 7, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDE422", name: "Edge Computing", department: "CSE", year: 4, semester: 7, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDE423", name: "Predictive Analysis", department: "CSE", year: 4, semester: 7, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDE424", name: "Internet of Things", department: "CSE", year: 4, semester: 7, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDL425", name: "IoT & Edge Lab", department: "CSE", year: 4, semester: 7, credits: 2, weeklyHours: 2, type: "lab" },

      // 🧮 YEAR 4 - SEM 8
      { subjectCode: "23CDT431", name: "Big Data Analytics", department: "CSE", year: 4, semester: 8, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CDT432", name: "Blockchain Technologies", department: "CSE", year: 4, semester: 8, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDI433", name: "Cyber Physical Systems", department: "CSE", year: 4, semester: 8, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDL435", name: "Big Data & Blockchain Lab", department: "CSE", year: 4, semester: 8, credits: 2, weeklyHours: 2, type: "lab" },
    ];

    // Clear existing and insert
    await Subject.deleteMany({});
    await Subject.insertMany(subjects);
    console.log(`✅ ${subjects.length} subjects added`);


    // -----------------------------------------
    // 2. SEED FACULTY & ADMIN
    // -----------------------------------------
    const faculty = [
      { name: "Dr. Krishna A. N", email: "krishna.an@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Naveena C", email: "naveena.c@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Bindiya M. K", email: "bindiya.mk@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Ajay B. N", email: "ajay.bn@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Prasad A. Y", email: "prasad.ay@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Shantha Kumar H. C", email: "shantha.kumar@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Veena H. N", email: "veena.hn@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Roopa M. J", email: "roopa.mj@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Prakruthi M. K", email: "prakruthi.mk@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Dr. Arun Kumar D. R", email: "arun.kumar.dr@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mr. Dhananjaya M", email: "dhananjaya.m@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Shubha T. V", email: "shubha.tv@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mr. Lochan Gowda M", email: "lochan.gowda@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Srinidhi K. S", email: "srinidhi.ks@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Anusha M", email: "anusha.m@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Rajeshwari G. L", email: "rajeshwari.gl@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Laxmi Shabadi", email: "laxmi.shabadi@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Jyothi P. K", email: "jyothi.pk@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Kavya G", email: "kavya.g@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Vijayalakshmi B", email: "vijayalakshmi.b@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Rajani", email: "rajani@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Chetana K. N", email: "chetana.kn@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Shilpashree S", email: "shilpashree.s@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Vinutha K", email: "vinutha.k@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mr. Pradeep R", email: "pradeep.r@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Megha S", email: "megha.s@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mr. Rakesh T", email: "rakesh.t@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mrs. Sneha K", email: "sneha.k@sjbit.edu.in", role: "faculty", department: "CSE" },
      { name: "Mr. Manjunath V", email: "manjunath.v@sjbit.edu.in", role: "faculty", department: "CSE" }
    ];

    // Clear existing users (optional, for clean slate)
    await User.deleteMany({});

    const hash = await bcrypt.hash("password123", 10);

    // Insert Faculty
    for (const f of faculty) {
        await User.create({
            _id: f.email, // Explicitly setting _id as email to match legacy logic
            name: f.name,
            email: f.email,
            passwordHash: hash,
            role: f.role,
            department: f.department,
            verified: true
        });
    }

    // Insert Admin
    await User.create({
        _id: "admin@sjbit.edu.in",
        name: "System Admin",
        email: "admin@sjbit.edu.in",
        passwordHash: hash,
        role: "admin",
        verified: true
    });

    console.log(`✅ ${faculty.length + 1} users added`);


    // -----------------------------------------
    // 3. SEED ROOMS
    // -----------------------------------------
    const rooms = [
      { name: "CSE Room 101", capacity: 60, floor: 1, type: "Theory" },
      { name: "CSE Room 102", capacity: 60, floor: 1, type: "Theory" },
      { name: "CSE Room 103", capacity: 40, floor: 1, type: "Theory" },
      { name: "CSE Lab 104", capacity: 30, floor: 1, type: "Lab" },
      { name: "CSE Room 201", capacity: 60, floor: 2, type: "Theory" },
      { name: "CSE Room 202", capacity: 60, floor: 2, type: "Theory" },
      { name: "CSE Room 203", capacity: 40, floor: 2, type: "Theory" },
      { name: "CSE Lab 204", capacity: 30, floor: 2, type: "Lab" },
      { name: "CSE Room 301", capacity: 60, floor: 3, type: "Theory" },
      { name: "CSE Room 302", capacity: 60, floor: 3, type: "Theory" },
      { name: "CSE Lab 303", capacity: 30, floor: 3, type: "Lab" },
      { name: "CSE Lab 304", capacity: 30, floor: 3, type: "Lab" },
      { name: "Faculty Room 310", capacity: 15, floor: 3, type: "Staff Room" },
      { name: "Project Lab 305", capacity: 25, floor: 3, type: "Lab" }
    ];

    // Clear and Insert Rooms
    await Room.deleteMany({});
    // We explicitly set _id to name for compatibility with the scheduling logic
    await Room.insertMany(rooms.map(r => ({ ...r, _id: r.name })));
    console.log(`✅ ${rooms.length} rooms added`);


    // -----------------------------------------
    // 4. SEED BATCHES
    // -----------------------------------------
    const batches = [
      { name: "CSE-2A", department: "CSE", year: 2, semester: 3, size: 40 },
      { name: "CSE-2B", department: "CSE", year: 2, semester: 3, size: 38 },
      { name: "CSE-2C", department: "CSE", year: 2, semester: 3, size: 39 },
      { name: "CSE-3A", department: "CSE", year: 3, semester: 5, size: 42 },
      { name: "CSE-3B", department: "CSE", year: 3, semester: 5, size: 41 },
      { name: "CSE-3C", department: "CSE", year: 3, semester: 5, size: 40 },
      { name: "CSE-4A", department: "CSE", year: 4, semester: 7, size: 45 },
      { name: "CSE-4B", department: "CSE", year: 4, semester: 7, size: 44 },
      { name: "CSE-4C", department: "CSE", year: 4, semester: 7, size: 43 }
    ];

    await Batch.deleteMany({});
    await Batch.insertMany(batches.map(b => ({ ...b, _id: b.name })));
    console.log(`✅ ${batches.length} batches added`);

    console.log("🌱 Seeding completed successfully!");
    process.exit(0);

  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

seed();