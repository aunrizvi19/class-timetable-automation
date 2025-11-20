const { ObjectId } = require("mongodb");

// ============================================================================
// 1. CONFIGURATION & TIMINGS
// ============================================================================
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// All scheduleable slots
const ALL_SLOTS = [
    "08:30", "09:30", 
    "10:30",          // Tea Break (15 mins)
    "10:45", "11:45", 
    "12:45",          // Lunch Break (45 mins)
    "13:30", "14:30", "15:30"
];

// Slots that are strictly breaks (No class can START or EXIST here normally)
const BREAKS = ["10:30", "12:45"];

// Valid start times for a 2-hour Lab to ensure it fits in one block
// 08:30 -> Ends 10:30 (Tea)
// 10:45 -> Ends 12:45 (Lunch)
// 13:30 -> Ends 15:30
const LAB_START_TIMES = ["08:30", "10:45", "13:30"];

// Slots considered "Afternoon" (For Wednesday Half-Day Logic)
// Any class starting AT or AFTER these times is forbidden on Wednesday
const AFTERNOON_SLOTS = ["13:30", "14:30", "15:30"];

// Genetic Algorithm Parameters
const POP_SIZE = 60;
const GENERATIONS = 150;
const MUTATION_RATE = 0.1;

// ============================================================================
// 2. PREPARE INPUTS (Adapted for Seed Data Schema)
// ============================================================================
async function generateAndSaveTimetable(db) {
    console.log("== GENERATING TIMETABLE (v4 - Seed Integration) ==");

    // 1. Fetch Data from NEW collections defined in seed.js
    const allSubjects = await db.collection("subjects").find({}).toArray();
    const allFaculty = await db.collection("users").find({ role: "faculty" }).toArray();
    const allRooms = await db.collection("rooms").find({}).toArray();
    const allBatches = await db.collection("batches").find({}).toArray(); // Was 'sections'

    const inputs = [];
    let facultyIndex = 0; // For simple round-robin assignment if explicit assignment is missing

    // 2. Auto-Assign Subjects to Batches
    // Since seed.js doesn't have an 'assignments' array in batches, we generate them logicially
    for (const batch of allBatches) {
        // Find subjects that match the batch's semester and department
        const semSubjects = allSubjects.filter(s => 
            s.semester === batch.semester && 
            (s.department === batch.department || s.department === "Common")
        );

        for (const sub of semSubjects) {
            // A. Find a Teacher
            // Try to find faculty in the same department
            const deptFaculty = allFaculty.filter(f => f.department === batch.department);
            // Fallback to any faculty if none found in dept
            const pool = deptFaculty.length > 0 ? deptFaculty : allFaculty;
            
            // Assign teacher (Round-robin to distribute load)
            const assignedFaculty = pool[facultyIndex % pool.length];
            facultyIndex++;

            // B. Calculate Sessions needed
            const isLab = sub.type.toLowerCase().includes("lab");
            const sessionDuration = isLab ? 2 : 1; // Labs are 2 hours, Theory is 1 hour
            
            // How many sessions per week? 
            // e.g., 4 hours theory = 4 sessions. 2 hours lab = 1 session (of 2 hrs).
            const sessionsPerWeek = isLab ? Math.ceil(sub.weeklyHours / 2) : sub.weeklyHours;

            // C. Filter Rooms based on type
            const compatibleRooms = allRooms.filter(r => {
                if (isLab) return r.type.toLowerCase().includes("lab");
                return r.type.toLowerCase().includes("theory") || r.type.toLowerCase().includes("lecture");
            });
            const roomPool = compatibleRooms.length > 0 ? compatibleRooms : allRooms;

            // D. Create Input Slots for Scheduler
            for (let i = 0; i < sessionsPerWeek; i++) {
                inputs.push({
                    id: `${batch._id}-${sub.subjectCode}-${i}`,
                    course: sub.name,
                    courseType: isLab ? "Lab" : "Theory",
                    faculty: assignedFaculty.name,
                    facultyId: assignedFaculty._id, 
                    section: batch._id, // e.g., "CSE-3A"
                    batch: isLab ? batch.name : null, // Theory is whole class
                    roomType: isLab ? "Lab" : "Theory",
                    availableRooms: roomPool.map(r => r._id), 
                    duration: sessionDuration
                });
            }
        }
    }

    console.log(`Generated ${inputs.length} slots from Seed Data.`);
    if (inputs.length === 0) return {};

    const timetable = runGeneticAlgorithm(inputs);
    const formatted = formatTimetableForSave(timetable, inputs);

    // Save to DB
    await db.collection("timetables").updateOne(
        { _id: "main" },
        { $set: { data: formatted, generatedAt: new Date() } },
        { upsert: true }
    );

    console.log("== TIMETABLE SAVED ==");
    return formatted;
}

// ============================================================================
// 3. GENETIC ALGORITHM ENGINE
// ============================================================================
function runGeneticAlgorithm(inputs) {
    let population = [];
    for (let i = 0; i < POP_SIZE; i++) {
        population.push(createChromosome(inputs));
    }

    let bestChromosome = null;
    let bestFitness = -Infinity;

    for (let g = 0; g < GENERATIONS; g++) {
        // Evaluate Fitness
        const evaluatedPop = population.map(ch => ({
            genes: ch,
            fitness: calculateFitness(ch)
        })).sort((a, b) => b.fitness - a.fitness);

        // Track Best
        if (evaluatedPop[0].fitness > bestFitness) {
            bestFitness = evaluatedPop[0].fitness;
            bestChromosome = evaluatedPop[0].genes;
        }
        
        // Stop if perfect
        if (bestFitness === 0) break;

        // Create Next Generation
        const nextGen = [evaluatedPop[0].genes, evaluatedPop[1].genes]; // Elitism
        while (nextGen.length < POP_SIZE) {
            const pA = selectParent(evaluatedPop);
            const pB = selectParent(evaluatedPop);
            let child = crossover(pA, pB);
            
            if (Math.random() < MUTATION_RATE) {
                child = mutate(child, inputs);
            }
            nextGen.push(child);
        }
        population = nextGen;
    }
    return bestChromosome;
}

function createChromosome(inputs) { 
    return inputs.map(i => assignRandomSlot(i)); 
}

function assignRandomSlot(input) {
    const day = DAYS[Math.floor(Math.random() * DAYS.length)];
    // Ensure we pick a valid room if available
    const room = input.availableRooms.length > 0 
        ? input.availableRooms[Math.floor(Math.random() * input.availableRooms.length)] 
        : "Unassigned";
        
    const time = getRandomValidTime(input.duration, day);
    
    return { ...input, day, time, room };
}

function getRandomValidTime(duration, day) {
    let validStarts = [];
    
    // Logic: Labs (2h) have specific slots, Theory (1h) avoids breaks
    if (duration === 2) {
        validStarts = [...LAB_START_TIMES];
    } else {
        validStarts = ALL_SLOTS.filter(t => !BREAKS.includes(t));
    }

    // Logic: Wednesday Half-Day
    if (day === "Wednesday") {
        validStarts = validStarts.filter(t => !AFTERNOON_SLOTS.includes(t));
    }

    // Fallback
    if (validStarts.length === 0) return "08:30";
    return validStarts[Math.floor(Math.random() * validStarts.length)];
}

function selectParent(pop) { 
    // Tournament Selection
    return pop[Math.floor(Math.random() * Math.min(5, pop.length))].genes; 
}

function crossover(pA, pB) { 
    // Uniform Crossover
    return pA.map((g, i) => Math.random() < 0.5 ? g : pB[i]); 
}

function mutate(ch, inputs) { 
    const i = Math.floor(Math.random() * ch.length); 
    ch[i] = assignRandomSlot(inputs[i]); 
    return ch; 
}

// ============================================================================
// 4. FITNESS FUNCTION
// ============================================================================
function calculateFitness(chromosome) {
    let score = 0;
    const HARD = 50000; 
    const SOFT = 10;

    for (let i = 0; i < chromosome.length; i++) {
        for (let j = i + 1; j < chromosome.length; j++) {
            const c1 = chromosome[i];
            const c2 = chromosome[j];
            
            // Optimization: Different days cannot clash
            if (c1.day !== c2.day) continue;
            
            if (isTimeOverlap(c1, c2)) {
                // 1. Teacher Clash
                if (c1.facultyId === c2.facultyId) score -= HARD;
                // 2. Room Clash
                if (c1.room === c2.room && c1.room !== "Unassigned") score -= HARD;
                // 3. Student Batch Clash
                if (c1.section === c2.section) score -= HARD;     
            }
            
            // 4. Distribution Penalty (Same subject twice in one day for a batch)
            if (c1.section === c2.section && c1.course === c2.course) score -= SOFT;
        }
        
        // 5. Wednesday Half-Day Constraint Check
        if (chromosome[i].day === "Wednesday" && AFTERNOON_SLOTS.includes(chromosome[i].time)) {
            score -= HARD;
        }
    }
    return score;
}

function isTimeOverlap(c1, c2) {
    const s1 = getOccupiedSlots(c1.time, c1.duration);
    const s2 = getOccupiedSlots(c2.time, c2.duration);
    return s1.some(s => s2.includes(s));
}

function getOccupiedSlots(start, duration) {
    const idx = ALL_SLOTS.indexOf(start);
    if (idx === -1) return [];
    
    let slots = [];
    let count = 0;
    let i = idx;
    
    while (count < duration && i < ALL_SLOTS.length) {
        // Valid slots are those that are NOT breaks
        if (!BREAKS.includes(ALL_SLOTS[i])) { 
            slots.push(ALL_SLOTS[i]); 
            count++; 
        }
        i++;
    }
    return slots;
}

// ============================================================================
// 5. FORMATTING OUTPUT
// ============================================================================
function formatTimetableForSave(chromosome, inputs) {
    const res = {};
    // Initialize empty grid
    DAYS.forEach(d => { 
        res[d] = {}; 
        ALL_SLOTS.forEach(t => { 
            if (!BREAKS.includes(t)) res[d][t] = []; 
        }); 
    });

    if (!chromosome) return res;

    for (const gene of chromosome) {
        const occupied = getOccupiedSlots(gene.time, gene.duration);
        
        const slotData = {
            _id: new ObjectId(),
            id: gene.id,
            course: gene.course,
            // Look up faculty name from inputs safely
            faculty: inputs.find(i => i.id === gene.id)?.faculty || "Unknown",
            room: gene.room,
            section: gene.section,
            batch: gene.batch,
            duration: gene.duration,
            facultyId: gene.facultyId
        };

        // Add slot data to every time block it occupies
        occupied.forEach(t => {
            if (res[gene.day] && res[gene.day][t]) {
                res[gene.day][t].push(slotData);
            }
        });
    }
    return res;
}

module.exports = { generateAndSaveTimetable };