document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // == GLOBAL SETTINGS (APPLIES TO ALL PAGES)
    // =================================================================
    const isDarkModeSaved = localStorage.getItem('darkMode') === 'true';
    if (isDarkModeSaved) {
        document.body.classList.add('dark-mode');
    }

    // =================================================================
    // == LOGIC FOR TIMETABLE PAGE (index.html)
    // =================================================================
    const timetableModal = document.getElementById('editModal');
    if (timetableModal) {
        const closeButton = timetableModal.querySelector('.close-button');
        const openModal = () => timetableModal.style.display = 'block';
        const closeModal = () => timetableModal.style.display = 'none';
        closeButton.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == timetableModal) closeModal(); });
    }
    const generateBtn = document.querySelector('.generate-btn');
    if (generateBtn) {
        populateTimetable({});
        generateBtn.addEventListener('click', async () => {
            const originalText = generateBtn.textContent;
            generateBtn.textContent = 'Generating...';
            generateBtn.disabled = true;
            const timetableData = await fetchTimetableData();
            populateTimetable(timetableData);
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        });
    }

    // =================================================================
    // == LOGIC FOR DASHBOARD PAGE (dashboard.html)
    // =================================================================
    const occupancyChartCanvas = document.getElementById('occupancyChart');
    let myOccupancyChart = null; // To hold the chart instance

    if (occupancyChartCanvas) {
        
        /**
         * Fetches data and populates the dashboard stats and chart.
         */
        async function loadDashboardStats() {
            try {
                // Fetch all data in parallel
                const [courses, faculty, rooms] = await Promise.all([
                    fetchCourses(), 
                    fetchFaculty(), 
                    fetchRooms()
                ]);

                // --- 1. Update Stat Cards ---
                if (courses) {
                    document.getElementById('totalCoursesStat').textContent = courses.length;
                }
                if (faculty) {
                    document.getElementById('totalFacultyStat').textContent = faculty.length;
                }
                if (rooms) {
                    document.getElementById('totalRoomsStat').textContent = rooms.length;
                }

                // --- 2. Process Data for Chart ---
                const roomTypeCounts = {};
                if (rooms) {
                    for (const room of rooms) {
                        const type = room.type || 'Unknown';
                        roomTypeCounts[type] = (roomTypeCounts[type] || 0) + 1;
                    }
                }

                const chartLabels = Object.keys(roomTypeCounts);
                const chartData = Object.values(roomTypeCounts);
                
                // Simple color generator
                const backgroundColors = chartLabels.map((_, index) => `rgba(${index * 60 % 255}, ${index * 100 % 255}, ${index * 40 % 255}, 0.6)`);
                const borderColors = chartLabels.map((_, index) => `rgba(${index * 60 % 255}, ${index * 100 % 255}, ${index * 40 % 255}, 1)`);


                // --- 3. Render Chart ---
                const ctx = occupancyChartCanvas.getContext('2d');
                
                // Destroy old chart instance if it exists
                if (myOccupancyChart) {
                    myOccupancyChart.destroy();
                }

                myOccupancyChart = new Chart(ctx, { 
                    type: 'bar', 
                    data: { 
                        labels: chartLabels.length > 0 ? chartLabels : ['No Data'], 
                        datasets: [{ 
                            label: 'Room Count', 
                            data: chartData.length > 0 ? chartData : [0], 
                            backgroundColor: chartLabels.length > 0 ? backgroundColors : ['rgba(200, 200, 200, 0.6)'], 
                            borderColor: chartLabels.length > 0 ? borderColors : ['rgba(200, 200, 200, 1)'], 
                            borderWidth: 1 
                        }] 
                    }, 
                    options: { 
                        responsive: true, 
                        scales: { y: { beginAtZero: true } } 
                    } 
                });

            } catch (error) {
                console.error("Error loading dashboard data:", error);
                alert("Could not load dashboard statistics. Please check the connection.");
            }
        }

        // Load the stats when the page loads
        loadDashboardStats();
    }

    // =================================================================
    // == LOGIC FOR COURSES PAGE (courses.html)
    // =================================================================
    const courseModal = document.getElementById('courseModal');
    if (courseModal) {
        async function loadAndRenderCourses() { const courses = await fetchCourses(); renderCoursesTable(courses); }
        loadAndRenderCourses();
        const addCourseBtn = document.querySelector('body.courses-page .main-header .publish-btn');
        const courseForm = document.getElementById('courseForm');
        const modalTitle = courseModal.querySelector('#modalTitle');
        const closeModalBtn = courseModal.querySelector('.close-button');
        let editingRow = null;
        const openModal = () => { if (!editingRow) { modalTitle.textContent = 'Add New Course'; document.getElementById('courseCode').readOnly = false; courseForm.reset(); } courseModal.style.display = 'block'; }
        const closeModal = () => { courseModal.style.display = 'none'; editingRow = null; courseForm.reset(); document.getElementById('courseCode').readOnly = false; };
        if(addCourseBtn) addCourseBtn.addEventListener('click', () => { editingRow = null; openModal(); });
        const courseTable = document.querySelector('.courses-page .data-table');
        if (courseTable) {
             courseTable.addEventListener('click', async (e) => {
                 if (e.target.classList.contains('edit')) { editingRow = e.target.closest('tr'); const cells = editingRow.children; document.getElementById('courseCode').value = cells[0].textContent; document.getElementById('courseName').value = cells[1].textContent; document.getElementById('courseCredits').value = cells[2].textContent; modalTitle.textContent = 'Edit Course'; document.getElementById('courseCode').readOnly = true; openModal(); }
                 else if (e.target.classList.contains('delete')) { const rowToDelete = e.target.closest('tr'); const courseCodeToDelete = rowToDelete.children[0].textContent; if (confirm(`Are you sure you want to delete course ${courseCodeToDelete}?`)) { try { const response = await fetch(`http://localhost:3000/api/courses/${courseCodeToDelete}`, { method: 'DELETE', }); if (!response.ok) { let errorMsg = response.statusText; try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (jsonError) { /* ignore */ } console.error("Error deleting course:", response.status, errorMsg); alert(`Error deleting course: ${errorMsg}`); return; } console.log(`Course ${courseCodeToDelete} deleted successfully via API`); loadAndRenderCourses(); } catch (error) { console.error("Network error deleting course:", error); alert("Could not connect to the server to delete the course."); } } }
             });
        }
        courseForm.addEventListener('submit', async (e) => { e.preventDefault(); const code = document.getElementById('courseCode').value; const name = document.getElementById('courseName').value; const credits = parseInt(document.getElementById('courseCredits').value); const courseData = { course_name: name, credits: credits }; let url = 'http://localhost:3000/api/courses'; let method = 'POST'; if (editingRow) { const originalCode = code; url = `http://localhost:3000/api/courses/${originalCode}`; method = 'PUT'; if (!name || isNaN(credits)) { alert("Course Name and Credits cannot be empty when editing."); return; } } else { courseData.course_code = code; if (!code || !name || isNaN(credits)) { alert("Please fill in all fields correctly for the new course."); return; } } try { const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json', }, body: JSON.stringify(courseData), }); if (!response.ok) { const errorData = await response.json(); console.error(`Error ${editingRow ? 'updating' : 'adding'} course:`, response.status, errorData); alert(`Error ${editingRow ? 'updating' : 'adding'} course: ${errorData.message || response.statusText}`); return; } console.log(`Course ${editingRow ? 'updated' : 'added'} successfully via API`); closeModal(); loadAndRenderCourses(); } catch (error) { console.error(`Network error ${editingRow ? 'updating' : 'adding'} course:`, error); alert(`Could not connect to the server to ${editingRow ? 'update' : 'add'} the course.`); } });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == courseModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR FACULTY PAGE (faculty.html)
    // =================================================================
    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) {
        async function loadAndRenderFaculty() {
            const faculty = await fetchFaculty(); 
            renderFacultyTable(faculty); 
        }
        loadAndRenderFaculty(); 

        const addBtn = document.querySelector('body.faculty-page .main-header .publish-btn');
        const facultyForm = document.getElementById('facultyForm');
        const modalTitle = facultyModal.querySelector('#modalTitle');
        const closeModalBtn = facultyModal.querySelector('.close-button');
        let editingRow = null; 

        const openModal = () => {
             if (!editingRow) {
                modalTitle.textContent = 'Add New Faculty';
                document.getElementById('facultyId').readOnly = false; 
                facultyForm.reset();
             }
             facultyModal.style.display = 'block';
        }
        const closeModal = () => {
            facultyModal.style.display = 'none';
            editingRow = null; 
            facultyForm.reset(); 
            document.getElementById('facultyId').readOnly = false; 
        };

        if(addBtn) addBtn.addEventListener('click', () => {
             editingRow = null; 
             openModal();
        });

        const facultyTable = document.querySelector('.faculty-page .data-table');
         if (facultyTable) {
            facultyTable.addEventListener('click', async (e) => { 
                if (e.target.classList.contains('edit')) {
                    editingRow = e.target.closest('tr');
                    const cells = editingRow.children;
                    document.getElementById('facultyId').value = cells[0].textContent; 
                    document.getElementById('facultyName').value = cells[1].textContent;
                    document.getElementById('facultyDept').value = cells[2].textContent;
                    document.getElementById('facultyDesignation').value = cells[3].textContent; // POPULATE DESIGNATION
                    modalTitle.textContent = 'Edit Faculty';
                    document.getElementById('facultyId').readOnly = true; 
                    openModal();
                } else if (e.target.classList.contains('delete')) {
                    const rowToDelete = e.target.closest('tr');
                    const facultyIdToDelete = rowToDelete.children[0].textContent;
                    if (confirm(`Are you sure you want to delete faculty member ${facultyIdToDelete}?`)) {
                        try {
                            const response = await fetch(`http://localhost:3000/api/faculty/${facultyIdToDelete}`, {
                                method: 'DELETE',
                            });

                            if (!response.ok) {
                                let errorMsg = response.statusText;
                                try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (jsonError) { /* ignore */ }
                                console.error("Error deleting faculty:", response.status, errorMsg);
                                alert(`Error deleting faculty: ${errorMsg}`);
                                return;
                            }
                            console.log(`Faculty ${facultyIdToDelete} deleted successfully`);
                            loadAndRenderFaculty(); // Reload table
                        } catch (error) {
                            console.error("Network error deleting faculty:", error);
                            alert("Could not connect to server to delete faculty.");
                        }
                    }
                }
            });
         }

        facultyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('facultyId').value;
            const name = document.getElementById('facultyName').value;
            const dept = document.getElementById('facultyDept').value;
            const designation = document.getElementById('facultyDesignation').value; // GET DESIGNATION

            // Data sent in the request body
            const facultyData = {
                name: name,
                department: dept,
                designation: designation // ADD DESIGNATION
            };

            let url = 'http://localhost:3000/api/faculty';
            let method = 'POST';

            if (editingRow) {
                // UPDATE (PUT) request
                const originalId = id; 
                url = `http://localhost:3000/api/faculty/${originalId}`;
                method = 'PUT';
                if (!name || !dept || !designation) { // VALIDATE DESIGNATION
                     alert("Name, Department, and Designation cannot be empty when editing.");
                     return;
                }
            } else {
                // ADD (POST) request
                facultyData.faculty_id = id; // Add the ID for POST
                if (!id || !name || !dept || !designation) { // VALIDATE DESIGNATION
                    alert("Please fill in all fields for the new faculty member.");
                    return;
                }
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(facultyData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Error ${editingRow ? 'updating' : 'adding'} faculty:`, response.status, errorData);
                    alert(`Error ${editingRow ? 'updating' : 'adding'} faculty: ${errorData.message || response.statusText}`);
                    return;
                }

                console.log(`Faculty ${editingRow ? 'updated' : 'added'} successfully`);
                closeModal();
                loadAndRenderFaculty(); // Reload the table

            } catch (error) {
                console.error(`Network error ${editingRow ? 'updating' : 'adding'} faculty:`, error);
                alert(`Could not connect to server to ${editingRow ? 'update' : 'add'} faculty.`);
            }
        });
        
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == facultyModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR ROOMS PAGE (rooms.html)
    // =================================================================
    const roomModal = document.getElementById('roomModal');
    if (roomModal) {
        async function loadAndRenderRooms() {
            const rooms = await fetchRooms();
            renderRoomsTable(rooms);
        }
        loadAndRenderRooms();

        const addBtn = document.querySelector('body.rooms-page .main-header .publish-btn');
        const roomForm = document.getElementById('roomForm');
        const modalTitle = roomModal.querySelector('#modalTitle');
        const closeModalBtn = roomModal.querySelector('.close-button');
        let editingRow = null;

        const openModal = () => {
             if (!editingRow) {
                modalTitle.textContent = 'Add New Room';
                document.getElementById('roomNumber').readOnly = false;
                roomForm.reset();
             }
             roomModal.style.display = 'block';
        }
        const closeModal = () => {
            roomModal.style.display = 'none';
            editingRow = null; 
            roomForm.reset(); 
            document.getElementById('roomNumber').readOnly = false;
        };

        if(addBtn) addBtn.addEventListener('click', () => { 
            editingRow = null;
            openModal(); 
        });

        const roomTable = document.querySelector('.rooms-page .data-table');
        if(roomTable) {
            roomTable.addEventListener('click', async (e) => {
                if (e.target.classList.contains('edit')) {
                    editingRow = e.target.closest('tr'); 
                    const cells = editingRow.children; 
                    document.getElementById('roomNumber').value = cells[0].textContent; 
                    document.getElementById('roomCapacity').value = cells[1].textContent; 
                    document.getElementById('roomType').value = cells[2].textContent; 
                    modalTitle.textContent = 'Edit Room'; 
                    document.getElementById('roomNumber').readOnly = true;
                    openModal();
                } else if (e.target.classList.contains('delete')) {
                    const rowToDelete = e.target.closest('tr');
                    const roomNumberToDelete = rowToDelete.children[0].textContent;
                    if (confirm(`Are you sure you want to delete room ${roomNumberToDelete}?`)) {
                        try {
                            const response = await fetch(`http://localhost:3000/api/rooms/${roomNumberToDelete}`, {
                                method: 'DELETE',
                            });

                            if (!response.ok) {
                                let errorMsg = response.statusText;
                                try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (jsonError) { /* ignore */ }
                                console.error("Error deleting room:", response.status, errorMsg);
                                alert(`Error deleting room: ${errorMsg}`);
                                return;
                            }
                            console.log(`Room ${roomNumberToDelete} deleted successfully`);
                            loadAndRenderRooms(); // Reload table
                        } catch (error) {
                            console.error("Network error deleting room:", error);
                            alert("Could not connect to server to delete room.");
                        }
                    }
                }
            });
        }

        roomForm.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            const number = document.getElementById('roomNumber').value; 
            const capacity = parseInt(document.getElementById('roomCapacity').value); 
            const type = document.getElementById('roomType').value;
            
            const roomData = { capacity: capacity, type: type };
            let url = 'http://localhost:3000/api/rooms';
            let method = 'POST';

            if (editingRow) {
                const originalNumber = number;
                url = `http://localhost:3000/api/rooms/${originalNumber}`;
                method = 'PUT';
                if (isNaN(capacity) || !type) {
                     alert("Capacity and Type cannot be empty when editing.");
                     return;
                }
            } else {
                roomData.room_number = number;
                if (!number || isNaN(capacity) || !type) {
                    alert("Please fill in all fields correctly for the new room.");
                    return;
                }
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(roomData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Error ${editingRow ? 'updating' : 'adding'} room:`, response.status, errorData);
                    alert(`Error ${editingRow ? 'updating' : 'adding'} room: ${errorData.message || response.statusText}`);
                    return;
                }

                console.log(`Room ${editingRow ? 'updated' : 'added'} successfully`);
                closeModal();
                loadAndRenderRooms(); // Reload the table

            } catch (error) {
                console.error(`Network error ${editingRow ? 'updating' : 'adding'} room:`, error);
                alert(`Could not connect to server to ${editingRow ? 'update' : 'add'} room.`);
            }
        });
        
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == roomModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR SECTIONS PAGE (sections.html) --- [NEW] ---
    // =================================================================
    const sectionModal = document.getElementById('sectionModal');
    if (sectionModal) {
        async function loadAndRenderSections() {
            const sections = await fetchSections();
            renderSectionsTable(sections);
        }
        loadAndRenderSections();

        const addBtn = document.querySelector('body.sections-page .main-header .publish-btn');
        const sectionForm = document.getElementById('sectionForm');
        const modalTitle = sectionModal.querySelector('#modalTitle');
        const closeModalBtn = sectionModal.querySelector('.close-button');
        let editingRow = null;

        const openModal = () => {
             if (!editingRow) {
                modalTitle.textContent = 'Add New Section';
                document.getElementById('sectionId').readOnly = false;
                sectionForm.reset();
             }
             sectionModal.style.display = 'block';
        }
        const closeModal = () => {
            sectionModal.style.display = 'none';
            editingRow = null; 
            sectionForm.reset(); 
            document.getElementById('sectionId').readOnly = false;
        };

        if(addBtn) addBtn.addEventListener('click', () => { 
            editingRow = null;
            openModal(); 
        });

        const sectionTable = document.querySelector('.sections-page .data-table');
        if(sectionTable) {
            sectionTable.addEventListener('click', async (e) => {
                if (e.target.classList.contains('edit')) {
                    editingRow = e.target.closest('tr'); 
                    const cells = editingRow.children; 
                    document.getElementById('sectionId').value = cells[0].textContent; 
                    document.getElementById('sectionDept').value = cells[1].textContent; 
                    document.getElementById('sectionSem').value = cells[2].textContent;
                    document.getElementById('sectionName').value = cells[3].textContent; 
                    modalTitle.textContent = 'Edit Section'; 
                    document.getElementById('sectionId').readOnly = true;
                    openModal();
                } else if (e.target.classList.contains('delete')) {
                    const rowToDelete = e.target.closest('tr');
                    const sectionIdToDelete = rowToDelete.children[0].textContent;
                    if (confirm(`Are you sure you want to delete section ${sectionIdToDelete}?`)) {
                        try {
                            const response = await fetch(`http://localhost:3000/api/sections/${sectionIdToDelete}`, {
                                method: 'DELETE',
                            });

                            if (!response.ok) {
                                let errorMsg = response.statusText;
                                try { const errorData = await response.json(); errorMsg = errorData.message || errorMsg; } catch (jsonError) { /* ignore */ }
                                console.error("Error deleting section:", response.status, errorMsg);
                                alert(`Error deleting section: ${errorMsg}`);
                                return;
                            }
                            console.log(`Section ${sectionIdToDelete} deleted successfully`);
                            loadAndRenderSections(); // Reload table
                        } catch (error) {
                            console.error("Network error deleting section:", error);
                            alert("Could not connect to server to delete section.");
                        }
                    }
                }
            });
        }

        sectionForm.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            const id = document.getElementById('sectionId').value;
            const dept = document.getElementById('sectionDept').value;
            const sem = parseInt(document.getElementById('sectionSem').value); 
            const name = document.getElementById('sectionName').value;
            
            const sectionData = { 
                department: dept, 
                semester: sem,
                section_name: name
            };

            let url = 'http://localhost:3000/api/sections';
            let method = 'POST';

            if (editingRow) {
                const originalId = id;
                url = `http://localhost:3000/api/sections/${originalId}`;
                method = 'PUT';
                if (!dept || isNaN(sem) || !name) {
                     alert("All fields must be filled correctly when editing.");
                     return;
                }
            } else {
                sectionData.section_id = id;
                if (!id || !dept || isNaN(sem) || !name) {
                    alert("Please fill in all fields correctly for the new section.");
                    return;
                }
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sectionData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`Error ${editingRow ? 'updating' : 'adding'} section:`, response.status, errorData);
                    alert(`Error ${editingRow ? 'updating' : 'adding'} section: ${errorData.message || response.statusText}`);
                    return;
                }

                console.log(`Section ${editingRow ? 'updated' : 'added'} successfully`);
                closeModal();
                loadAndRenderSections(); // Reload the table

            } catch (error) {
                console.error(`Network error ${editingRow ? 'updating' : 'adding'} section:`, error);
                alert(`Could not connect to server to ${editingRow ? 'update' : 'add'} section.`);
            }
        });
        
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == sectionModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR SETTINGS PAGE (settings.html)
    // =================================================================
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        const maxHoursInput = document.getElementById('max-hours');
        const lunchStartInput = document.getElementById('lunchBreakStart');
        const lunchDurationInput = document.getElementById('lunchBreakDuration');
        const teaStartInput = document.getElementById('teaBreakStart');
        const teaDurationInput = document.getElementById('teaBreakDuration');
        const darkModeToggle = document.getElementById('darkModeToggle');
        darkModeToggle.addEventListener('change', () => { document.body.classList.toggle('dark-mode'); });
        const loadSettings = () => { maxHoursInput.value = localStorage.getItem('maxHours') || '3'; lunchStartInput.value = localStorage.getItem('lunchBreakStart') || '12:45'; lunchDurationInput.value = localStorage.getItem('lunchBreakDuration') || '45'; teaStartInput.value = localStorage.getItem('teaBreakStart') || '10:30'; teaDurationInput.value = localStorage.getItem('teaBreakDuration') || '15'; const isDarkMode = localStorage.getItem('darkMode') === 'true'; darkModeToggle.checked = isDarkMode; if (isDarkMode) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode'); };
        saveBtn.addEventListener('click', () => { localStorage.setItem('maxHours', maxHoursInput.value); localStorage.setItem('lunchBreakStart', lunchStartInput.value); localStorage.setItem('lunchBreakDuration', lunchDurationInput.value); localStorage.setItem('teaBreakStart', teaStartInput.value); localStorage.setItem('teaBreakDuration', teaDurationInput.value); localStorage.setItem('darkMode', darkModeToggle.checked); alert('Settings saved!'); if (darkModeToggle.checked) document.body.classList.add('dark-mode'); else document.body.classList.remove('dark-mode'); });
        loadSettings();
    }

    // =================================================================
    // == LOGIC FOR LOGIN/SIGNUP PAGE (login.html)
    // =================================================================
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupLink = document.getElementById('showSignup');
    const showLoginLink = document.getElementById('showLogin');
    const formTitle = document.getElementById('formTitle');

    if (loginForm && signupForm) { // Only run if we are on the login page
        const loginErrorEl = document.getElementById('loginError');
        const signupErrorEl = document.getElementById('signupError');

        showSignupLink.addEventListener('click', (e) => { 
            e.preventDefault(); 
            loginErrorEl.textContent = ''; // Clear errors
            signupErrorEl.textContent = '';
            loginForm.style.display = 'none'; 
            signupForm.style.display = 'block'; 
            formTitle.textContent = 'Sign Up'; 
        });
        showLoginLink.addEventListener('click', (e) => { 
            e.preventDefault(); 
            loginErrorEl.textContent = ''; // Clear errors
            signupErrorEl.textContent = '';
            signupForm.style.display = 'none'; 
            loginForm.style.display = 'block'; 
            formTitle.textContent = 'Login'; 
        });
        
        // --- LOGIN FORM SUBMISSION ---
        loginForm.addEventListener('submit', async (e) => { 
            e.preventDefault();
            loginErrorEl.textContent = ''; // Clear previous errors
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const loginButton = loginForm.querySelector('.auth-btn');
            loginButton.textContent = 'Logging in...';
            loginButton.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }

                // --- SUCCESS ---
                console.log(data.message);
                // We're not using tokens yet, so just redirect
                window.location.href = 'dashboard.html'; 

            } catch (error) {
                loginErrorEl.textContent = error.message;
            } finally {
                loginButton.textContent = 'Login';
                loginButton.disabled = false;
            }
        });
        
        // --- SIGNUP FORM SUBMISSION ---
        signupForm.addEventListener('submit', async (e) => { 
            e.preventDefault(); 
            signupErrorEl.textContent = ''; // Clear previous errors
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const signupButton = signupForm.querySelector('.auth-btn');
            signupButton.textContent = 'Signing up...';
            signupButton.disabled = true;
            
            try {
                 const response = await fetch('http://localhost:3000/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Signup failed');
                }

                // --- SUCCESS ---
                alert('Signup successful! Please log in.');
                showLoginLink.click(); // Switch to login form

            } catch (error) {
                signupErrorEl.textContent = error.message;
            } finally {
                signupButton.textContent = 'Sign Up';
                signupButton.disabled = false;
            }
        });
    }

}); // <<< THIS IS THE SINGLE CLOSING BRACE for DOMContentLoaded

// =================================================================
// == HELPER FUNCTIONS (FOR TIMETABLE PAGE)
// =================================================================
async function fetchTimetableData() {
    console.log("Requesting new timetable from backend...");
    const courses = [{ course: "CS-101", faculty: "Dr. Grant", room: "301" },{ course: "MA-210", faculty: "Dr. Malcolm", room: "205" },{ course: "BIO-150", faculty: "Dr. Sattler", room: "Lab 2" },{ course: "PHY-300", faculty: "Dr. Wu", room: "104" }];
    const timeSlots = ["08:30", "09:30", "11:00", "12:00", "13:30", "14:30", "15:30"];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let generatedTimetable = {};
    const classCount = Math.floor(Math.random() * 3) + 5;
    for (let i = 0; i < classCount; i++) { const course = courses[Math.floor(Math.random() * courses.length)]; const day = days[Math.floor(Math.random() * days.length)]; const time = timeSlots[Math.floor(Math.random() * timeSlots.length)]; if (!generatedTimetable[day]) { generatedTimetable[day] = {}; } generatedTimetable[day][time] = { ...course, conflict: Math.random() > 0.8 }; }
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Data received!", generatedTimetable);
    return generatedTimetable;
}

function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    if (!tbody) return;
    const lunchStart = localStorage.getItem('lunchBreakStart') || '12:45';
    const lunchDuration = parseInt(localStorage.getItem('lunchBreakDuration') || '45');
    const teaStart = localStorage.getItem('teaBreakStart') || '10:30';
    const teaDuration = parseInt(localStorage.getItem('teaBreakDuration') || '15');
    const startTime = 8 * 60 + 30; const endTime = 16 * 60 + 30; const interval = 15;
    let tableHTML = '';
    const dayMap = { "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5 };
    const dayNames = Object.keys(dayMap);
    let occupiedSlots = {};
    for (let min = startTime; min < endTime; min += interval) {
        const hour = Math.floor(min / 60).toString().padStart(2, '0');
        const minute = (min % 60).toString().padStart(2, '0');
        const currentTime = `${hour}:${minute}`;
        if (occupiedSlots[`break-${min}`]) { continue; }
        const timeLabel = (minute === '00' || minute === '30') ? currentTime : '';
        if (currentTime === lunchStart) { const rowspan = lunchDuration / interval; const validRowspan = Math.max(1, Math.round(rowspan)); tableHTML += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" rowspan="${validRowspan}" class="break-slot">Lunch Break</td></tr>`; for (let i = 1; i < validRowspan; i++) { occupiedSlots[`break-${min + i * interval}`] = true; } continue; }
        if (currentTime === teaStart) { const rowspan = teaDuration / interval; const validRowspan = Math.max(1, Math.round(rowspan)); tableHTML += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" rowspan="${validRowspan}" class="break-slot">Tea Break</td></tr>`; for (let i = 1; i < validRowspan; i++) { occupiedSlots[`break-${min + i * interval}`] = true; } continue; }
        tableHTML += `<tr><td class="time-cell">${timeLabel}</td>`;
        for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
            if (occupiedSlots[`${dayIndex}-${min}`]) { continue; }
            let cellContent = ''; let rowspan = 1; const dayName = dayNames[dayIndex];
            if (data[dayName] && data[dayName][currentTime]) { rowspan = 60 / interval; const slotData = data[dayName][currentTime]; cellContent = `<td rowspan="${rowspan}" class="timetable-slot ${slotData.conflict ? 'conflict' : ''}"><strong>${slotData.course}</strong><span>${slotData.faculty}</span><em>${slotData.room}</em></td>`; } else { cellContent = '<td></td>'; }
            tableHTML += cellContent;
            if (rowspan > 1) { const validRowspan = Math.max(1, Math.round(rowspan)); for (let i = 1; i < validRowspan; i++) { occupiedSlots[`${dayIndex}-${min + i * interval}`] = true; } }
        }
        tableHTML += '</tr>';
    }
    tbody.innerHTML = tableHTML;
    const timetableModal = document.getElementById('editModal');
    if (timetableModal) { const openModal = () => timetableModal.style.display = 'block'; tbody.querySelectorAll('.timetable-slot').forEach(slot => { slot.addEventListener('click', openModal); }); }
}

// =================================================================
// == HELPER FUNCTIONS (FOR COURSES PAGE)
// =================================================================
async function fetchCourses() {
    console.log("Fetching courses from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/courses');
        if (!response.ok) {
            console.error("Error fetching courses:", response.status, response.statusText);
            if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
            alert(`Error loading courses: ${response.statusText}`);
            return null;
        }
        const courses = await response.json();
        console.log("Courses received:", courses);
        return courses;
    } catch (error) {
        console.error("Network error fetching courses:", error);
        if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
        alert("Could not connect to the server to load courses.");
        return null;
    }
}

function renderCoursesTable(courses) {
    const tableBody = document.querySelector('.courses-page .data-table tbody'); 
    if (!tableBody) {
        if (document.body.classList.contains('courses-page')) { console.error("Could not find courses table body to render!"); }
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows
    if (!courses || courses.length === 0) { tableBody.innerHTML = '<tr><td colspan="4">No courses found.</td></tr>'; return; }
    courses.forEach(course => {
        const rowHTML = `
            <tr>
                <td>${course.course_code || course._id}</td>
                <td>${course.course_name}</td>
                <td>${course.credits}</td>
                <td>
                    <button class="action-btn-table edit">Edit</button>
                    <button class="action-btn-table delete">Delete</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// =================================================================
// == HELPER FUNCTIONS (FOR FACULTY PAGE)
// =================================================================
async function fetchFaculty() {
    console.log("Fetching faculty from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/faculty'); 
        if (!response.ok) {
            console.error("Error fetching faculty:", response.status, response.statusText);
            if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
            alert(`Error loading faculty: ${response.statusText}`);
            return null;
        }
        const faculty = await response.json();
        console.log("Faculty received:", faculty);
        return faculty;
    } catch (error) {
        console.error("Network error fetching faculty:", error);
        if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
        alert("Could not connect to the server to load faculty.");
        return null;
    }
}

function renderFacultyTable(facultyMembers) {
    const tableBody = document.querySelector('.faculty-page .data-table tbody');
    if (!tableBody) {
        if (document.body.classList.contains('faculty-page')) {
           console.error("Could not find faculty table body to render!");
        }
        return;
    }

    tableBody.innerHTML = ''; 

    if (!facultyMembers || facultyMembers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No faculty members found.</td></tr>'; // Colspan is 5 now
        return;
    }

    facultyMembers.forEach(faculty => {
        const rowHTML = `
            <tr>
                <td>${faculty.faculty_id || faculty._id}</td>
                <td>${faculty.name}</td>
                <td>${faculty.department}</td>
                <td>${faculty.designation}</td> <td>
                    <button class="action-btn-table edit">Edit</button>
                    <button class="action-btn-table delete">Delete</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// =================================================================
// == HELPER FUNCTIONS (FOR ROOMS PAGE)
// =================================================================
async function fetchRooms() {
    console.log("Fetching rooms from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/rooms'); 
        if (!response.ok) {
            console.error("Error fetching rooms:", response.status, response.statusText);
            if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
            alert(`Error loading rooms: ${response.statusText}`);
            return null;
        }
        const rooms = await response.json();
        console.log("Rooms received:", rooms);
        return rooms;
    } catch (error) {
        console.error("Network error fetching rooms:", error);
        if (document.body.classList.contains('dashboard-page')) return null; // Don't alert on dashboard
        alert("Could not connect to the server to load rooms.");
        return null;
    }
}

function renderRoomsTable(rooms) {
    const tableBody = document.querySelector('.rooms-page .data-table tbody');
    if (!tableBody) {
        if (document.body.classList.contains('rooms-page')) {
           console.error("Could not find rooms table body to render!");
        }
        return;
    }

    tableBody.innerHTML = ''; 

    if (!rooms || rooms.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No rooms found.</td></tr>';
        return;
    }

    rooms.forEach(room => {
        const rowHTML = `
            <tr>
                <td>${room.room_number || room._id}</td>
                <td>${room.capacity}</td>
                <td>${room.type}</td>
                <td>
                    <button class="action-btn-table edit">Edit</button>
                    <button class="action-btn-table delete">Delete</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

// =================================================================
// == HELPER FUNCTIONS (FOR SECTIONS PAGE) --- [NEW] ---
// =================================================================
async function fetchSections() {
    console.log("Fetching sections from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/sections'); 
        if (!response.ok) {
            console.error("Error fetching sections:", response.status, response.statusText);
            alert(`Error loading sections: ${response.statusText}`);
            return null;
        }
        const sections = await response.json();
        console.log("Sections received:", sections);
        return sections;
    } catch (error) {
        console.error("Network error fetching sections:", error);
        alert("Could not connect to the server to load sections.");
        return null;
    }
}

function renderSectionsTable(sections) {
    const tableBody = document.querySelector('.sections-page .data-table tbody');
    if (!tableBody) {
        if (document.body.classList.contains('sections-page')) {
           console.error("Could not find sections table body to render!");
        }
        return;
    }

    tableBody.innerHTML = ''; 

    if (!sections || sections.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">No sections found.</td></tr>'; // Colspan is 5
        return;
    }

    sections.forEach(section => {
        const rowHTML = `
            <tr>
                <td>${section.section_id || section._id}</td>
                <td>${section.department}</td>
                <td>${section.semester}</td>
                <td>${section.section_name}</td>
                <td>
                    <button class="action-btn-table edit">Edit</button>
                    <button class="action-btn-table delete">Delete</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}