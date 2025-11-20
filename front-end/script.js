// =================================================================
// == GLOBAL VARIABLES & CACHE
// =================================================================
let allCourses = [];
let allFaculty = [];
let allRooms = [];
let allSections = [];
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
        // Protect private pages
        if (!user) {
            alert('You must be logged in to view this page.');
            window.location.href = 'login.html';
            return;
        }

        // Admin Page Protection
        if (bodyClass.contains('admin-page') && user.role !== 'admin') {
            alert('Access Denied: Admins only.');
            redirectToDashboard(user.role);
            return;
        }
        
        // Faculty Page Protection (Admins allowed)
        if (bodyClass.contains('faculty-page') && user.role !== 'faculty' && user.role !== 'admin') {
            alert('Access Denied.');
            redirectToDashboard(user.role);
            return;
        }

        // Student Page Protection (Admins allowed)
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

    // --- THEME TOGGLE LOGIC ---
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    
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
    if (darkModeToggleSettings) {
        darkModeToggleSettings.checked = isDarkMode;
    }


    // =================================================================
    // == 3. STUDENT & FACULTY DASHBOARD LOGIC
    // =================================================================
    
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
                // 1. Populate Grid
                populateTimetable(result.data);

                // 2. Calculate Stats
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
                
                // Populate Stats Cards
                const totalClassesStat = document.getElementById('totalClassesStat');
                if (totalClassesStat) totalClassesStat.textContent = totalHours; // Renamed for faculty
                
                const totalHoursStat = document.getElementById('totalHoursStat');
                if (totalHoursStat) totalHoursStat.textContent = totalHours;

                // Find faculty department
                if (user.role === 'faculty') {
                    const facultyData = await fetchApi('/api/faculty'); // Fetch all
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
    
    // =================================================================
    // == 4. [MOVED] GLOBAL TIMETABLE LOADER
    // =================================================================
    
    async function loadTimetable() {
        const timetableDoc = await fetchTimetableData();
        if(timetableDoc && timetableDoc.data) {
            currentTimetableData = timetableDoc.data; 
            populateTimetable(currentTimetableData);
        } else {
            currentTimetableData = {};
            populateTimetable(null);
            // Only show alert on admin page
            if (document.querySelector('.generate-btn') && user && user.role === 'admin') {
                alert("No timetable found. Please generate one.");
            }
        }
    }


    // =================================================================
    // == 5. ADMIN TIMETABLE PAGE LOGIC (index.html)
    // =================================================================
    
    const generateBtn = document.querySelector('.generate-btn');
    const publishBtn = document.querySelector('.publish-btn');

    if (generateBtn) { // We are on index.html
        if (user && user.role !== 'admin') {
            const headerActions = document.querySelector('.header-actions');
            if(headerActions) headerActions.style.display = 'none';
            const filters = document.querySelector('.filters');
            if(filters) filters.style.display = 'none';
        }

        async function loadModalData() {
            try {
                const [courses, faculty, rooms, sections] = await Promise.all([
                    fetchCourses(), fetchFaculty(), fetchRooms(), fetchSections()
                ]);
                allCourses = courses || [];
                allFaculty = faculty || [];
                allRooms = rooms || [];
                allSections = sections || [];
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

        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
                if (!currentTimetableData) { alert("No timetable to publish."); return; }
                if (confirm("Publish timetable?")) {
                    alert("✅ Timetable Published!");
                }
            });
        }

        const sectionSelect = document.getElementById('section-select');
        if (sectionSelect) {
            fetchSections().then(sections => {
                if(sections) sections.forEach(s => sectionSelect.innerHTML += `<option value="${s._id}">${s._id}</option>`);
            });
            sectionSelect.addEventListener('change', () => populateTimetable(currentTimetableData));
        }
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
                loadTimetable(); // <-- uses global loader
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
                loadTimetable(); // <-- uses global loader
            } catch(e) { alert(e.message); }
        });
    }


    // =================================================================
    // == 6. ADMIN DASHBOARD STATS
    // =================================================================
    const occupancyChartCanvas = document.getElementById('occupancyChart');
    if (occupancyChartCanvas && user && user.role === 'admin') {
        if(user.name) document.querySelector('.dashboard-header').textContent = `Welcome, ${user.name}!`;

        async function loadDashboardStats() {
            try {
                const [courses, faculty, rooms] = await Promise.all([fetchCourses(), fetchFaculty(), fetchRooms()]);
                if (courses) document.getElementById('totalCoursesStat').textContent = courses.length;
                if (faculty) document.getElementById('totalFacultyStat').textContent = faculty.length;
                if (rooms) document.getElementById('totalRoomsStat').textContent = rooms.length;
                
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
            } catch (e) { console.error(e); }
        }
        loadDashboardStats();
    }

    // =================================================================
    // == 7. ADMIN DATA PAGES (CRUD)
    // =================================================================

    // --- COURSES PAGE ---
    const courseModal = document.getElementById('courseModal');
    if (courseModal) {
        async function reloadCourses() { const data = await fetchCourses(); renderCoursesTable(data); }
        reloadCourses();
        
        const courseForm = document.getElementById('courseForm');
        let editingRow = null;
        
        document.querySelector('.publish-btn').addEventListener('click', () => {
            editingRow = null;
            document.getElementById('modalTitle').textContent = 'Add New Course';
            document.getElementById('courseCode').readOnly = false;
            courseForm.reset();
            courseModal.style.display = 'block';
        });

        document.querySelector('.data-table').addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('courseCode').value = cells[0].textContent;
                document.getElementById('courseName').value = cells[1].textContent;
                document.getElementById('courseType').value = cells[2].textContent;
                document.getElementById('lectures_per_week').value = cells[3].textContent;
                document.getElementById('tutorials_per_week').value = cells[4].textContent;
                document.getElementById('practicals_per_week').value = cells[5].textContent;
                document.getElementById('courseCredits').value = cells[6].textContent;
                
                document.getElementById('modalTitle').textContent = 'Edit Course';
                document.getElementById('courseCode').readOnly = true;
                courseModal.style.display = 'block';
            } else if (e.target.classList.contains('delete')) {
                const code = e.target.closest('tr').children[0].textContent;
                if (confirm(`Delete course ${code}?`)) {
                    await fetch(`http://localhost:3000/api/courses/${code}`, { method: 'DELETE' });
                    reloadCourses();
                }
            }
        });

        courseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                course_code: document.getElementById('courseCode').value,
                course_name: document.getElementById('courseName').value,
                credits: parseInt(document.getElementById('courseCredits').value),
                course_type: document.getElementById('courseType').value,
                lectures_per_week: parseInt(document.getElementById('lectures_per_week').value),
                tutorials_per_week: parseInt(document.getElementById('tutorials_per_week').value),
                practicals_per_week: parseInt(document.getElementById('practicals_per_week').value)
            };
            const method = editingRow ? 'PUT' : 'POST';
            const url = editingRow ? `http://localhost:3000/api/courses/${data.course_code}` : 'http://localhost:3000/api/courses';
            
            await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            courseModal.style.display = 'none';
            reloadCourses();
        });
        
        courseModal.querySelector('.close-button').addEventListener('click', () => courseModal.style.display = 'none');
    }

    // --- FACULTY PAGE ---
    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) {
        async function reloadFaculty() {
            const [faculty, users] = await Promise.all([fetchFaculty(), fetchUsers()]);
            const userSet = new Set(users ? users.map(u => u.profileId) : []);
            renderFacultyTable(faculty, userSet);
        }
        reloadFaculty();

        const facultyForm = document.getElementById('facultyForm');
        let editingRow = null;

        document.querySelector('.publish-btn').addEventListener('click', () => {
            editingRow = null;
            document.getElementById('modalTitle').textContent = 'Add New Faculty';
            document.getElementById('facultyId').readOnly = false;
            facultyForm.reset();
            facultyModal.style.display = 'block';
        });

        document.querySelector('.data-table').addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('facultyId').value = cells[0].textContent;
                document.getElementById('facultyName').value = cells[1].textContent;
                document.getElementById('facultyDept').value = cells[2].textContent;
                document.getElementById('facultyDesignation').value = cells[3].textContent;
                document.getElementById('modalTitle').textContent = 'Edit Faculty';
                document.getElementById('facultyId').readOnly = true;
                facultyModal.style.display = 'block';
            } else if (e.target.classList.contains('delete')) {
                const id = e.target.closest('tr').children[0].textContent;
                if (confirm(`Delete faculty ${id}?`)) {
                    await fetch(`http://localhost:3000/api/faculty/${id}`, { method: 'DELETE' });
                    reloadFaculty();
                }
            } else if (e.target.classList.contains('create-login') && !e.target.disabled) {
                const row = e.target.closest('tr');
                openCreateLoginModal(row.children[0].textContent, row.children[1].textContent);
            }
        });

        facultyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                faculty_id: document.getElementById('facultyId').value,
                name: document.getElementById('facultyName').value,
                department: document.getElementById('facultyDept').value,
                designation: document.getElementById('facultyDesignation').value
            };
            const method = editingRow ? 'PUT' : 'POST';
            const url = editingRow ? `http://localhost:3000/api/faculty/${data.faculty_id}` : 'http://localhost:3000/api/faculty';
            
            await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            facultyModal.style.display = 'none';
            reloadFaculty();
        });

        // Create Login Modal Logic
        const loginModal = document.getElementById('createLoginModal');
        const loginForm = document.getElementById('createLoginForm');
        
        function openCreateLoginModal(id, name) {
            document.getElementById('createLoginFacultyId').value = id;
            document.getElementById('createLoginFacultyName').value = name;
            loginForm.reset();
            document.getElementById('createLoginError').textContent = '';
            loginModal.style.display = 'block';
        }
        
        if(loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = {
                    facultyId: document.getElementById('createLoginFacultyId').value,
                    email: document.getElementById('createLoginEmail').value,
                    password: document.getElementById('createLoginPassword').value
                };
                
                try {
                    const res = await fetch('http://localhost:3000/api/users/create-faculty-login', {
                        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                    });
                    const result = await res.json();
                    if(!res.ok) throw new Error(result.message);
                    alert(result.message);
                    loginModal.style.display = 'none';
                    reloadFaculty();
                } catch (err) {
                    document.getElementById('createLoginError').textContent = err.message;
                }
            });
        }
        
        document.querySelectorAll('.modal .close-button').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
        });
    }

    // --- ROOMS PAGE ---
    const roomModal = document.getElementById('roomModal');
    if (roomModal) {
        async function reloadRooms() { const data = await fetchRooms(); renderRoomsTable(data); }
        reloadRooms();
        
        const roomForm = document.getElementById('roomForm');
        let editingRow = null;

        document.querySelector('.publish-btn').addEventListener('click', () => {
            editingRow = null;
            document.getElementById('modalTitle').textContent = 'Add New Room';
            document.getElementById('roomNumber').readOnly = false;
            roomForm.reset();
            roomModal.style.display = 'block';
        });

        document.querySelector('.data-table').addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('roomNumber').value = cells[0].textContent;
                document.getElementById('roomCapacity').value = cells[1].textContent;
                document.getElementById('roomType').value = cells[2].textContent;
                document.getElementById('modalTitle').textContent = 'Edit Room';
                document.getElementById('roomNumber').readOnly = true;
                roomModal.style.display = 'block';
            } else if (e.target.classList.contains('delete')) {
                const id = e.target.closest('tr').children[0].textContent;
                if (confirm(`Delete room ${id}?`)) {
                    await fetch(`http://localhost:3000/api/rooms/${id}`, { method: 'DELETE' });
                    reloadRooms();
                }
            }
        });

        roomForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                room_number: document.getElementById('roomNumber').value,
                capacity: parseInt(document.getElementById('roomCapacity').value),
                type: document.getElementById('roomType').value
            };
            const method = editingRow ? 'PUT' : 'POST';
            const url = editingRow ? `http://localhost:3000/api/rooms/${data.room_number}` : 'http://localhost:3000/api/rooms';
            
            await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            roomModal.style.display = 'none';
            reloadRooms();
        });
        
        roomModal.querySelector('.close-button').addEventListener('click', () => roomModal.style.display = 'none');
    }

    // --- SECTIONS PAGE ---
    const sectionModal = document.getElementById('sectionModal');
    if (sectionModal) {
        async function reloadSections() { const data = await fetchSections(); renderSectionsTable(data); }
        reloadSections();

        const sectionForm = document.getElementById('sectionForm');
        let editingRow = null;

        document.getElementById('addNewSectionBtn').addEventListener('click', () => {
            editingRow = null;
            document.getElementById('sectionModalTitle').textContent = 'Add New Section';
            document.getElementById('sectionId').readOnly = false;
            sectionForm.reset();
            sectionModal.style.display = 'block';
        });

        document.getElementById('sectionsTableBody').addEventListener('click', async (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('sectionId').value = cells[0].textContent;
                document.getElementById('sectionDept').value = cells[1].textContent;
                document.getElementById('sectionSem').value = cells[2].textContent;
                document.getElementById('sectionName').value = cells[3].textContent;
                document.getElementById('sectionBatches').value = cells[4].textContent;
                document.getElementById('sectionModalTitle').textContent = 'Edit Section';
                document.getElementById('sectionId').readOnly = true;
                sectionModal.style.display = 'block';
            } else if (e.target.classList.contains('delete')) {
                const id = e.target.closest('tr').children[0].textContent;
                if (confirm(`Delete section ${id}?`)) {
                    await fetch(`http://localhost:3000/api/sections/${id}`, { method: 'DELETE' });
                    reloadSections();
                }
            } else if (e.target.classList.contains('assign')) {
                openAssignmentModal(e.target.closest('tr').children[0].textContent);
            }
        });

        sectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const batches = document.getElementById('sectionBatches').value.split(',').map(b => b.trim()).filter(b => b);
            const data = {
                section_id: document.getElementById('sectionId').value,
                department: document.getElementById('sectionDept').value,
                semester: parseInt(document.getElementById('sectionSem').value),
                section_name: document.getElementById('sectionName').value,
                batches: batches
            };
            const method = editingRow ? 'PUT' : 'POST';
            const url = editingRow ? `http://localhost:3000/api/sections/${data.section_id}` : 'http://localhost:3000/api/sections';
            
            await fetch(url, { method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) });
            sectionModal.style.display = 'none';
            reloadSections();
        });

        // Assignments Logic
        const assignModal = document.getElementById('assignmentModal');
        const assignForm = document.getElementById('assignmentForm');
        let currentSectionId = null;

        async function openAssignmentModal(sectionId) {
            currentSectionId = sectionId;
            document.getElementById('assignmentModalTitle').textContent = `Assign to ${sectionId}`;
            
            const [courses, faculty, section] = await Promise.all([fetchCourses(), fetchFaculty(), fetchSection(sectionId)]);
            
            const cSelect = document.getElementById('assignCourseSelect');
            cSelect.innerHTML = '<option value="">Select Course...</option>';
            courses.forEach(c => cSelect.innerHTML += `<option value="${c._id}">${c.course_name} (${c.course_type})</option>`);
            
            const fSelect = document.getElementById('assignFacultySelect');
            fSelect.innerHTML = '<option value="">Select Faculty...</option>';
            faculty.forEach(f => fSelect.innerHTML += `<option value="${f._id}">${f.name}</option>`);
            
            const bSelect = document.getElementById('assignBatchSelect');
            bSelect.innerHTML = '<option value="Entire Section">Entire Section</option>';
            (section.batches || []).forEach(b => bSelect.innerHTML += `<option value="${b}">${b}</option>`);
            
            renderAssignmentList(section.assignments || []);
            assignModal.style.display = 'block';
        }

        if(assignForm) {
            assignForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const cSelect = document.getElementById('assignCourseSelect');
                const fSelect = document.getElementById('assignFacultySelect');
                const bSelect = document.getElementById('assignBatchSelect');
                
                const data = {
                    courseId: cSelect.value,
                    facultyId: fSelect.value,
                    courseName: cSelect.options[cSelect.selectedIndex].text,
                    facultyName: fSelect.options[fSelect.selectedIndex].text,
                    batch: bSelect.value
                };
                
                const res = await fetch(`http://localhost:3000/api/sections/${currentSectionId}/assign`, {
                    method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
                });
                if(res.ok) {
                    // Refresh list
                    const section = await fetchSection(currentSectionId);
                    renderAssignmentList(section.assignments);
                    assignForm.reset();
                }
            });
        }

        const assignList = document.getElementById('assignmentList');
        if(assignList) {
            assignList.addEventListener('click', async (e) => {
                if (e.target.classList.contains('delete-assignment')) {
                    if(confirm("Remove assignment?")) {
                        await fetch(`http://localhost:3000/api/sections/${currentSectionId}/unassign`, {
                            method: 'DELETE', headers: {'Content-Type': 'application/json'}, 
                            body: JSON.stringify({ assignmentId: e.target.dataset.id })
                        });
                        const section = await fetchSection(currentSectionId);
                        renderAssignmentList(section.assignments);
                    }
                }
            });
        }

        document.querySelectorAll('.modal .close-button').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
        });
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
        
        usersTableBody.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-user')) {
                const row = e.target.closest('tr');
                const email = row.dataset.email;
                const name = row.children[0].textContent;
                
                if (confirm(`Are you sure you want to delete the user "${name}" (${email})?`)) {
                    try {
                        const res = await fetch(`http://localhost:3000/api/users/${email}`, { method: 'DELETE' });
                        const result = await res.json();
                        if (!res.ok) throw new Error(result.message);
                        alert(result.message);
                        loadAndRenderUsers(); // Refresh the list
                    } catch (err) {
                        alert(`Error: ${err.message}`);
                    }
                }
            }
        });

        loadAndRenderUsers();
    }
    
    // --- SETTINGS PAGE ---
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        const inputs = ['max-hours', 'lunchBreakStart', 'lunchBreakDuration', 'teaBreakStart', 'teaBreakDuration'];
        
        // Load
        inputs.forEach(id => {
            const val = localStorage.getItem(id);
            if(val && document.getElementById(id)) document.getElementById(id).value = val;
        });

        // Save
        saveSettingsBtn.addEventListener('click', () => {
            inputs.forEach(id => {
                if(document.getElementById(id)) localStorage.setItem(id, document.getElementById(id).value);
            });
            localStorage.setItem('darkMode', document.getElementById('darkModeToggle').checked);
            alert('Settings Saved!');
        });
    }

    // --- LOGIN/SIGNUP PAGE ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        // [FIX] Apply dark mode on load
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }

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

        // Click handlers
        loginToggle.addEventListener('click', showLogin);
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
        signupToggle.addEventListener('click', showSignup);
        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); showSignup(); });


        const signupRole = document.getElementById('signupRole');
        signupRole.addEventListener('change', () => {
            const group = document.getElementById('profileIdGroup');
            const label = document.getElementById('profileIdLabel');
            const input = document.getElementById('signupProfileId');
            
            if (signupRole.value === 'student') {
                group.style.display = 'block';
                label.textContent = 'Section ID';
                input.placeholder = 'e.g., CS-A';
            } else {
                group.style.display = 'none';
            }
        });

        // Form Submit Handlers
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

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const role = document.getElementById('signupRole').value;
            const profileId = document.getElementById('signupProfileId').value;
            const errorEl = document.getElementById('signupError');
            errorEl.textContent = '';
            
            if (role === 'student' && !profileId) {
                errorEl.textContent = 'Please provide your Section ID.';
                return;
            }
            
            try {
                const res = await fetch('http://localhost:3000/api/signup', { 
                    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ name, email, password, role, profileId }) 
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                alert("Signup successful! Please log in.");
                showLogin(); // Flip to login form
            } catch(err) { errorEl.textContent = err.message; }
        });
    }

}); // <<< END of DOMContentLoaded

// =================================================================
// == 8. HELPER FUNCTIONS
// =================================================================

// --- API Fetchers ---
async function fetchApi(url) {
    try {
        const res = await fetch(`http://localhost:3000${url}`);
        if(res.ok) return await res.json();
        else console.error(`Failed to fetch ${url}: ${res.statusText}`);
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


// --- TIMETABLE RENDERER ---
function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return; // Exit if no grid found
    if (!data || Object.keys(data).length === 0) { 
        tbody.innerHTML = '<tr><td colspan="7">No timetable data available.</td></tr>'; 
        return; 
    }

    const sectionFilter = document.getElementById('section-select');
    // If no filter exists (e.g., student/faculty page), 'all' will show all data given
    const selectedSection = sectionFilter ? sectionFilter.value : 'all';
    
    // [NEW] Time Column Logic
    const TIME_SLOTS_MAP = {
        '08:30': '08:30 - 09:30',
        '09:30': '09:30 - 10:30',
        '10:30': '10:30 - 10:45', // Tea Break Placeholder
        '10:45': '10:45 - 11:45',
        '11:45': '11:45 - 12:45',
        '12:45': '12:45 - 13:30', // Lunch Break Placeholder
        '13:30': '13:30 - 14:30',
        '14:30': '14:30 - 15:30',
        '15:30': '15:30 - 16:30'
    };
    // Get actual break times from settings
    const lunchStart = localStorage.getItem('lunchBreakStart') || '12:45';
    const teaStart = localStorage.getItem('teaBreakStart') || '10:30';
    
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let html = '';
    
    // Create sorted list of time keys, including breaks
    const allTimeKeys = new Set(Object.keys(TIME_SLOTS_MAP));
    allTimeKeys.add(lunchStart);
    allTimeKeys.add(teaStart);
    const sortedTimeKeys = [...allTimeKeys].sort();

    sortedTimeKeys.forEach(time => {
        const timeLabel = TIME_SLOTS_MAP[time] || time;

        if (time === teaStart) {
            html += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" class="break-slot">Tea Break</td></tr>`;
            return; // Skip this slot from the main logic
        }
        if (time === lunchStart) {
            html += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" class="break-slot">Lunch Break</td></tr>`;
            return; // Skip this slot from the main logic
        }

        // Only render class rows (from the original map keys)
        if (!TIME_SLOTS_MAP[time]) return; 

        html += `<tr><td class="time-cell">${timeLabel}</td>`;
        
        DAYS.forEach(day => {
            let cellContent = '';
            // [FIXED] Data is now { day: { time: [Array of Slots] } }
            if (data[day] && data[day][time]) {
                let slots = data[day][time] || []; // Array
                
                // Filter by section if one is selected
                if (selectedSection !== 'all') {
                    slots = slots.filter(s => String(s.section) === String(selectedSection));
                }

                // Render all matching slots (stacked)
                slots.forEach(slot => {
                    // batch shown only if present (labs). Section is always shown per Option B.
                    const batchText = slot.batch ? ` (${slot.batch})` : '';
                    // Keep room + (section) always
                    const sectionText = slot.section ? ` (${slot.section})` : '';
                    cellContent += `
                        <div class="timetable-slot ${slot.conflict ? 'conflict' : ''}"
                             data-day="${day}" data-time="${time}" data-section="${slot.section}">
                            <strong>${slot.course}${slot.batch ? ` ${batchText}` : ''}</strong>
                            <span>${slot.faculty}</span>
                            <em>${slot.room}${sectionText}</em>
                        </div>
                    `;
                });
            }
            // If no classes → show "Free"
            html += `<td>${cellContent || '<div class="free-slot">Free</div>'}</td>`;
        });
        html += '</tr>';
    });
    tbody.innerHTML = html;

    // Add click handlers *only* for admin
    if (document.body.classList.contains('role-admin')) {
        tbody.querySelectorAll('.timetable-slot').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = el.dataset.day;
                const time = el.dataset.time;
                const section = el.dataset.section;
                
                // Find the specific slot data from the cache
                const allSlots = (currentTimetableData && currentTimetableData[day] && currentTimetableData[day][time]) ? currentTimetableData[day][time] : [];
                const slotData = allSlots.find(s => String(s.section) === String(section));
                
                if (slotData) openEditSlotModal(slotData, day, time);
            });
        });
    }
}

// --- MODAL POPULATOR ---
function openEditSlotModal(slotData, day, time) {
    const modal = document.getElementById('editModal');
    if (!modal) return;

    document.getElementById('editSlotDay').value = day;
    document.getElementById('editSlotTime').value = time;
    document.getElementById('editSlotSectionId').value = slotData.section;
    
    // Populate Dropdowns
    const cSelect = document.getElementById('editCourse');
    cSelect.innerHTML = '';
    allCourses.forEach(c => cSelect.innerHTML += `<option value="${c._id}" ${c.course_name === slotData.course ? 'selected' : ''}>${c.course_name}</option>`);
    
    const fSelect = document.getElementById('editFaculty');
    fSelect.innerHTML = '';
    allFaculty.forEach(f => fSelect.innerHTML += `<option value="${f._id}" ${String(f._id) === String(slotData.facultyId) ? 'selected' : ''}>${f.name}</option>`);
    
    const rSelect = document.getElementById('editRoom');
    rSelect.innerHTML = '';
    allRooms.forEach(r => rSelect.innerHTML += `<option value="${r._id}" ${String(r._id) === String(slotData.room) ? 'selected' : ''}>${r._id}</option>`);
    
    const bSelect = document.getElementById('editBatch');
    bSelect.innerHTML = '<option value="Entire Section">Entire Section</option>';
    const section = allSections.find(s => String(s._id) === String(slotData.section));
    if(section && section.batches) {
        section.batches.forEach(b => bSelect.innerHTML += `<option value="${b}" ${b === slotData.batch ? 'selected' : ''}>${b}</option>`);
    }
    // If slotData.batch is null, set select to Entire Section
    bSelect.value = slotData.batch || 'Entire Section';

    modal.style.display = 'block';
}

// --- ADMIN PAGE RENDERERS ---
function renderCoursesTable(data) {
    const html = (data || []).map(c => `
        <tr>
            <td>${c._id}</td>
            <td>${c.course_name}</td>
            <td>${c.course_type}</td>
            <td>${c.lectures_per_week || 0}</td>
            <td>${c.tutorials_per_week || 0}</td>
            <td>${c.practicals_per_week || 0}</td>
            <td>${c.credits}</td>
            <td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.courses-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="8">No courses found.</td></tr>';
}

function renderFacultyTable(data, userSet) {
    const html = (data || []).map(f => {
        const hasLogin = userSet.has(f._id);
        return `
        <tr>
            <td>${f._id}</td><td>${f.name}</td><td>${f.department}</td><td>${f.designation}</td>
            <td><button class="action-btn-table create-login" ${hasLogin ? 'disabled' : ''}>${hasLogin ? 'Account Exists' : 'Create Login'}</button></td>
            <td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td>
        </tr>`;
    }).join('');
    const tbody = document.querySelector('.faculty-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="6">No faculty found.</td></tr>';
}

function renderRoomsTable(data) {
    const html = (data || []).map(r => `
        <tr>
            <td>${r._id}</td><td>${r.capacity}</td><td>${r.type}</td>
            <td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.rooms-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="4">No rooms found.</td></tr>';
}

function renderSectionsTable(data) {
    const html = (data || []).map(s => `
        <tr>
            <td>${s._id}</td><td>${s.department}</td><td>${s.semester}</td><td>${s.section_name}</td>
            <td>${(s.batches||[]).join(', ')}</td>
            <td><button class="action-btn-table assign">Assign</button><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.sections-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="6">No sections found.</td></tr>';
}

function renderAssignmentList(assignments) {
    const list = document.getElementById('assignmentList');
    if(!list) return;
    list.innerHTML = (assignments && assignments.length) ? assignments.map(a => `
        <li>
            <div class="info"><strong>${a.courseName} (${a.batch||'Entire Section'})</strong><span>${a.facultyName}</span></div>
            <button class="action-btn-table delete-assignment" data-id="${a._id}">Remove</button>
        </li>`).join('') : '<li>No assignments yet.</li>';
}
