// 1. استيراد مكتبة Realtime Database المتوافقة مع إصدار مشروعك
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

// 2. إعدادات Firebase الخاصة بمشروعك stud-2027
const firebaseConfig = {
    apiKey: "AIzaSyCg4aet4KkFggw8a3RwOJcYgokZ3o95CEo",
    authDomain: "stud-2027.firebaseapp.com",
    projectId: "stud-2027",
    storageBucket: "stud-2027.firebasestorage.app",
    messagingSenderId: "29918435060",
    appId: "1:29918435060:web:c344d803ffc2d281cbf0a1",
    measurementId: "G-RZBVVPP31Y"
};

// تهيئة Firebase وقاعدة البيانات
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

// جعل الوظائف متاحة لملف الـ HTML
window.generateSchedule = generateSchedule;
window.resetForm = resetForm;
window.checkExistingStudent = checkExistingStudent;

// دالة توليد الجدول لأول مرة
function generateSchedule() {
    const name = document.getElementById('student-name').value.trim();
    const dailyCount = parseInt(document.getElementById('daily-subjects').value);
    const wakeTime = document.getElementById('wake-time').value;
    const sleepTime = document.getElementById('sleep-time').value;

    const selectedSubjects = [];
    document.querySelectorAll('.subjects-grid input:checked').forEach(checkbox => {
        selectedSubjects.push(checkbox.value);
    });

    if (!name) { alert("يرجى إدخال الاسم الثنائي أولاً."); return; }
    if (selectedSubjects.length === 0) { alert("يرجى اختيار مادة واحدة على الأقل."); return; }

    let [wakeH, wakeM] = wakeTime.split(':').map(Number);
    let [sleepH, sleepM] = sleepTime.split(':').map(Number);
    let startMinutes = wakeH * 60 + wakeM + 60; 
    let endMinutes = sleepH * 60 + sleepM - 30;  
    if (endMinutes < startMinutes) endMinutes += 24 * 60;

    const availableMinutes = endMinutes - startMinutes;
    const blockDuration = Math.floor(availableMinutes / dailyCount); 
    let subjectIndex = 0;

    let scheduleData = {}; 

    days.forEach(day => {
        scheduleData[day] = [];
        let currentMinutes = startMinutes;

        for (let i = 0; i < dailyCount; i++) {
            const subject = selectedSubjects[subjectIndex % selectedSubjects.length];
            subjectIndex++;

            let hour = Math.floor((currentMinutes % (24 * 60)) / 60);
            let minute = Math.floor(currentMinutes % 60);
            let timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

            scheduleData[day].push({ subject: subject, time: timeString });
            currentMinutes += blockDuration;
        }
    });

    // حفظ الجدول وعرضه
    saveToFirebase(name, scheduleData);
    renderSchedule(name, scheduleData);
}

// دالة عرض الجدول وتفعيل التعديل اليدوي والتحديث التلقائي
function renderSchedule(name, scheduleData) {
    document.getElementById('display-name').innerText = name;
    const tbody = document.getElementById('schedule-body');
    tbody.innerHTML = '';

    days.forEach(day => {
        const row = document.createElement('tr');
        const dayCell = document.createElement('td');
        dayCell.className = 'day-row';
        dayCell.innerText = day;
        row.appendChild(dayCell);

        const contentCell = document.createElement('td');
        const container = document.createElement('div');
        container.className = 'slot-container';

        scheduleData[day].forEach((slotData, index) => {
            const slot = document.createElement('div');
            slot.className = 'editable-slot';
            slot.innerHTML = `
                <span class="subject-name" contenteditable="true">${slotData.subject}</span>
                <span class="subject-time" contenteditable="true">${slotData.time}</span>
            `;

            // الحفظ التلقائي عند التعديل اليدوي والخروج من الخانة
            slot.querySelectorAll('span').forEach(span => {
                span.addEventListener('blur', () => {
                    const updatedSubject = slot.querySelector('.subject-name').innerText.trim();
                    const updatedTime = slot.querySelector('.subject-time').innerText.trim();
                    
                    scheduleData[day][index] = { subject: updatedSubject, time: updatedTime };
                    saveToFirebase(name, scheduleData); 
                });
            });

            container.appendChild(slot);
        });

        contentCell.appendChild(container);
        row.appendChild(contentCell);
        tbody.appendChild(row);
    });

    document.getElementById('setup-section').classList.add('hidden');
    document.getElementById('schedule-section').classList.remove('hidden');
}

// دالة حفظ البيانات في Realtime Database
async function saveToFirebase(studentName, scheduleData) {
    try {
        // الحفظ في مسار محدد باسم الطالب
        await set(ref(db, 'schedules/' + studentName), {
            studentName: studentName,
            schedule: scheduleData,
            lastUpdated: new Date().toISOString()
        });
        console.log("تم الحفظ بنجاح في Realtime Database!");
    } catch (e) {
        console.error("خطأ في الحفظ: ", e);
    }
}

// دالة استرجاع الجدول القديم
async function checkExistingStudent() {
    const name = document.getElementById('student-name').value.trim();
    if (!name) {
        alert("يرجى كتابة الاسم الثنائي في الخانة أولاً للبحث عن جدولك.");
        return;
    }
    
    try {
        const snapshot = await get(ref(db, 'schedules/' + name));
        if (snapshot.exists()) {
            const data = snapshot.val();
            renderSchedule(data.studentName, data.schedule);
            alert(`أهلاً بك مجدداً يا ${name}، تم تحميل جدولك بنجاح!`);
        } else {
            alert("لم نجد جدولاً مخزناً بهذا الاسم. املأ الحقول واضغط على توليد الجدول لإنشاء واحد جديد.");
        }
    } catch (e) {
        console.error("خطأ في جلب البيانات: ", e);
    }
}

function resetForm() {
    document.getElementById('setup-section').classList.remove('hidden');
    document.getElementById('schedule-section').classList.add('hidden');
}
