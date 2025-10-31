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
    if (occupancyChartCanvas) {
        const ctx = occupancyChartCanvas.getContext('2d');
        new Chart(ctx, { type: 'bar', data: { labels: ['Lecture Halls', 'Computer Labs', 'Science Labs', 'Auditoriums'], datasets: [{ label: 'Occupied Rooms', data: [20, 15, 12, 3], backgroundColor: ['rgba(54, 162, 235, 0.6)','rgba(255, 99, 132, 0.6)','rgba(75, 192, 192, 0.6)','rgba(153, 102, 255, 0.6)'], borderColor: ['rgba(54, 162, 235, 1)','rgba(255, 99, 132, 1)','rgba(75, 192, 192, 1)','rgba(153, 102, 255, 1)'], borderWidth: 1 }] }, options: { responsive: true, scales: { y: { beginAtZero: true } } } });
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
    // == LOGIC FOR FACULTY PAGE (faculty.html)  --- [UPDATED SECTION] ---
    // =================================================================
    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) {
        // --- Fetch and render faculty on page load ---
        async function loadAndRenderFaculty() {
            const faculty = await fetchFaculty(); // Calls the helper function
            renderFacultyTable(faculty); // Calls the helper function
        }
        loadAndRenderFaculty(); // Call the function immediately

        const addBtn = document.querySelector('body.faculty-page .main-header .publish-btn');
        const facultyForm = document.getElementById('facultyForm');
        const modalTitle = facultyModal.querySelector('#modalTitle');
        const closeModalBtn = facultyModal.querySelector('.close-button');
        let editingRow = null; // Variable to track which row we are editing

        const openModal = () => {
             // Reset form state for adding unless editingRow is set
             if (!editingRow) {
                modalTitle.textContent = 'Add New Faculty';
                document.getElementById('facultyId').readOnly = false; // Make ID editable when adding
                facultyForm.reset();
             }
             facultyModal.style.display = 'block';
        }
        const closeModal = () => {
            facultyModal.style.display = 'none';
            editingRow = null; // Clear editing state
            facultyForm.reset(); // Clear form fields
            document.getElementById('facultyId').readOnly = false; // Ensure ID is editable again
        };

        if(addBtn) addBtn.addEventListener('click', () => {
             editingRow = null; // Ensure we are in "add" mode
             openModal();
        });

        const facultyTable = document.querySelector('.faculty-page .data-table');
         if (facultyTable) {
            facultyTable.addEventListener('click', async (e) => { // Made async
                if (e.target.classList.contains('edit')) {
                    editingRow = e.target.closest('tr');
                    const cells = editingRow.children;
                    document.getElementById('facultyId').value = cells[0].textContent; // Populate ID
                    document.getElementById('facultyName').value = cells[1].textContent;
                    document.getElementById('facultyDept').value = cells[2].textContent;
                    modalTitle.textContent = 'Edit Faculty';
                    document.getElementById('facultyId').readOnly = true; // Make ID read-only when editing
                    openModal();
                } else if (e.target.classList.contains('delete')) {
                    // --- Connect DELETE button to backend ---
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

        // --- UPDATED Submit Listener for ADDING and EDITING faculty ---
        facultyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('facultyId').value;
            const name = document.getElementById('facultyName').value;
            const dept = document.getElementById('facultyDept').value;

            // Data sent in the request body
            const facultyData = {
                name: name,
                department: dept
            };

            let url = 'http://localhost:3000/api/faculty';
            let method = 'POST';

            if (editingRow) {
                // UPDATE (PUT) request
                const originalId = id; // Get ID from read-only form
                url = `http://localhost:3000/api/faculty/${originalId}`;
                method = 'PUT';
                if (!name || !dept) {
                     alert("Name and Department cannot be empty when editing.");
                     return;
                }
            } else {
                // ADD (POST) request
                facultyData.faculty_id = id; // Add the ID for POST
                if (!id || !name || !dept) {
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
        // --- END OF UPDATED Submit Listener ---

        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == facultyModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR ROOMS PAGE (rooms.html)
    // =================================================================
    const roomModal = document.getElementById('roomModal');
    if (roomModal) {
         // NOTE: This section still uses frontend-only logic. Needs backend integration.
        const addBtn = document.querySelector('body.rooms-page .main-header .publish-btn');
        const roomForm = document.getElementById('roomForm');
        const modalTitle = roomModal.querySelector('#modalTitle');
        const closeModalBtn = roomModal.querySelector('.close-button');
        let editingRow = null;
        const openModal = () => roomModal.style.display = 'block';
        const closeModal = () => { roomModal.style.display = 'none'; editingRow = null; roomForm.reset(); };
        if(addBtn) addBtn.addEventListener('click', () => { modalTitle.textContent = 'Add New Room'; openModal(); });
        const roomTable = document.querySelector('.rooms-page .data-table');
        if(roomTable) {
            roomTable.addEventListener('click', (e) => {
                if (e.target.classList.contains('edit')) {
                    editingRow = e.target.closest('tr'); const cells = editingRow.children; document.getElementById('roomNumber').value = cells[0].textContent; document.getElementById('roomCapacity').value = cells[1].textContent; document.getElementById('roomType').value = cells[2].textContent; modalTitle.textContent = 'Edit Room'; openModal();
                } else if (e.target.classList.contains('delete')) {
                    if (confirm('Are you sure you want to delete this room?')) { e.target.closest('tr').remove(); }
                }
            });
        }
        roomForm.addEventListener('submit', (e) => { e.preventDefault(); const number = document.getElementById('roomNumber').value; const capacity = document.getElementById('roomCapacity').value; const type = document.getElementById('roomType').value; if (editingRow) { const cells = editingRow.children; cells[0].textContent = number; cells[1].textContent = capacity; cells[2].textContent = type; } else { document.querySelector('.data-table tbody').insertAdjacentHTML('beforeend', `<tr><td>${number}</td><td>${capacity}</td><td>${type}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`); } closeModal(); });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == roomModal) closeModal(); });
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
        showSignupLink.addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; signupForm.style.display = 'block'; formTitle.textContent = 'Sign Up'; });
        showLoginLink.addEventListener('click', (e) => { e.preventDefault(); signupForm.style.display = 'none'; loginForm.style.display = 'block'; formTitle.textContent = 'Login'; });
        loginForm.addEventListener('submit', (e) => { e.preventDefault(); alert('Login attempt (no backend yet!)'); window.location.href = 'dashboard.html'; });
        signupForm.addEventListener('submit', (e) => { e.preventDefault(); alert('Signup attempt (no backend yet!)'); signupForm.style.display = 'none'; loginForm.style.display = 'block'; formTitle.textContent = 'Login'; });
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
// == HELPER FUNCTIONS (FOR DATA PAGES LIKE COURSES)
// =================================================================
async function fetchCourses() {
    console.log("Fetching courses from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/courses'); // URL of our GET endpoint
        if (!response.ok) {
            console.error("Error fetching courses:", response.status, response.statusText);
            alert(`Error loading courses: ${response.statusText}`);
            return null;
        }
        const courses = await response.json();
        console.log("Courses received:", courses);
        return courses;
    } catch (error) {
        console.error("Network error fetching courses:", error);
        alert("Could not connect to the server to load courses.");
        return null;
    }
}

function renderCoursesTable(courses) {
    const tableBody = document.querySelector('.courses-page .data-table tbody'); // Target the courses table body
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
// == HELPER FUNCTIONS (FOR DATA PAGES LIKE FACULTY)
// =================================================================

/**
 * Fetches all faculty from the backend API.
 * Returns an array of faculty objects or null if an error occurs.
 */
async function fetchFaculty() {
    console.log("Fetching faculty from backend...");
    try {
        const response = await fetch('http://localhost:3000/api/faculty'); // URL of faculty GET endpoint
        if (!response.ok) {
            console.error("Error fetching faculty:", response.status, response.statusText);
            alert(`Error loading faculty: ${response.statusText}`);
            return null;
        }
        const faculty = await response.json();
        console.log("Faculty received:", faculty);
        return faculty;
    } catch (error) {
        console.error("Network error fetching faculty:", error);
        alert("Could not connect to the server to load faculty.");
        return null;
    }
}

/**
 * Renders the faculty data into the HTML table.
 * @param {Array} facultyMembers - An array of faculty objects.
 */
function renderFacultyTable(facultyMembers) {
    // Target the faculty table body specifically
    const tableBody = document.querySelector('.faculty-page .data-table tbody');
    if (!tableBody) {
        if (document.body.classList.contains('faculty-page')) {
           console.error("Could not find faculty table body to render!");
        }
        return;
    }

    tableBody.innerHTML = ''; // Clear existing rows

    if (!facultyMembers || facultyMembers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No faculty members found.</td></tr>'; // Colspan is 4
        return;
    }

    facultyMembers.forEach(faculty => {
        const rowHTML = `
            <tr>
                <td>${faculty.faculty_id || faculty._id}</td>
                <td>${faculty.name}</td>
                <td>${faculty.department}</td>
                <td>
                    <button class="action-btn-table edit">Edit</button>
                    <button class="action-btn-table delete">Delete</button>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });
}