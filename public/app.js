document.addEventListener('DOMContentLoaded', () => {
    fetchStudents();

    // Modals
    const addModal = document.getElementById('add-student-modal');
    const detailModal = document.getElementById('student-detail-modal');
    const showAddBtn = document.getElementById('show-add-modal');
    const closeBtns = document.querySelectorAll('.close-modal');

    showAddBtn.onclick = () => addModal.style.display = 'block';

    closeBtns.forEach(btn => {
        btn.onclick = () => {
            addModal.style.display = 'none';
            detailModal.style.display = 'none';
        };
    });

    window.onclick = (event) => {
        if (event.target == addModal) addModal.style.display = 'none';
        if (event.target == detailModal) detailModal.style.display = 'none';
    };

    // Add Student Form
    const addForm = document.getElementById('add-student-form');
    addForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(addForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const res = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                addForm.reset();
                addModal.style.display = 'none';
                fetchStudents();
            } else {
                const err = await res.json();
                alert('エラー: ' + err.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Note Form
    const noteForm = document.getElementById('add-note-form');
    noteForm.onsubmit = async (e) => {
        e.preventDefault();
        const studentId = noteForm.dataset.studentId;
        const content = document.getElementById('note-content').value;

        try {
            const res = await fetch(`/api/students/${studentId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            if (res.ok) {
                document.getElementById('note-content').value = '';
                fetchNotes(studentId);
            }
        } catch (err) {
            console.error(err);
        }
    };
});

async function fetchStudents() {
    try {
        const res = await fetch('/api/students');
        const students = await res.json();
        renderStudents(students);
        updateStats(students);
    } catch (err) {
        console.error('Failed to fetch students:', err);
    }
}

function renderStudents(students) {
    const tbody = document.getElementById('student-list-body');
    tbody.innerHTML = '';

    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 600;">${student.name}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">${student.email}</div>
            </td>
            <td>
                <div>${student.university}</div>
                <div style="font-size: 0.75rem; color: #6b7280;">${student.major || '-'}</div>
            </td>
            <td>${student.graduation_year}年卒</td>
            <td>
                <select onchange="updateStatus('${student.id}', this.value)" class="status-select">
                    <option value="1" ${student.status_id === 1 ? 'selected' : ''}>未対応</option>
                    <option value="2" ${student.status_id === 2 ? 'selected' : ''}>書類選考中</option>
                    <option value="3" ${student.status_id === 3 ? 'selected' : ''}>面接中</option>
                    <option value="4" ${student.status_id === 4 ? 'selected' : ''}>内定</option>
                    <option value="5" ${student.status_id === 5 ? 'selected' : ''}>承諾</option>
                    <option value="6" ${student.status_id === 6 ? 'selected' : ''}>辞退</option>
                </select>
            </td>
            <td>${new Date(student.created_at).toLocaleDateString('ja-JP')}</td>
            <td>
                <button onclick="showDetail('${student.id}', '${student.name}')" class="btn btn-secondary">メモ</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateStatus(studentId, statusId) {
    try {
        await fetch(`/api/students/${studentId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_id: statusId })
        });
        fetchStudents();
    } catch (err) {
        console.error(err);
    }
}

async function showDetail(studentId, name) {
    const modal = document.getElementById('student-detail-modal');
    const infoDiv = document.getElementById('student-detail-info');
    const noteForm = document.getElementById('add-note-form');

    infoDiv.innerHTML = `<strong>${name}</strong> さんの選考詳細`;
    noteForm.dataset.studentId = studentId;

    modal.style.display = 'block';
    fetchNotes(studentId);
}

async function fetchNotes(studentId) {
    const notesList = document.getElementById('notes-list');
    notesList.innerHTML = '読み込み中...';

    try {
        const res = await fetch(`/api/students/${studentId}/notes`);
        const notes = await res.json();

        notesList.innerHTML = '';
        if (notes.length === 0) {
            notesList.innerHTML = '<div style="color: #6b7280; font-size: 0.875rem;">メモはありません</div>';
            return;
        }

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.innerHTML = `
                <span class="note-date">${new Date(note.created_at).toLocaleString('ja-JP')}</span>
                <div>${note.content}</div>
            `;
            notesList.appendChild(div);
        });
    } catch (err) {
        console.error(err);
    }
}

function updateStats(students) {
    document.getElementById('total-students').textContent = students.length;
    // status_id 2=書類選考中, 3=面接中
    const screening = students.filter(s => s.status_id === 2 || s.status_id === 3).length;
    document.getElementById('screening-students').textContent = screening;
    // status_id 4=内定
    const offered = students.filter(s => s.status_id === 4).length;
    document.getElementById('offered-students').textContent = offered;
}
