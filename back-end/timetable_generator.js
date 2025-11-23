const { MongoClient } = require('mongodb');

// ============================================================================
//  CONFIGURATION & CONSTANTS
// ============================================================================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Time Slots definition
// "isLabStart": true means a 2-hour contiguous lab can start here without hitting a break
const TIME_SLOTS = [
    { start: "08:30", end: "09:30", isLabStart: true }, // Slot 0: Lab 8:30-10:30
    { start: "09:30", end: "10:30", isLabStart: false },// Slot 1
    // 10:30 - 10:45 TEA BREAK
    { start: "10:45", end: "11:45", isLabStart: true }, // Slot 2: Lab 10:45-12:45
    { start: "11:45", end: "12:45", isLabStart: false },// Slot 3
    // 12:45 - 13:30 LUNCH BREAK
    { start: "13:30", end: "14:30", isLabStart: true }, // Slot 4: Lab 13:30-15:30
    { start: "14:30", end: "15:30", isLabStart: false },// Slot 5
    { start: "15:30", end: "16:30", isLabStart: false } // Slot 6
];

// Course Type Definitions (Based on 2023 Scheme Syllabus)
// L: Theory Hours/Week, P: Practical Hours/Week (2 hours = 1 Lab Session)
const COURSE_RULES = {
    'PCC':  { L: 3, P: 0 }, // Professional Core (Theory)
    'IPCC': { L: 3, P: 2 }, // Integrated (Theory + Lab)
    'PCCL': { L: 0, P: 2 }, // Lab Only
    'PEC':  { L: 3, P: 0 }, // Professional Elective
    'ETC':  { L: 3, P: 0 }, // Emerging Tech
    'AEC':  { L: 0, P: 2 }, // Ability Enhancement (Lab)
    'HSMC': { L: 1, P: 0 }, // Social Connect/UHV
    'NCMC': { L: 0, P: 0 }  // Non-credit (usually weekends/events)
};

// Helper to detect type from Subject Code (e.g., "23CST501" -> "PCC")
function getCourseType(code) {
    if (!code) return 'PCC'; // Default
    if (code.includes('CST')) return 'PCC';
    if (code.includes('CSI')) return 'IPCC';
    if (code.includes('CSL')) return 'PCCL';
    if (code.includes('CSP')) return 'PEC';
    if (code.includes('CSE')) return 'ETC';
    if (code.includes('CSAE') || code.includes('RMAE')) return 'AEC';
    if (code.includes('HHS') || code.includes('SCRH')) return 'HSMC';
    return 'PCC';
}

// ============================================================================
//  CORE GENERATOR FUNCTION
// ============================================================================

async function generateAndSaveTimetable(db) {
    console.log("🚀 Starting 2023 Scheme Timetable Generation...");

    // 1. FETCH RESOURCES
    const subjects = await db.collection('subjects').find({}).toArray();
    const faculty = await db.collection('users').find({ role: 'faculty' }).toArray();
    const rooms = await db.collection('rooms').find({}).toArray();
    const sections = await db.collection('batches').find({}).toArray(); // Assuming 'batches' collection holds Sections (A, B, C)

    if (sections.length === 0 || subjects.length === 0) throw new Error("Missing Sections or Subjects data.");

    // 2. INITIALIZE STRUCTURES
    // Master Schedule: { Day: { Time: [ { ...classDetails } ] } }
    let timetable = {}; 
    DAYS.forEach(d => {
        timetable[d] = {};
        TIME_SLOTS.forEach(t => timetable[d][t.start] = []);
    });

    // Resource Trackers (to prevent conflicts)
    // facultyBusy[facultyId][day][slotIndex] = true
    let facultyBusy = {};
    // sectionBusy[sectionId][day][slotIndex] = true (Whole section is busy, e.g., during theory)
    let sectionBusy = {};
    // roomBusy[roomId][day][slotIndex] = true
    let roomBusy = {};

    // Initialize Trackers
    faculty.forEach(f => { facultyBusy[f._id] = initAvailabilityMatrix(); });
    sections.forEach(s => { sectionBusy[s._id] = initAvailabilityMatrix(); });
    rooms.forEach(r => { roomBusy[r._id] = initAvailabilityMatrix(); });

    // 3. GENERATE SCHEDULE FOR EACH SECTION
    for (const section of sections) {
        console.log(`Processing Section: ${section._id} (Sem ${section.semester})`);

        // Filter subjects for this section's semester
        const sectionSubjects = subjects.filter(s => s.semester == section.semester && s.department === section.department);
        
        // Separate Theory and Lab Requirements
        let theoryQueue = [];
        let labQueue = [];

        sectionSubjects.forEach(sub => {
            const type = getCourseType(sub.subjectCode);
            const rules = COURSE_RULES[type] || { L: 3, P: 0 };
            
            // Add Theory Hours
            for(let i=0; i<rules.L; i++) {
                theoryQueue.push({ ...sub, type: 'Theory', isLab: false });
            }

            // Add Lab Sessions (P=2 means 1 session of 2 hours)
            const labSessions = Math.floor(rules.P / 2);
            for(let i=0; i<labSessions; i++) {
                labQueue.push({ ...sub, type: 'Lab', isLab: true });
            }
        });

        // ---------------------------------------------------------
        // PHASE A: SCHEDULE LABS (Priority 1 - Contiguous Blocks)
        // ---------------------------------------------------------
        // Logic: A section splits into 3 batches (B1, B2, B3). 
        // All batches must have labs AT THE SAME TIME (Parallel Labs) but different subjects.
        
        // Group labs into sets of 3 (or however many batches)
        const batches = ['B1', 'B2', 'B3'];
        
        // We need to schedule 'labQueue' items.
        // Since Labs are expensive (resources), we try to fit them first.
        
        while(labQueue.length > 0) {
            // Take up to 3 distinct lab subjects for parallel execution
            let currentSessionLabs = [];
            
            // Try to pick 3 unique subjects if possible, else repeat
            let distinctLabs = [...new Set(labQueue.map(l => l.subjectCode))];
            
            for(let b=0; b<batches.length; b++) {
                if(labQueue.length === 0) break;
                
                // Try to find a lab subject we haven't picked for this session yet
                let candidateIndex = labQueue.findIndex(l => !currentSessionLabs.some(c => c.subjectCode === l.subjectCode));
                
                // If all remaining labs are same subject, just pick the first one
                if(candidateIndex === -1) candidateIndex = 0;
                
                currentSessionLabs.push(labQueue[candidateIndex]);
                labQueue.splice(candidateIndex, 1); // Remove from queue
            }

            // Now find a valid 2-hour slot for this "Parallel Lab Session"
            let allocated = false;

            // Shuffle days to avoid all labs on Monday
            const shuffledDays = [...DAYS].sort(() => 0.5 - Math.random());

            for (const day of shuffledDays) {
                if(allocated) break;
                if (day === "Wednesday") continue; // Wed afternoon is Activity, avoid labs if possible or restricted

                // Iterate through Lab-Capable Start Slots (0, 2, 4)
                // Indices in TIME_SLOTS: 0(8:30), 2(10:45), 4(13:30)
                const labStartIndices = [0, 2, 4]; 

                for (const slotIdx of labStartIndices) {
                    if(allocated) break;

                    // Check if Section is free for 2 hours (slotIdx and slotIdx+1)
                    if (isSectionBusy(sectionBusy, section._id, day, slotIdx) || 
                        isSectionBusy(sectionBusy, section._id, day, slotIdx+1)) {
                        continue;
                    }

                    // Try to assign Faculty and Rooms for each batch
                    let assignments = [];
                    let resourcesAvailable = true;

                    for (let i = 0; i < currentSessionLabs.length; i++) {
                        const sub = currentSessionLabs[i];
                        const batchName = batches[i];

                        // Find Faculty
                        const teacher = findFreeFaculty(faculty, facultyBusy, day, slotIdx, slotIdx+1, sub.department);
                        // Find Room (Lab type)
                        const room = findFreeRoom(rooms, roomBusy, day, slotIdx, slotIdx+1, 'Lab');

                        if (teacher && room) {
                            assignments.push({ sub, batchName, teacher, room });
                        } else {
                            resourcesAvailable = false;
                            break;
                        }
                    }

                    if (resourcesAvailable) {
                        // BOOK IT!
                        assignments.forEach(assign => {
                            const entry = {
                                day,
                                time: TIME_SLOTS[slotIdx].start, // Start Time
                                section: section._id,
                                batch: `${section._id}-${assign.batchName}`,
                                course: assign.sub.name,
                                code: assign.sub.subjectCode,
                                faculty: assign.teacher.name,
                                facultyId: assign.teacher._id,
                                room: assign.room.name,
                                type: 'Lab',
                                duration: 2 // Marker for frontend to span 2 columns if needed
                            };

                            // Push to Master Timetable (for the start slot)
                            timetable[day][TIME_SLOTS[slotIdx].start].push(entry);
                            
                            // Mark Resources Busy for BOTH slots (2 hours)
                            markFacultyBusy(facultyBusy, assign.teacher._id, day, [slotIdx, slotIdx+1]);
                            markRoomBusy(roomBusy, assign.room._id, day, [slotIdx, slotIdx+1]);
                        });

                        // Mark Section Busy
                        markSectionBusy(sectionBusy, section._id, day, [slotIdx, slotIdx+1]);
                        allocated = true;
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // PHASE B: SCHEDULE THEORY (Priority 2 - Single Hours)
        // ---------------------------------------------------------
        
        // Daily limit map: section -> day -> count
        let dailyTheoryCount = {};
        DAYS.forEach(d => dailyTheoryCount[d] = 0);

        for (const sub of theoryQueue) {
            let allocated = false;
            
            // Shuffle days
            const shuffledDays = [...DAYS].sort(() => 0.5 - Math.random());

            for (const day of shuffledDays) {
                if (allocated) break;
                
                // Max 4 theory hours per day to prevent burnout? 
                // User said "max of two hours per day" PER SUBJECT.
                // Let's check total per day too.
                if (dailyTheoryCount[day] >= 5) continue; // Soft limit

                // Wed Afternoon constraint
                const validSlots = (day === "Wednesday") ? [0,1,2,3] : [0,1,2,3,4,5,6];

                for (const slotIdx of validSlots) {
                    if (allocated) break;

                    // Check Section
                    if (isSectionBusy(sectionBusy, section._id, day, slotIdx)) continue;

                    // Check "2 hours max per subject per day" logic
                    // Implementation: Check timetable for this day/section/subject count.
                    if (getSubjectDailyCount(timetable, day, section._id, sub.name) >= 2) continue;

                    // Find Faculty
                    const teacher = findFreeFaculty(faculty, facultyBusy, day, slotIdx, slotIdx, sub.department);
                    // Find Room (Lecture type)
                    const room = findFreeRoom(rooms, roomBusy, day, slotIdx, slotIdx, 'Lecture');

                    if (teacher && room) {
                        // BOOK IT
                        const entry = {
                            day,
                            time: TIME_SLOTS[slotIdx].start,
                            section: section._id,
                            batch: "All", // Whole class
                            course: sub.name,
                            code: sub.subjectCode,
                            faculty: teacher.name,
                            facultyId: teacher._id,
                            room: room.name,
                            type: getCourseType(sub.subjectCode), // PCC, IPCC etc
                            duration: 1
                        };

                        timetable[day][TIME_SLOTS[slotIdx].start].push(entry);
                        
                        markFacultyBusy(facultyBusy, teacher._id, day, [slotIdx]);
                        markRoomBusy(roomBusy, room._id, day, [slotIdx]);
                        markSectionBusy(sectionBusy, section._id, day, [slotIdx]);
                        
                        dailyTheoryCount[day]++;
                        allocated = true;
                    }
                }
            }
        }
    }

    // 4. SAVE TO DB
    const timetableCollection = db.collection('timetables');
    await timetableCollection.deleteMany({});
    await timetableCollection.insertOne({ 
        _id: 'main', 
        createdAt: new Date(), 
        data: timetable 
    });

    console.log("✅ 2023 Scheme Timetable Generated Successfully!");
    return timetable;
}

// ============================================================================
//  HELPER FUNCTIONS
// ============================================================================

function initAvailabilityMatrix() {
    // 7 slots per day for 6 days
    let matrix = {};
    DAYS.forEach(d => {
        matrix[d] = Array(7).fill(false);
    });
    return matrix;
}

function isSectionBusy(sectionBusy, secId, day, slotIdx) {
    if (!sectionBusy[secId]) return false;
    return sectionBusy[secId][day][slotIdx];
}

function findFreeFaculty(facultyList, facultyBusy, day, startSlot, endSlot, dept) {
    // Filter by dept
    const deptFaculty = facultyList.filter(f => f.department === dept);
    // Shuffle for randomness
    const shuffled = deptFaculty.sort(() => 0.5 - Math.random());

    for (const f of shuffled) {
        let isFree = true;
        for (let s = startSlot; s <= endSlot; s++) {
            // Safe check for slot boundary
            if (s >= 7 || facultyBusy[f._id][day][s]) {
                isFree = false; 
                break;
            }
        }
        if (isFree) return f;
    }
    // Fallback: any faculty (Staff) if dept specific not found? 
    // For now, return strict null to ensure correctness.
    return null;
}

function findFreeRoom(roomList, roomBusy, day, startSlot, endSlot, type) {
    // Filter by type (Lab vs Lecture)
    // Assuming room.type is 'Lab' or 'Lecture' in DB
    const validRooms = roomList.filter(r => 
        type === 'Lab' ? (r.type === 'Lab') : (r.type !== 'Lab')
    );
    const shuffled = validRooms.sort(() => 0.5 - Math.random());

    for (const r of shuffled) {
        let isFree = true;
        for (let s = startSlot; s <= endSlot; s++) {
            if (s >= 7 || roomBusy[r._id][day][s]) {
                isFree = false; 
                break;
            }
        }
        if (isFree) return r;
    }
    return null;
}

function markFacultyBusy(facultyBusy, fid, day, slots) {
    slots.forEach(s => { if(s < 7) facultyBusy[fid][day][s] = true; });
}

function markRoomBusy(roomBusy, rid, day, slots) {
    slots.forEach(s => { if(s < 7) roomBusy[rid][day][s] = true; });
}

function markSectionBusy(sectionBusy, sid, day, slots) {
    slots.forEach(s => { if(s < 7) sectionBusy[sid][day][s] = true; });
}

function getSubjectDailyCount(timetable, day, sectionId, courseName) {
    let count = 0;
    const dayData = timetable[day];
    for (const time in dayData) {
        const slots = dayData[time];
        // Check if this section has this course in this slot
        const hasClass = slots.some(s => s.section === sectionId && s.course === courseName);
        if (hasClass) count++;
    }
    return count;
}

module.exports = { generateAndSaveTimetable };