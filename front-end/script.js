const API_BASE = '/api'; 

// --- 0. HELPER: FETCH API ---
async function fetchApi(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request Error');
        return data;
    } catch (err) {
        console.error(err);
        alert(err.message); 
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. GLOBAL DARK MODE INIT ---
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

    // --- 2. AUTHENTICATION CHECKS ---
    const user = JSON.parse(localStorage.getItem('timetableUser'));
    const isAuthPage = document.body.classList.contains('login-page');

    if (isAuthPage) {
        setupAuthPage();
        return; 
    }

    if (!user) { 
        window.location.href = 'login.html'; 
        return; 
    }

    // --- 3. DYNAMIC UI SETUP ---
    setupSidebarAndRole(user);
    setupLogout();

    const header = document.querySelector('.dashboard-header') || document.getElementById('welcomeHeader');
    if(header && !document.body.classList.contains('timetable-page')) header.textContent = `Welcome, ${user.name}!`;

    loadPageData(user);
});

function setupAuthPage() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginToggle = document.getElementById('loginToggle');
    const signupToggle = document.getElementById('signupToggle');

    if (loginToggle && signupToggle) {
        loginToggle.addEventListener('click', () => {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            loginToggle.classList.add('active');
            signupToggle.classList.remove('active');
        });
        signupToggle.addEventListener('click', () => {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            loginToggle.classList.remove('active');
            signupToggle.classList.add('active');
        });

        document.getElementById('showSignup')?.addEventListener('click', (e) => { e.preventDefault(); signupToggle.click(); });
        document.getElementById('showLogin')?.addEventListener('click', (e) => { e.preventDefault(); loginToggle.click(); });
        
        const signupRole = document.getElementById('signupRole');
        if (signupRole) {
            signupRole.addEventListener('change', () => {
                document.getElementById('studentFields').style.display = (signupRole.value === 'student') ? 'block' : 'none';
                document.getElementById('facultyFields').style.display = (signupRole.value === 'faculty') ? 'block' : 'none';
            });
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('loginIdentifier').value;
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            if(errorEl) errorEl.textContent = "Logging in...";
            
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ identifier, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                localStorage.setItem('timetableUser', JSON.stringify(data.user));
                
                if (data.user.role === 'admin') window.location.href = 'dashboard.html';
                else if (data.user.role === 'faculty') window.location.href = 'faculty-dashboard.html';
                else window.location.href = 'student-dashboard.html';
            } catch(err) {
                if(errorEl) errorEl.textContent = err.message;
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
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
                const res = await fetch(`${API_BASE}/signup`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                if(!res.ok) throw new Error(result.message);
                alert("Account created! Please login.");
                location.reload();
            } catch(err) {
                document.getElementById('signupError').textContent = err.message;
            }
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
    document.querySelectorAll('#logoutBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('timetableUser');
            window.location.href = 'login.html';
        });
    });
}

async function loadPageData(user) {
    // --- Admin Tables ---
    if (document.querySelector('.courses-page tbody')) loadTable('courses', renderCourseRow);
    if (document.querySelector('.rooms-page tbody')) loadTable('rooms', renderRoomRow);
    if (document.querySelector('.sections-page tbody')) loadTable('sections', renderSectionRow);
    if (document.querySelector('.faculty-page tbody')) loadTable('faculty', renderFacultyRow);
    if (document.getElementById('usersTableBody')) loadTable('users', renderUserRow);

    // --- Admin Dashboard Stats ---
    if (document.getElementById('totalCoursesStat')) {
        const [c, f, r] = await Promise.all([
            fetchApi('/courses'), fetchApi('/faculty'), fetchApi('/rooms')
        ]);
        document.getElementById('totalCoursesStat').textContent = c ? c.length : 0;
        document.getElementById('totalFacultyStat').textContent = f ? f.length : 0;
        document.getElementById('totalRoomsStat').textContent = r ? r.length : 0;
        
        // Start Real-time clock for Admin Dashboard too
        startRealTimeClock({}, user);
    }

    // --- Timetable Page ---
    if (document.body.classList.contains('timetable-page')) {
        const t = await fetchApi('/timetable');
        const sections = await fetchApi('/sections');
        window.allSections = sections || [];
        if (t && t.data) populateTimetable(t.data);
        if(user.role === 'admin') populateFilters();
    }
    
    // --- Student Dashboard ---
    if (document.body.classList.contains('student-page')) {
         if (!user.profileId) {
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

    // --- Faculty Dashboard ---
    if (document.body.classList.contains('faculty-page') && !document.body.classList.contains('admin-page')) {
        const t = await fetchApi(`/timetable/faculty/${user.profileId}`);
        if (t && t.data) {
            populateTimetable(t.data);
            startRealTimeClock(t.data, user);
        }
        if(document.getElementById('facultyDeptStat')) document.getElementById('facultyDeptStat').textContent = user.department || "CSE";
    }

    // --- PUBLISH / GENERATE BUTTON ---
    const genBtn = document.querySelector('.generate-btn');
    if(genBtn) {
        genBtn.addEventListener('click', async () => {
            if(confirm("📢 PUBLISH NEW TIMETABLE?\n\nThis will generate a fresh schedule and immediately publish it to all students and faculty.\n\nThis action cannot be undone.")) {
                genBtn.textContent = "Publishing...";
                genBtn.disabled = true;
                await fetchApi('/timetable/generate', { method: 'POST' });
                alert("✅ Timetable Published Successfully!");
                location.reload();
            }
        });
    }

    setupAddButtons();
}

async function loadTable(endpoint, renderFn) {
    const data = await fetchApi(`/${endpoint}`);
    const tbody = document.querySelector('tbody');
    if(!tbody || !data) return;
    tbody.innerHTML = data.map(renderFn).join('');
    
    tbody.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!confirm("Delete this item?")) return;
            await fetchApi(`/${endpoint}/${e.target.dataset.id}`, { method: 'DELETE' });
            location.reload();
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
            await fetchApi(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payloadFn()) });
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

const renderCourseRow = c => `<tr><td>${c._id}</td><td>${c.course_name}</td><td>${c.course_type||'-'}</td><td>${c.lectures_per_week||0}</td><td>${c.tutorials_per_week||0}</td><td>${c.practicals_per_week||0}</td><td>${c.credits||0}</td><td><button class="action-btn-table edit" data-id="${c._id}">Edit</button><button class="action-btn-table delete" data-id="${c._id}">Delete</button></td></tr>`;
const renderSectionRow = s => `<tr><td>${s._id}</td><td>${s.department}</td><td>${s.semester}</td><td>${s.size||'-'}</td><td><button class="action-btn-table edit" data-id="${s._id}">Edit</button><button class="action-btn-table delete" data-id="${s._id}">Delete</button></td></tr>`;
const renderUserRow = u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.profileId||u.usn||'-'}</td><td><button class="delete action-btn-table" data-id="${u._id}">Delete</button></td></tr>`;
const renderRoomRow = r => `<tr><td>${r._id}</td><td>${r.capacity}</td><td>${r.type}</td><td><button class="delete action-btn-table" data-id="${r._id}">Delete</button></td></tr>`;
const renderFacultyRow = f => `<tr><td>${f.name}</td><td>${f.email}</td><td>${f.department}</td><td>${f.facultyId||'-'}</td><td><button class="delete action-btn-table" data-id="${f._id}">Delete</button></td></tr>`;

function openEditCourseModal(course) {
    document.getElementById('courseName').value = course.course_name;
    document.getElementById('courseType').value = course.course_type;
    document.getElementById('lectures_per_week').value = course.lectures_per_week;
    document.getElementById('tutorials_per_week').value = course.tutorials_per_week;
    document.getElementById('practicals_per_week').value = course.practicals_per_week;
    document.getElementById('courseCredits').value = course.credits;
    const modal = document.getElementById('courseModal');
    if(modal) modal.style.display = 'block';
}

function openEditSectionModal(section) {
    document.getElementById('sectionName').value = section.section_name;
    document.getElementById('sectionDept').value = section.department;
    document.getElementById('sectionSem').value = section.semester;
    document.getElementById('sectionSize').value = section.size;
    const modal = document.getElementById('sectionModal');
    if(modal) modal.style.display = 'block';
}

function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;
    const times = ['08:30', '09:30', '10:30', '10:45', '11:45', '12:45', '13:30', '14:30', '15:30'];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    const ySel = document.getElementById('year-select');
    const sSel = document.getElementById('semester-select');
    let validBatches = null;
    
    if (ySel && sSel && (ySel.value !== 'all' || sSel.value !== 'all')) {
         validBatches = window.allSections.filter(b => (ySel.value === 'all' || String(Math.ceil(b.semester/2)) === ySel.value) && (sSel.value === 'all' || String(b.semester) === sSel.value)).map(b => b._id);
    }

    tbody.innerHTML = times.map(time => {
        if(time === '10:30') return `<tr><td class="time-cell">${time}</td><td colspan="6" class="break-slot">Tea Break</td></tr>`;
        if(time === '12:45') return `<tr><td class="time-cell">${time}</td><td colspan="6" class="break-slot">Lunch Break</td></tr>`;

        const cells = days.map(day => {
            const slots = (data[day] && data[day][time]) || [];
            let displaySlots = validBatches ? slots.filter(s => validBatches.includes(s.section)) : slots;
            return `<td>${displaySlots.map(s => `<div class="timetable-slot"><strong>${s.course}</strong><br>${s.faculty}<br><small>${s.room} (${s.section})</small></div>`).join('')}</td>`;
        }).join('');
        return `<tr><td class="time-cell">${time}</td>${cells}</tr>`;
    }).join('');
}

function populateFilters() {
    const ySel = document.getElementById('year-select');
    const sSel = document.getElementById('semester-select');
    if(!ySel) return;
    const years = new Set(), sems = new Set();
    window.allSections.forEach(s => { sems.add(s.semester); years.add(Math.ceil(s.semester/2)); });
    ySel.innerHTML = '<option value="all">All Years</option>' + [...years].sort().map(y => `<option value="${y}">Year ${y}</option>`).join('');
    sSel.innerHTML = '<option value="all">All Semesters</option>' + [...sems].sort().map(s => `<option value="${s}">Semester ${s}</option>`).join('');
    ySel.addEventListener('change', async () => { const t = await fetchApi('/timetable'); populateTimetable(t.data); });
    sSel.addEventListener('change', async () => { const t = await fetchApi('/timetable'); populateTimetable(t.data); });
}

async function renderSectionSelector() {
    const container = document.querySelector('.timetable-container');
    const sections = await fetchApi('/sections');
    container.innerHTML = `
        <div style="padding: 40px; text-align: center; background: var(--color-bg-content); border-radius: 8px;">
            <h2>Select Your Class</h2>
            <select id="studentBatchSelect" class="form-group" style="padding: 10px; width: 200px; margin-bottom: 15px;">
                <option value="">Choose Batch...</option>
                ${sections.map(s => `<option value="${s._id}">${s._id}</option>`).join('')}
            </select><br>
            <button onclick="saveStudentSection()" class="action-btn publish-btn">Join Class</button>
        </div>`;
}
window.saveStudentSection = async () => {
    const batch = document.getElementById('studentBatchSelect').value;
    if(!batch) return alert("Please select a batch");
    let user = JSON.parse(localStorage.getItem('timetableUser'));
    user.profileId = batch; 
    localStorage.setItem('timetableUser', JSON.stringify(user));
    location.reload();
};

function startRealTimeClock(timetableData, user) {
    const timeEl = document.getElementById('liveTime');
    const dateEl = document.getElementById('liveDate');
    const classEl = document.getElementById('currentClassInfo');
    const roomEl = document.getElementById('currentRoomInfo');
    if (!timeEl) return;

    function update() {
        const now = new Date();
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const today = days[now.getDay()];
        
        timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        dateEl.textContent = `${today}, ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

        if (!timetableData || !timetableData[today]) {
            if(classEl) classEl.textContent = "System Active";
            return;
        }
        
        // Simple logic to find current class based on time
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTimeVal = currentHour * 60 + currentMin;
        let found = false;

        for (const startTimeStr in timetableData[today]) {
            const [h, m] = startTimeStr.split(':').map(Number);
            const slotStartVal = h * 60 + m;
            const slotEndVal = slotStartVal + 60; // 1 hour slots
            
            if (currentTimeVal >= slotStartVal && currentTimeVal < slotEndVal) {
                const classes = timetableData[today][startTimeStr];
                let myClass = null;
                if (user.role === 'student') myClass = classes.find(c => c.section === user.profileId);
                else if (user.role === 'faculty') myClass = classes.find(c => c.facultyId === user.profileId || c.faculty === user.name);
                
                if (myClass) {
                    if(classEl) classEl.textContent = myClass.course;
                    if(roomEl) roomEl.textContent = `Room: ${myClass.room}`;
                    found = true;
                }
                break;
            }
        }
        if (!found && classEl && user.role !== 'admin') {
            classEl.textContent = "Free Period";
            if(roomEl) roomEl.textContent = "";
        }
    }
    setInterval(update, 1000);
    update();
}