const API_BASE = '/api';

// --- HELPER: GENERIC FETCH ---
async function fetchApi(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request Error');
        return data;
    } catch (err) {
        console.error("API Error:", err);
        if(options.method && options.method !== 'GET') alert(err.message);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGlobalUI();
    const user = JSON.parse(localStorage.getItem('timetableUser'));
    const isAuthPage = document.body.classList.contains('login-page');

    if (isAuthPage) { setupAuthPage(); return; }
    if (!user) { window.location.href = 'login.html'; return; }

    setupSidebarAndRole(user);
    setupLogout();

    const header = document.querySelector('.dashboard-header') || document.getElementById('welcomeHeader');
    if(header && !document.body.classList.contains('timetable-page')) {
        header.textContent = `Welcome, ${user.name}!`;
    }

    loadPageData(user);
});

// --- UI INIT (Sidebar & Dark Mode) ---
function initGlobalUI() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        if(darkModeToggle) darkModeToggle.checked = true;
    }

    if(darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if(darkModeToggle.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'true');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'false');
            }
        });
    }

    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if(sidebarToggle && sidebar && mainContent) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('retracted');
            mainContent.classList.toggle('expanded');
        });
    }
}

function setupSidebarAndRole(user) {
    document.body.classList.remove('admin-page', 'faculty-page', 'student-page');
    if(user.role === 'admin') document.body.classList.add('admin-page');
    if(user.role === 'faculty') document.body.classList.add('faculty-page');
    if(user.role === 'student') document.body.classList.add('student-page');
}

function setupLogout() {
    const btn = document.getElementById('logoutBtn');
    if(btn) btn.addEventListener('click', (e) => { 
        e.preventDefault(); 
        localStorage.removeItem('timetableUser'); 
        window.location.href = 'login.html'; 
    });
}

// --- CORE DATA LOADING LOGIC ---
async function loadPageData(user) {
    console.log("🔄 Loading Data for Role:", user.role);

    // 1. Master Timetable Page (Shared View)
    if (document.body.classList.contains('timetable-page')) {
        const t = await fetchApi('/timetable');
        window.allSections = (await fetchApi('/sections')) || [];
        
        // Handle Publish Button (Admin Only)
        const genBtn = document.querySelector('.generate-btn');
        if(user.role === 'admin' && genBtn) {
            genBtn.style.display = 'inline-block';
            genBtn.addEventListener('click', async () => { 
                if(confirm("🚀 Regenerate Timetable? This will overwrite the current schedule.")) { 
                    genBtn.textContent = "Processing..."; 
                    await fetchApi('/timetable/generate', {method: 'POST'}); 
                    location.reload(); 
                }
            });
        }

        if (t && t.data) populateTimetable(t.data);
        if (user.role === 'admin') populateFilters();
    }
    
    // 2. Student Dashboard
    if (document.body.classList.contains('student-page')) {
         if (!user.profileId || user.profileId === "Not Assigned") {
             renderSectionSelector();
         } else {
             if (document.getElementById('studentSectionStat')) document.getElementById('studentSectionStat').textContent = user.profileId;
             const t = await fetchApi(`/timetable/section/${user.profileId}`);
             if (t && t.data) {
                 populateTimetable(t.data);
                 startRealTimeClock(t.data, user);
             }
         }
    }

    // 3. Faculty Dashboard
    if (document.body.classList.contains('faculty-page') && !document.body.classList.contains('admin-page')) {
        const t = await fetchApi(`/timetable/faculty/${user.profileId}`);
        if (t && t.data) {
            populateTimetable(t.data);
            startRealTimeClock(t.data, user);
        }
        if(document.getElementById('facultyDeptStat')) {
            document.getElementById('facultyDeptStat').textContent = user.department || "General";
        }
    }

    // 4. Admin Dashboard Stats
    if (document.body.classList.contains('admin-page') && document.getElementById('totalCoursesStat')) {
        const [c, f, r] = await Promise.all([
            fetchApi('/courses'), 
            fetchApi('/faculty'), 
            fetchApi('/rooms')
        ]);
        if(document.getElementById('totalCoursesStat')) document.getElementById('totalCoursesStat').textContent = c ? c.length : 0;
        if(document.getElementById('totalFacultyStat')) document.getElementById('totalFacultyStat').textContent = f ? f.length : 0;
        if(document.getElementById('totalRoomsStat')) document.getElementById('totalRoomsStat').textContent = r ? r.length : 0;
        
        if(document.getElementById('attendanceTableBody')) { 
            loadAttendanceWidget(f || []); 
            startRealTimeClock({}, user); 
        }
    }

    // 5. Load Management Tables (Admin)
    if (document.querySelector('.courses-page tbody')) loadTable('courses', renderCourseRow, 'tbody'); 
    if (document.querySelector('.rooms-page tbody')) loadTable('rooms', renderRoomRow, 'tbody');
    if (document.querySelector('.sections-page tbody')) loadTable('sections', renderSectionRow, 'tbody');
    if (document.getElementById('facultyTableBody')) loadTable('faculty', renderFacultyRow, '#facultyTableBody');
    if (document.getElementById('usersTableBody')) loadTable('users', renderUserRow, '#usersTableBody');

    setupAddButtons();
}

// --- MASTER TIMETABLE RENDERER (YEAR CODED) ---
function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;

    const times = ['08:30', '09:30', '10:30', '10:45', '11:45', '12:45', '13:30', '14:30', '15:30'];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Filter Logic: Only Semester is used
    const sSel = document.getElementById('semester-select');
    let validBatches = null;
    
    if (sSel && sSel.value !== 'all' && window.allSections) {
        validBatches = window.allSections
            .filter(b => String(b.semester) === sSel.value)
            .map(b => b._id);
    }

    tbody.innerHTML = times.map(time => {
        // Breaks
        if(time === '10:30') return `<tr><td class="time-cell">${time}</td><td colspan="6" class="break-slot">Tea Break</td></tr>`;
        if(time === '12:45') return `<tr><td class="time-cell">${time}</td><td colspan="6" class="break-slot">Lunch Break</td></tr>`;

        const cells = days.map(day => {
            const slots = (data[day] && data[day][time]) || [];
            
            // Filter logic
            let displaySlots = validBatches ? slots.filter(s => validBatches.includes(s.section)) : slots;
            
            // Sort logic: Ensure S1 comes before S3, etc.
            displaySlots.sort((a, b) => a.section.localeCompare(b.section));

            return `<td>
                <div class="cell-content">
                ${displaySlots.map(s => {
                    // 1. Extract Semester Number (e.g. "CSE-5A" -> 5)
                    // Default to 1 if not found
                    const semMatch = s.section.match(/\d+/);
                    const semNum = semMatch ? parseInt(semMatch[0]) : 1;
                    
                    // 2. Calculate Year (1, 2, 3, 4)
                    const yearNum = Math.ceil(semNum / 2);
                    
                    // 3. Render Card with 'year-X' class
                    return `
                    <div class="timetable-slot year-${yearNum} ${s.type ? s.type.toLowerCase() : ''}">
                        <div class="slot-header">
                            <span class="section-badge">Y${yearNum} | S${semNum}</span>
                            <span class="batch-code">${s.batch || s.section}</span>
                        </div>
                        <div class="course-name">${s.course}</div>
                        <div class="slot-footer">
                            <span>${s.room}</span>
                            <span>${s.faculty}</span>
                        </div>
                    </div>`;
                }).join('')}
                </div>
            </td>`;
        }).join('');
        
        return `<tr><td class="time-cell">${time}</td>${cells}</tr>`;
    }).join('');
    
    console.log("✅ Master Timetable rendered with Year Color Coding.");
}

// --- UPDATED FILTER LOGIC ---
function populateFilters() {
    const sSel = document.getElementById('semester-select');
    if(!sSel || !window.allSections) return;
    
    const sems = new Set();
    window.allSections.forEach(s => sems.add(s.semester));
    
    sSel.innerHTML = '<option value="all">Show All Semesters</option>' + 
        [...sems].sort().map(s => `<option value="${s}">Semester ${s}</option>`).join('');
    
    sSel.addEventListener('change', async () => { 
        const t = await fetchApi('/timetable'); 
        if(t && t.data) populateTimetable(t.data); 
    });
}

// --- REAL-TIME CLOCK & LIVE STATUS ---
async function startRealTimeClock(timetableData, user) {
    const timeEl = document.getElementById('liveTime');
    const dateEl = document.getElementById('liveDate');
    const classEl = document.getElementById('currentClassInfo');
    const roomEl = document.getElementById('currentRoomInfo');
    
    if (!timeEl) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let attendanceData = [];
    try { attendanceData = (await fetchApi(`/attendance/${todayStr}`)) || []; } catch(e) {}

    function update() {
        const now = new Date();
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const today = days[now.getDay()];
        
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateEl.textContent = `${today}, ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

        if (user.role === 'admin') return;

        if (!timetableData || !timetableData[today]) { 
            if(classEl) { classEl.textContent = "No Classes Today"; classEl.style.color = "var(--text-muted)"; }
            return; 
        }

        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeVal = currentHour * 60 + currentMin;
        let found = false;

        for (const startTimeStr in timetableData[today]) {
            const [h, m] = startTimeStr.split(':').map(Number);
            const slotStartVal = h * 60 + m;
            const slotEndVal = slotStartVal + 60; 

            if (currentTimeVal >= slotStartVal && currentTimeVal < slotEndVal) {
                const classes = timetableData[today][startTimeStr];
                let myClass = null;
                
                if (user.role === 'student') {
                    myClass = classes.find(c => c.section === user.profileId || (c.batch && c.batch.includes(user.profileId)));
                } else if (user.role === 'faculty') {
                    myClass = classes.find(c => c.facultyId === user.profileId || c.faculty === user.name);
                }
                
                if (myClass) {
                    found = true;
                    let displayFaculty = myClass.faculty;
                    let note = "";
                    let color = "white";

                    const record = attendanceData.find(r => r.facultyId === myClass.facultyId);
                    if (record && record.status === 'absent') {
                        if (record.substitutions && record.substitutions.length > 0) {
                            displayFaculty = record.substitutions[0].substituteName;
                            note = "<br><small style='color:#ff9f43'>(Substitute)</small>";
                        } else {
                            displayFaculty = "No Instructor";
                            note = "<br><small style='color:#ff4757'>(Cancelled)</small>";
                            color = "#ff4757";
                        }
                    }

                    if(classEl) { 
                        classEl.innerHTML = `${myClass.course}`; 
                        classEl.style.color = color; 
                    }
                    if(roomEl) {
                        roomEl.innerHTML = `Room: ${myClass.room} <br> 👤 ${displayFaculty} ${note}`;
                    }
                }
                break;
            }
        }
        
        if (!found && classEl) {
            classEl.textContent = "Free Period";
            classEl.style.color = "var(--color-success)";
            if(roomEl) roomEl.textContent = "Relax or visit the library.";
        }
    }

    setInterval(update, 1000);
    update();
}

// --- CRUD TABLE FUNCTIONS (Admin) ---
async function loadTable(endpoint, renderFn, selector) {
    const data = await fetchApi(`/${endpoint}`);
    const tbody = document.querySelector(selector);
    if(!tbody || !data) return;
    tbody.innerHTML = data.map(renderFn).join('');
    
    tbody.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => { 
            if(confirm("Delete item?")) { 
                await fetchApi(`/${endpoint}/${e.target.dataset.id}`, {method: 'DELETE'}); 
                location.reload(); 
            }
        });
    });
    
    tbody.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = data.find(i => i._id === e.target.dataset.id);
            if(endpoint === 'courses') openEditCourseModal(item);
            if(endpoint === 'sections') openEditSectionModal(item);
        });
    });
}

function setupAddButtons() {
    const bind = (id, url, payloadFn) => {
        const form = document.getElementById(id);
        if(form) form.addEventListener('submit', async(e) => { 
            e.preventDefault(); 
            await fetchApi(url, {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payloadFn())}); 
            location.reload(); 
        });
    };

    bind('courseForm', '/courses', () => ({ 
        course_name: document.getElementById('courseName').value, 
        course_type: document.getElementById('courseType').value, 
        lectures_per_week: document.getElementById('lectures_per_week').value, 
        tutorials_per_week: document.getElementById('tutorials_per_week').value, 
        practicals_per_week: document.getElementById('practicals_per_week').value, 
        credits: document.getElementById('courseCredits').value 
    }));
    
    bind('sectionForm', '/sections', () => ({ 
        section_name: document.getElementById('sectionName').value, 
        department: document.getElementById('sectionDept').value, 
        semester: document.getElementById('sectionSem').value, 
        size: document.getElementById('sectionSize').value 
    }));
    
    bind('roomForm', '/rooms', () => ({ 
        roomNumber: document.getElementById('roomNumber').value, 
        capacity: document.getElementById('roomCapacity').value, 
        type: document.getElementById('roomType').value 
    }));
    
    bind('facultyForm', '/faculty', () => ({ 
        name: document.getElementById('facultyName').value, 
        email: document.getElementById('facultyEmail').value, 
        facultyId: document.getElementById('facultyId').value, 
        department: document.getElementById('facultyDept').value 
    }));
}

// --- UTILS & RENDERERS ---
const renderCourseRow = c => `<tr><td>${c._id}</td><td>${c.course_name}</td><td>${c.course_type}</td><td>${c.lectures_per_week}</td><td>${c.tutorials_per_week}</td><td>${c.practicals_per_week}</td><td>${c.credits}</td><td><button class="action-btn-table edit" data-id="${c._id}">Edit</button><button class="action-btn-table delete" data-id="${c._id}">Delete</button></td></tr>`;
const renderSectionRow = s => `<tr><td>${s._id}</td><td>${s.department}</td><td>${s.semester}</td><td>${s.size}</td><td><button class="action-btn-table edit" data-id="${s._id}">Edit</button><button class="action-btn-table delete" data-id="${s._id}">Delete</button></td></tr>`;
const renderUserRow = u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.profileId||'-'}</td><td><button class="delete action-btn-table" data-id="${u._id}">Delete</button></td></tr>`;
const renderRoomRow = r => `<tr><td>${r._id}</td><td>${r.capacity}</td><td>${r.type}</td><td><button class="delete action-btn-table" data-id="${r._id}">Delete</button></td></tr>`;
const renderFacultyRow = f => `<tr><td>${f.name}</td><td>${f.email}</td><td>${f.department}</td><td>${f.facultyId||'-'}</td><td><button class="delete action-btn-table" data-id="${f._id}">Delete</button></td></tr>`;

// Modal Placeholders
function openEditCourseModal(c) { console.log("Edit course", c); } 
function openEditSectionModal(s) { console.log("Edit section", s); }

async function renderSectionSelector() {
    const container = document.querySelector('.timetable-container');
    const sections = await fetchApi('/sections');
    if(container) container.innerHTML = `<div style="padding:40px;text-align:center;background:var(--bg-card);"><h2>Select Your Class</h2><select id="studentBatchSelect" class="form-group"><option value="">Choose Batch...</option>${sections.map(s => `<option value="${s._id}">${s._id}</option>`).join('')}</select><br><button onclick="saveStudentSection()" class="action-btn publish-btn">Join Class</button></div>`;
}
window.saveStudentSection = async () => {
    const batch = document.getElementById('studentBatchSelect').value;
    if(!batch) return alert("Please select a batch");
    let user = JSON.parse(localStorage.getItem('timetableUser'));
    user.profileId = batch; 
    localStorage.setItem('timetableUser', JSON.stringify(user)); 
    location.reload();
};

async function loadAttendanceWidget(facultyList) {
    const tbody = document.getElementById('attendanceTableBody');
    const btn = document.getElementById('saveAttendanceBtn');
    if (!tbody || !btn) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const records = (await fetchApi(`/attendance/${todayStr}`)) || [];
    
    tbody.innerHTML = facultyList.map(f => {
        const record = records.find(r => r.facultyId === f._id);
        const isAbsent = record && record.status === 'absent';
        const subName = (record && record.substitutions && record.substitutions[0]) ? record.substitutions[0].substituteName : "";
        return `<tr data-fid="${f._id}"><td>${f.name}</td><td><label class="toggle-switch" style="width:50px;height:26px"><input type="checkbox" class="status-toggle" ${!isAbsent?'checked':''}><span class="slider" style="background:${!isAbsent?'var(--color-success)':'var(--color-danger)'}"></span></label> <span class="status-label">${!isAbsent?'Present':'Absent'}</span></td><td><select class="sub-select" ${!isAbsent?'disabled':''}><option value="">No Substitute</option>${facultyList.filter(sf => sf._id !== f._id).map(sf => `<option value="${sf._id}" ${sf.name === subName ? 'selected' : ''}>${sf.name}</option>`).join('')}</select></td></tr>`;
    }).join('');
    
    tbody.querySelectorAll('.status-toggle').forEach(input => input.addEventListener('change', (e) => {
        const row = e.target.closest('tr');
        const isPresent = e.target.checked;
        row.querySelector('.slider').style.background = isPresent ? 'var(--color-success)' : 'var(--color-danger)';
        row.querySelector('.status-label').textContent = isPresent ? 'Present' : 'Absent';
        row.querySelector('.sub-select').disabled = isPresent;
    }));
    
    btn.addEventListener('click', async () => {
        btn.textContent = "Saving...";
        const updates = [];
        tbody.querySelectorAll('tr').forEach(row => {
            const fid = row.dataset.fid;
            const isPresent = row.querySelector('.status-toggle').checked;
            const subId = row.querySelector('.sub-select').value;
            const subName = subId ? row.querySelector(`.sub-select option[value="${subId}"]`).textContent : "";
            updates.push(fetchApi('/attendance', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ date: todayStr, facultyId: fid, status: isPresent ? 'present' : 'absent', substitutions: subId ? [{ slot: "ALL", substituteId: subId, substituteName: subName }] : [] }) }));
        });
        await Promise.all(updates);
        btn.textContent = "✅ Saved";
        setTimeout(() => btn.textContent = "Save Changes", 2000);
    });
}

function setupAuthPage() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginToggle = document.getElementById('loginToggle');
    const signupToggle = document.getElementById('signupToggle');
    
    document.getElementById('showSignup')?.addEventListener('click', (e) => { e.preventDefault(); signupToggle.click(); });
    document.getElementById('showLogin')?.addEventListener('click', (e) => { e.preventDefault(); loginToggle.click(); });

    if (loginToggle && signupToggle) {
        loginToggle.addEventListener('click', () => { loginForm.style.display='block'; signupForm.style.display='none'; loginToggle.classList.add('active'); signupToggle.classList.remove('active'); });
        signupToggle.addEventListener('click', () => { loginForm.style.display='none'; signupForm.style.display='block'; loginToggle.classList.remove('active'); signupToggle.classList.add('active'); });
        const signupRole = document.getElementById('signupRole');
        if (signupRole) signupRole.addEventListener('change', () => {
            document.getElementById('studentFields').style.display = (signupRole.value === 'student') ? 'block' : 'none';
            document.getElementById('facultyFields').style.display = (signupRole.value === 'faculty') ? 'block' : 'none';
        });
    }
    if (loginForm) loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('loginIdentifier').value;
        const password = document.getElementById('loginPassword').value;
        try {
            const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({identifier, password}) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            localStorage.setItem('timetableUser', JSON.stringify(data.user));
            if (data.user.role === 'admin') window.location.href = 'dashboard.html';
            else if (data.user.role === 'faculty') window.location.href = 'faculty-dashboard.html';
            else window.location.href = 'student-dashboard.html';
        } catch(err) { document.getElementById('loginError').textContent = err.message; }
    });
    if (signupForm) signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = document.getElementById('signupRole').value;
        const data = {
            name: document.getElementById('signupName').value,
            email: document.getElementById('signupEmail').value,
            password: document.getElementById('signupPassword').value,
            role: role,
            usn: role === 'student' ? document.getElementById('signupUSN').value : undefined,
            facultyId: role === 'faculty' ? document.getElementById('signupFacultyID').value : undefined
        };
        try {
            const res = await fetch(`${API_BASE}/signup`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
            if(!res.ok) throw new Error((await res.json()).message);
            alert("Account created! Please login."); location.reload();
        } catch(err) { document.getElementById('signupError').textContent = err.message; }
    });
}