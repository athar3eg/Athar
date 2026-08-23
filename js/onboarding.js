// ============================================
// مِدار — Onboarding Wizard
// ============================================
let currentUser = null;
let currentStep = 1;
const TOTAL_STEPS = 5;
const DAYS = ["أحد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"];

let subjectRows = [];
let teacherRows = [];
let scheduleRows = [];

const toast = document.getElementById("toast");
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

(async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;
  addSubjectRow();
  addScheduleRow();
})();

// ---------- Subjects ----------
function addSubjectRow() {
  const id = "s" + Date.now() + Math.random().toString(36).slice(2, 6);
  subjectRows.push(id);
  const wrap = document.getElementById("subjectsList");
  const div = document.createElement("div");
  div.className = "repeat-item";
  div.id = id;
  div.innerHTML = `
    <input type="text" placeholder="اسم المادة" class="subj-name">
    <select class="subj-priority">
      <option value="1">أولوية عالية</option>
      <option value="2" selected>أولوية متوسطة</option>
      <option value="3">أولوية عادية</option>
    </select>
    <button type="button" class="remove-btn" onclick="removeRow('${id}')">✕</button>`;
  wrap.appendChild(div);
}

// ---------- Teachers ----------
function addTeacherRow() {
  const id = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
  teacherRows.push(id);
  const wrap = document.getElementById("teachersList");
  const options = subjectRows.map(sid => {
    const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
    return `<option value="${sid}">${name}</option>`;
  }).join("");
  const div = document.createElement("div");
  div.className = "repeat-item";
  div.id = id;
  div.innerHTML = `
    <select class="teach-subject">${options}</select>
    <input type="text" placeholder="اسم المدرس" class="teach-name">
    <input type="text" placeholder="رابط القناة (اختياري)" class="teach-url">
    <button type="button" class="remove-btn" onclick="removeRow('${id}')">✕</button>`;
  wrap.appendChild(div);
}

// ---------- Fixed schedule ----------
function addScheduleRow() {
  const id = "f" + Date.now() + Math.random().toString(36).slice(2, 6);
  scheduleRows.push(id);
  const wrap = document.getElementById("scheduleList");
  const subjOptions = `<option value="">بدون مادة</option>` + subjectRows.map(sid => {
    const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
    return `<option value="${sid}">${name}</option>`;
  }).join("");

  const div = document.createElement("div");
  div.className = "repeat-item";
  div.id = id;
  div.style.flexWrap = "wrap";
  div.innerHTML = `
    <input type="text" placeholder="اسم الموعد (مثلاً: حصة فيزياء)" class="sched-title" style="flex-basis:100%">
    <select class="sched-subject" style="flex-basis:48%">${subjOptions}</select>
    <div class="day-pills sched-days" style="flex-basis:100%">
      ${DAYS.map((d, i) => `<div class="day-pill" data-day="${i}" onclick="toggleDay(this)">${d}</div>`).join("")}
    </div>
    <input type="time" class="sched-start" value="16:00" style="flex-basis:47%">
    <input type="time" class="sched-end" value="17:00" style="flex-basis:47%">
    <button type="button" class="remove-btn" onclick="removeRow('${id}')">✕</button>`;
  wrap.appendChild(div);
}
function toggleDay(el) { el.classList.toggle("selected"); }

function removeRow(id) {
  document.getElementById(id)?.remove();
  subjectRows = subjectRows.filter(x => x !== id);
  teacherRows = teacherRows.filter(x => x !== id);
  scheduleRows = scheduleRows.filter(x => x !== id);
}

// ---------- Navigation ----------
function updateProgress() {
  document.getElementById("progressFill").style.width = (currentStep / TOTAL_STEPS * 100) + "%";
  document.getElementById("backBtn").style.display = currentStep === 1 ? "none" : "flex";
  document.getElementById("nextBtn").textContent = currentStep === TOTAL_STEPS ? "احفظ وابدأ 🚀" : "التالي";
}

function goToStep(n) {
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  document.querySelector(`.step[data-step="${n}"]`).classList.add("active");
  currentStep = n;
  updateProgress();
  if (n === 3) refreshTeacherSubjectOptions();
  if (n === 4) refreshScheduleSubjectOptions();
  if (n === 5) renderSummary();
}

function refreshTeacherSubjectOptions() {
  document.querySelectorAll(".teach-subject").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = subjectRows.map(sid => {
      const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
      return `<option value="${sid}">${name}</option>`;
    }).join("");
    if (current) sel.value = current;
  });
}
function refreshScheduleSubjectOptions() {
  document.querySelectorAll(".sched-subject").forEach(sel => {
    const current = sel.value;
    sel.innerHTML = `<option value="">بدون مادة</option>` + subjectRows.map(sid => {
      const name = document.querySelector(`#${sid} .subj-name`)?.value || "مادة";
      return `<option value="${sid}">${name}</option>`;
    }).join("");
    if (current) sel.value = current;
  });
}

function nextStep() {
  if (currentStep === 2 && subjectRows.length === 0) {
    showToast("ضيف مادة واحدة على الأقل");
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
  const wakeTime = document.getElementById("wakeTime").value;
  const sleepTime = document.getElementById("sleepTime").value;
  const subjCount = subjectRows.length;
  const teachCount = teacherRows.length;
  const schedCount = scheduleRows.length;

  document.getElementById("summaryCard").innerHTML = `
    <div class="row"><div class="content"><div class="title">النوم والصحيان</div><div class="meta">من ${sleepTime} لحد ${wakeTime}</div></div></div>
    <div class="row"><div class="content"><div class="title">المواد</div><div class="meta">${subjCount} مادة</div></div></div>
    <div class="row"><div class="content"><div class="title">المدرسين</div><div class="meta">${teachCount} مدرس</div></div></div>
    <div class="row"><div class="content"><div class="title">الجدول الثابت</div><div class="meta">${schedCount} موعد أسبوعي</div></div></div>
  `.replace(/<div class="row">/g, '<div class="row" style="border-bottom:1px solid var(--border)">');
}

// ---------- Save to Supabase ----------
async function saveEverything() {
  const btn = document.getElementById("nextBtn");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> جاري الحفظ...`;

  try {
    // 1) Profile
    const wake_time = document.getElementById("wakeTime").value;
    const sleep_time = document.getElementById("sleepTime").value;
    const energy_level = document.getElementById("energyLevel").value;
    const preferred_session_minutes = parseInt(document.getElementById("sessionMinutes").value) || 50;

    await supabase.from("profiles").update({
      wake_time, sleep_time, energy_level, preferred_session_minutes,
      onboarding_completed: true, updated_at: new Date().toISOString()
    }).eq("id", currentUser.id);

    // 2) Subjects — save and map local id -> real db id
    const subjectIdMap = {};
    for (const sid of subjectRows) {
      const name = document.querySelector(`#${sid} .subj-name`)?.value.trim();
      if (!name) continue;
      const priority = parseInt(document.querySelector(`#${sid} .subj-priority`)?.value) || 2;
      const { data, error } = await supabase.from("subjects")
        .insert({ user_id: currentUser.id, name, priority })
        .select().single();
      if (!error) subjectIdMap[sid] = data.id;
    }

    // 3) Teachers
    for (const tid of teacherRows) {
      const name = document.querySelector(`#${tid} .teach-name`)?.value.trim();
      if (!name) continue;
      const localSubjId = document.querySelector(`#${tid} .teach-subject`)?.value;
      const channel_url = document.querySelector(`#${tid} .teach-url`)?.value.trim() || null;
      await supabase.from("teachers").insert({
        user_id: currentUser.id,
        subject_id: subjectIdMap[localSubjId] || null,
        name, channel_url
      });
    }

    // 4) Fixed schedule — one row per selected day
    for (const fid of scheduleRows) {
      const title = document.querySelector(`#${fid} .sched-title`)?.value.trim();
      if (!title) continue;
      const localSubjId = document.querySelector(`#${fid} .sched-subject`)?.value;
      const start_time = document.querySelector(`#${fid} .sched-start`)?.value;
      const end_time = document.querySelector(`#${fid} .sched-end`)?.value;
      const days = [...document.querySelectorAll(`#${fid} .day-pill.selected`)].map(el => parseInt(el.dataset.day));
      for (const day_of_week of days) {
        await supabase.from("fixed_schedule").insert({
          user_id: currentUser.id,
          subject_id: subjectIdMap[localSubjId] || null,
          title, day_of_week, start_time, end_time, block_kind: "class"
        });
      }
    }

    showToast("تم الحفظ! 🎉");
    setTimeout(() => window.location.href = "dashboard.html", 700);

  } catch (err) {
    console.error(err);
    showToast("حصل خطأ، حاول تاني");
    btn.disabled = false;
    btn.textContent = "احفظ وابدأ 🚀";
  }
}

updateProgress();
