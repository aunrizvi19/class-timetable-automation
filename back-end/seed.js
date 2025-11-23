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
    // 1. SEED SUBJECTS (Updated for 2023 Scheme)
    // -----------------------------------------
    // NOTE: 'type' must be lowercase ("theory" or "lab") to match Subject Schema
    
    const subjects = [
      // --- YEAR 1: SEMESTER 1 (Physics Cycle) ---
      { subjectCode: "23MAT11A", name: "Mathematics-I", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23PHI12A", name: "Physics for CSE Stream", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23EET13A", name: "Electrical Engineering", department: "CSE", year: 1, semester: 1, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23MET14A", name: "Mechanical Engineering", department: "CSE", year: 1, semester: 1, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CPI15A", name: "C Programming (Integrated)", department: "CSE", year: 1, semester: 1, credits: 4, weeklyHours: 5, type: "theory" },

      // --- YEAR 1: SEMESTER 2 (Chemistry Cycle) ---
      { subjectCode: "23MAT21A", name: "Mathematics-II", department: "CSE", year: 1, semester: 2, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23CHI22A", name: "Chemistry for CSE Stream", department: "CSE", year: 1, semester: 2, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "23ECT23A", name: "Electronics Engineering", department: "CSE", year: 1, semester: 2, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CVT24A", name: "Civil Engineering", department: "CSE", year: 1, semester: 2, credits: 3, weeklyHours: 3, type: "theory" },
      { subjectCode: "23CDI25A", name: "CAED (Integrated)", department: "CSE", year: 1, semester: 2, credits: 4, weeklyHours: 5, type: "theory" },

      // --- YEAR 2: SEMESTER 3 (2023 Scheme) ---
      // IBSC: Discrete Maths
      { subjectCode: "23CSI301", name: "Discrete Mathematics & Graph Theory", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 4, type: "theory" },
      // PCC: Data Structures (Theory)
      { subjectCode: "23CST302", name: "Data Structures & Applications", department: "CSE", year: 2, semester: 3, credits: 3, weeklyHours: 3, type: "theory" },
      // IPCC: Logic Design (Theory + Lab)
      { subjectCode: "23CSI303", name: "Logic Design & Comp. Org", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 5, type: "theory" },
      // IPCC: OS (Theory + Lab)
      { subjectCode: "23CSI304", name: "Operating Systems", department: "CSE", year: 2, semester: 3, credits: 4, weeklyHours: 5, type: "theory" },
      // PCCL: Data Structures Lab
      { subjectCode: "23CSL305", name: "Data Structures Lab", department: "CSE", year: 2, semester: 3, credits: 1, weeklyHours: 2, type: "lab" },
      // ETC: Emerging Tech (Using Computer Graphics as default choice)
      { subjectCode: "23CSE311", name: "Computer Graphics", department: "CSE", year: 2, semester: 3, credits: 3, weeklyHours: 3, type: "theory" },
      // AEC: Git
      { subjectCode: "23CSAE31", name: "Version Controller (Git)", department: "CSE", year: 2, semester: 3, credits: 1, weeklyHours: 2, type: "lab" },

      // --- YEAR 2: SEMESTER 4 (2023 Scheme) ---
      // BSC: Stats
      { subjectCode: "23CST401", name: "Probability & Statistical Methods", department: "CSE", year: 2, semester: 4, credits: 3, weeklyHours: 3, type: "theory" },
      // PCC: DAA
      { subjectCode: "23CST402", name: "Design & Analysis of Algorithms", department: "CSE", year: 2, semester: 4, credits: 4, weeklyHours: 4, type: "theory" },
      // IPCC: Java (Theory + Lab)
      { subjectCode: "23CSI403", name: "OOP with JAVA", department: "CSE", year: 2, semester: 4, credits: 4, weeklyHours: 5, type: "theory" },
      // IPCC: IoT (Theory + Lab)
      { subjectCode: "23CSI404", name: "Microcontroller & IoT", department: "CSE", year: 2, semester: 4, credits: 4, weeklyHours: 5, type: "theory" },
      // PCCL: DAA Lab
      { subjectCode: "23CSL405", name: "Algorithms Lab", department: "CSE", year: 2, semester: 4, credits: 1, weeklyHours: 2, type: "lab" },
      // ETC: Multimedia (Default Choice)
      { subjectCode: "23CSE421", name: "Multimedia Technology", department: "CSE", year: 2, semester: 4, credits: 3, weeklyHours: 3, type: "theory" },

      // --- YEAR 3: SEMESTER 5 (2023 Scheme) ---
      // PCC: CN
      { subjectCode: "23CST501", name: "Computer Networks", department: "CSE", year: 3, semester: 5, credits: 3, weeklyHours: 3, type: "theory" },
      // IPCC: SE & PM (Theory + Lab)
      { subjectCode: "23CSI502", name: "Software Engineering & PM", department: "CSE", year: 3, semester: 5, credits: 4, weeklyHours: 5, type: "theory" },
      // IPCC: DBMS (Theory + Lab)
      { subjectCode: "23CSI503", name: "Database Management Systems", department: "CSE", year: 3, semester: 5, credits: 4, weeklyHours: 5, type: "theory" },
      // PCCL: CN Lab
      { subjectCode: "23CSL504", name: "Computer Networks Lab", department: "CSE", year: 3, semester: 5, credits: 1, weeklyHours: 2, type: "lab" },
      // PEC: Elective 1 (Unix as default)
      { subjectCode: "23CSP511", name: "Unix System Programming", department: "CSE", year: 3, semester: 5, credits: 3, weeklyHours: 3, type: "theory" },
      // ETC: Emerging Tech 3 (DIP as default)
      { subjectCode: "23CSE531", name: "Digital Image Processing", department: "CSE", year: 3, semester: 5, credits: 3, weeklyHours: 3, type: "theory" },

      // --- YEAR 3: SEMESTER 6 (2023 Scheme) ---
      // PCC: AIML
      { subjectCode: "23CST601", name: "AI & Machine Learning", department: "CSE", year: 3, semester: 6, credits: 3, weeklyHours: 3, type: "theory" },
      // IPCC: TOC (Theory + Lab)
      { subjectCode: "23CSI602", name: "Theory of Computation", department: "CSE", year: 3, semester: 6, credits: 4, weeklyHours: 5, type: "theory" },
      // PCCL: AIML Lab
      { subjectCode: "23CSL603", name: "AI & ML Lab", department: "CSE", year: 3, semester: 6, credits: 1, weeklyHours: 2, type: "lab" },
      // PEC: Elective 2 (C# as default)
      { subjectCode: "23CSP621", name: "C# and .NET", department: "CSE", year: 3, semester: 6, credits: 3, weeklyHours: 3, type: "theory" },
      // OEC: Open Elective 1 (Data Structures as default)
      { subjectCode: "23CSO611", name: "Intro to Data Structures", department: "CSE", year: 3, semester: 6, credits: 3, weeklyHours: 3, type: "theory" },
      // ETC: Emerging Tech 4 (Computer Vision as default)
      { subjectCode: "23CSE641", name: "Computer Vision", department: "CSE", year: 3, semester: 6, credits: 3, weeklyHours: 3, type: "theory" },

      // --- YEAR 4: SEMESTER 7 (Legacy/Placeholder Scheme) ---
      { subjectCode: "18CS71", name: "AI & ML (Legacy)", department: "CSE", year: 4, semester: 7, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "18CS72", name: "Big Data Analytics", department: "CSE", year: 4, semester: 7, credits: 4, weeklyHours: 4, type: "theory" },
      { subjectCode: "18CSL76", name: "AI & ML Lab", department: "CSE", year: 4, semester: 7, credits: 2, weeklyHours: 2, type: "lab" },
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

    // Clear existing users
    await User.deleteMany({});

    const hash = await bcrypt.hash("password123", 10);

    // Insert Faculty
    for (const f of faculty) {
        await User.create({
            _id: f.email, // Explicitly setting _id as email
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
    // Note: 'type' in Room schema might be flexible, but usually keeping it 
    // consistent with generator logic (Capitalized 'Lab'/'Lecture') is safer for rooms.
    // Only Subject schema enforced lowercase strictness.
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
    await Room.insertMany(rooms.map(r => ({ ...r, _id: r.name })));
    console.log(`✅ ${rooms.length} rooms added`);


    // -----------------------------------------
    // 4. SEED BATCHES
    // -----------------------------------------
    const batches = [
      { name: "CSE-2A", department: "CSE", year: 2, semester: 3, size: 60 },
      { name: "CSE-2B", department: "CSE", year: 2, semester: 3, size: 60 },
      { name: "CSE-2C", department: "CSE", year: 2, semester: 3, size: 60 },
      { name: "CSE-3A", department: "CSE", year: 3, semester: 5, size: 60 },
      { name: "CSE-3B", department: "CSE", year: 3, semester: 5, size: 60 },
      { name: "CSE-3C", department: "CSE", year: 3, semester: 5, size: 60 },
      { name: "CSE-4A", department: "CSE", year: 4, semester: 7, size: 60 },
      { name: "CSE-4B", department: "CSE", year: 4, semester: 7, size: 60 },
      { name: "CSE-4C", department: "CSE", year: 4, semester: 7, size: 60 }
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