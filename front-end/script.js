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
            alert('Logged out successfully.');
            window.location.href = 'login.html';
        });
    });

    // --- THEME TOGGLE LOGIC ---
    // 1. Apply theme on load
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    // 2. Handle Header Toggle Button (for Student/Faculty pages)
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
        // Set initial icon
        themeToggleBtn.textContent = isDarkMode ? '☀️' : '🌙';
        
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('darkMode', isDark);
            themeToggleBtn.textContent = isDark ? '☀️' : '🌙';
        });
    }

    // 3. Handle Settings Page Toggle (Admin)
    const darkModeToggleSettings = document.getElementById('darkModeToggle');
    if (darkModeToggleSettings) {
        darkModeToggleSettings.checked = isDarkMode;
        darkModeToggleSettings.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', darkModeToggleSettings.checked);
        });
    }


    // =================================================================
    // == 3. STUDENT & FACULTY DASHBOARD LOGIC
    // =================================================================
    
    if (user && (bodyClass.contains('student-page') || bodyClass.contains('faculty-page'))) {
        const welcomeHeader = document.getElementById('welcomeHeader');
        if (welcomeHeader) welcomeHeader.textContent = `Welcome back, ${user.name}!`;
        
        // Display Student Section in Stats
        const studentSectionStat = document.getElementById('studentSectionStat');
        if (studentSectionStat && user.role === 'student') {
            studentSectionStat.textContent = user.profileId || 'N/A';
        }

        async function loadPersonalTimetable() {
            if (!user.profileId) {
                console.warn("User has no profileId.");
                return; 
            }
            
            let url = '';
            if (user.role === 'student') url = `http://localhost:3000/api/timetable/section/${user.profileId}`;
            else if (user.role === 'faculty') url = `http://localhost:3000/api/timetable/faculty/${user.profileId}`;

            try {
                const response = await fetch(url);
                if (response.ok) {
                    const result = await response.json();
                    
                    // 1. Populate Grid
                    populateTimetable(result.data);

                    // 2. Calculate Total Classes for Stats
                    let totalClasses = 0;
                    const data = result.data;
                    for (const day in data) {
                        for (const time in data[day]) {
                            const slots = data[day][time];
                            if (Array.isArray(slots)) {
                                totalClasses += slots.length;
                            }
                        }
                    }
                    const totalClassesStat = document.getElementById('totalClassesStat');
                    if (totalClassesStat) totalClassesStat.textContent = totalClasses;

                }
            } catch (e) { console.error("Personal timetable error:", e); }
        }
        loadPersonalTimetable();
    }

    // =================================================================
    // == 4. ADMIN TIMETABLE PAGE LOGIC
    // =================================================================
    
    const generateBtn = document.querySelector('.generate-btn');
    const publishBtn = document.querySelector('.publish-btn');

    if (generateBtn) {
        // Hide controls if not admin
        if (user && user.role !== 'admin') {
            const headerActions = document.querySelector('.header-actions');
            if(headerActions) headerActions.style.display = 'none';
            const filters = document.querySelector('.filters');
            if(filters) filters.style.display = 'none';
        }

        // Load Modal Data
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
        
        async function loadTimetable() {
            console.log("Loading timetable...");
            const timetableDoc = await fetchTimetableData();
            if(timetableDoc && timetableDoc.data) {
                currentTimetableData = timetableDoc.data; 
                populateTimetable(currentTimetableData);
                const generatedAt = new Date(timetableDoc.generatedAt).toLocaleString();
                console.log(`Loaded timetable generated at: ${generatedAt}`);
            } else {
                currentTimetableData = {};
                populateTimetable(null);
                if (user.role === 'admin') alert("No timetable found. Please generate one.");
            }
        }

        loadModalData(); 
        loadTimetable();
        
        // Generate Button
        generateBtn.addEventListener('click', async () => {
            if (!confirm("Generate new timetable? This will overwrite existing data.")) return;
            const originalText = generateBtn.textContent;
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            
            try {
                const response = await fetch('http://localhost:3000/api/timetable/generate', { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                
                alert('New timetable generated successfully!');
                currentTimetableData = result.data;
                populateTimetable(currentTimetableData);
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = originalText;
            }
        });

        // Publish Button
        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
                if (!currentTimetableData || Object.keys(currentTimetableData).length === 0) {
                    alert("No timetable to publish."); return;
                }
                if (confirm("Publish timetable? This will notify all users.")) {
                    const originalText = publishBtn.textContent;
                    publishBtn.textContent = "Publishing...";
                    publishBtn.disabled = true;
                    setTimeout(() => {
                        alert("✅ Timetable Published!");
                        publishBtn.textContent = originalText;
                        publishBtn.disabled = false;
                    }, 1000);
                }
            });
        }

        // Filter Listener
        const sectionSelect = document.getElementById('section-select');
        if (sectionSelect) {
            fetchSections().then(sections => {
                if(sections) sections.forEach(s => sectionSelect.innerHTML += `<option value="${s._id}">${s._id}</option>`);
            });
            sectionSelect.addEventListener('change', () => populateTimetable(currentTimetableData));
        }
    }

    // [MODAL LOGIC FOR EDITING SLOTS]
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
                alert('Updated!'); closeModal(); loadTimetable();
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
                alert('Deleted!'); closeModal(); loadTimetable();
            } catch(e) { alert(e.message); }
        });
    }


    // =================================================================
    // == 5. ADMIN DASHBOARD STATS
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
                        labels: Object.keys(roomTypeCounts), 
                        datasets: [{ label: 'Rooms', data: Object.values(roomTypeCounts), backgroundColor: '#36a2eb' }] 
                    } 
                });
            } catch (e) { console.error(e); }
        }
        loadDashboardStats();
    }

    // =================================================================
    // == 6. ADMIN DATA PAGES (CRUD)
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
                document.getElementById('courseCredits').value = cells[2].textContent;
                document.getElementById('courseType').value = cells[3].textContent;
                document.getElementById('courseDuration').value = cells[4].textContent;
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
                credits: document.getElementById('courseCredits').value,
                course_type: document.getElementById('courseType').value,
                duration: document.getElementById('courseDuration').value
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
        
        document.querySelectorAll('.close-button').forEach(btn => {
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
                capacity: document.getElementById('roomCapacity').value,
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
                semester: document.getElementById('sectionSem').value,
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
                // Refresh list manually or fetch section again
                const section = await fetchSection(currentSectionId);
                renderAssignmentList(section.assignments);
                assignForm.reset();
            }
        });

        document.getElementById('assignmentList').addEventListener('click', async (e) => {
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

        document.querySelectorAll('.close-button').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.modal').style.display = 'none');
        });
    }

    // --- LOGIN/SIGNUP PAGE ---
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
// == HELPER FUNCTIONS
// =================================================================

async function fetchApi(url) {
    try {
        const res = await fetch(`http://localhost:3000${url}`);
        if(res.ok) return await res.json();
    } catch(e) { console.error(e); }
    return null;
}
async function fetchCourses() { return fetchApi('/api/courses'); }
async function fetchFaculty() { return fetchApi('/api/faculty'); }
async function fetchRooms() { return fetchApi('/api/rooms'); }
async function fetchSections() { return fetchApi('/api/sections'); }
async function fetchUsers() { return fetchApi('/api/users'); }
async function fetchSection(id) { return fetchApi(`/api/sections/${id}`); }
async function fetchTimetableData() { return fetchApi('/api/timetable'); }

function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;
    if (!data) { tbody.innerHTML = '<tr><td colspan="7">No data available.</td></tr>'; return; }

    const sectionFilter = document.getElementById('section-select');
    const selectedSection = sectionFilter ? sectionFilter.value : 'all';
    
    // Get schedule settings from local storage
    const lunchStart = localStorage.getItem('lunchBreakStart') || '12:45';
    const teaStart = localStorage.getItem('teaBreakStart') || '10:30';

    const TIME_SLOTS = ['08:30', '09:30', '10:45', '11:45', '13:30', '14:30', '15:30'];
    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    let html = '';
    
    // Map time slots to display names (e.g., to insert breaks)
    const displaySlots = {
        '08:30': '08:30 - 09:30',
        '09:30': '09:30 - 10:30',
        '10:30': '10:30 - 10:45', // Tea Break
        '10:45': '10:45 - 11:45',
        '11:45': '11:45 - 12:45',
        '12:45': '12:45 - 13:30', // Lunch Break
        '13:30': '13:30 - 14:30',
        '14:30': '14:30 - 15:30',
        '15:30': '15:30 - 16:30'
    };
    
    // We need to add the break times into the loop
    const allTimeKeys = [...TIME_SLOTS];
    if (!allTimeKeys.includes(teaStart)) allTimeKeys.push(teaStart);
    if (!allTimeKeys.includes(lunchStart)) allTimeKeys.push(lunchStart);
    allTimeKeys.sort(); // Puts them in order: 08:30, 09:30, 10:30, 10:45...

    allTimeKeys.forEach(time => {
        if (time === teaStart) {
            html += `<tr><td class="time-cell">10:30</td><td colspan="6" class="break-slot">Tea Break</td></tr>`;
            return;
        }
        if (time === lunchStart) {
            html += `<tr><td class="time-cell">12:45</td><td colspan="6" class="break-slot">Lunch Break</td></tr>`;
            return;
        }

        html += `<tr><td class="time-cell">${displaySlots[time] || time}</td>`;
        
        DAYS.forEach(day => {
            let cellContent = '';
            if (data[day] && data[day][time]) {
                let slots = data[day][time] || []; // Array
                
                // Filter if specific section selected
                if (selectedSection !== 'all') {
                    slots = slots.filter(s => s.section === selectedSection);
                }

                if (slots.length > 0) {
                    // Render all matching slots (stacked)
                    slots.forEach(slot => {
                        const batch = (slot.batch && slot.batch !== 'Entire Section') ? `(${slot.batch})` : '';
                        cellContent += `
                            <div class="timetable-slot ${slot.conflict ? 'conflict' : ''}"
                                 data-day="${day}" data-time="${time}" data-section="${slot.section}">
                                <strong>${slot.course} ${batch}</strong>
                                <span>${slot.faculty}</span>
                                <em>${slot.room} (${slot.section})</em>
                            </div>
                        `;
                    });
                }
            }
            html += `<td>${cellContent}</td>`;
        });
        html += '</tr>';
    });
    tbody.innerHTML = html;

    // Edit Click Handler (Admin Only)
    if (document.body.classList.contains('role-admin')) {
        tbody.querySelectorAll('.timetable-slot').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const day = el.dataset.day;
                const time = el.dataset.time;
                const section = el.dataset.section;
                
                const allSlots = currentTimetableData[day][time];
                const slotData = allSlots.find(s => s.section === section);
                
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
    
    // Populate Dropdowns (Assuming global caches are populated)
    const cSelect = document.getElementById('editCourse');
    cSelect.innerHTML = '';
    allCourses.forEach(c => cSelect.innerHTML += `<option value="${c._id}" ${c.course_name === slotData.course ? 'selected' : ''}>${c.course_name}</option>`);
    
    const fSelect = document.getElementById('editFaculty');
    fSelect.innerHTML = '';
    allFaculty.forEach(f => fSelect.innerHTML += `<option value="${f._id}" ${f._id === slotData.facultyId ? 'selected' : ''}>${f.name}</option>`);
    
    const rSelect = document.getElementById('editRoom');
    rSelect.innerHTML = '';
    allRooms.forEach(r => rSelect.innerHTML += `<option value="${r._id}" ${r._id === slotData.room ? 'selected' : ''}>${r._id}</option>`);
    
    const bSelect = document.getElementById('editBatch');
    bSelect.innerHTML = '<option value="Entire Section">Entire Section</option>';
    const section = allSections.find(s => s._id === slotData.section);
    if(section && section.batches) {
        section.batches.forEach(b => bSelect.innerHTML += `<option value="${b}" ${b === slotData.batch ? 'selected' : ''}>${b}</option>`);
    }
    bSelect.value = slotData.batch;

    modal.style.display = 'block';
}

// --- ADMIN PAGE RENDERERS ---
function renderCoursesTable(data) {
    const html = (data || []).map(c => `
        <tr>
            <td>${c._id}</td><td>${c.course_name}</td><td>${c.credits}</td>
            <td>${c.course_type}</td><td>${c.duration}</td>
            <td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td>
        </tr>`).join('');
    const tbody = document.querySelector('.courses-page .data-table tbody');
    if(tbody) tbody.innerHTML = html || '<tr><td colspan="6">No courses found.</td></tr>';
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