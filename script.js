// 1. إعدادات Firebase الخاصة بمشروعك stud-2027
const firebaseConfig = {
    apiKey: "AIzaSyCg4aet4KkFggw8a3RwOJcYgokZ3o95CEo",
    authDomain: "stud-2027.firebaseapp.com",
    databaseURL: "https://stud-2027-default-rtdb.firebaseio.com",
    projectId: "stud-2027",
    storageBucket: "stud-2027.firebasestorage.app",
    messagingSenderId: "29918435060",
    appId: "1:29918435060:web:c344d803ffc2d281cbf0a1",
    measurementId: "G-RZBVVPP31Y"
};

// 2. تحميل مكتبات Firebase بشكل ديناميكي آمن لمنع تعارض الأطر في المتصفح وعملها دون نظام موديول خارجي
import("https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js").then((firebaseApp) => {
    import("https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js").then((firebaseDatabase) => {
        
        // تهيئة التطبيق وقاعدة البيانات بعد اكتمال تحميل المكتبات
        const app = firebaseApp.initializeApp(firebaseConfig);
        const db = firebaseDatabase.getDatabase(app);
        const { ref, set, get } = firebaseDatabase;

        const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

        // تعريف دالة توليد الجدول الدراسي
        window.generateSchedule = function() {
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

            saveToFirebase(name, scheduleData);
            window.renderSchedule(name, scheduleData);
        };

        // دالة رسم الجدول وتضمين خاصية التحديث الفوري عند التعديل اليدوي
        window.renderSchedule = function(name, scheduleData) {
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
        };

        // دالة حفظ البيانات في ريال تايم داتابيز
        async function saveToFirebase(studentName, scheduleData) {
            try {
                await set(ref(db, 'schedules/' + studentName), {
                    studentName: studentName,
                    schedule: scheduleData,
                    lastUpdated: new Date().toISOString()
                });
                console.log("تم تحديث البيانات في فايربيس بنجاح!");
            } catch (e) {
                console.error("خطأ أثناء محاولة الحفظ: ", e);
            }
        }

        // دالة استرجاع البيانات المخزنة مسبقاً بناءً على الاسم الثنائي
        window.checkExistingStudent = async function() {
            const name = document.getElementById('student-name').value.trim();
            if (!name) {
                alert("يرجى كتابة الاسم الثنائي أولاً للبحث عن الجدول.");
                return;
            }
            
            try {
                const snapshot = await get(ref(db, 'schedules/' + name));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    window.renderSchedule(data.studentName, data.schedule);
                    alert(`أهلاً بك مجدداً يا ${name}، تم تحميل جدولك بنجاح!`);
                } else {
                    alert("لم نجد جدولاً مسجلاً بهذا الاسم، يرجى ملء البيانات لتوليد جدول جديد.");
                }
            } catch (e) {
                console.error("خطأ في استيراد الجدول الدراسي: ", e);
            }
        };

        window.resetForm = function() {
            document.getElementById('setup-section').classList.remove('hidden');
            document.getElementById('schedule-section').classList.add('hidden');
        };

    });
});
