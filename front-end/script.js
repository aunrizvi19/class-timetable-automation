const API_BASE = '/api'; 

async function fetchApi(endpoint, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Request Error');
        return data;
    } catch (err) {
        console.error(err);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // 1. AUTHENTICATION
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

        document.getElementById('showSignup').addEventListener('click', (e) => { e.preventDefault(); signupToggle.click(); });
        document.getElementById('showLogin').addEventListener('click', (e) => { e.preventDefault(); loginToggle.click(); });

        const signupRole = document.getElementById('signupRole');
        if (signupRole) {
            signupRole.addEventListener('change', () => {
                const role = signupRole.value;
                document.getElementById('studentFields').style.display = (role === 'student') ? 'block' : 'none';
                document.getElementById('facultyFields').style.display = (role === 'faculty') ? 'block' : 'none';
            });
        }
    }

    // Login
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            errorEl.textContent = "Logging in...";
            
            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                
                localStorage.setItem('timetableUser', JSON.stringify(data.user));
                window.location.href = data.user.role === 'admin' ? 'dashboard.html' : 
                                       data.user.role === 'faculty' ? 'faculty-dashboard.html' : 
                                       'student-dashboard.html';
            } catch(err) {
                errorEl.textContent = err.message;
            }
        });
    }

    // Signup
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

    // 2. GLOBAL INIT
    if (!document.body.classList.contains('login-page')) {
        const user = JSON.parse(localStorage.getItem('timetableUser'));
        if (!user) { window.location.href = 'login.html'; return; }

        const header = document.querySelector('.dashboard-header') || document.getElementById('welcomeHeader');
        if(header) header.textContent = `Welcome, ${user.name}!`;

        document.querySelectorAll('#logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('timetableUser');
                window.location.href = 'login.html';
            });
        });

        loadPageData(user);
    }
});

// 3. DATA LOADERS
async function loadPageData(user) {
    // Admin Dashboard
    if (document.body.classList.contains('admin-page')) {
        if(document.getElementById('totalCoursesStat')) {
            const [c, f, r, t] = await Promise.all([
                fetchApi('/courses'), fetchApi('/faculty'), fetchApi('/rooms'), fetchApi('/timetable')
            ]);
            document.getElementById('totalCoursesStat').textContent = c ? c.length : 0;
            document.getElementById('totalFacultyStat').textContent = f ? f.length : 0;
            document.getElementById('totalRoomsStat').textContent = r ? r.length : 0;
            if(t && t.data) updateLiveStatus(t.data);
        }
        
        // Load Tables
        if(document.getElementById('usersTableBody')) loadTable('users', renderUserRow);
        if(document.querySelector('.courses-page tbody')) loadTable('courses', renderCourseRow);
        if(document.querySelector('.rooms-page tbody')) loadTable('rooms', renderRoomRow);
        if(document.querySelector('.sections-page tbody')) loadTable('sections', renderSectionRow);
        if(document.querySelector('.faculty-page tbody')) loadTable('faculty', renderFacultyRow);

        setupAddButtons();
    }

    // Student View
    if (document.body.classList.contains('student-page')) {
        // Check if student has a profileId (Batch), if not show selector
        if (!user.profileId) {
            renderSectionSelector();
        } else {
            if (document.getElementById('studentSectionStat')) document.getElementById('studentSectionStat').textContent = user.profileId;
            const t = await fetchApi(`/timetable/section/${user.profileId}`);
            if (t && t.data) populateTimetable(t.data);
        }
    }

    // Faculty View
    if (document.body.classList.contains('faculty-page') && !document.body.classList.contains('admin-page')) {
        const t = await fetchApi(`/timetable/faculty/${user.profileId}`);
        if (t && t.data) {
            populateTimetable(t.data);
            let h = 0;
            Object.values(t.data).forEach(d => Object.values(d).forEach(s => s.forEach(slot => h += (slot.duration||1))));
            if(document.getElementById('totalHoursStat')) document.getElementById('totalHoursStat').textContent = h;
        }
    }
    
    // Timetable Page
    if (document.body.classList.contains('timetable-page')) {
        const t = await fetchApi('/timetable');
        const sections = await fetchApi('/sections');
        window.allSections = sections || [];
        if (t && t.data) {
            populateTimetable(t.data);
            if(user.role === 'admin') populateFilters();
        }
    }
    
    // Generate Button
    const genBtn = document.querySelector('.generate-btn');
    if(genBtn) {
        genBtn.addEventListener('click', async () => {
            if(confirm("Generate new timetable?")) {
                genBtn.textContent = "Working...";
                await fetchApi('/timetable/generate', { method: 'POST' });
                location.reload();
            }
        });
    }
}

// Section Selector (for new Students)
async function renderSectionSelector() {
    const container = document.querySelector('.timetable-container');
    const sections = await fetchApi('/sections');
    
    container.innerHTML = `
        <div style="padding: 40px; text-align: center; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2>Select Your Class</h2>
            <p style="margin-bottom: 20px; color: #666;">You haven't joined a class section yet.</p>
            <select id="studentBatchSelect" style="padding: 10px; width: 200px; margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Choose Batch...</option>
                ${sections.map(s => `<option value="${s._id}">${s._id}</option>`).join('')}
            </select>
            <br>
            <button onclick="saveStudentSection()" class="action-btn publish-btn">Join Class</button>
        </div>
    `;
}
window.saveStudentSection = async () => {
    const batch = document.getElementById('studentBatchSelect').value;
    if(!batch) return alert("Please select a batch");
    
    // Save locally and reload (In a real app, save to DB via API call here)
    let user = JSON.parse(localStorage.getItem('timetableUser'));
    user.profileId = batch; 
    localStorage.setItem('timetableUser', JSON.stringify(user));
    location.reload();
};

// CRUD Helpers
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
}

function setupAddButtons() {
    const bind = (id, url, payload) => {
        const form = document.getElementById(id);
        if(form) form.addEventListener('submit', async(e) => {
            e.preventDefault();
            await fetchApi(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload()) });
            location.reload();
        });
    };
    bind('courseForm', '/courses', () => ({
        course_name: document.getElementById('courseName').value,
        course_type: document.getElementById('courseType').value,
        lectures_per_week: document.getElementById('lectures_per_week').value,
        credits: document.getElementById('courseCredits').value
    }));
    bind('roomForm', '/rooms', () => ({
        roomNumber: document.getElementById('roomNumber').value,
        capacity: document.getElementById('roomCapacity').value,
        type: document.getElementById('roomType').value
    }));
    bind('sectionForm', '/sections', () => ({
        section_name: document.getElementById('sectionName').value,
        department: document.getElementById('sectionDept').value,
        semester: document.getElementById('sectionSem').value
    }));
    bind('facultyForm', '/faculty', () => ({
        name: document.getElementById('facultyName').value,
        email: document.getElementById('facultyEmail').value,
        facultyId: document.getElementById('facultyId').value,
        department: document.getElementById('facultyDept').value
    }));
}

// Renderers
const renderUserRow = u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.profileId||u.usn||'-'}</td><td><button class="delete action-btn-table" data-id="${u._id}">Delete</button></td></tr>`;
const renderCourseRow = c => `<tr><td>${c._id}</td><td>${c.course_name}</td><td>${c.course_type}</td><td>${c.lectures_per_week}</td><td>${c.credits}</td><td><button class="delete action-btn-table" data-id="${c._id}">Delete</button></td></tr>`;
const renderRoomRow = r => `<tr><td>${r._id}</td><td>${r.capacity}</td><td>${r.type}</td><td><button class="delete action-btn-table" data-id="${r._id}">Delete</button></td></tr>`;
const renderSectionRow = s => `<tr><td>${s._id}</td><td>${s.department}</td><td>${s.semester}</td><td><button class="delete action-btn-table" data-id="${s._id}">Delete</button></td></tr>`;
const renderFacultyRow = f => `<tr><td>${f.name}</td><td>${f.email}</td><td>${f.department}</td><td>${f.facultyId||'-'}</td><td><button class="delete action-btn-table" data-id="${f._id}">Delete</button></td></tr>`;

function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;
    const times = ['08:30', '09:30', '10:30', '10:45', '11:45', '12:45', '13:30', '14:30', '15:30'];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // Filters
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

            return `<td>${displaySlots.map(s => 
                `<div class="timetable-slot"><strong>${s.course}</strong><br>${s.faculty}<br><small>${s.room} (${s.section})</small></div>`
            ).join('')}</td>`;
        }).join('');
        return `<tr><td class="time-cell">${time}</td>${cells}</tr>`;
    }).join('');
}

function updateLiveStatus(data) {
    const list = document.getElementById('activeFacultyList');
    if(!list) return;
    const today = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
    const active = new Set();
    if (data[today]) Object.values(data[today]).forEach(slots => slots.forEach(s => active.add(s.faculty)));
    list.innerHTML = active.size ? [...active].map(n => `<span class="status-badge status-active">🟢 ${n}</span>`).join('') : "No active classes";
}

function populateFilters() {
    const ySel = document.getElementById('year-select');
    const sSel = document.getElementById('semester-select');
    if(!ySel) return;
    const years = new Set(), sems = new Set();
    window.allSections.forEach(s => { sems.add(s.semester); years.add(Math.ceil(s.semester/2)); });
    ySel.innerHTML = '<option value="all">All Years</option>' + [...years].sort().map(y => `<option value="${y}">Year ${y}</option>`).join('');
    sSel.innerHTML = '<option value="all">All Semesters</option>' + [...sems].sort().map(s => `<option value="${s}">Semester ${s}</option>`).join('');
    ySel.addEventListener('change', () => populateTimetable(currentTimetableData));
    sSel.addEventListener('change', () => populateTimetable(currentTimetableData));
}