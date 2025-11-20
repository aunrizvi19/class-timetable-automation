const { ObjectId } = require("mongodb");

// ============================================================================
// 1. PREPARE INPUTS
// ============================================================================
async function generateAndSaveTimetable(db) {
    console.log("== GENERATING TIMETABLE ==");

    const allCourses = await db.collection("courses").find({}).toArray();
    const allFaculty = await db.collection("faculty").find({}).toArray();
    const allRooms = await db.collection("rooms").find({}).toArray();
    const allSections = await db.collection("sections").find({}).toArray();

    const inputs = [];

    for (const section of allSections) {
        for (const assignment of section.assignments) {

            const course = allCourses.find(c => String(c._id) === String(assignment.courseId));
            const faculty = allFaculty.find(f => String(f._id) === String(assignment.facultyId));
            if (!course || !faculty) continue;

            const batchRaw = assignment.batch || "";
            const batch = batchRaw.trim().toLowerCase();
            const isTheory = batch === "" || batch.includes("entire");

            // THEORY CLASSES
            if (course.lectures_per_week > 0 && isTheory) {
                const theoryRooms = allRooms.filter(r => r.type.toLowerCase() === "theory");
                for (let i = 0; i < course.lectures_per_week; i++) {
                    inputs.push({
                        id: `${section._id}-${course._id}-L${i}`,
                        course: course.course_name,
                        courseType: course.course_type,
                        faculty: faculty.name,
                        facultyId: faculty._id,
                        section: section._id,
                        batch: null,          // <-- NO BATCH DISPLAYED FOR THEORY
                        roomType: "Theory",
                        availableRooms: theoryRooms.map(r => r._id),
                        duration: 1
                    });
                }
            }

            // LAB CLASSES (always batch-specific)
            if (course.practicals_per_week > 0 && !isTheory) {
                const labRooms = allRooms.filter(r => r.type.toLowerCase() === "lab");

                inputs.push({
                    id: `${section._id}-${course._id}-${assignment.batch}`,
                    course: course.course_name,
                    courseType: course.course_type,
                    faculty: faculty.name,
                    facultyId: faculty._id,
                    section: section._id,
                    batch: assignment.batch,
                    roomType: "Lab",
                    availableRooms: labRooms.map(r => r._id),
                    duration: course.practicals_per_week      // 2-hour or 3-hour lab
                });
            }
        }
    }

    console.log("Inputs:", inputs.length);

    const timetable = generate(inputs);
    const formatted = formatTimetableForSave(timetable, inputs);

    await db.collection("timetables").updateOne(
        { _id: "main" },
        { $set: { data: formatted, generatedAt: new Date() } },
        { upsert: true }
    );

    console.log("== DONE ==");
    return formatted;
}

// ============================================================================
// 2. GENETIC ALGORITHM
// ============================================================================
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL_SLOTS = ["08:30","09:30","10:30","10:45","11:45","12:45","13:30","14:30","15:30"];
const CLASS_SLOTS = ["08:30","09:30","10:45","11:45","13:30","14:30","15:30"];
const BREAKS = ["10:30","12:45"];

const POP = 40;
const GEN = 80;
const MUTATE = 0.08;

function generate(inputs) {
    let population = [];
    for (let i = 0; i < POP; i++) population.push(makeChromosome(inputs));

    let best = null, bestFit = -1e9;

    for (let g = 0; g < GEN; g++) {
        population = population.map(ch => ({
            ch,
            fit: fitness(ch, inputs)
        })).sort((a,b)=>b.fit-a.fit);

        if (population[0].fit > bestFit) {
            bestFit = population[0].fit;
            best = population[0].ch;
        }

        const next = [population[0].ch, population[1].ch];

        while (next.length < POP) {
            let c = cross( pick(population).ch , pick(population).ch );
            if (Math.random() < MUTATE) c = mutate(c, inputs);
            next.push(c);
        }
        population = next;
    }

    return best;
}

function makeChromosome(inputs) {
    return inputs.map((inp) => ({
        id: inp.id,
        day: DAYS[Math.floor(Math.random()*DAYS.length)],
        time: getValidStart(inp.duration),
        room: inp.availableRooms[Math.floor(Math.random()*inp.availableRooms.length)],
        duration: inp.duration,
        section: inp.section,
        batch: inp.batch,
        facultyId: inp.facultyId,
        conflict: false
    }));
}

function pick(pop) {
    return pop[Math.floor(Math.random()*pop.length)];
}

function cross(p1, p2) {
    const child = [];
    for (let i=0;i<p1.length;i++) {
        // LABS MUST stay intact
        if (p1[i].duration > 1) child.push({ ...p1[i] });
        else child.push(Math.random() < 0.5 ? { ...p1[i] } : { ...p2[i] });
    }
    return child;
}

function mutate(ch, inputs) {
    const i = Math.floor(Math.random()*ch.length);
    const inp = inputs[i];

    ch[i].day = DAYS[Math.floor(Math.random()*DAYS.length)];
    ch[i].time = getValidStart(inp.duration);
    ch[i].room = inp.availableRooms[Math.floor(Math.random()*inp.availableRooms.length)];

    return ch;
}

// ============================================================================
// 3. FITNESS AND CONSTRAINTS
// ============================================================================
function fitness(ch, inputs) {
    let score = 0;

    for (let i = 0; i < ch.length; i++) {
        for (let j = i + 1; j < ch.length; j++) {
            const A = ch[i], B = ch[j];
            if (A.day !== B.day) continue;

            const aSlots = slots(A.time, A.duration);
            const bSlots = slots(B.time, B.duration);

            if (aSlots.includes("X")) { score -= 80; continue; }
            if (bSlots.includes("X")) { score -= 80; continue; }

            const clash = aSlots.some(s => bSlots.includes(s));
            if (!clash) continue;

            if (A.facultyId === B.facultyId) score -= 10;
            if (A.room === B.room) score -= 10;

            if (A.section === B.section) {
                if (A.batch === null || B.batch === null) score -= 10;
                else if (A.batch === B.batch) score -= 10;
            }
        }
    }

    return score;
}

function slots(start, dur) {
    const idx = ALL_SLOTS.indexOf(start);
    if (idx < 0) return ["X"];
    const s = [];
    for (let i=0;i<dur;i++) {
        const t = ALL_SLOTS[idx+i];
        if (!t || BREAKS.includes(t)) return ["X"];
        s.push(t);
    }
    return s;
}

function getValidStart(dur) {
    const good = CLASS_SLOTS.filter(t => !slots(t,dur).includes("X"));
    return good[Math.floor(Math.random()*good.length)];
}

// ============================================================================
// 4. FORMAT FOR DATABASE
// ============================================================================
function formatTimetableForSave(ch, inputs) {
    const res = {};
    for (const d of DAYS) {
        res[d] = {};
        for (const t of ALL_SLOTS) res[d][t] = [];
    }

    for (const c of ch) {
        const sl = slots(c.time, c.duration);
        if (sl.includes("X")) continue;

        const inp = inputs.find(i => i.id === c.id);
        if (!inp) continue;

        const data = {
            _id: new ObjectId(),
            id: c.id,
            course: inp.course,
            faculty: inp.faculty,
            room: c.room,
            section: c.section,
            batch: inp.batch,   // null for theory
            duration: c.duration,
            conflict: c.conflict
        };

        for (const s of sl) res[c.day][s].push(data);
    }

    return res;
}

module.exports = { generateAndSaveTimetable };
