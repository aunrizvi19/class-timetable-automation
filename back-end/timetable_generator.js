// =================================================================
// == Class Timetable Generator (using a Genetic Algorithm)
// == v3 - Supports Multiple Sections per Time Slot (Arrays)
// =================================================================

// --- Constants ---
const POPULATION_SIZE = 50; 
const NUM_GENERATIONS = 100; 
const MUTATION_RATE = 0.05; 
const ELITISM_RATE = 0.1; 

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '08:30', '09:30', 
    '10:45', '11:45', 
    '13:30', '14:30', '15:30'
];

const TIME_SLOT_INDICES = {};
TIME_SLOTS.forEach((time, index) => TIME_SLOT_INDICES[time] = index);

async function generateAndSaveTimetable(db) {
    console.log("Starting advanced timetable generation (v3)...");

    const inputs = await fetchGenerationInputs(db);
    if (inputs.allClasses.length === 0) throw new Error("No classes found.");
    if (inputs.allRooms.length === 0) throw new Error("No rooms found.");

    let population = createInitialPopulation(inputs);
    let bestTimetable = null;
    let bestFitness = Infinity;

    for (let gen = 0; gen < NUM_GENERATIONS; gen++) {
        const fitnessScores = population.map(timetable => calculateFitness(timetable, inputs));

        for (let i = 0; i < population.length; i++) {
            if (fitnessScores[i] < bestFitness) {
                bestFitness = fitnessScores[i];
                bestTimetable = population[i];
            }
        }

        if (bestFitness < 10) { 
            console.log(`Good solution (fitness ${bestFitness}) found at generation ${gen}!`);
            break;
        }

        population = createNextGeneration(population, fitnessScores, inputs);
    }

    const formattedTimetable = formatTimetableForSave(bestTimetable, inputs);

    const timetablesCollection = db.collection('timetables');
    await timetablesCollection.updateOne(
        { _id: 'main' },
        { $set: { 
            data: formattedTimetable, 
            generatedAt: new Date(),
            fitness: bestFitness
        } },
        { upsert: true }
    );

    console.log("Timetable saved successfully.");
    return formattedTimetable;
}

async function fetchGenerationInputs(db) {
    const allRooms = await db.collection('rooms').find({}).toArray();
    const courses = await db.collection('courses').find({}).toArray();
    const courseMap = new Map();
    courses.forEach(c => courseMap.set(c._id, c));

    const sections = await db.collection('sections').find({}).toArray();
    
    const allClasses = [];
    sections.forEach(section => {
        if (section.assignments) {
            section.assignments.forEach(assignment => {
                const course = courseMap.get(assignment.courseId);
                allClasses.push({
                    id: assignment._id.toString(),
                    sectionId: section._id,
                    courseId: assignment.courseId,
                    facultyId: assignment.facultyId,
                    batch: assignment.batch,
                    duration: course ? parseInt(course.duration) : 1,
                    courseType: course ? course.course_type : 'Theory',
                    courseName: assignment.courseName.split(' - ')[0],
                    facultyName: assignment.facultyName.split(' (')[0]
                });
            });
        }
    });

    return { allRooms, allClasses, courseMap };
}

function createInitialPopulation(inputs) {
    const population = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        const timetable = [];
        inputs.allClasses.forEach(classGene => {
            const validTimeSlots = TIME_SLOTS.slice(0, TIME_SLOTS.length - (classGene.duration - 1));
            const randomDay = DAYS[Math.floor(Math.random() * DAYS.length)];
            const randomTime = validTimeSlots[Math.floor(Math.random() * validTimeSlots.length)];
            const randomRoom = inputs.allRooms[Math.floor(Math.random() * inputs.allRooms.length)];

            timetable.push({
                ...classGene,
                day: randomDay,
                time: randomTime,
                roomId: randomRoom._id
            });
        });
        population.push(timetable);
    }
    return population;
}

function calculateFitness(timetable, inputs) {
    let conflicts = 0;
    const occupied = new Map(); 
    const facultyLoad = new Map();
    const sectionLoad = new Map();

    timetable.forEach(classGene => {
        const { day, time, roomId, facultyId, sectionId, batch, duration } = classGene;
        classGene.conflict = false;

        const startTimeIndex = TIME_SLOT_INDICES[time];

        for (let i = 0; i < duration; i++) {
            const currentTimeSlot = TIME_SLOTS[startTimeIndex + i];
            if (!currentTimeSlot) continue;

            const roomKey = `${day}-${currentTimeSlot}-${roomId}`;
            if (occupied.has(roomKey)) {
                conflicts += 10;
                classGene.conflict = true; 
            } else {
                occupied.set(roomKey, true);
            }

            const facultyKey = `${day}-${currentTimeSlot}-${facultyId}`;
            if (occupied.has(facultyKey)) {
                conflicts += 10;
                classGene.conflict = true;
            } else {
                occupied.set(facultyKey, true);
            }

            const batchKey = `${day}-${currentTimeSlot}-${sectionId}-${batch}`;
            const entireSectionKey = `${day}-${currentTimeSlot}-${sectionId}-Entire Section`;

            if (batch === 'Entire Section') {
                for (const key of occupied.keys()) {
                   if (key.startsWith(`${day}-${currentTimeSlot}-${sectionId}-`)) {
                       conflicts += 10;
                       classGene.conflict = true;
                       break;
                   }
                }
            } else {
                if (occupied.has(batchKey) || occupied.has(entireSectionKey)) {
                    conflicts += 10;
                    classGene.conflict = true;
                }
            }
            occupied.set(batchKey, true);
        }

        const facultyLoadKey = `${facultyId}-${day}`;
        const currentFacultyLoad = (facultyLoad.get(facultyLoadKey) || 0) + duration;
        facultyLoad.set(facultyLoadKey, currentFacultyLoad);
        if (currentFacultyLoad > 3) conflicts += 1;

        const sectionLoadKey = `${sectionId}-${day}`;
        const currentSectionLoad = (sectionLoad.get(sectionLoadKey) || 0) + duration;
        sectionLoad.set(sectionLoadKey, currentSectionLoad);
        if (currentSectionLoad > 4) conflicts += 1;
    });

    return conflicts;
}

function createNextGeneration(population, fitnessScores, inputs) {
    const newPopulation = [];
    const eliteCount = Math.floor(POPULATION_SIZE * ELITISM_RATE);

    const scoredPopulation = population.map((timetable, i) => ({
        timetable: timetable,
        fitness: fitnessScores[i]
    })).sort((a, b) => a.fitness - b.fitness);

    for (let i = 0; i < eliteCount; i++) {
        newPopulation.push(scoredPopulation[i].timetable);
    }

    while (newPopulation.length < POPULATION_SIZE) {
        const parentA = scoredPopulation[Math.floor(Math.random() * eliteCount)].timetable;
        const parentB = scoredPopulation[Math.floor(Math.random() * eliteCount)].timetable;
        const child = crossover(parentA, parentB);
        mutate(child, inputs);
        newPopulation.push(child);
    }
    return newPopulation;
}

function crossover(parentA, parentB) {
    const child = [];
    for (let i = 0; i < parentA.length; i++) {
        if (Math.random() < 0.5) child.push({ ...parentA[i] });
        else child.push({ ...parentB[i] });
    }
    return child;
}

function mutate(timetable, inputs) {
    timetable.forEach(classGene => {
        if (Math.random() < MUTATION_RATE) {
            const mutationType = Math.floor(Math.random() * 3);
            switch (mutationType) {
                case 0: 
                    classGene.day = DAYS[Math.floor(Math.random() * DAYS.length)];
                    break;
                case 1: 
                    const validTimeSlots = TIME_SLOTS.slice(0, TIME_SLOTS.length - (classGene.duration - 1));
                    classGene.time = validTimeSlots[Math.floor(Math.random() * validTimeSlots.length)];
                    break;
                case 2: 
                    classGene.roomId = inputs.allRooms[Math.floor(Math.random() * inputs.allRooms.length)]._id;
                    break;
            }
        }
    });
}

/**
 * [Step 8 - Formatting] [MODIFIED FOR ARRAYS]
 * Saves data as: Data -> Day -> Time -> [Array of Slots]
 */
function formatTimetableForSave(timetable, inputs) {
    const formatted = {};
    DAYS.forEach(day => formatted[day] = {});

    calculateFitness(timetable, inputs);

    timetable.forEach(classGene => {
        const { day, time, roomId, courseName, facultyName, sectionId, facultyId, batch, duration, conflict } = classGene;
        
        const slotData = {
            course: courseName,
            faculty: facultyName,
            room: roomId,
            section: sectionId,
            facultyId: facultyId,
            batch: batch,
            duration: duration,
            conflict: !!conflict
        };

        // Initialize array if not exists
        if (!formatted[day][time]) {
            formatted[day][time] = [];
        }

        // Check if this exact slot is already added to prevent duplicates
        // (though the GA shouldn't produce duplicates, it's safer)
        const exists = formatted[day][time].some(s => 
            s.section === sectionId && s.batch === batch && s.course === courseName
        );

        if (!exists) {
            formatted[day][time].push(slotData);
        }
    });

    return formatted;
}

module.exports = { generateAndSaveTimetable };