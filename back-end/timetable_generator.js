const { ObjectId } = require('mongodb');

// =================================================================
// == 1. DATA PREPARATION
// =================================================================
async function generateAndSaveTimetable(db) {
    console.log("Starting timetable generation...");

    // Fetch all necessary data from the database
    const allCourses = await db.collection('courses').find({}).toArray();
    const allFaculty = await db.collection('faculty').find({}).toArray();
    const allRooms = await db.collection('rooms').find({}).toArray();
    const allSections = await db.collection('sections').find({}).toArray();

    const inputs = []; // This will hold all classes that need to be scheduled

    // [MODIFIED] Process assignments based on L-T-P structure
    allSections.forEach(section => {
        section.assignments.forEach(assignment => {
            
            const course = allCourses.find(c => c._id === assignment.courseId);
            const faculty = allFaculty.find(f => f._id === assignment.facultyId);

            if (!course || !faculty) {
                console.warn(`Skipping assignment: Course or Faculty not found. (Course: ${assignment.courseId}, Faculty: ${assignment.facultyId})`);
                return;
            }

            // --- Logic for Theory/Lecture (L) classes ---
            const lectures = course.lectures_per_week || 0;
            if (lectures > 0 && assignment.batch === 'Entire Section') {
                const theoryRooms = allRooms.filter(r => r.type === 'Theory');
                if (theoryRooms.length === 0) {
                    console.warn(`No 'Theory' rooms available for ${course._id}. Skipping lecture.`);
                    return;
                }
                
                for (let i = 0; i < lectures; i++) {
                    inputs.push({
                        id: `${section._id}-${course._id}-L${i+1}`,
                        course: course.course_name,
                        courseType: course.course_type,
                        faculty: faculty.name,
                        facultyId: faculty._id,
                        section: section._id,
                        batch: 'Entire Section',
                        roomType: 'Theory',
                        availableRooms: theoryRooms.map(r => r._id), 
                        duration: 1 // Lectures are 1 hour
                    });
                }
            }

            // --- Logic for Practical/Lab (P) classes ---
            const practicals = course.practicals_per_week || 0;
            if (practicals > 0 && assignment.batch !== 'Entire Section') {
                const labRooms = allRooms.filter(r => r.type === 'Lab');
                if (labRooms.length === 0) {
                    console.warn(`No 'Lab' rooms available for ${course._id}. Skipping lab.`);
                    return;
                }

                // Create *one* class for the *total* duration of the practical
                // e.g., if P=2, create one 2-hour class.
                inputs.push({
                    id: `${section._id}-${course._id}-${assignment.batch}`,
                    course: course.course_name,
                    courseType: course.course_type,
                    faculty: faculty.name,
                    facultyId: faculty._id,
                    section: section._id,
                    batch: assignment.batch,
                    roomType: 'Lab',
                    availableRooms: labRooms.map(r => r._id), 
                    duration: practicals // Lab duration is P (e.g., 2 or 3 hours)
                });
            }
            
            // Note: Tutorials (T) are not implemented, but could be added here
        });
    });

    if (inputs.length === 0) {
        console.error("No valid class assignments found. Aborting generation.");
        throw new Error("No valid class assignments found. Check section assignments.");
    }
    
    console.log(`Total classes to schedule: ${inputs.length}`);

    // =================================================================
    // == 2. GENETIC ALGORITHM
    // =================================================================
    const timetable = generate(inputs);
    const formattedTimetable = formatTimetableForSave(timetable, inputs);
    
    // Save to database
    await db.collection('timetables').updateOne(
        { _id: 'main' },
        { $set: { data: formattedTimetable, generatedAt: new Date() } },
        { upsert: true }
    );
    
    console.log("Timetable generation complete and saved.");
    return formattedTimetable;
}

// --- GA Constants ---
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// All 1-hour slots
const ALL_TIME_SLOTS = ['08:30', '09:30', '10:30', '10:45', '11:45', '12:45', '13:30', '14:30', '15:30'];
// Slots that are *not* breaks
const CLASS_TIME_SLOTS = ['08:30', '09:30', '10:45', '11:45', '13:30', '14:30', '15:30'];
// Break slots
const BREAK_SLOTS = ['10:30', '12:45'];

const POPULATION_SIZE = 50;
const MAX_GENERATIONS = 100;
const MUTATION_RATE = 0.1;

// --- Main GA Function ---
function generate(inputs) {
    if (inputs.length === 0) return [];

    let population = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        population.push(createChromosome(inputs));
    }

    let bestChromosome = null;
    let bestFitness = -Infinity;

    for (let gen = 0; gen < MAX_GENERATIONS; gen++) {
        population = population.map(chromosome => ({
            chromosome,
            fitness: calculateFitness(chromosome, inputs)
        }));

        population.sort((a, b) => b.fitness - a.fitness);

        if (population[0].fitness > bestFitness) {
            bestFitness = population[0].fitness;
            bestChromosome = population[0].chromosome;
        }

        // Perfect score
        if (bestFitness === 0) break;

        const newPopulation = [population[0].chromosome, population[1].chromosome]; // Elitism
        
        while (newPopulation.length < POPULATION_SIZE) {
            const parent1 = selectParent(population).chromosome;
            const parent2 = selectParent(population).chromosome;
            let child = crossover(parent1, parent2);
            if (Math.random() < MUTATION_RATE) {
                child = mutate(child, inputs);
            }
            newPopulation.push(child);
        }
        population = newPopulation;
    }
    
    // Add conflict info to the best chromosome
    return checkAllConstraints(bestChromosome, inputs).chromosome;
}

// --- Chromosome Functions ---
function createChromosome(inputs) {
    return inputs.map(classInput => {
        const day = DAYS[Math.floor(Math.random() * DAYS.length)];
        // [FIXED] Only pick valid start times
        const time = getRandomValidStartTime(classInput.duration); 
        const room = classInput.availableRooms[Math.floor(Math.random() * classInput.availableRooms.length)];
        
        return {
            id: classInput.id,
            day: day,
            time: time,
            room: room,
            duration: classInput.duration,
            section: classInput.section,
            batch: classInput.batch,
            facultyId: classInput.facultyId,
            conflict: false
        };
    });
}

function selectParent(population) {
    // Tournament selection
    const tournamentSize = 3;
    let best = null;
    for (let i = 0; i < tournamentSize; i++) {
        const random = population[Math.floor(Math.random() * population.length)];
        if (best === null || random.fitness > best.fitness) {
            best = random;
        }
    }
    return best;
}

function crossover(parent1, parent2) {
    const midpoint = Math.floor(Math.random() * parent1.length);
    const child = parent1.slice(0, midpoint).concat(parent2.slice(midpoint));
    return child;
}

function mutate(chromosome, inputs) {
    const geneIndex = Math.floor(Math.random() * chromosome.length);
    const classInput = inputs[geneIndex]; // Get the corresponding input data
    
    // Mutate one gene
    chromosome[geneIndex].day = DAYS[Math.floor(Math.random() * DAYS.length)];
    // [FIXED] Only pick valid start times
    chromosome[geneIndex].time = getRandomValidStartTime(classInput.duration);
    chromosome[geneIndex].room = classInput.availableRooms[Math.floor(Math.random() * classInput.availableRooms.length)];
    
    return chromosome;
}

// --- Fitness & Constraints ---
function calculateFitness(chromosome, inputs) {
    return checkAllConstraints(chromosome, inputs).fitness;
}

function checkAllConstraints(chromosome, inputs) {
    let fitness = 0;
    const newChromosome = JSON.parse(JSON.stringify(chromosome)); // Deep copy
    newChromosome.forEach(gene => gene.conflict = false); // Reset conflicts

    for (let i = 0; i < newChromosome.length; i++) {
        for (let j = i + 1; j < newChromosome.length; j++) {
            const class1 = newChromosome[i];
            const class2 = newChromosome[j];
            
            if (class1.day !== class2.day) continue; // No conflict if on different days

            // [FIXED] Get all 1-hour slots each class occupies
            const slots1 = getSlots(class1.time, class1.duration);
            const slots2 = getSlots(class2.time, class2.duration);

            // Check for invalid slot (e.g., crossing a break)
            if (slots1.includes('INVALID')) {
                fitness -= 100; // Very high penalty
                class1.conflict = true;
            }
            if (slots2.includes('INVALID')) {
                fitness -= 100; // Very high penalty
                class2.conflict = true;
            }
            if (slots1.includes('INVALID') || slots2.includes('INVALID')) continue;


            // Check for time overlap
            const timeOverlap = slots1.some(s1 => slots2.includes(s1));
            if (!timeOverlap) continue; // No conflict if no time overlap

            // --- We now know they are on the same day at overlapping times ---

            // 1. Faculty Conflict
            if (class1.facultyId === class2.facultyId) {
                fitness -= 10; 
                class1.conflict = true;
                class2.conflict = true;
            }

            // 2. Room Conflict
            if (class1.room === class2.room) {
                fitness -= 10; 
                class1.conflict = true;
                class2.conflict = true;
            }

            // 3. Section/Batch Conflict
            if (class1.section === class2.section) {
                if (class1.batch === 'Entire Section' || class2.batch === 'Entire Section' || class1.batch === class2.batch) {
                    fitness -= 10; 
                    class1.conflict = true;
                    class2.conflict = true;
                }
            }
        }
    }
    return { fitness, chromosome: newChromosome };
}

// [REWRITTEN] Helper to get all 1-hour slots a class occupies
function getSlots(startTime, duration) {
    const slots = [];
    let currentIndex = ALL_TIME_SLOTS.indexOf(startTime);

    if (currentIndex === -1 || BREAK_SLOTS.includes(startTime)) {
        return ['INVALID']; // Start time isn't a valid class start slot
    }

    for (let i = 0; i < duration; i++) {
        const slotIndex = currentIndex + i;
        if (slotIndex >= ALL_TIME_SLOTS.length) {
            return ['INVALID']; // Runs off the end of the day
        }
        
        const currentSlot = ALL_TIME_SLOTS[slotIndex];
        
        // If this isn't the *first* slot, check if it's a break
        if (i > 0 && BREAK_SLOTS.includes(currentSlot)) {
            return ['INVALID']; // Class crosses a break
        }
        
        slots.push(currentSlot);
    }
    
    return slots;
}

// [NEW] Helper to get a random valid start time for a class
function getRandomValidStartTime(duration) {
    const validStartTimes = [];
    for (const time of CLASS_TIME_SLOTS) {
        const slots = getSlots(time, duration);
        if (!slots.includes('INVALID')) {
            validStartTimes.push(time);
        }
    }
    
    if(validStartTimes.length === 0) {
        // This is bad, means a duration (e.g., 4) is too long
        // Default to a simple random slot to avoid crashing
        console.warn(`No valid start time found for duration ${duration}. Defaulting to random slot.`);
        return CLASS_TIME_SLOTS[Math.floor(Math.random() * CLASS_TIME_SLOTS.length)];
    }

    return validStartTimes[Math.floor(Math.random() * validStartTimes.length)];
}


// =================================================================
// == 3. DATA FORMATTING
// =================================================================
function formatTimetableForSave(timetable, inputs) {
    const formatted = {};
    DAYS.forEach(day => {
        formatted[day] = {};
        // Initialize ALL slots, including breaks
        ALL_TIME_SLOTS.forEach(time => {
            formatted[day][time] = []; // Initialize as array
        });
    });

    timetable.forEach(classGene => {
        // [MODIFIED] A class can occupy multiple slots. We must format this.
        const occupiedSlots = getSlots(classGene.time, classGene.duration);
        if (occupiedSlots.includes('INVALID')) return; // Skip invalid class

        const inputData = inputs.find(inp => inp.id === classGene.id);
        if (!inputData) return; // Skip if input not found

        const slotData = {
            _id: new ObjectId(),
            course: inputData.course,
            faculty: inputData.faculty,
            room: classGene.room,
            section: classGene.section,
            facultyId: classGene.facultyId,
            batch: classGene.batch,
            duration: classGene.duration,
            conflict: classGene.conflict
        };

        // Add the class data to *every* slot it occupies
        occupiedSlots.forEach(timeSlot => {
            if (formatted[classGene.day] && formatted[classGene.day][timeSlot]) {
                // Check to prevent duplicates if a conflict was saved
                const alreadyExists = formatted[classGene.day][timeSlot].some(s => s.id === slotData.id || (s.section === slotData.section && s.course === slotData.course && s.batch === slotData.batch));
                if (!alreadyExists) {
                     formatted[classGene.day][timeSlot].push(slotData);
                }
            }
        });
    });

    return formatted;
}

module.exports = { generateAndSaveTimetable };