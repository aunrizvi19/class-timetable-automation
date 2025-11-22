// ============================================================================
// TIMETABLE GENERATOR (Smart Labs & Rotating Batches)
// ============================================================================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Standard Slots
const FULL_DAY_SLOTS = [
    { start: "08:30", end: "09:30", type: "Lecture" },
    { start: "09:30", end: "10:30", type: "Lecture" },
    // 10:30 - 10:45 Tea Break (handled by frontend)
    { start: "10:45", end: "11:45", type: "Lecture" },
    { start: "11:45", end: "12:45", type: "Lecture" },
    // 12:45 - 13:30 Lunch Break (handled by frontend)
    { start: "13:30", end: "14:30", type: "LabOrLecture" },
    { start: "14:30", end: "15:30", type: "LabOrLecture" },
    { start: "15:30", end: "16:30", type: "LabOrLecture" }
];

// Wednesday Half-Day Logic
const WEDNESDAY_SLOTS = [
    { start: "08:30", end: "09:30", type: "Lecture" },
    { start: "09:30", end: "10:30", type: "Lecture" },
    { start: "10:45", end: "11:45", type: "Lecture" },
    { start: "11:45", end: "12:45", type: "Lecture" },
    { start: "13:30", end: "16:30", type: "Activity" } // Sports/Club
];

async function generateAndSaveTimetable(db) {
    console.log("🚀 Starting Smart Generation: Parallel Labs & Rotating Batches...");

    // 1. Fetch All Resources
    const subjects = await db.collection('subjects').find({}).toArray();
    const faculty = await db.collection('users').find({ role: 'faculty' }).toArray();
    const rooms = await db.collection('rooms').find({}).toArray();
    const sections = await db.collection('batches').find({}).toArray();

    if (sections.length === 0 || subjects.length === 0) {
        throw new Error("Missing Data: Add Sections and Courses first.");
    }

    let schedule = [];
    
    // Helper: Get Random Item from Array
    const getRandom = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

    // 2. Generate Schedule per Section
    for (const section of sections) {
        // Filter subjects for this specific class (Dept + Semester)
        const theorySubjects = subjects.filter(s => s.department === section.department && s.semester === section.semester && s.type === 'theory');
        const labSubjects = subjects.filter(s => s.department === section.department && s.semester === section.semester && s.type === 'lab');

        // Faculty for this dept
        const deptFaculty = faculty.filter(f => f.department === section.department);
        
        // Rooms
        const lectureRooms = rooms.filter(r => r.type === 'Lecture');
        const labRooms = rooms.filter(r => r.type === 'Lab');

        // State tracking to prevent too many labs
        let labsScheduledThisWeek = 0;

        for (const day of DAYS) {
            const slots = (day === "Wednesday") ? WEDNESDAY_SLOTS : FULL_DAY_SLOTS;
            let hasHadLabToday = false;

            for (const slot of slots) {
                
                // A. ACTIVITY SLOT (Wednesdays)
                if (slot.type === "Activity") {
                    schedule.push({
                        day, time: slot.start, 
                        section: section._id, batch: "All",
                        course: "Sports / Co-Curricular", faculty: "Sports Dept", room: "Ground", type: "Activity"
                    });
                    continue;
                }

                // B. LAB LOGIC (Parallel & Rotating)
                // Criteria: Afternoon slot, Labs exist, haven't done lab today, max 2 labs/week
                const isAfternoon = parseInt(slot.start.split(':')[0]) >= 13;
                
                if (isAfternoon && !hasHadLabToday && labsScheduledThisWeek < 2 && labSubjects.length >= 1 && Math.random() > 0.5) {
                    
                    hasHadLabToday = true;
                    labsScheduledThisWeek++;

                    // We assume 3 batches: B1, B2, B3
                    const batches = ['B1', 'B2', 'B3'];
                    
                    // Shuffle labs so B1 doesn't always get the same lab first
                    const availableLabs = [...labSubjects].sort(() => 0.5 - Math.random());

                    batches.forEach((batchName, index) => {
                        // ROTATION LOGIC: 
                        // Ensure B1, B2, B3 get DIFFERENT labs if possible
                        const labSubject = availableLabs[index % availableLabs.length];
                        
                        // Ensure B1, B2, B3 get DIFFERENT rooms
                        const labRoom = labRooms[index % labRooms.length] || { _id: "Lab-Default" };
                        
                        // Assign a teacher
                        const teacher = getRandom(deptFaculty) || { name: "Staff", _id: "TBD" };

                        schedule.push({
                            day,
                            time: slot.start,
                            section: section._id,         // Main filter
                            batch: `${section._id}-${batchName}`, // Display: CSE-5A-B1
                            course: labSubject.name,
                            faculty: teacher.name,
                            facultyId: teacher._id,
                            room: labRoom._id,
                            type: "Lab"
                        });
                    });

                } 
                // C. THEORY LOGIC (Standard Lecture)
                else {
                    if (theorySubjects.length > 0) {
                        const sub = getRandom(theorySubjects);
                        const teacher = getRandom(deptFaculty) || { name: "Staff", _id: "TBD" };
                        const room = getRandom(lectureRooms) || { _id: "101" };

                        schedule.push({
                            day,
                            time: slot.start,
                            section: section._id,
                            batch: "All",
                            course: sub.name,
                            faculty: teacher.name,
                            facultyId: teacher._id,
                            room: room._id,
                            type: "Theory"
                        });
                    }
                }
            }
        }
    }

    // 3. Transform Data for Frontend Grid
    // Structure: { "Monday": { "08:30": [ { class... }, { class... } ] } }
    const finalData = {};
    
    DAYS.forEach(day => {
        finalData[day] = {};
        FULL_DAY_SLOTS.forEach(slot => {
            finalData[day][slot.start] = [];
        });
        // Ensure Wed activity slot exists
        if (day === "Wednesday") finalData[day]["13:30"] = [];
    });

    schedule.forEach(entry => {
        if (!finalData[entry.day]) finalData[entry.day] = {};
        if (!finalData[entry.day][entry.time]) finalData[entry.day][entry.time] = [];
        
        finalData[entry.day][entry.time].push(entry);
    });

    // 4. Save to Database (Overwrite 'main' document)
    const timetableCollection = db.collection('timetables');
    await timetableCollection.deleteMany({}); // Clear old
    await timetableCollection.insertOne({ 
        _id: 'main', 
        createdAt: new Date(), 
        data: finalData 
    });

    console.log("✅ Smart Timetable Generated successfully!");
    return finalData;
}

module.exports = { generateAndSaveTimetable };