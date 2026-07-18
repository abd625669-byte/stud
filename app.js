/**
 * منظم الدراسة الذكي للسادس العلمي
 * Core Logic, Schedule Generator & UI State Controller
 */

// ==========================================================================
// Application State
// ==========================================================================
let state = {
    studentName: "",
    selectedSubjects: [],
    subjectsPerDay: 2,
    sleepTime: "23:00",
    wakeTime: "06:00",
    schedule: {}, // Format: { Saturday: [ { type, subject, start, end, completed }, ... ], ... }
    currentDay: "Saturday"
};

// Day Names Mapping (English to Arabic)
const dayNamesAr = {
    Saturday: "السبت",
    Sunday: "الأحد",
    Monday: "الإثنين",
    Tuesday: "الثلاثاء",
    Wednesday: "الأربعاء",
    Thursday: "الخميس",
    Friday: "الجمعة"
};

const daysOrder = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// Motivational Tips List
const motivationalTips = [
    "ابدأ بدراسة المواد التي تتطلب تركيزاً عالياً في الصباح الباكر، وحافظ على فترات الاستراحة لتجديد نشاطك.",
    "الالتزام بالجدول اليومي هو خطوتك الأولى نحو المجموعة الطبية أو الهندسة. استمر يا بطل!",
    "تذكر دائماً: معدل السادس العلمي يُبنى يوماً بعد يوم، الحصة الحالية هي الأهم.",
    "الاستراحة بين المواد ليست إضاعة للوقت، بل إعادة شحن لعقلك ليستوعب المزيد.",
    "الرياضيات والفيزياء تحتاجان إلى ورقة وقلم وفهم عميق للقوانين قبل البدء بالمسائل.",
    "لا تدع التراكمات تحبطك. ابدأ اليوم بصفحة جديدة وتدرج في إنجاز أهدافك.",
    "النوم الكافي (6-8 ساعات) يثبت المعلومات في الذاكرة طويلة المدى. لا تهمل وقت نومك."
];

// ==========================================================================
// DOM Elements
// ==========================================================================
const setupSection = document.getElementById("setup-section");
const scheduleSection = document.getElementById("schedule-section");
const setupForm = document.getElementById("planner-setup-form");
const generateBtn = document.getElementById("generate-schedule-btn");
const editSettingsBtn = document.getElementById("edit-settings-btn");
const printBtn = document.getElementById("print-schedule-btn");

// Form Inputs
const studentNameInput = document.getElementById("student-name");
const subjectsContainer = document.getElementById("subjects-checkboxes-container");
const subjectsPerDaySelect = document.getElementById("subjects-per-day");
const sleepTimeInput = document.getElementById("sleep-time");
const wakeTimeInput = document.getElementById("wake-time");

// Stats & Header
const scheduleStudentTitle = document.getElementById("schedule-student-title");
const statActiveHours = document.getElementById("stat-active-hours");
const statStudyHours = document.getElementById("stat-study-hours");
const statSubjectsCount = document.getElementById("stat-subjects-count");
const statCompletionPct = document.getElementById("stat-completion-pct");
const daysTabsList = document.getElementById("days-tabs-list");
const timelineContainer = document.getElementById("day-schedule-timeline");
const motivationalTipEl = document.getElementById("motivational-tip");

// Modal Elements
const editSlotModal = document.getElementById("edit-slot-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const editSlotForm = document.getElementById("edit-slot-form");
const editDayIdInput = document.getElementById("edit-day-id");
const editSlotIdxInput = document.getElementById("edit-slot-idx");
const editSubjectSelect = document.getElementById("edit-subject-select");
const editStartTimeInput = document.getElementById("edit-start-time");
const editEndTimeInput = document.getElementById("edit-end-time");
const saveSlotBtn = document.getElementById("save-slot-btn");
const cancelSlotBtn = document.getElementById("cancel-slot-btn");

// Alarm Overlay Elements
const alarmOverlay = document.getElementById("alarm-overlay");
const alarmSubjectName = document.getElementById("alarm-subject-name");
const stopAlarmBtn = document.getElementById("stop-alarm-btn");

// ==========================================================================
// Time Helpers
// ==========================================================================

/**
 * Convert time string "HH:MM" to minutes from midnight
 */
function timeToMinutes(timeStr) {
    const [hrs, mins] = timeStr.split(":").map(Number);
    return hrs * 60 + mins;
}

/**
 * Convert minutes from midnight to time string "HH:MM" (24h)
 */
function minutesToTimeString24(minutes) {
    const hrs = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const hrsStr = String(hrs).padStart(2, '0');
    const minsStr = String(mins).padStart(2, '0');
    return `${hrsStr}:${minsStr}`;
}

/**
 * Convert minutes from midnight to time string (12h format with ص/م)
 */
function minutesToTimeString12(minutes) {
    let hrs = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const ampm = hrs >= 12 ? 'م' : 'ص';
    hrs = hrs % 12;
    hrs = hrs ? hrs : 12; // 0 should be 12
    const minsStr = String(mins).padStart(2, '0');
    return `${hrs}:${minsStr} ${ampm}`;
}

/**
 * Format string "HH:MM" (24h) to "HH:MM ص/م" (12h)
 */
function formatTime12(time24) {
    return minutesToTimeString12(timeToMinutes(time24));
}

// ==========================================================================
// Core Algorithm: Schedule Generator
// ==========================================================================

function buildWeeklySchedule() {
    const wakeMins = timeToMinutes(state.wakeTime);
    let sleepMins = timeToMinutes(state.sleepTime);
    
    // If sleep is after midnight (e.g. 01:00 AM)
    if (sleepMins < wakeMins) {
        sleepMins += 24 * 60;
    }
    
    const totalAwakeMins = sleepMins - wakeMins;
    
    // Subject pool rotation
    let subjectIndex = 0;
    const subjectsList = state.selectedSubjects;
    const numPerDay = Number(state.subjectsPerDay);
    
    // We calculate slot times dynamically.
    // Recommended structure:
    // - Morning Prep buffer: 60 mins from waking.
    // - Sleep Prep buffer: 60 mins before sleep.
    // - This leaves: totalAwakeMins - 120 mins.
    // Let's divide the remaining time into N study sessions and breaks.
    // Break sizes: 30 minutes, with a longer lunch/rest break of 60 minutes if N >= 2
    
    const morningBuffer = 60; 
    const nightBuffer = 60;
    const availableStudyBlockMins = totalAwakeMins - morningBuffer - nightBuffer;
    
    // Let's formulate breaks:
    // If N = 1: 0 breaks (just 1 big study block).
    // If N = 2: 1 break (45 mins).
    // If N = 3: 2 breaks (1 break of 30m, 1 break of 60m = 90m total).
    // If N = 4: 3 breaks (2 breaks of 30m, 1 break of 60m = 120m total).
    let totalBreakMins = 0;
    let breakPattern = []; // Array of break durations
    
    if (numPerDay === 2) {
        totalBreakMins = 45;
        breakPattern = [45];
    } else if (numPerDay === 3) {
        totalBreakMins = 90;
        breakPattern = [30, 60];
    } else if (numPerDay === 4) {
        totalBreakMins = 120;
        breakPattern = [30, 60, 30];
    }
    
    const totalStudyMins = availableStudyBlockMins - totalBreakMins;
    const singleSessionDuration = Math.floor(totalStudyMins / numPerDay);
    
    const weeklySchedule = {};
    
    daysOrder.forEach((day) => {
        const daySlots = [];
        let currentPointer = wakeMins;
        
        // 1. Morning Routine
        daySlots.push({
            type: "break",
            subject: "الاستيقاظ والتحضير الصباحي",
            start: minutesToTimeString24(currentPointer),
            end: minutesToTimeString24(currentPointer + morningBuffer),
            completed: false
        });
        currentPointer += morningBuffer;
        
        // 2. Study & Break Sessions
        for (let i = 0; i < numPerDay; i++) {
            // Assign subject from list (rotating)
            let currentSubject = "مراجعة عامة";
            if (subjectsList.length > 0) {
                currentSubject = subjectsList[subjectIndex % subjectsList.length];
                subjectIndex++;
            }
            
            // Study session
            daySlots.push({
                type: "study",
                subject: currentSubject,
                start: minutesToTimeString24(currentPointer),
                end: minutesToTimeString24(currentPointer + singleSessionDuration),
                completed: false
            });
            currentPointer += singleSessionDuration;
            
            // Intermediary break (if not the last study session)
            if (i < numPerDay - 1) {
                const breakDuration = breakPattern[i] || 30;
                daySlots.push({
                    type: "break",
                    subject: breakDuration >= 60 ? "استراحة غداء وغداء وروتين" : "استراحة قصيرة وتجديد نشاط",
                    start: minutesToTimeString24(currentPointer),
                    end: minutesToTimeString24(currentPointer + breakDuration),
                    completed: false
                });
                currentPointer += breakDuration;
            }
        }
        
        // 3. Night Rest buffer / Free time
        if (currentPointer < sleepMins) {
            daySlots.push({
                type: "free",
                subject: "وقت حر ومراجعة خفيفة وترفيه",
                start: minutesToTimeString24(currentPointer),
                end: minutesToTimeString24(sleepMins),
                completed: false
            });
        }
        
        weeklySchedule[day] = daySlots;
    });
    
    return weeklySchedule;
}

// ==========================================================================
// UI Rendering Controllers
// ==========================================================================

/**
 * Update UI screens based on schedule existence
 */
function toggleScreens(hasSchedule) {
    if (hasSchedule) {
        setupSection.classList.add("hidden");
        scheduleSection.classList.remove("hidden");
    } else {
        setupSection.classList.remove("hidden");
        scheduleSection.classList.add("hidden");
    }
}

/**
 * Render stats panels
 */
function renderStats() {
    // Total awake hours
    const wakeMins = timeToMinutes(state.wakeTime);
    let sleepMins = timeToMinutes(state.sleepTime);
    if (sleepMins < wakeMins) sleepMins += 24 * 60;
    const awakeHours = ((sleepMins - wakeMins) / 60).toFixed(1);
    statActiveHours.textContent = `${awakeHours} ساعة`;
    
    // Total recommended study hours per day
    let dailyStudyMinutes = 0;
    const saturdaySlots = state.schedule.Saturday || [];
    saturdaySlots.forEach(slot => {
        if (slot.type === "study") {
            const duration = timeToMinutes(slot.end) - timeToMinutes(slot.start);
            dailyStudyMinutes += (duration > 0 ? duration : (duration + 24*60));
        }
    });
    const studyHours = (dailyStudyMinutes / 60).toFixed(1);
    statStudyHours.textContent = `${studyHours} ساعات`;
    
    // Subjects count
    statSubjectsCount.textContent = `${state.selectedSubjects.length} مواد`;
    
    // Completion rate of the week
    let totalStudySlots = 0;
    let completedStudySlots = 0;
    
    daysOrder.forEach(day => {
        const slots = state.schedule[day] || [];
        slots.forEach(slot => {
            if (slot.type === "study") {
                totalStudySlots++;
                if (slot.completed) {
                    completedStudySlots++;
                }
            }
        });
    });
    
    const pct = totalStudySlots > 0 ? Math.round((completedStudySlots / totalStudySlots) * 100) : 0;
    statCompletionPct.textContent = `${pct}%`;
}

/**
 * Render the interactive daily timeline schedule
 */
function renderActiveDayTimeline() {
    const slots = state.schedule[state.currentDay] || [];
    timelineContainer.innerHTML = "";
    
    if (slots.length === 0) {
        timelineContainer.innerHTML = `<div class="no-slots">لا يوجد حصص مضافة لهذا اليوم.</div>`;
        return;
    }
    
    slots.forEach((slot, idx) => {
        const slotCard = document.createElement("div");
        slotCard.className = `slot-card ${slot.completed ? 'completed' : ''}`;
        slotCard.setAttribute("data-subject-type", slot.type === 'study' ? slot.subject : 'استراحة');
        
        // Bullet point on vertical line
        const bullet = document.createElement("div");
        bullet.className = "slot-bullet";
        slotCard.appendChild(bullet);
        
        // Left side contents: checkbox + subject info
        const info = document.createElement("div");
        info.className = "slot-info";
        
        // Checkbox only for study slots
        if (slot.type === "study") {
            const checkbox = document.createElement("div");
            checkbox.className = `slot-checkbox ${slot.completed ? 'checked' : ''}`;
            checkbox.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
            checkbox.addEventListener("click", (e) => {
                e.stopPropagation();
                toggleSlotComplete(state.currentDay, idx);
            });
            info.appendChild(checkbox);
        } else {
            // Placeholder margin for non-study items to align them
            const placeholder = document.createElement("div");
            placeholder.style.width = "22px";
            info.appendChild(placeholder);
        }
        
        const meta = document.createElement("div");
        meta.className = "slot-meta";
        
        const timeSpan = document.createElement("span");
        timeSpan.className = "slot-time";
        timeSpan.textContent = `${formatTime12(slot.start)} - ${formatTime12(slot.end)}`;
        
        const subjectName = document.createElement("span");
        subjectName.className = "slot-subject-name";
        subjectName.textContent = slot.subject;
        
        meta.appendChild(timeSpan);
        meta.appendChild(subjectName);
        info.appendChild(meta);
        slotCard.appendChild(info);
        
        // Actions side: Edit button
        const actions = document.createElement("div");
        actions.className = "slot-actions";
        
        const editBtn = document.createElement("button");
        editBtn.className = "btn-slot-edit";
        editBtn.title = "تعديل هذه الحصة";
        editBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
        `;
        editBtn.addEventListener("click", () => openEditModal(state.currentDay, idx));
        
        actions.appendChild(editBtn);
        slotCard.appendChild(actions);
        
        timelineContainer.appendChild(slotCard);
    });
}

/**
 * Handle day tabs switching
 */
function setupTabs() {
    const tabButtons = daysTabsList.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.currentDay = btn.getAttribute("data-day");
            renderActiveDayTimeline();
            
            // Randomize tip of the day occasionally
            const randIdx = Math.floor(Math.random() * motivationalTips.length);
            motivationalTipEl.textContent = motivationalTips[randIdx];
        });
    });
}

// ==========================================================================
// Inline Editing Modal Logic
// ==========================================================================

function populateModalSubjectDropdown() {
    editSubjectSelect.innerHTML = "";
    
    // Add selected study subjects
    state.selectedSubjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        editSubjectSelect.appendChild(opt);
    });
    
    // Add default utilities
    const utilities = [
        "استراحة قصيرة وتجديد نشاط",
        "استراحة غداء وغداء وروتين",
        "الاستيقاظ والتحضير الصباحي",
        "وقت حر ومراجعة خفيفة وترفيه",
        "مراجعة عامة"
    ];
    
    utilities.forEach(util => {
        const opt = document.createElement("option");
        opt.value = util;
        opt.textContent = util;
        editSubjectSelect.appendChild(opt);
    });
}

function openEditModal(day, idx) {
    const slot = state.schedule[day][idx];
    
    editDayIdInput.value = day;
    editSlotIdxInput.value = idx;
    
    // Populate select options
    populateModalSubjectDropdown();
    
    // Set current values
    editSubjectSelect.value = slot.subject;
    editStartTimeInput.value = slot.start;
    editEndTimeInput.value = slot.end;
    
    // Show modal
    editSlotModal.classList.remove("hidden");
}

function closeEditModal() {
    editSlotModal.classList.add("hidden");
}

function saveEditedSlot() {
    const day = editDayIdInput.value;
    const idx = Number(editSlotIdxInput.value);
    
    const originalSlot = state.schedule[day][idx];
    
    // Update values
    originalSlot.subject = editSubjectSelect.value;
    originalSlot.start = editStartTimeInput.value;
    originalSlot.end = editEndTimeInput.value;
    
    // Check if it is a study session type
    // If it was changed to an activity/break, label its type accordingly
    const breaksList = [
        "استراحة قصيرة وتجديد نشاط",
        "استراحة غداء وغداء وروتين",
        "الاستيقاظ والتحضير الصباحي",
        "وقت حر ومراجعة خفيفة وترفيه"
    ];
    if (breaksList.includes(originalSlot.subject)) {
        originalSlot.type = "break";
    } else {
        originalSlot.type = "study";
    }
    
    // Save, render and notify
    saveStateToLocalStorage();
    renderActiveDayTimeline();
    renderStats();
    closeEditModal();
}

function toggleSlotComplete(day, idx) {
    const slot = state.schedule[day][idx];
    if (slot && slot.type === "study") {
        slot.completed = !slot.completed;
        saveStateToLocalStorage();
        renderActiveDayTimeline();
        renderStats();
    }
}

// ==========================================================================
// Alarm System & Web Audio Siren (Piercing Alert)
// ==========================================================================

let audioCtx = null;
let alarmIntervalId = null;
let alarmActive = false;
let currentAlarmingSlot = null;
let firedAlarms = {}; // Keys: "day-idx-HH:MM"

/**
 * Resumes or initializes AudioContext on user interaction to satisfy browser security
 */
function resumeAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

/**
 * Starts a loud, looping dual-oscillator sawtooth siren in 250ms pulses
 */
function startAlarmSound() {
    if (alarmIntervalId) return; // Already running
    
    resumeAudioContext();
    
    let toggle = true;
    
    alarmIntervalId = setInterval(() => {
        if (!audioCtx) return;
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.type = 'sawtooth'; // Harsh piercing wave
        osc2.type = 'sine';     // Adds thickness to the sound
        
        const frequency = toggle ? 880 : 1200; // Alternating pitch
        osc1.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        osc2.frequency.setValueAtTime(frequency + 4, audioCtx.currentTime); // Minor detuning for chorus/siren feel
        toggle = !toggle;
        
        gainNode.gain.setValueAtTime(0.9, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
        
        osc1.start();
        osc2.start();
        osc1.stop(audioCtx.currentTime + 0.23);
        osc2.stop(audioCtx.currentTime + 0.23);
    }, 250);
}

/**
 * Stops the siren interval
 */
function stopAlarmSound() {
    if (alarmIntervalId) {
        clearInterval(alarmIntervalId);
        alarmIntervalId = null;
    }
}

/**
 * Activates the alarm state, opens overlay and plays sound
 */
function triggerAlarm(day, idx, slot) {
    if (alarmActive) return;
    alarmActive = true;
    currentAlarmingSlot = { day, idx };
    
    alarmSubjectName.textContent = slot.subject;
    alarmOverlay.classList.remove("hidden");
    
    startAlarmSound();
}

/**
 * Dismisses the alarm, stops sound, hides overlay and redirects user to active day
 */
function dismissAlarm() {
    if (!alarmActive) return;
    
    stopAlarmSound();
    alarmOverlay.classList.add("hidden");
    alarmActive = false;
    
    if (currentAlarmingSlot) {
        // Switch tab to the day of the alarm and redraw
        state.currentDay = currentAlarmingSlot.day;
        renderScheduleView();
    }
    
    currentAlarmingSlot = null;
}

/**
 * Running background check matching current time with study schedules
 */
function checkAlarmTicker() {
    if (alarmActive) return;
    if (!state.schedule || Object.keys(state.schedule).length === 0) return;
    
    const now = new Date();
    const jsDayToDaysOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = jsDayToDaysOrder[now.getDay()];
    
    const nowTime24 = String(now.getHours()).padStart(2, '0') + ":" + String(now.getMinutes()).padStart(2, '0');
    
    const slots = state.schedule[todayName] || [];
    slots.forEach((slot, idx) => {
        if (slot.type === "study" && slot.start === nowTime24) {
            const alarmKey = `${todayName}-${idx}-${nowTime24}`;
            if (!firedAlarms[alarmKey]) {
                firedAlarms[alarmKey] = true;
                triggerAlarm(todayName, idx, slot);
            }
        }
    });
}

// ==========================================================================
// Local Storage Persistence
// ==========================================================================

function saveStateToLocalStorage() {
    localStorage.setItem("six_scientific_planner_state", JSON.stringify(state));
}

function loadStateFromLocalStorage() {
    const localData = localStorage.getItem("six_scientific_planner_state");
    if (localData) {
        try {
            state = JSON.parse(localData);
            return true;
        } catch (e) {
            console.error("Error parsing local planner state", e);
        }
    }
    return false;
}

// ==========================================================================
// Printing & Weekly Layout Generation
// ==========================================================================

function renderAllDaysForPrinting() {
    // Check if print elements exist, delete them to rebuild fresh
    const oldPrintSec = document.querySelectorAll(".days-print-section");
    oldPrintSec.forEach(el => el.remove());
    
    // Create print container inside schedule container so CSS handles it
    daysOrder.forEach(day => {
        const printSec = document.createElement("div");
        printSec.className = "days-print-section print-only";
        printSec.style.display = "none"; // Hidden on screen by default
        
        const title = document.createElement("h3");
        title.className = "days-print-title";
        title.textContent = `جدول يوم: ${dayNamesAr[day]}`;
        printSec.appendChild(title);
        
        const timeline = document.createElement("div");
        timeline.className = "schedule-timeline";
        
        const slots = state.schedule[day] || [];
        slots.forEach(slot => {
            const slotCard = document.createElement("div");
            slotCard.className = `slot-card`;
            slotCard.setAttribute("data-subject-type", slot.type === 'study' ? slot.subject : 'استراحة');
            
            const info = document.createElement("div");
            info.className = "slot-info";
            
            const meta = document.createElement("div");
            meta.className = "slot-meta";
            
            const timeSpan = document.createElement("span");
            timeSpan.className = "slot-time";
            timeSpan.textContent = `${formatTime12(slot.start)} - ${formatTime12(slot.end)}`;
            
            const subjectName = document.createElement("span");
            subjectName.className = "slot-subject-name";
            subjectName.textContent = slot.subject;
            
            meta.appendChild(timeSpan);
            meta.appendChild(subjectName);
            info.appendChild(meta);
            slotCard.appendChild(info);
            
            printSec.appendChild(slotCard);
        });
        
        scheduleSection.appendChild(printSec);
    });
}

// ==========================================================================
// Initializer & Event Listeners Setup
// ==========================================================================

function init() {
    // 1. Theme and checkboxes dynamic interactions on form
    const checkboxCards = subjectsContainer.querySelectorAll(".subject-checkbox-card");
    checkboxCards.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"]');
        
        // Sync visual card wrapper state to inputs
        checkbox.addEventListener("change", () => {
            if (checkbox.checked) {
                card.classList.add("checked");
            } else {
                card.classList.remove("checked");
            }
        });
    });

    // 2. Setup Generate Schedule Trigger
    generateBtn.addEventListener("click", () => {
        const nameVal = studentNameInput.value.trim();
        if (!nameVal) {
            studentNameInput.focus();
            alert("يرجى إدخال اسمك الثنائي أولاً يا بطل!");
            return;
        }
        
        // Extract selected subjects
        const selectedChks = subjectsContainer.querySelectorAll('input[type="checkbox"]:checked');
        const chosenSubjects = Array.from(selectedChks).map(chk => chk.value);
        
        if (chosenSubjects.length === 0) {
            alert("يرجى اختيار مادة دراسية واحدة على الأقل لتضمينها في الجدول.");
            return;
        }
        
        // Save form fields to state
        state.studentName = nameVal;
        state.selectedSubjects = chosenSubjects;
        state.subjectsPerDay = Number(subjectsPerDaySelect.value);
        state.sleepTime = sleepTimeInput.value;
        state.wakeTime = wakeTimeInput.value;
        state.currentDay = "Saturday";
        
        // Generate
        state.schedule = buildWeeklySchedule();
        
        // Save & Render
        saveStateToLocalStorage();
        renderScheduleView();
    });

    // 3. Edit settings back trigger
    editSettingsBtn.addEventListener("click", () => {
        toggleScreens(false);
    });

    // 4. Print click
    printBtn.addEventListener("click", () => {
        renderAllDaysForPrinting();
        window.print();
    });

    // 5. Modal actions
    closeModalBtn.addEventListener("click", closeEditModal);
    cancelSlotBtn.addEventListener("click", closeEditModal);
    saveSlotBtn.addEventListener("click", saveEditedSlot);
    
    // Close modal clicking outside
    window.addEventListener("click", (e) => {
        if (e.target === editSlotModal) {
            closeEditModal();
        }
    });

    // Alarm actions & setup
    stopAlarmBtn.addEventListener("click", dismissAlarm);
    document.addEventListener("click", resumeAudioContext);
    
    // Start background timer check for alarms
    setInterval(checkAlarmTicker, 10000);

    // 6. Init tabs
    setupTabs();

    // 7. Load from localstorage if present
    const loaded = loadStateFromLocalStorage();
    if (loaded && state.studentName && Object.keys(state.schedule).length > 0) {
        // Pre-fill form values in case they edit settings later
        studentNameInput.value = state.studentName;
        subjectsPerDaySelect.value = state.subjectsPerDay;
        sleepTimeInput.value = state.sleepTime;
        wakeTimeInput.value = state.wakeTime;
        
        // Pre-fill checkboxes
        const checkboxes = subjectsContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(chk => {
            const card = chk.closest('.subject-checkbox-card');
            if (state.selectedSubjects.includes(chk.value)) {
                chk.checked = true;
                card.classList.add("checked");
            } else {
                chk.checked = false;
                card.classList.remove("checked");
            }
        });
        
        renderScheduleView();
    } else {
        toggleScreens(false);
    }
}

function renderScheduleView() {
    scheduleStudentTitle.textContent = `الجدول الدراسي للبطل: ${state.studentName}`;
    
    // Set active tab to current day
    const tabs = daysTabsList.querySelectorAll(".tab-btn");
    tabs.forEach(btn => {
        if (btn.getAttribute("data-day") === state.currentDay) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    toggleScreens(true);
    renderActiveDayTimeline();
    renderStats();
}

// Start application
document.addEventListener("DOMContentLoaded", init);
