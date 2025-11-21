const { ObjectId } = require("mongodb");

// ============================================================================
// 1. CONFIGURATION & CONSTANTS
// ============================================================================
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Time Slots
const FULL_DAY_SLOTS = [
    { start: "08:30", end: "09:30", type: "Lecture" },
    { start: "09:30", end: "10:30", type: "Lecture" },
    // 10:30 - 10:45 Tea Break (Implicit)
    { start: "10:45", end: "11:45", type: "Lecture" },
    { start: "11:45", end: "12:45", type: "Lecture" },
    // 12:45 - 13:30 Lunch Break (Implicit)
    { start: "13:30", end: "14:30", type: "Lecture" },
    { start: "14:30", end: "15:30", type: "Lecture" },
    { start: "15:30", end: "16:30", type: "Lecture" }
];

const WEDNESDAY_SLOTS = [
    { start: "08:30", end: "09:30", type: "Lecture" },
    { start: "09:30", end: "10:30", type: "Lecture" },
    // Tea Break
    { start: "10:45", end: "11:45", type: "Lecture" },
    { start: "11:45", end: "12:45", type: "Lecture" },
    // Lunch
    { start: "13:30", end: "16:30", type: "Activity", name: "Sports/Cultural/Technical Activities" }
];

const POPULATION_SIZE = 10; 
const MAX_GENERATIONS = 20; 

// ============================================================================
// 2. MAIN GENERATION FUNCTION
// ============================================================================
async function generateAndSaveTimetable(db) {
    console.log("🚀 Starting Timetable Generation...");

    // 1. Fetch Data (CORRECTED COLLECTION NAMES)
    // Using Mongoose default plural names
    const courses = await db.collection('subjects').find({}).toArray();
    const faculty = await db.collection('users').find({ role: 'faculty' }).toArray();
    const rooms = await db.collection('rooms').find({}).toArray();
    const sections = await db.collection('batches').find({}).toArray();

    console.log(`📊 Data Loaded: ${courses.length} Courses, ${faculty.length} Faculty, ${sections.length} Batches.`);

    if (!courses.length || !faculty.length || !sections.length) {
        throw new Error("Missing Data: Please run 'node seed.js' to populate the database first.");
    }

    // 2. Build the Gene Pool
    let genePool = [];
    
    for (const section of sections) {
        // Filter courses for this section's semester and department
        const relevantCourses = courses.filter(c => 
            (c.department === section.department) && 
            (c.semester === section.semester)
        );

        for (const course of relevantCourses) {
            // Assign Faculty
            const deptFaculty = faculty.filter(f => f.department === course.department);
            const assignedFaculty = deptFaculty.length > 0 
                ? deptFaculty[Math.floor(Math.random() * deptFaculty.length)] 
                : faculty[0];

            if (!assignedFaculty) continue;

            // Find Substitutes
            const substitutes = deptFaculty
                .filter(f => f._id.toString() !== assignedFaculty._id.toString())
                .map(f => ({ name: f.name, _id: f._id }));

            const isLab = course.type && course.type.toLowerCase() === 'lab';
            const hoursNeeded = parseInt(course.weeklyHours) || 3;

            // Create Schedule Blocks
            for (let i = 0; i < hoursNeeded; i++) {
                genePool.push({
                    sectionId: section.name, // Using Name as ID
                    courseCode: course.subjectCode,
                    courseName: course.name,
                    facultyId: assignedFaculty._id,
                    facultyName: assignedFaculty.name,
                    substitutes: substitutes,
                    type: isLab ? "Lab" : "Theory",
                    duration: isLab ? 2 : 1,
                    roomCandidate: null
                });
                if (isLab) i++; // Skip next hour for lab
            }
        }
    }

    if (genePool.length === 0) {
        throw new Error("No classes to schedule! Check if Courses map to Batch Semesters correctly.");
    }

    // 3. Run Genetic Algorithm
    const bestSchedule = runGeneticAlgorithm(genePool, rooms);

    // 4. Format and Save
    const finalTimetable = formatForStorage(bestSchedule, sections);
    
    await db.collection('timetables').updateOne(
        { _id: 'main' },
        { $set: { data: finalTimetable, generatedAt: new Date() } },
        { upsert: true }
    );

    console.log("✅ Timetable Generated Successfully!");
    return finalTimetable;
}

// ============================================================================
// 3. GENETIC ALGORITHM ENGINE
// ============================================================================

function runGeneticAlgorithm(genePool, rooms) {
    let population = [];

    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(createRandomSchedule(genePool, rooms));
    }

    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        population.sort((a, b) => calculateFitness(b) - calculateFitness(a));

        if (calculateFitness(population[0]) === 0) {
            return population[0];
        }

        const survivors = population.slice(0, POPULATION_SIZE / 2);
        const newGen = [...survivors];
        
        while (newGen.length < POPULATION_SIZE) {
            const parent = survivors[Math.floor(Math.random() * survivors.length)];
            newGen.push(mutateSchedule(parent, rooms));
        }
        population = newGen;
    }
    return population[0];
}

function createRandomSchedule(genes, rooms) {
    return genes.map(gene => {
        const day = DAYS[Math.floor(Math.random() * DAYS.length)];
        const slots = day === "Wednesday" ? WEDNESDAY_SLOTS : FULL_DAY_SLOTS;
        
        const validSlots = slots.filter(s => s.type === "Lecture");
        const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
        const room = rooms.length ? rooms[Math.floor(Math.random() * rooms.length)].name : "101";

        return { ...gene, day, time: slot.start, room };
    });
}

function mutateSchedule(schedule, rooms) {
    const newSchedule = JSON.parse(JSON.stringify(schedule));
    const idx = Math.floor(Math.random() * newSchedule.length);
    const gene = newSchedule[idx];

    const day = DAYS[Math.floor(Math.random() * DAYS.length)];
    const slots = day === "Wednesday" ? WEDNESDAY_SLOTS : FULL_DAY_SLOTS;
    const validSlots = slots.filter(s => s.type === "Lecture");
    const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
    
    gene.day = day;
    gene.time = slot.start;
    gene.room = rooms.length ? rooms[Math.floor(Math.random() * rooms.length)].name : "101";

    return newSchedule;
}

function calculateFitness(schedule) {
    let score = 0;
    for (let i = 0; i < schedule.length; i++) {
        for (let j = i + 1; j < schedule.length; j++) {
            const c1 = schedule[i];
            const c2 = schedule[j];

            if (c1.day === c2.day && c1.time === c2.time) {
                if (c1.facultyId === c2.facultyId) score -= 100;
                if (c1.room === c2.room) score -= 100;
                if (c1.sectionId === c2.sectionId) score -= 100;
            }
        }
    }
    return score;
}

// ============================================================================
// 4. FORMATTING FOR FRONTEND
// ============================================================================
function formatForStorage(schedule, sections) {
    const formatted = {};
    
    DAYS.forEach(day => {
        formatted[day] = {};
        const daySlots = day === "Wednesday" ? WEDNESDAY_SLOTS : FULL_DAY_SLOTS;
        
        daySlots.forEach(slot => {
            formatted[day][slot.start] = [];
            
            if (day === "Wednesday" && slot.type === "Activity") {
                 formatted[day][slot.start].push({
                    course: slot.name,
                    faculty: "All Staff",
                    room: "Campus",
                    section: "ALL",
                    type: "Activity",
                    isUniversal: true
                });
            }
        });
    });

    schedule.forEach(cls => {
        if (formatted[cls.day] && formatted[cls.day][cls.time]) {
            formatted[cls.day][cls.time].push({
                course: cls.courseName,
                faculty: cls.facultyName,
                facultyId: cls.facultyId,
                room: cls.room,
                section: cls.sectionId,
                type: cls.type,
                substitutes: cls.substitutes
            });
        }
    });

    // Fill Gaps with PBL
    DAYS.forEach(day => {
        const daySlots = day === "Wednesday" ? WEDNESDAY_SLOTS : FULL_DAY_SLOTS;
        daySlots.filter(s => s.type === "Lecture").forEach(slot => {
            const time = slot.start;
            const classesNow = formatted[day][time] || [];
            
            sections.forEach(sec => {
                const hasClass = classesNow.find(c => c.section === sec.name);
                if (!hasClass) {
                    if(!formatted[day][time]) formatted[day][time] = [];
                    formatted[day][time].push({
                        course: "PBL / ABL / Library",
                        faculty: "-",
                        room: "Library",
                        section: sec.name,
                        type: "Self-Learning"
                    });
                }
            });
        });
    });

    return formatted;
}

module.exports = { generateAndSaveTimetable };