// ============================================
// أَثَر — Onboarding Wizard Logic (Tailwind & Supabase)
// ============================================
let currentUser = null;
let currentStep = 1;
const TOTAL_STEPS = 6;
const DAYS = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

let selectedStage = null;
let selectedTrack = null;
let subjectRows = [];
let teacherRows = [];
let scheduleRows = [];

const SUGGESTIONS_MAP = {
  literary: ["اللغة العربية", "اللغة الإنجليزية", "التاريخ", "الجغرافيا", "الفلسفة والمنطق", "علم النفس والاجتماع", "لغة أجنبية ثانية"],
  scientific_math: ["اللغة العربية", "اللغة الإنجليزية", "الجبر والهندسة الفراغية", "التفاضل والتكامل", "الفيزياء", "الكيمياء", "لغة أجنبية ثانية"],
  scientific_science: ["اللغة العربية", "اللغة الإنجليزية", "الأحياء", "الفيزياء", "الكيمياء", "الجيولوجيا", "لغة أجنبية ثانية"],
  first_secondary: ["اللغة العربية", "اللغة الإنجليزية", "الرياضيات", "العلوم المتكاملة", "التاريخ", "لغة أجنبية ثانية"]
};

(async function init() {
  try {
    currentUser = await withTimeout(requireAuth(), 10000);
    if (!currentUser) return;
    addScheduleRow();
  } catch (err) {
    console.error("Init error:", err);
    showToast(err.message || "حدث خطأ أثناء تحميل الصفحة");
  }
})();

// ---------- Step 1: Grade & Track Handlers (1.7.2) ----------
function selectGrade(grade) {
  selectedStage = grade;
  document.querySelectorAll(".grade-btn").forEach(btn => {
    if (btn.dataset.grade === grade) {
      btn.classList.add("border-primary", "bg-primary-container/30", "text-primary");
      btn.classList.remove("border-outline-variant");
    } else {
      btn.classList.remove("border-primary", "bg-primary-container/30", "text-primary");
      btn.classList.add("border-outline-variant");
    }
  });

  const branchArea = document.getElementById("branchSelectionArea");
  if (grade === "first_secondary") {
    selectedTrack = null;
    if (branchArea) branchArea.classList.add("hidden");
  } else {
    if (branchArea) branchArea.classList.remove("hidden");
  }
}

function selectTrack(track) {
  selectedTrack = track;
  document.querySelectorAll(".track-btn").forEach(btn => {
    if (btn.dataset.track === track) {
      btn.classList.add("border-primary", "bg-primary-container/30", "text-primary");
      btn.classList.remove("border-outline-variant");
    } else {
      btn.classList.remove("border-primary", "bg-primary-container/30", "text-primary");
      btn.classList.add("border-outline-variant");
    }
  });
}

// ---------- Step 3: Suggested Subjects (1.7.5) ----------
function renderSuggestedSubjects() {
  const container = document.getElementById("suggestedChipsList");
  if (!container) return;

  let key = selectedTrack;
  if (selectedStage === "first_secondary" || !key) key = "first_secondary";

  const list = SUGGESTIONS_MAP[key] || SUGGESTIONS_MAP.first_secondary;
  
  container.innerHTML = list.map(name => `
    <button type="button" onclick="addSuggestedSubject('${name}')" class="px-3 py-1.5 rounded-full text-xs font-semibold border border-outline-variant bg-white dark:bg-surface-container hover:border-primary hover:text-primary transition flex items-center gap-1 shadow-xs">
      <span class="material-symbols-outlined" style="font-size:14px">add</span>
      <span>${name}</span>
    </button>
  `).join("");
}

function addSuggestedSubject(name) {
  // Check if subject already exists
  const existingNames = subjectRows.map(sid => document.querySelector(`#${sid} .subj-name`)?.value.trim());
  if (existingNames.includes(name)) {
    showToast(`مادة ${name} مضافة بالفعل`);
    return;
  }

  const id = "s" + Date.now() + Math.random().toString(36).slice(2, 6);
  subjectRows.push(id);
  const wrap = document.getElementById("subjectsList");
  const div = document.createElement("div");
  div.className = "flex items-center gap-2 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant fade-in";
  div.id = id;
  div.innerHTML = `
    <input type="text" value="${escapeHtml(name)}" placeholder="اسم المادة" class="subj-name flex-1 border border-outline-variant rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container font-semibold">
    <select class="subj-priority border border-outline-variant rounded-lg py-2 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">
      <option value="1">أولوية عالية 🔴</option>
      <option value="2" selected>أولوية متوسطة 🟡</option>
      <option value="3">أولوية عادية 🟢</option>
    </select>
    <button type="button" class="w-8 h-8 rounded-lg hover:bg-error-container text-error flex items-center justify-center transition" onclick="removeRow('${id}')">
      <span class="material-symbols-outlined" style="font-size:18px">delete</span>
    </button>`;
  wrap.appendChild(div);
  showToast(`تمت إضافة ${name} ✓`);
}

// ---------- Subjects Manual Add ----------
function addSubjectRow() {
  const id = "s" + Date.now() + Math.random().toString(36).slice(2, 6);
  subjectRows.push(id);
  const wrap = document.getElementById("subjectsList");
  const div = document.createElement("div");
  div.className = "flex items-center gap-2 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant fade-in";
  div.id = id;
  div.innerHTML = `
    <input type="text" placeholder="اسم المادة (مثلاً: فيزياء)" class="subj-name flex-1 border border-outline-variant rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">
    <select class="subj-priority border border-outline-variant rounded-lg py-2 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">
      <option value="1">أولوية عالية 🔴</option>
      <option value="2" selected>أولوية متوسطة 🟡</option>
      <option value="3">أولوية عادية 🟢</option>
    </select>
    <button type="button" class="w-8 h-8 rounded-lg hover:bg-error-container text-error flex items-center justify-center transition" onclick="removeRow('${id}')">
      <span class="material-symbols-outlined" style="font-size:18px">delete</span>
    </button>`;
  wrap.appendChild(div);
}

// ---------- Teachers ----------
function addTeacherRow() {
  const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
  teacherRows.push(id);
  const wrap = document.getElementById("teachersList");
  const options = subjectRows.map(sid => {
    const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
    return `<option value="${sid}">${escapeHtml(name)}</option>`;
  }).join("");

  const div = document.createElement("div");
  div.className = "flex flex-col gap-2 bg-surface-container-low p-3 rounded-xl border border-outline-variant fade-in";
  div.id = id;
  div.innerHTML = `
    <div class="flex items-center gap-2">
      <select class="teach-subject flex-1 border border-outline-variant rounded-lg py-2 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">${options}</select>
      <input type="text" placeholder="اسم المدرس" class="teach-name flex-1 border border-outline-variant rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">
      <button type="button" class="w-8 h-8 rounded-lg hover:bg-error-container text-error flex items-center justify-center transition shrink-0" onclick="removeRow('${id}')">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>
      </button>
    </div>
    <input type="text" placeholder="رابط القناة أو المنصة (اختياري)" class="teach-url border border-outline-variant rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">`;
  wrap.appendChild(div);
}

// ---------- Fixed Schedule ----------
function addScheduleRow() {
  const id = "f" + Date.now() + Math.random().toString(36).slice(2, 6);
  scheduleRows.push(id);
  const wrap = document.getElementById("scheduleList");
  const subjOptions = `<option value="">بدون مادة</option>` + subjectRows.map(sid => {
    const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
    return `<option value="${sid}">${escapeHtml(name)}</option>`;
  }).join("");

  const div = document.createElement("div");
  div.className = "flex flex-col gap-2.5 bg-surface-container-low p-3.5 rounded-xl border border-outline-variant fade-in";
  div.id = id;
  div.innerHTML = `
    <div class="flex items-center gap-2">
      <input type="text" placeholder="اسم الحصة / السنتر" class="sched-title flex-1 border border-outline-variant rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">
      <select class="sched-subject flex-1 border border-outline-variant rounded-lg py-2 px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container">${subjOptions}</select>
      <button type="button" class="w-8 h-8 rounded-lg hover:bg-error-container text-error flex items-center justify-center transition shrink-0" onclick="removeRow('${id}')">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>
      </button>
    </div>
    <div class="flex flex-wrap gap-1 sched-days">
      ${DAYS.map((d, i) => `<button type="button" class="day-pill px-2.5 py-1 rounded-md text-xs font-semibold border border-outline-variant bg-white dark:bg-surface-container transition text-on-surface-variant hover:border-primary" data-day="${i}" onclick="toggleDay(this)">${d}</button>`).join("")}
    </div>
    <div class="flex items-center gap-2">
      <span class="text-xs text-on-surface-variant font-semibold">من:</span>
      <input type="time" class="sched-start flex-1 border border-outline-variant rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container font-mono" value="16:00">
      <span class="text-xs text-on-surface-variant font-semibold">إلى:</span>
      <input type="time" class="sched-end flex-1 border border-outline-variant rounded-lg py-1 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-surface-container font-mono" value="17:30">
    </div>`;
  wrap.appendChild(div);
}

function toggleDay(el) {
  el.classList.toggle("bg-primary");
  el.classList.toggle("text-white");
  el.classList.toggle("border-primary");
  el.classList.toggle("selected");
}

function removeRow(id) {
  document.getElementById(id)?.remove();
  subjectRows = subjectRows.filter(x => x !== id);
  teacherRows = teacherRows.filter(x => x !== id);
  scheduleRows = scheduleRows.filter(x => x !== id);
}

// ---------- Navigation ----------
function updateProgress() {
  const percent = Math.round((currentStep / TOTAL_STEPS) * 100);
  const fill = document.getElementById("progressFill");
  if (fill) fill.style.width = percent + "%";
  const counter = document.getElementById("stepCounterText");
  if (counter) counter.textContent = `الخطوة ${currentStep} من ${TOTAL_STEPS}`;
  const percentTxt = document.getElementById("stepPercentText");
  if (percentTxt) percentTxt.textContent = `${percent}%`;

  const backBtn = document.getElementById("backBtn");
  if (backBtn) {
    if (currentStep === 1) backBtn.classList.add("hidden");
    else backBtn.classList.remove("hidden");
  }

  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.textContent = currentStep === TOTAL_STEPS ? "حفظ والبدء 🚀" : "التالي";
  }
}

function goToStep(n) {
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  const target = document.querySelector(`.step[data-step="${n}"]`);
  if (target) target.classList.add("active");
  currentStep = n;
  updateProgress();
  if (n === 3) {
    renderSuggestedSubjects();
    if (subjectRows.length === 0) {
      // Auto pre-populate 2 suggested subjects
      const key = selectedTrack || (selectedStage === "first_secondary" ? "first_secondary" : "scientific_science");
      const list = SUGGESTIONS_MAP[key] || SUGGESTIONS_MAP.first_secondary;
      if (list && list.length >= 2) {
        addSuggestedSubject(list[0]);
        addSuggestedSubject(list[1]);
      }
    }
  }
  if (n === 4) refreshTeacherSubjectOptions();
  if (n === 5) refreshScheduleSubjectOptions();
  if (n === 6) renderSummary();
}

function refreshTeacherSubjectOptions() {
  document.querySelectorAll(".teach-subject").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = subjectRows.map(sid => {
      const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
      return `<option value="${sid}">${escapeHtml(name)}</option>`;
    }).join("");
    if (current) sel.value = current;
  });
}

function refreshScheduleSubjectOptions() {
  document.querySelectorAll(".sched-subject").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = `<option value="">بدون مادة</option>` + subjectRows.map(sid => {
      const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
      return `<option value="${sid}">${escapeHtml(name)}</option>`;
    }).join("");
    if (current) sel.value = current;
  });
}

function nextStep() {
  if (currentStep === 1) {
    if (!selectedStage) {
      showToast("يرجى اختيار الصف الدراسي");
      return;
    }
    if ((selectedStage === "second_secondary" || selectedStage === "third_secondary") && !selectedTrack) {
      showToast("يرجى اختيار الشعبة الدراسية");
      return;
    }
  }

  if (currentStep === 3 && subjectRows.length === 0) {
    showToast("يرجى إضافة مادة واحدة على الأقل");
    return;
  }

  if (currentStep < TOTAL_STEPS) {
    goToStep(currentStep + 1);
  } else {
    saveEverything();
  }
}

function prevStep() {
  if (currentStep > 1) goToStep(currentStep - 1);
}

function renderSummary() {
  const wakeTime = document.getElementById("wakeTime")?.value || "07:00";
  const sleepTime = document.getElementById("sleepTime")?.value || "23:00";
  const subjCount = subjectRows.length;
  const teachCount = teacherRows.length;
  const schedCount = scheduleRows.length;

  const stageLabels = {
    first_secondary: "الأول الثانوي",
    second_secondary: "الثاني الثانوي",
    third_secondary: "الثالث الثانوي"
  };
  const trackLabels = {
    literary: "أدبي",
    scientific_math: "علمي رياضة",
    scientific_science: "علمي علوم"
  };

  const stageText = stageLabels[selectedStage] || "غير محدد";
  const trackText = selectedTrack ? ` · ${trackLabels[selectedTrack] || ""}` : "";

  document.getElementById("summaryCard").innerHTML = `
    <div class="flex items-center justify-between py-2 border-b border-outline-variant">
      <span class="text-xs font-semibold text-on-surface-variant">المرحلة الدراسية</span>
      <span class="text-xs font-bold text-primary">${stageText}${trackText}</span>
    </div>
    <div class="flex items-center justify-between py-2 border-b border-outline-variant">
      <span class="text-xs font-semibold text-on-surface-variant">ساعات الروتين</span>
      <span class="text-xs font-bold font-cairo">من <span class="font-mono">${sleepTime}</span> حتى <span class="font-mono">${wakeTime}</span></span>
    </div>
    <div class="flex items-center justify-between py-2 border-b border-outline-variant">
      <span class="text-xs font-semibold text-on-surface-variant">المواد الدراسية</span>
      <span class="text-xs font-bold text-primary">${subjCount} مادة</span>
    </div>
    <div class="flex items-center justify-between py-2 border-b border-outline-variant">
      <span class="text-xs font-semibold text-on-surface-variant">المدرسون</span>
      <span class="text-xs font-bold">${teachCount} مدرس</span>
    </div>
    <div class="flex items-center justify-between py-2">
      <span class="text-xs font-semibold text-on-surface-variant">المواعيد الثابتة الأسبوعية</span>
      <span class="text-xs font-bold text-secondary">${schedCount} موعد أسبوعي</span>
    </div>`;
}

// ---------- Save to Supabase ----------
async function saveEverything() {
  const btn = document.getElementById("nextBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin material-symbols-outlined" style="font-size:18px">progress_activity</span><span>جاري الحفظ...</span>`;
  }

  try {
    // 1) Profile with stage and track
    const wake_time = document.getElementById("wakeTime")?.value || "07:00";
    const sleep_time = document.getElementById("sleepTime")?.value || "23:00";
    const energy_level = document.getElementById("energyLevel")?.value || "medium";
    const preferred_session_minutes = parseInt(document.getElementById("sessionMinutes")?.value) || 50;

    const profileUpdate = withTimeout(sb.from("profiles").update({
      stage: selectedStage,
      track: selectedTrack,
      wake_time,
      sleep_time,
      energy_level,
      preferred_session_minutes,
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    }).eq("id", currentUser.id));

    // 2) Subjects
    const subjectsPayload = subjectRows
      .map(sid => ({
        sid,
        name: document.querySelector(`#${sid} .subj-name`)?.value.trim(),
        priority: parseInt(document.querySelector(`#${sid} .subj-priority`)?.value) || 2
      }))
      .filter(s => s.name);

    let subjectIdMap = {};
    if (subjectsPayload.length) {
      const colors = ["#0077CC", "#00875F", "#A15C00", "#7C3AED", "#DB2777", "#D97706", "#2563EB"];
      const { data, error } = await withTimeout(sb.from("subjects")
        .insert(subjectsPayload.map((s, idx) => ({
          user_id: currentUser.id,
          name: s.name,
          priority: s.priority,
          color: colors[idx % colors.length],
          mastery_percentage: 50,
          risk_level: "stable"
        })))
        .select());
      if (!error && data) {
        data.forEach((row, i) => { subjectIdMap[subjectsPayload[i].sid] = row.id; });
      }
    }

    // 3) Teachers
    const teachersPayload = teacherRows
      .map(tid => ({
        name: document.querySelector(`#${tid} .teach-name`)?.value.trim(),
        subject_id: subjectIdMap[document.querySelector(`#${tid} .teach-subject`)?.value] || null,
        channel_url: document.querySelector(`#${tid} .teach-url`)?.value.trim() || null
      }))
      .filter(t => t.name)
      .map(t => ({ user_id: currentUser.id, ...t }));

    const teachersInsert = teachersPayload.length
      ? withTimeout(sb.from("teachers").insert(teachersPayload))
      : Promise.resolve();

    // 4) Fixed schedule
    const fixedPayload = [];
    for (const fid of scheduleRows) {
      const title = document.querySelector(`#${fid} .sched-title`)?.value.trim();
      if (!title) continue;
      const subject_id = subjectIdMap[document.querySelector(`#${fid} .sched-subject`)?.value] || null;
      const start_time = document.querySelector(`#${fid} .sched-start`)?.value;
      const end_time = document.querySelector(`#${fid} .sched-end`)?.value;
      const days = [...document.querySelectorAll(`#${fid} .day-pill.selected`)].map(el => parseInt(el.dataset.day));
      for (const day_of_week of days) {
        fixedPayload.push({ user_id: currentUser.id, subject_id, title, day_of_week, start_time, end_time, block_kind: "class" });
      }
    }
    const fixedInsert = fixedPayload.length
      ? withTimeout(sb.from("fixed_schedule").insert(fixedPayload))
      : Promise.resolve();

    await Promise.all([profileUpdate, teachersInsert, fixedInsert]);

    showToast("تم الحفظ بنجاح! 🎉");
    setTimeout(() => window.location.href = "dashboard.html", 700);

  } catch (err) {
    console.error(err);
    showToast("حدث خطأ أثناء الحفظ، يرجى المحاولة ثانية");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "حفظ والبدء 🚀";
    }
  }
}

updateProgress();
