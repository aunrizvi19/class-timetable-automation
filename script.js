document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // == LOGIC FOR TIMETABLE PAGE (index.html)
    // =================================================================
    const timetableModal = document.getElementById('editModal');
    if (timetableModal) {
        const closeButton = timetableModal.querySelector('.close-button');
        const timetableSlots = document.querySelectorAll('.timetable-slot');
        const openModal = () => timetableModal.style.display = 'block';
        const closeModal = () => timetableModal.style.display = 'none';
        timetableSlots.forEach(slot => slot.addEventListener('click', openModal));
        closeButton.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == timetableModal) closeModal(); });
    }
    const generateBtn = document.querySelector('.generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => { 
            const timetableData = await fetchTimetableData();
            populateTimetable(timetableData);
        });
    }

    // =================================================================
    // == LOGIC FOR DASHBOARD PAGE (dashboard.html)
    // =================================================================
    const occupancyChartCanvas = document.getElementById('occupancyChart');
    if (occupancyChartCanvas) {
        const ctx = occupancyChartCanvas.getContext('2d');
        const occupancyChart = new Chart(ctx, {
            type: 'bar', // Type of chart
            data: {
                labels: ['Lecture Halls', 'Computer Labs', 'Science Labs', 'Auditoriums'],
                datasets: [{
                    label: 'Occupied Rooms',
                    data: [20, 15, 12, 3], // Sample data
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // =================================================================
    // == LOGIC FOR COURSES PAGE (courses.html)
    // =================================================================
    const courseModal = document.getElementById('courseModal');
    if (courseModal) {
        const addCourseBtn = document.querySelector('.publish-btn');
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
                if (confirm('Are you sure you want to delete this course?')) {
                    e.target.closest('tr').remove();
                }
            }
        });
        courseForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('courseCode').value;
            const name = document.getElementById('courseName').value;
            const credits = document.getElementById('courseCredits').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = code;
                cells[1].textContent = name;
                cells[2].textContent = credits;
            } else {
                const tableBody = document.querySelector('.data-table tbody');
                tableBody.insertAdjacentHTML('beforeend', `<tr><td>${code}</td><td>${name}</td><td>${credits}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == courseModal) closeModal(); });
    }

    // =================================================================
    // == LOGIC FOR FACULTY PAGE (faculty.html)
    // =================================================================
    const facultyModal = document.getElementById('facultyModal');
    if (facultyModal) {
        const addBtn = document.querySelector('.publish-btn');
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
                if (confirm('Are you sure you want to delete this faculty member?')) {
                    e.target.closest('tr').remove();
                }
            }
        });
        facultyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('facultyId').value;
            const name = document.getElementById('facultyName').value;
            const dept = document.getElementById('facultyDept').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = id;
                cells[1].textContent = name;
                cells[2].textContent = dept;
            } else {
                const tableBody = document.querySelector('.data-table tbody');
                tableBody.insertAdjacentHTML('beforeend', `<tr><td>${id}</td><td>${name}</td><td>${dept}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == facultyModal) closeModal(); });
    }
    
    // =================================================================
    // == LOGIC FOR ROOMS PAGE (rooms.html)
    // =================================================================
    const roomModal = document.getElementById('roomModal');
    if (roomModal) {
        const addBtn = document.querySelector('.publish-btn');
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
                if (confirm('Are you sure you want to delete this room?')) {
                    e.target.closest('tr').remove();
                }
            }
        });
        roomForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const number = document.getElementById('roomNumber').value;
            const capacity = document.getElementById('roomCapacity').value;
            const type = document.getElementById('roomType').value;
            if (editingRow) {
                const cells = editingRow.children;
                cells[0].textContent = number;
                cells[1].textContent = capacity;
                cells[2].textContent = type;
            } else {
                const tableBody = document.querySelector('.data-table tbody');
                tableBody.insertAdjacentHTML('beforeend', `<tr><td>${number}</td><td>${capacity}</td><td>${type}</td><td><button class="action-btn-table edit">Edit</button><button class="action-btn-table delete">Delete</button></td></tr>`);
            }
            closeModal();
        });
        closeModalBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (event) => { if (event.target == roomModal) closeModal(); });
    }
});

// =================================================================
// == HELPER FUNCTIONS
// =================================================================
async function fetchTimetableData() {
    console.log("Requesting new timetable from backend...");
    const sampleData = {
        "Monday": {
            "09:00 - 10:00": { course: "CS-310", faculty: "Dr. Wu", room: "Lab 5", conflict: true },
            "10:00 - 11:00": { course: "EE-101", faculty: "Mr. Arnold", room: "202" }
        },
        "Tuesday": {
             "11:00 - 12:00": { course: "PH-250", faculty: "Dr. Sattler", room: "104" }
        }
    };
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Data received!", sampleData);
    return sampleData;
}

function populateTimetable(data) {
    const tbody = document.querySelector('.timetable-grid tbody');
    tbody.innerHTML = '';
    const newRow = `
        <tr>
            <td>09:00 - 10:00</td>
            <td>
                <div class="timetable-slot ${data.Monday['09:00 - 10:00'].conflict ? 'conflict' : ''}">
                    <strong>${data.Monday['09:00 - 10:00'].course}</strong>
                    <span>${data.Monday['09:00 - 10:00'].faculty}</span>
                    <em>${data.Monday['09:00 - 10:00'].room}</em>
                </div>
            </td>
            <td></td><td></td><td></td><td></td>
        </tr>
    `;
    tbody.innerHTML = newRow;
}