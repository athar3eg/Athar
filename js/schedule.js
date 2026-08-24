// ============================================
// مِدار — Schedule Page
// ============================================
const DAY_NAMES_FULL = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
let me = null;
let selectedDay = new Date().getDay();
let mySubjects = [];
let editingFixedDays = new Set();

const toast = document.getElementById("toast");
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
function comingSoon(name, e) {
  if (e) e.preventDefault();
  showToast(`🚧 قسم "${name}" جاي في تحديث قادم`);
}
function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("الاتصال بطيء — حاول تاني")), ms))
  ]);
}
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled:", e.reason));

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;
    applyTheme();

    document.getElementById("dateText").textContent = new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long" });

    buildDayTabs();
    await loadSubjectsForForms();
    await loadFixedForDay(selectedDay);
    await loadTasks();
  } catch (err) {
    console.error("Schedule init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

function applyTheme() {
  document.documentElement.setAttribute("data-theme", localStorage.getItem("madar-theme") || "light");
}

function buildDayTabs() {
  const wrap = document.getElementById("dayTabs");
  wrap.innerHTML = DAY_NAMES_FULL.map((name, i) =>
    `<div class="tab-pill ${i === selectedDay ? "active" : ""}" data-day="${i}" onclick="selectDay(${i})">${name}</div>`
  ).join("");
}
async function selectDay(i) {
  selectedDay = i;
  buildDayTabs();
  await loadFixedForDay(i);
}

async function loadSubjectsForForms() {
  const { data, error } = await sb.from("subjects").select("*").eq("user_id", me.id).order("priority");
  mySubjects = data || [];
  const opts = mySubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
  document.getElementById("taskSubject").innerHTML = opts || `<option value="">ضيف مادة الأول من الإعدادات</option>`;
  document.getElementById("fixedSubject").innerHTML = `<option value="">بدون مادة</option>` + opts;
}

async function loadFixedForDay(day) {
  const listEl = document.getElementById("fixedList");
  listEl.innerHTML = `<div class="empty-state">جاري التحميل...</div>`;

  const { data, error } = await sb.from("fixed_schedule")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id).eq("day_of_week", day)
    .order("start_time");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مواعيد ثابتة اليوم ده</div>`;
    return;
  }
  listEl.innerHTML = data.map(b => `
    <div class="row">
      <div class="dot" style="background:${b.subjects?.color || "var(--accent)"}"></div>
      <div class="content">
        <div class="title">${b.title}</div>
        <div class="meta">${b.subjects?.name || ""}</div>
      </div>
      <div class="time">${b.start_time.slice(0,5)} - ${b.end_time.slice(0,5)}</div>
    </div>`).join("");
}

async function loadTasks() {
  const listEl = document.getElementById("tasksList");
  listEl.innerHTML = `<div class="empty-state">جاري التحميل...</div>`;

  const { data, error } = await sb.from("tasks")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مهام لسه — دوس "إضافة مهمة" تحت 👇</div>`;
    return;
  }

  listEl.innerHTML = data.map(t => `
    <div class="row" id="task-${t.id}">
      <div class="check-circle" onclick="completeTask('${t.id}')"></div>
      <div class="content" onclick="location.href='focus.html?task=${t.id}'">
        <div class="title">${t.title}</div>
        <div class="meta">${t.subjects?.name || ""} ${t.due_date ? "· " + t.due_date : ""} · ${t.estimated_minutes} د</div>
      </div>
      <div class="time">${taskTypeLabel(t.task_type)}</div>
    </div>`).join("");
}

function taskTypeLabel(type) {
  const map = { study: "مذاكرة", watch: "مشاهدة", practice: "تمارين", review: "مراجعة", quiz: "اختبار", other: "تاني" };
  return map[type] || type;
}

async function completeTask(id) {
  const row = document.getElementById(`task-${id}`);
  row?.classList.add("done");
  const { error } = await sb.from("tasks").update({ status: "completed" }).eq("id", id);
  if (error) { showToast("حصل خطأ"); row?.classList.remove("done"); return; }
  showToast("تم إنجاز المهمة 🎉");
  setTimeout(loadTasks, 600);
}

// ---------- Task Modal ----------
function openTaskModal() {
  document.getElementById("taskDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("taskModal").classList.add("show");
}
function closeTaskModal() { document.getElementById("taskModal").classList.remove("show"); }

async function saveTask() {
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) { showToast("اكتب عنوان المهمة"); return; }

  const btn = document.getElementById("saveTaskBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("taskSubject").value || null;
    const task_type = document.getElementById("taskType").value;
    const due_date = document.getElementById("taskDate").value || null;
    const estimated_minutes = parseInt(document.getElementById("taskMinutes").value) || 30;

    const { error } = await withTimeout(sb.from("tasks").insert({
      user_id: me.id, title, subject_id, task_type, due_date, estimated_minutes, status: "pending"
    }));
    if (error) throw error;

    document.getElementById("taskTitle").value = "";
    closeTaskModal();
    showToast("اتضافت المهمة ✅");
    await loadTasks();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ، حاول تاني");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ المهمة";
  }
}

// ---------- Fixed Schedule Modal ----------
function openFixedModal() {
  editingFixedDays = new Set([selectedDay]);
  const wrap = document.getElementById("fixedDays");
  wrap.innerHTML = DAY_NAMES_FULL.map((d, i) =>
    `<div class="day-pill ${i === selectedDay ? "selected" : ""}" data-day="${i}" onclick="toggleFixedDay(this,${i})">${d}</div>`
  ).join("");
  document.getElementById("fixedModal").classList.add("show");
}
function closeFixedModal() { document.getElementById("fixedModal").classList.remove("show"); }
function toggleFixedDay(el, i) {
  el.classList.toggle("selected");
  if (editingFixedDays.has(i)) editingFixedDays.delete(i); else editingFixedDays.add(i);
}

async function saveFixed() {
  const title = document.getElementById("fixedTitle").value.trim();
  if (!title) { showToast("اكتب اسم الموعد"); return; }
  if (editingFixedDays.size === 0) { showToast("اختار يوم واحد على الأقل"); return; }

  const btn = document.getElementById("saveFixedBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("fixedSubject").value || null;
    const start_time = document.getElementById("fixedStart").value;
    const end_time = document.getElementById("fixedEnd").value;

    for (const day_of_week of editingFixedDays) {
      const { error } = await withTimeout(sb.from("fixed_schedule").insert({
        user_id: me.id, title, subject_id, day_of_week, start_time, end_time, block_kind: "class"
      }));
      if (error) throw error;
    }

    closeFixedModal();
    showToast("اتضاف الموعد ✅");
    await loadFixedForDay(selectedDay);
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ، حاول تاني");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الموعد";
  }
}
