const { ObjectId } = require("mongodb");

// ============================================================================
// 1. CONFIGURATION & TIMINGS
// ============================================================================
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ALL_SLOTS = [
    "08:30", "09:30", 
    "10:30",          // Tea Break
    "10:45", "11:45", 
    "12:45",          // Lunch Break
    "13:30", "14:30", "15:30"
];

const BREAKS = ["10:30", "12:45"];
const LAB_START_TIMES = ["08:30", "10:45", "13:30"];
const AFTERNOON_SLOTS = ["13:30", "14:30", "15:30"];

const POP_SIZE = 60;
const GENERATIONS = 150;
const MUTATION_RATE = 0.1;

// ============================================================================
// 2. PREPARE INPUTS (Corrected for Seed Data)
// ============================================================================
async function generateAndSaveTimetable(db) {
    console.log("== GENERATING TIMETABLE (v5 - Seed Integration) ==");

    // FETCH FROM NEW COLLECTIONS
    const allSubjects = await db.collection("subjects").find({}).toArray();
    const allFaculty = await db.collection("users").find({ role: "faculty" }).toArray();
    const allRooms = await db.collection("rooms").find({}).toArray();
    const allBatches = await db.collection("batches").find({}).toArray();

    if (allSubjects.length === 0 || allBatches.length === 0) {
        console.error("❌ ERROR: No subjects or batches found. Did you run 'node seed.js'?");
        return {};
    }

    const inputs = [];
    let facultyIndex = 0; 

    // AUTO-ASSIGN LOGIC
    for (const batch of allBatches) {
        const semSubjects = allSubjects.filter(s => 
            s.semester === batch.semester && 
            (s.department === batch.department || s.department === "Common")
        );

        for (const sub of semSubjects) {
            // Assign Faculty (Round Robin)
            const deptFaculty = allFaculty.filter(f => f.department === batch.department);
            const pool = deptFaculty.length > 0 ? deptFaculty : allFaculty;
            const assignedFaculty = pool[facultyIndex % pool.length];
            facultyIndex++;

            // Lab vs Theory Logic
            const isLab = sub.type.toLowerCase().includes("lab");
            const sessionDuration = isLab ? 2 : 1;
            const sessionsPerWeek = isLab ? Math.ceil(sub.weeklyHours / 2) : sub.weeklyHours;

            // Filter Rooms
            const compatibleRooms = allRooms.filter(r => {
                if (isLab) return r.type.toLowerCase().includes("lab");
                return r.type.toLowerCase().includes("theory") || r.type.toLowerCase().includes("lecture");
            });
            const roomPool = compatibleRooms.length > 0 ? compatibleRooms : allRooms;

            for (let i = 0; i < sessionsPerWeek; i++) {
                inputs.push({
                    id: `${batch._id}-${sub.subjectCode}-${i}`,
                    course: sub.name,
                    courseType: isLab ? "Lab" : "Theory",
                    faculty: assignedFaculty.name,
                    facultyId: assignedFaculty._id,
                    section: batch._id, // The Batch Name (e.g. CSE-3A)
                    batch: isLab ? batch.name : null, 
                    roomType: isLab ? "Lab" : "Theory",
                    availableRooms: roomPool.map(r => r._id),
                    duration: sessionDuration
                });
            }
        }
    }

    console.log(`Prepared ${inputs.length} slots. Starting generation...`);
    const timetable = runGeneticAlgorithm(inputs);
    const formatted = formatTimetableForSave(timetable, inputs);

    await db.collection("timetables").updateOne(
        { _id: "main" },
        { $set: { data: formatted, generatedAt: new Date() } },
        { upsert: true }
    );

    console.log("== TIMETABLE SAVED ==");
    return formatted;
}

// ============================================================================
// 3. GENETIC ALGORITHM
// ============================================================================
function runGeneticAlgorithm(inputs) {
    let population = [];
    for (let i = 0; i < POP_SIZE; i++) population.push(createChromosome(inputs));

    let bestChromosome = null;
    let bestFitness = -Infinity;

    for (let g = 0; g < GENERATIONS; g++) {
        const evaluatedPop = population.map(ch => ({
            genes: ch,
            fitness: calculateFitness(ch)
        })).sort((a, b) => b.fitness - a.fitness);

        if (evaluatedPop[0].fitness > bestFitness) {
            bestFitness = evaluatedPop[0].fitness;
            bestChromosome = evaluatedPop[0].genes;
        }
        if (bestFitness === 0) break;

        const nextGen = [evaluatedPop[0].genes, evaluatedPop[1].genes];
        while (nextGen.length < POP_SIZE) {
            const pA = selectParent(evaluatedPop);
            const pB = selectParent(evaluatedPop);
            let child = crossover(pA, pB);
            if (Math.random() < MUTATION_RATE) child = mutate(child, inputs);
            nextGen.push(child);
        }
        population = nextGen;
    }
    return bestChromosome;
}

function createChromosome(inputs) { return inputs.map(i => assignRandomSlot(i)); }

function assignRandomSlot(input) {
    const day = DAYS[Math.floor(Math.random() * DAYS.length)];
    const room = input.availableRooms.length > 0 ? input.availableRooms[Math.floor(Math.random() * input.availableRooms.length)] : "Unassigned";
    const time = getRandomValidTime(input.duration, day);
    return { ...input, day, time, room };
}

function getRandomValidTime(duration, day) {
    let validStarts = (duration === 2) ? [...LAB_START_TIMES] : ALL_SLOTS.filter(t => !BREAKS.includes(t));
    if (day === "Wednesday") validStarts = validStarts.filter(t => !AFTERNOON_SLOTS.includes(t));
    return validStarts.length ? validStarts[Math.floor(Math.random() * validStarts.length)] : "08:30";
}

function selectParent(pop) { return pop[Math.floor(Math.random() * Math.min(5, pop.length))].genes; }

function crossover(pA, pB) { return pA.map((g, i) => Math.random() < 0.5 ? g : pB[i]); }

// FIXED: Replaces object to prevent 'undefined' error
function mutate(ch, inputs) { 
    const i = Math.floor(Math.random() * ch.length); 
    ch[i] = assignRandomSlot(inputs[i]); 
    return ch; 
}

function calculateFitness(chromosome) {
    let score = 0;
    const HARD = 50000, MEDIUM = 1000, SOFT = 10;

    for (let i = 0; i < chromosome.length; i++) {
        for (let j = i + 1; j < chromosome.length; j++) {
            const c1 = chromosome[i];
            const c2 = chromosome[j];
            if (c1.day !== c2.day) continue;
            
            if (isTimeOverlap(c1, c2)) {
                if (c1.facultyId === c2.facultyId) score -= HARD; 
                if (c1.room === c2.room && c1.room !== "Unassigned") score -= HARD;           
                if (c1.section === c2.section) score -= HARD;    
            }
            if (c1.section === c2.section && c1.course === c2.course) score -= SOFT;
        }
        if (chromosome[i].day === "Wednesday" && AFTERNOON_SLOTS.includes(chromosome[i].time)) score -= HARD;
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
    let slots = [], count = 0, i = idx;
    while (count < duration && i < ALL_SLOTS.length) {
        if (!BREAKS.includes(ALL_SLOTS[i])) { slots.push(ALL_SLOTS[i]); count++; }
        i++;
    }
    return slots;
}

function formatTimetableForSave(chromosome, inputs) {
    const res = {};
    DAYS.forEach(d => { res[d] = {}; ALL_SLOTS.forEach(t => { if (!BREAKS.includes(t)) res[d][t] = []; }); });
    if (!chromosome) return res;

    chromosome.forEach(gene => {
        getOccupiedSlots(gene.time, gene.duration).forEach(t => {
            if (res[gene.day] && res[gene.day][t]) {
                res[gene.day][t].push({
                    _id: new ObjectId(),
                    id: gene.id,
                    course: gene.course,
                    faculty: gene.faculty,
                    room: gene.room,
                    section: gene.section,
                    batch: gene.batch,
                    duration: gene.duration,
                    facultyId: gene.facultyId
                });
            }
        });
    });
    return res;
}

module.exports = { generateAndSaveTimetable };