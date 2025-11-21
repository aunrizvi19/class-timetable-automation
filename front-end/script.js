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

    // --- 0. GLOBAL DARK MODE INIT ---
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

    // --- 1. AUTHENTICATION CHECKS ---
    const user = JSON.parse(localStorage.getItem('timetableUser'));
    const isAuthPage = document.body.classList.contains('login-page');

    if (!isAuthPage) {
        if (!user) { 
            window.location.href = 'login.html'; 
            return; 
        }

        // DYNAMIC BODY CLASS FOR SIDEBAR VISIBILITY
        // This fixes the issue where sidebar items were hidden on the Timetable page
        document.body.classList.remove('admin-page', 'faculty-page', 'student-page');
        if(user.role === 'admin') document.body.classList.add('admin-page');
        if(user.role === 'faculty') document.body.classList.add('faculty-page');
        if(user.role === 'student') document.body.classList.add('student-page');

        // Update Header
        const header = document.querySelector('.dashboard-header') || document.getElementById('welcomeHeader');
        if(header) header.textContent = `Welcome, ${user.name}!`;

        // Logout
        document.querySelectorAll('#logoutBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('timetableUser');
                window.location.href = 'login.html';
            });
        });

        loadPageData(user);
    }

    // Login Form Logic
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const loginToggle = document.getElementById('loginToggle');
        const signupToggle = document.getElementById('signupToggle');
        const signupForm = document.getElementById('signupForm');

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

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('loginIdentifier').value;
            const password = document.getElementById('loginPassword').value;
            
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
                document.getElementById('loginError').textContent = err.message;
            }
        });

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
                if(!res.ok) throw new Error((await res.json()).message);
                alert("Account created! Please login.");
                location.reload();
            } catch(err) {
                document.getElementById('signupError').textContent = err.message;
            }
        });
    }
});

// 3. DATA LOADERS
async function loadPageData(user) {
    // Admin & Faculty Shared Logic (Courses, Rooms, etc.)
    if (document.querySelector('.courses-page tbody')) loadTable('courses', renderCourseRow);
    if (document.querySelector('.rooms-page tbody')) loadTable('rooms', renderRoomRow);
    if (document.querySelector('.sections-page tbody')) loadTable('sections', renderSectionRow);
    if (document.querySelector('.faculty-page tbody')) loadTable('faculty', renderFacultyRow);
    if (document.getElementById('usersTableBody')) loadTable('users', renderUserRow);

    // Admin Dashboard Stats
    if (document.getElementById('totalCoursesStat')) {
        const [c, f, r] = await Promise.all([
            fetchApi('/courses'), fetchApi('/faculty'), fetchApi('/rooms')
        ]);
        document.getElementById('totalCoursesStat').textContent = c ? c.length : 0;
        document.getElementById('totalFacultyStat').textContent = f ? f.length : 0;
        document.getElementById('totalRoomsStat').textContent = r ? r.length : 0;
    }

    // Timetable Page
    if (document.body.classList.contains('timetable-page')) {
        const t = await fetchApi('/timetable');
        const sections = await fetchApi('/sections');
        window.allSections = sections || [];
        if (t && t.data) populateTimetable(t.data);
        
        // Show filters only for Admin
        if(user.role === 'admin') populateFilters();
    }
    
    // Student Dashboard
    if (document.body.classList.contains('student-page')) {
         if (!user.profileId) {
             renderSectionSelector();
         } else {
             if (document.getElementById('studentSectionStat')) document.getElementById('studentSectionStat').textContent = user.profileId;
             const t = await fetchApi(`/timetable/section/${user.profileId}`);
             if (t && t.data) populateTimetable(t.data);
         }
    }

    // Faculty Dashboard
    if (document.body.classList.contains('faculty-page') && !document.body.classList.contains('admin-page')) {
        const t = await fetchApi(`/timetable/faculty/${user.profileId}`);
        if (t && t.data) populateTimetable(t.data);
        // Add dept info if needed
        if(document.getElementById('facultyDeptStat')) document.getElementById('facultyDeptStat').textContent = user.department || "CSE";
    }

    // Generate Button
    const genBtn = document.querySelector('.generate-btn');
    if(genBtn) {
        genBtn.addEventListener('click', async () => {
            if(confirm("Generate new timetable? This will overwrite the existing one.")) {
                genBtn.textContent = "Generating...";
                await fetchApi('/timetable/generate', { method: 'POST' });
                location.reload();
            }
        });
    }
}

// CRUD Helper
async function loadTable(endpoint, renderFn) {
    const data = await fetchApi(`/${endpoint}`);
    const tbody = document.querySelector('tbody');
    if(!tbody || !data) return;
    tbody.innerHTML = data.map(renderFn).join('');
    
    // Attach Delete Events
    tbody.querySelectorAll('.delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if(!confirm("Delete this item?")) return;
            await fetchApi(`/${endpoint}/${e.target.dataset.id}`, { method: 'DELETE' });
            location.reload();
        });
    });

    // Attach Edit Events
    tbody.querySelectorAll('.edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = data.find(i => i._id === e.target.dataset.id);
            if(endpoint === 'courses') openEditCourseModal(item);
            if(endpoint === 'sections') openEditSectionModal(item);
        });
    });
}

// --- RENDERERS (Updated with L/T/P and Edit buttons) ---

const renderCourseRow = c => `
<tr>
    <td>${c._id}</td>
    <td>${c.course_name}</td>
    <td>${c.course_type || '-'}</td>
    <td>${c.lectures_per_week || 0}</td>
    <td>${c.tutorials_per_week || 0}</td>
    <td>${c.practicals_per_week || 0}</td>
    <td>${c.credits || 0}</td>
    <td>
        <button class="action-btn-table edit" data-id="${c._id}">Edit</button>
        <button class="action-btn-table delete" data-id="${c._id}">Delete</button>
    </td>
</tr>`;

const renderSectionRow = s => `
<tr>
    <td>${s._id}</td>
    <td>${s.department}</td>
    <td>${s.semester}</td>
    <td>${s.size}</td>
    <td>
        <button class="action-btn-table edit" data-id="${s._id}">Edit</button>
        <button class="action-btn-table delete" data-id="${s._id}">Delete</button>
    </td>
</tr>`;

const renderUserRow = u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td><td>${u.profileId||u.usn||'-'}</td><td><button class="delete action-btn-table" data-id="${u._id}">Delete</button></td></tr>`;
const renderRoomRow = r => `<tr><td>${r._id}</td><td>${r.capacity}</td><td>${r.type}</td><td><button class="delete action-btn-table" data-id="${r._id}">Delete</button></td></tr>`;
const renderFacultyRow = f => `<tr><td>${f.name}</td><td>${f.email}</td><td>${f.department}</td><td>${f.facultyId||'-'}</td><td><button class="delete action-btn-table" data-id="${f._id}">Delete</button></td></tr>`;


// --- EDIT MODAL LOGIC ---

function openEditCourseModal(course) {
    // You need to add a modal with ID 'editCourseModal' to courses.html first
    // This is a placeholder prompt for now if modal isn't added
    // Ideally, replicate the Add Course form into a Modal
    alert(`Edit functionality coming for: ${course.course_name}. (Add 'editCourseModal' to HTML)`);
}

function openEditSectionModal(section) {
    alert(`Edit functionality coming for: ${section.section_name}. (Add 'editSectionModal' to HTML)`);
}

// --- TIMETABLE LOGIC ---
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

            return `<td>${displaySlots.map(s => 
                `<div class="timetable-slot"><strong>${s.course}</strong><br>${s.faculty}<br><small>${s.room} (${s.section})</small></div>`
            ).join('')}</td>`;
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
}