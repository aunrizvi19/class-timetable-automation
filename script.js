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
    // == ALL OTHER PAGE LOGIC (Dashboard, Courses, Faculty, Rooms, Settings)
    // =================================================================
    // This section remains unchanged. The full code is included below.
    const occupancyChartCanvas = document.getElementById('occupancyChart');
    if (occupancyChartCanvas) { /* ... */ }
    const courseModal = document.getElementById('courseModal');
    if (courseModal) { /* ... */ }
    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) { /* ... */ }
    const roomModal = document.getElementById('roomModal');
    if (roomModal) { /* ... */ }
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) { /* ... */ }
});


// =================================================================
// == HELPER FUNCTIONS (FOR TIMETABLE PAGE)
// =================================================================
async function fetchTimetableData() {
    console.log("Requesting new timetable from backend...");
    const courses = [{ course: "CS-101", faculty: "Dr. Grant", room: "301" },{ course: "MA-210", faculty: "Dr. Malcolm", room: "205" },{ course: "BIO-150", faculty: "Dr. Sattler", room: "Lab 2" },{ course: "PHY-300", faculty: "Dr. Wu", room: "104" }];
    const timeSlots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
    // UPDATED: Added Saturday to the pool of possible days
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let generatedTimetable = {};
    const classCount = Math.floor(Math.random() * 3) + 5; // Generate a few more classes
    for (let i = 0; i < classCount; i++) {
        const course = courses[Math.floor(Math.random() * courses.length)];
        const day = days[Math.floor(Math.random() * days.length)];
        const time = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        if (!generatedTimetable[day]) { generatedTimetable[day] = {}; }
        generatedTimetable[day][time] = { ...course, conflict: Math.random() > 0.8 };
    }
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
    
    const startTime = 9 * 60; 
    const endTime = 16 * 60;
    const interval = 15;
    let tableHTML = '';
    // UPDATED: Added Saturday to the day map
    const dayMap = { "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5 };
    const dayNames = Object.keys(dayMap);
    let occupiedSlots = {};

    for (let min = startTime; min < endTime; min += interval) {
        const hour = Math.floor(min / 60).toString().padStart(2, '0');
        const minute = (min % 60).toString().padStart(2, '0');
        const currentTime = `${hour}:${minute}`;

        // Check if this row is part of a previous rowspan (for breaks)
        if (occupiedSlots[`break-${min}`]) {
            continue;
        }

        const timeLabel = (minute === '00' || minute === '30') ? currentTime : '';
        
        // Improved Break Logic
        if (currentTime === lunchStart) {
            const rowspan = lunchDuration / interval;
            tableHTML += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" rowspan="${rowspan}" class="break-slot">Lunch Break</td></tr>`;
            for (let i = 1; i < rowspan; i++) { occupiedSlots[`break-${min + i * interval}`] = true; }
            continue;
        }
        if (currentTime === teaStart) {
            const rowspan = teaDuration / interval;
            tableHTML += `<tr><td class="time-cell">${timeLabel}</td><td colspan="6" rowspan="${rowspan}" class="break-slot">Tea Break</td></tr>`;
            for (let i = 1; i < rowspan; i++) { occupiedSlots[`break-${min + i * interval}`] = true; }
            continue;
        }

        tableHTML += `<tr><td class="time-cell">${timeLabel}</td>`;

        // UPDATED: Loop to 6 days instead of 5
        for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
            if (occupiedSlots[`${dayIndex}-${min}`]) {
                continue;
            }

            let cellContent = '';
            let rowspan = 1;
            const dayName = dayNames[dayIndex];

            if (data[dayName] && data[dayName][currentTime]) {
                rowspan = 60 / interval; // Classes are 1 hour
                const slotData = data[dayName][currentTime];
                cellContent = `<td rowspan="${rowspan}" class="timetable-slot ${slotData.conflict ? 'conflict' : ''}"><strong>${slotData.course}</strong><span>${slotData.faculty}</span><em>${slotData.room}</em></td>`;
            } else {
                cellContent = '<td></td>';
            }
            
            tableHTML += cellContent;

            if (rowspan > 1) {
                for (let i = 1; i < rowspan; i++) {
                    occupiedSlots[`${dayIndex}-${min + i * interval}`] = true;
                }
            }
        }
        tableHTML += '</tr>';
    }
    tbody.innerHTML = tableHTML;
    
    // Add event listener for the newly created slots
    const timetableModal = document.getElementById('editModal');
    if (timetableModal) {
        const openModal = () => timetableModal.style.display = 'block';
        tbody.querySelectorAll('.timetable-slot').forEach(slot => {
            slot.addEventListener('click', openModal);
        });
    }
}


// --- Full, unchanged logic for other pages is included below ---

// (Full code for Dashboard, Courses, Faculty, Rooms, Settings modals and listeners)
document.addEventListener('DOMContentLoaded', () => {

    // ... (This part is already defined at the top, but shown here to represent the full file structure)

    const occupancyChartCanvas = document.getElementById('occupancyChart');
    if (occupancyChartCanvas) {
        const ctx = occupancyChartCanvas.getContext('2d');
        const occupancyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Lecture Halls', 'Computer Labs', 'Science Labs', 'Auditoriums'],
                datasets: [{
                    label: 'Occupied Rooms',
                    data: [20, 15, 12, 3],
                    backgroundColor: ['rgba(54, 162, 235, 0.6)','rgba(255, 99, 132, 0.6)','rgba(75, 192, 192, 0.6)','rgba(153, 102, 255, 0.6)'],
                    borderColor: ['rgba(54, 162, 235, 1)','rgba(255, 99, 132, 1)','rgba(75, 192, 192, 1)','rgba(153, 102, 255, 1)'],
                    borderWidth: 1
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    const courseModal = document.getElementById('courseModal');
    if (courseModal) {
        const addCourseBtn = document.querySelector('button.publish-btn');
        const courseForm = document.getElementById('courseForm');
        const modalTitle = courseModal.querySelector('#modalTitle');
        const closeModalBtn = courseModal.querySelector('.close-button');
        let editingRow = null;
        const openModal = () => courseModal.style.display = 'block';
        const closeModal = () => { courseModal.style.display = 'none'; editingRow = null; courseForm.reset(); };
        addCourseBtn.addEventListener('click', () => { modalTitle.textContent = 'Add New Course'; openModal(); });
        document.querySelector('.data-table').addEventListener('click', (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('courseCode').value = cells[0].textContent;
                document.getElementById('courseName').value = cells[1].textContent;
                document.getElementById('courseCredits').value = cells[2].textContent;
                modalTitle.textContent = 'Edit Course';
                openModal();
            } else if (e.target.classList.contains('delete')) {
                if (confirm('Are you sure you want to delete this course?')) { e.target.closest('tr').remove(); }
            }
        });
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('courseCode').value;
            const name = document.getElementById('courseName').value;
            const credits = document.getElementById('courseCredits').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = code; cells[1].textContent = name; cells[2].textContent = credits;
            } else {
                document.querySelector('.data-table tbody').insertAdjacentHTML('beforeend', `<tr><td>${code}</td><td>${name}</td><td>${credits}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == courseModal) closeModal(); });
    }

    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) {
        const addBtn = document.querySelector('button.publish-btn');
        const facultyForm = document.getElementById('facultyForm');
        const modalTitle = facultyModal.querySelector('#modalTitle');
        const closeModalBtn = facultyModal.querySelector('.close-button');
        let editingRow = null;
        const openModal = () => facultyModal.style.display = 'block';
        const closeModal = () => { facultyModal.style.display = 'none'; editingRow = null; facultyForm.reset(); };
        addBtn.addEventListener('click', () => { modalTitle.textContent = 'Add New Faculty'; openModal(); });
        document.querySelector('.data-table').addEventListener('click', (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('facultyId').value = cells[0].textContent;
                document.getElementById('facultyName').value = cells[1].textContent;
                document.getElementById('facultyDept').value = cells[2].textContent;
                modalTitle.textContent = 'Edit Faculty';
                openModal();
            } else if (e.target.classList.contains('delete')) {
                if (confirm('Are you sure you want to delete this faculty member?')) { e.target.closest('tr').remove(); }
            }
        });
        facultyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('facultyId').value;
            const name = document.getElementById('facultyName').value;
            const dept = document.getElementById('facultyDept').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = id; cells[1].textContent = name; cells[2].textContent = dept;
            } else {
                document.querySelector('.data-table tbody').insertAdjacentHTML('beforeend', `<tr><td>${id}</td><td>${name}</td><td>${dept}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == facultyModal) closeModal(); });
    }
    
    const roomModal = document.getElementById('roomModal');
    if (roomModal) {
        const addBtn = document.querySelector('button.publish-btn');
        const roomForm = document.getElementById('roomForm');
        const modalTitle = roomModal.querySelector('#modalTitle');
        const closeModalBtn = roomModal.querySelector('.close-button');
        let editingRow = null;
        const openModal = () => roomModal.style.display = 'block';
        const closeModal = () => { roomModal.style.display = 'none'; editingRow = null; roomForm.reset(); };
        addBtn.addEventListener('click', () => { modalTitle.textContent = 'Add New Room'; openModal(); });
        document.querySelector('.data-table').addEventListener('click', (e) => {
            if (e.target.classList.contains('edit')) {
                editingRow = e.target.closest('tr');
                const cells = editingRow.children;
                document.getElementById('roomNumber').value = cells[0].textContent;
                document.getElementById('roomCapacity').value = cells[1].textContent;
                document.getElementById('roomType').value = cells[2].textContent;
                modalTitle.textContent = 'Edit Room';
                openModal();
            } else if (e.target.classList.contains('delete')) {
                if (confirm('Are you sure you want to delete this room?')) { e.target.closest('tr').remove(); }
            }
        });
        roomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const number = document.getElementById('roomNumber').value;
            const capacity = document.getElementById('roomCapacity').value;
            const type = document.getElementById('roomType').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = number; cells[1].textContent = capacity; cells[2].textContent = type;
            } else {
                document.querySelector('.data-table tbody').insertAdjacentHTML('beforeend', `<tr><td>${number}</td><td>${capacity}</td><td>${type}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == roomModal) closeModal(); });
    }

    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        const maxHoursInput = document.getElementById('max-hours');
        const lunchStartInput = document.getElementById('lunchBreakStart');
        const lunchDurationInput = document.getElementById('lunchBreakDuration');
        const teaStartInput = document.getElementById('teaBreakStart');
        const teaDurationInput = document.getElementById('teaBreakDuration');
        const darkModeToggle = document.getElementById('darkModeToggle');

        darkModeToggle.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode');
        });

        const loadSettings = () => {
            maxHoursInput.value = localStorage.getItem('maxHours') || '3';
            lunchStartInput.value = localStorage.getItem('lunchBreakStart') || '12:45';
            lunchDurationInput.value = localStorage.getItem('lunchBreakDuration') || '45';
            teaStartInput.value = localStorage.getItem('teaBreakStart') || '10:30';
            teaDurationInput.value = localStorage.getItem('teaBreakDuration') || '15';
            const isDarkMode = localStorage.getItem('darkMode') === 'true';
            darkModeToggle.checked = isDarkMode;
            if (isDarkMode) document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
        };

        saveBtn.addEventListener('click', () => {
            localStorage.setItem('maxHours', maxHoursInput.value);
            localStorage.setItem('lunchBreakStart', lunchStartInput.value);
            localStorage.setItem('lunchBreakDuration', lunchDurationInput.value);
            localStorage.setItem('teaBreakStart', teaStartInput.value);
            localStorage.setItem('teaBreakDuration', teaDurationInput.value);
            localStorage.setItem('darkMode', darkModeToggle.checked);
            alert('Settings saved!');
            if (darkModeToggle.checked) document.body.classList.add('dark-mode');
            else document.body.classList.remove('dark-mode');
        });
        loadSettings();
    }
});