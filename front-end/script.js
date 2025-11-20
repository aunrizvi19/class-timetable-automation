// =================================================================
// == GLOBAL VARIABLES & CACHE
// =================================================================
let allCourses = [];
let allFaculty = [];
let allRooms = [];
let allSections = []; // Now represents "Batches" from seed data
let currentTimetableData = {}; // Holds the raw data from the server

document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // == 1. AUTHENTICATION & PAGE PROTECTION
    // =================================================================
    const user = JSON.parse(localStorage.getItem('timetableUser'));
    const bodyClass = document.body.classList;
    const isLoginPage = bodyClass.contains('login-page');

    // --- Apply Role-Based CSS Classes ---
    if (user && !isLoginPage) {
        if (user.role === 'admin') document.body.classList.add('role-admin');
        else if (user.role === 'faculty') document.body.classList.add('role-faculty');
        else if (user.role === 'student') document.body.classList.add('role-student');
    }
    
    // --- Redirect Logic ---
    if (isLoginPage) {
        if (user) {
            redirectToDashboard(user.role);
            return;
        }
    } else {
        if (!user) {
            alert('You must be logged in to view this page.');
            window.location.href = 'login.html';
            return;
        }
        // Page Access Control
        if (bodyClass.contains('admin-page') && user.role !== 'admin') {
            alert('Access Denied: Admins only.');
            redirectToDashboard(user.role);
            return;
        }
        if (bodyClass.contains('faculty-page') && user.role !== 'faculty' && user.role !== 'admin') {
            alert('Access Denied.');
            redirectToDashboard(user.role);
            return;
        }
        if (bodyClass.contains('student-page') && user.role !== 'student' && user.role !== 'admin') {
            alert('Access Denied.');
            redirectToDashboard(user.role);
            return;
        }
    }
    
    function redirectToDashboard(role) {
        if (role === 'admin') window.location.href = 'dashboard.html';
        else if (role === 'faculty') window.location.href = 'faculty-dashboard.html';
        else if (role === 'student') window.location.href = 'student-dashboard.html';
        else window.location.href = 'login.html';
    }

    // =================================================================
    // == 2. GLOBAL UI (Sidebar, Logout, Theme)
    // =================================================================
    
    // Sidebar Toggle
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        document.body.classList.add('sidebar-collapsed');
    }
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarCollapsed', document.body.classList.contains('sidebar-collapsed'));
        });
    }
    
    // Logout
    document.querySelectorAll('#logoutBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('timetableUser');
            localStorage.removeItem('sidebarCollapsed');
            localStorage.removeItem('darkMode');
            alert('Logged out successfully.');
            window.location.href = 'login.html';
        });
    });

    // Theme Toggle
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) document.body.classList.add('dark-mode');
    
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        themeToggleBtn.textContent = isDarkMode ? '☀️' : '🌙';
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        });
    }

    const darkModeToggleSettings = document.getElementById('darkModeToggle');
    if (darkModeToggleSettings) darkModeToggleSettings.checked = isDarkMode;


    // =================================================================
    // == 3. DASHBOARDS & LIVE STATUS
    // =================================================================
    
    // --- FACULTY / STUDENT DASHBOARD ---
    if (user && (bodyClass.contains('student-page') || bodyClass.contains('faculty-page'))) {
        const welcomeHeader = document.getElementById('welcomeHeader');
        if (welcomeHeader) welcomeHeader.textContent = `Welcome back, ${user.name}!`;
        
        const studentSectionStat = document.getElementById('studentSectionStat');
        if (studentSectionStat && user.role === 'student') {
            studentSectionStat.textContent = user.profileId || 'N/A';
        }

        async function loadPersonalTimetable() {
            if (!user.profileId) return; 
            
            let url = '';
            if (user.role === 'student') url = `/api/timetable/section/${user.profileId}`;
            else if (user.role === 'faculty') url = `/api/timetable/faculty/${user.profileId}`;

            const result = await fetchApi(url);
            if (result && result.data) {
                currentTimetableData = result.data;
                populateTimetable(result.data); // Render grid

                // Calculate Stats
                let totalHours = 0;
                const data = result.data;
                for (const day in data) {
                    for (const time in data[day]) {
                        const slots = data[day][time] || [];
                        slots.forEach(slot => {
                            totalHours += (slot.duration || 1);
                        });
                    }
                }
                
                const totalClassesStat = document.getElementById('totalClassesStat');
                if (totalClassesStat) totalClassesStat.textContent = totalHours;
                
                const totalHoursStat = document.getElementById('totalHoursStat');
                if (totalHoursStat) totalHoursStat.textContent = totalHours;

                if (user.role === 'faculty') {
                    const facultyData = await fetchApi('/api/faculty');
                    if (facultyData) {
                        const me = facultyData.find(f => f._id === user.profileId);
                        if(me) {
                            const facultyDeptStat = document.getElementById('facultyDeptStat');
                            if(facultyDeptStat) facultyDeptStat.textContent = me.department || 'N/A';
                        }
                    }
                }
            }
        }
        loadPersonalTimetable();
    }

    // --- ADMIN DASHBOARD (Live Status) ---
    const occupancyChartCanvas = document.getElementById('occupancyChart');
    if (occupancyChartCanvas && user && user.role === 'admin') {
        if(user.name) document.querySelector('.dashboard-header').textContent = `Welcome, ${user.name}!`;

        async function loadDashboardStats() {
            try {
                const [courses, faculty, rooms, timetable] = await Promise.all([
                    fetchCourses(), fetchFaculty(), fetchRooms(), fetchTimetableData()
                ]);
                
                if (courses) document.getElementById('totalCoursesStat').textContent = courses.length;
                if (faculty) document.getElementById('totalFacultyStat').textContent = faculty.length;
                if (rooms) document.getElementById('totalRoomsStat').textContent = rooms.length;

                // Occupancy Chart
                const roomTypeCounts = {};
                if (rooms) rooms.forEach(r => roomTypeCounts[r.type] = (roomTypeCounts[r.type] || 0) + 1);
                
                new Chart(occupancyChartCanvas.getContext('2d'), { 
                    type: 'bar', 
                    data: { 
                        labels: Object.keys(roomTypeCounts).length ? Object.keys(roomTypeCounts) : ['No Data'],
                        datasets: [{ 
                            label: 'Rooms', 
                            data: Object.values(roomTypeCounts).length ? Object.values(roomTypeCounts) : [0], 
                            backgroundColor: '#36a2eb' 
                        }] 
                    } 
                });

                // Live Status Logic
                const activeFacultyList = document.getElementById('activeFacultyList');
                if (activeFacultyList && timetable && timetable.data) {
                    updateLiveTeachers(timetable.data);
                    // Optional: Refresh every minute
                    setInterval(() => updateLiveTeachers(timetable.data), 60000);
                }

            } catch (e) { console.error(e); }
        }

        function updateLiveTeachers(data) {
            const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const now = new Date();
            const currentDay = DAYS[now.getDay()];
            const currentHour = now.getHours();
            const currentMin = now.getMinutes();
            
            // Helper: Convert HH:MM to minutes from midnight
            const getMins = (t) => parseInt(t.split(':')[0])*60 + parseInt(t.split(':')[1]);
            const nowMins = currentHour * 60 + currentMin;

            let activeNames = new Set();
            
            if (data[currentDay]) {
                for (const slotTime in data[currentDay]) {
                    const slotStartMins = getMins(slotTime);
                    const slots = data[currentDay][slotTime] || [];
                    
                    slots.forEach(s => {
                        const durationMins = (s.duration || 1) * 60;
                        // Check if current time is within this slot's duration
                        if (nowMins >= slotStartMins && nowMins < (slotStartMins + durationMins)) {
                            activeNames.add(s.faculty);
                        }
                    });
                }
            }

            const listEl = document.getElementById('activeFacultyList');
            listEl.innerHTML = '';
            if (activeNames.size === 0) {
                // Format time nicely
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                listEl.innerHTML = `<span style="color:gray; font-style: italic;">No active classes at ${timeStr} (${currentDay})</span>`;
            } else {
                activeNames.forEach(name => {
                    const badge = document.createElement('span');
                    badge.style.cssText = "background:#d4edda; color:#155724; padding:5px 12px; border-radius:20px; font-size:0.85em; border:1px solid #c3e6cb; display:inline-block;";
                    badge.textContent = `🟢 ${name}`;
                    listEl.appendChild(badge);
                });
            }
        }

        loadDashboardStats();
    }


    // =================================================================
    // == 4. GLOBAL TIMETABLE LOADER (Admin/Shared View)
    // =================================================================
    
    async function loadTimetable() {
        const timetableDoc = await fetchTimetableData();
        if(timetableDoc && timetableDoc.data) {
            currentTimetableData = timetableDoc.data; 
            populateTimetable(currentTimetableData);
        } else {
            currentTimetableData = {};
            populateTimetable(null);
            if (document.querySelector('.generate-btn') && user && user.role === 'admin') {
                alert("No timetable found. Please generate one.");
            }
        }
    }


    // =================================================================
    // == 5. ADMIN TIMETABLE PAGE LOGIC (index.html)
    // =================================================================
    
    const generateBtn = document.querySelector('.generate-btn');
    const yearSelect = document.getElementById('year-select');
    const semesterSelect = document.getElementById('semester-select');

    if (generateBtn) { // We are on index.html
        if (user && user.role !== 'admin') {
            const headerActions = document.querySelector('.header-actions');
            if(headerActions) headerActions.style.display = 'none';
        }

        async function loadModalData() {
            try {
                const [courses, faculty, rooms, sections] = await Promise.all([
                    fetchCourses(), fetchFaculty(), fetchRooms(), fetchSections()
                ]);
                allCourses = courses || [];
                allFaculty = faculty || [];
                allRooms = rooms || [];
                allSections = sections || []; // Note: 'sections' API returns Batches now

                populateFilters(); // Fill Year/Sem dropdowns

            } catch (e) { console.error("Error loading modal data:", e); }
        }
        
        loadModalData(); 
        loadTimetable();
        
        generateBtn.addEventListener('click', async () => {
            if (!confirm("Generate new timetable? This will overwrite existing data.")) return;
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            try {
                const res = await fetch('http://localhost:3000/api/timetable/generate', { method: 'POST' });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                alert('New timetable generated!');
                currentTimetableData = result.data;
                populateTimetable(currentTimetableData);
            } catch (error) { alert(`Error: ${error.message}`); }
            finally { generateBtn.disabled = false; generateBtn.textContent = 'Generate New Timetable'; }
        });

        // Listen for filter changes
        if (yearSelect) yearSelect.addEventListener('change', () => populateTimetable(currentTimetableData));
        if (semesterSelect) semesterSelect.addEventListener('change', () => populateTimetable(currentTimetableData));
    }

    // Populate the new dropdown filters based on actual data
    function populateFilters() {
        if (!yearSelect || !semesterSelect) return;

        const uniqueYears = new Set();
        const uniqueSems = new Set();

        allSections.forEach(batch => {
            if (batch.semester) {
                uniqueSems.add(batch.semester);
                // Calculate year from semester (1,2->1, 3,4->2, etc)
                const yr = Math.ceil(batch.semester / 2);
                uniqueYears.add(yr);
            }
        });

        // Reset and populate Year
        yearSelect.innerHTML = '<option value="all">All Years</option>';
        [...uniqueYears].sort().forEach(y => {
            yearSelect.innerHTML += `<option value="${y}">Year ${y}</option>`;
        });

        // Reset and populate Semester
        semesterSelect.innerHTML = '<option value="all">All Semesters</option>';
        [...uniqueSems].sort().forEach(s => {
            semesterSelect.innerHTML += `<option value="${s}">Semester ${s}</option>`;
        });
    }


    // --- TIMETABLE EDIT MODAL ---
    const timetableModal = document.getElementById('editModal');
    if (timetableModal) {
        const closeButton = timetableModal.querySelector('.close-button');
        const closeModal = () => timetableModal.style.display = 'none';
        closeButton.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == timetableModal) closeModal(); });
        
        const editSlotForm = document.getElementById('editSlotForm');
        editSlotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const slotData = {
                day: document.getElementById('editSlotDay').value,
                time: document.getElementById('editSlotTime').value,
                sectionId: document.getElementById('editSlotSectionId').value,
                courseId: document.getElementById('editCourse').value,
                facultyId: document.getElementById('editFaculty').value,
                roomId: document.getElementById('editRoom').value,
                batch: document.getElementById('editBatch').value
            };
            try {
                const res = await fetch('http://localhost:3000/api/timetable/update-slot', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(slotData)
                });
                if(!res.ok) throw new Error((await res.json()).message);
                alert('Updated!'); closeModal(); 
                loadTimetable(); 
            } catch(e) { alert(e.message); }
        });

        const deleteSlotBtn = document.getElementById('deleteSlotBtn');
        deleteSlotBtn.addEventListener('click', async () => {
            if(!confirm("Delete slot?")) return;
            const slotData = {
                day: document.getElementById('editSlotDay').value,
                time: document.getElementById('editSlotTime').value,
                sectionId: document.getElementById('editSlotSectionId').value
            };
            try {
                const res = await fetch('http://localhost:3000/api/timetable/delete-slot', {
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(slotData)
                });
                if(!res.ok) throw new Error((await res.json()).message);
                alert('Deleted!'); closeModal(); 
                loadTimetable(); 
            } catch(e) { alert(e.message); }
        });
    }

    // --- CRUD PAGES --- (Generic logic for managing data tables)
    // Only loaded if elements exist on the specific page
    
    const courseModal = document.getElementById('courseModal'); // Works for Subjects now
    if (courseModal) {
        async function reloadCourses() { const data = await fetchCourses(); renderCoursesTable(data); }
        reloadCourses();
        // (Keeping standard CRUD logic implied, referencing global renderers)
    }

    const sectionModal = document.getElementById('sectionModal'); // Works for Batches
    if (sectionModal) {
        async function reloadSections() { 
            const data = await fetchSections(); 
            allSections = data || []; 
            renderSectionsTable(data); 
        }
        reloadSections();
    }

    // --- USERS PAGE ---
    const usersTableBody = document.getElementById('usersTableBody');
    if (usersTableBody) {
        async function loadAndRenderUsers() {
            const users = await fetchUsers();
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">No users found.</td></tr>';
                return;
            }
            let html = '';
            users.forEach(u => {
                html += `
                    <tr data-email="${u._id}">
                        <td>${u.name || 'N/A'}</td>
                        <td>${u.email || u._id}</td>
                        <td>${u.role}</td>
                        <td>${u.profileId || 'N/A'}</td>
                        <td>
                            <button class="action-btn-table delete delete-user" ${u.role === 'admin' ? 'disabled' : ''}>Delete</button>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
        loadAndRenderUsers();
    }
    
    // --- LOGIN LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const signupForm = document.getElementById('signupForm');
        const showSignupLink = document.getElementById('showSignup');
        const showLoginLink = document.getElementById('showLogin');
        const loginToggle = document.getElementById('loginToggle');
        const signupToggle = document.getElementById('signupToggle');
        const formTitle = document.getElementById('formTitle');

        const showLogin = () => {
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            loginToggle.classList.add('active');
            signupToggle.classList.remove('active');
            formTitle.textContent = 'Login';
        };

        const showSignup = () => {
            loginForm.style.display = 'none';
            signupForm.style.display = 'block';
            loginToggle.classList.remove('active');
            signupToggle.classList.add('active');
            formTitle.textContent = 'Sign Up';
        };

        loginToggle.addEventListener('click', showLogin);
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
        signupToggle.addEventListener('click', showSignup);
        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); showSignup(); });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const errorEl = document.getElementById('loginError');
            errorEl.textContent = '';
            try {
                const res = await fetch('http://localhost:3000/api/login', { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email, password }) 
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                localStorage.setItem('timetableUser', JSON.stringify(data.user));
                redirectToDashboard(data.user.role);
            } catch(err) { errorEl.textContent = err.message; }
        });
    }

}); // <<< END of DOMContentLoaded

// =================================================================
// == 8. HELPER FUNCTIONS & RENDERERS
// =================================================================

async function fetchApi(url) {
    try {
        const res = await fetch(`http://localhost:3000${url}`);
        if(res.ok) return await res.json();
    } catch(e) { console.error(`Network error fetching ${url}:`, e); }
    return null;
}
async function fetchCourses() { return fetchApi('/api/courses'); }
async function fetchFaculty() { return fetchApi('/api/faculty'); }
async function fetchRooms() { return fetchApi('/api/rooms'); }
async function fetchSections() { return fetchApi('/api/sections'); }
async function fetchUsers() { return fetchApi('/api/users'); }
async function fetchSection(id) { return fetchApi(`/api/sections/${id}`); }
async function fetchTimetableData() { return fetchApi('/api/timetable'); }

// --- POPULATE TIMETABLE (Updated for Batch/Year/Sem Filtering) ---
function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;
    if (!data || Object.keys(data).length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7">No timetable data available.</td></tr>'; 
        return; 
    }

    // 1. Get Filter Values
    const yearVal = document.getElementById('year-select') ? document.getElementById('year-select').value : 'all';
    const semVal = document.getElementById('semester-select') ? document.getElementById('semester-select').value : 'all';
    
    // 2. Determine valid Sections (Batches) to display
    let visibleBatchIds = null; // null means show all

    if (yearVal !== 'all' || semVal !== 'all') {
        visibleBatchIds = allSections.filter(batch => {
            const batchSem = batch.semester;
            const batchYear = Math.ceil(batchSem / 2);
            
            const matchYear = (yearVal === 'all') || (String(batchYear) === yearVal);
            const matchSem = (semVal === 'all') || (String(batchSem) === semVal);
            
            return matchYear && matchSem;
        }).map(b => b._id);
    }

    const TIME_SLOTS_MAP = {
        '08:30': '08:30 - 09:30',
        '09:30': '09:30 - 10:30',
        '10:30': '10:30 - 10:45',
        '10:45': '10:45 - 11:45',
        '11:45': '11:45 - 12:45',
        '12:45': '12:45 - 13:30',
        '13:30': '13:30 - 14:30',
        '14:30': '14:30 - 15:30',
        '15:30': '15:30 - 16:30'
    };
    const lunchStart = '12:45';
    const teaStart = '10:30';
    
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let html = '';
    
    // Sort times including breaks
    const allTimeKeys = new Set(Object.keys(TIME_SLOTS_MAP));
    allTimeKeys.add(lunchStart);
    allTimeKeys.add(teaStart);
    const sortedTimeKeys = [...allTimeKeys].sort();

    sortedTimeKeys.forEach(time => {
        const timeLabel = TIME_SLOTS_MAP[time] || time;

        if (time === teaStart) {
            html += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" class="break-slot">Tea Break</td></tr>`;
            return;
        }
        if (time === lunchStart) {
            html += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" class="break-slot">Lunch Break</td></tr>`;
            return;
        }
        if (!TIME_SLOTS_MAP[time]) return; 

        html += `<tr><td class="time-cell">${timeLabel}</td>`;
        
        DAYS.forEach(day => {
            let cellContent = '';
            if (data[day] && data[day][time]) {
                let slots = data[day][time] || [];

                // Filter logic
                if (visibleBatchIds !== null) {
                    slots = slots.filter(s => visibleBatchIds.includes(s.section));
                }

                slots.forEach(slot => {
                    const batchText = slot.batch ? ` (${slot.batch})` : '';
                    const sectionText = slot.section ? ` (${slot.section})` : '';
                    cellContent += `
                        <div class="timetable-slot ${slot.conflict ? 'conflict' : ''}"
                             data-day="${day}" data-time="${time}" data-section="${slot.section}">
                            <strong>${slot.course}</strong>
                            <span>${slot.faculty}</span>
                            <em>${slot.room}${sectionText}${batchText}</em>
                        </div>
                    `;
                });
            }
            html += `<td>${cellContent || '<div class="free-slot">Free</div>'}</td>`;
        });
        html += '</tr>';
    });
    tbody.innerHTML = html;

    // Edit Handlers (Admin)
    if (document.body.classList.contains('role-admin')) {
        tbody.querySelectorAll('.timetable-slot').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = el.dataset.day;
                const time = el.dataset.time;
                const section = el.dataset.section;
                const allSlots = (currentTimetableData[day] && currentTimetableData[day][time]) || [];
                const slotData = allSlots.find(s => String(s.section) === String(section));
                if (slotData) openEditSlotModal(slotData, day, time);
            });
        });
    }
}

function openEditSlotModal(slotData, day, time) {
    const modal = document.getElementById('editModal');
    if (!modal) return;

    document.getElementById('editSlotDay').value = day;
    document.getElementById('editSlotTime').value = time;
    document.getElementById('editSlotSectionId').value = slotData.section;
    
    const cSelect = document.getElementById('editCourse');
    cSelect.innerHTML = '';
    allCourses.forEach(c => cSelect.innerHTML += `<option value="${c._id}" ${c.course_name === slotData.course ? 'selected' : ''}>${c.course_name}</option>`);
    
    const fSelect = document.getElementById('editFaculty');
    fSelect.innerHTML = '';
    allFaculty.forEach(f => fSelect.innerHTML += `<option value="${f._id}" ${f.name === slotData.faculty ? 'selected' : ''}>${f.name}</option>`);
    
    const rSelect = document.getElementById('editRoom');
    rSelect.innerHTML = '';
    allRooms.forEach(r => rSelect.innerHTML += `<option value="${r._id}" ${String(r._id) === String(slotData.room) ? 'selected' : ''}>${r._id}</option>`);
    
    const bSelect = document.getElementById('editBatch');
    bSelect.innerHTML = '<option value="Entire Section">Entire Section (Theory)</option>';
    // Populate specific batches from the section object
    const batchObj = allSections.find(s => String(s._id) === String(slotData.section));
    // In new seed, batch name is the section name itself, but logic assumes sub-batches?
    // For now, just allow "Entire" or current value
    if (slotData.batch) {
        bSelect.innerHTML += `<option value="${slotData.batch}" selected>${slotData.batch}</option>`;
    }

    modal.style.display = 'block';
}

function renderCoursesTable(data) {
    const html = (data || []).map(c => `
        <tr>
            <td>${c._id}</td>
            <td>${c.course_name}</td>
            <td>${c.course_type || 'N/A'}</td>
            <td>${c.lectures_per_week || 0}</td>
            <td>${c.credits || 0}</td>
            <td><button class="action-btn-table edit">Edit</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.courses-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="6">No subjects found.</td></tr>';
}

function renderSectionsTable(data) {
    const html = (data || []).map(s => `
        <tr>
            <td>${s._id}</td>
            <td>${s.department}</td>
            <td>${s.semester} (Year ${Math.ceil(s.semester/2)})</td>
            <td>${s.size || 0}</td>
            <td><button class="action-btn-table edit">Edit</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.sections-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="5">No batches found.</td></tr>';
}