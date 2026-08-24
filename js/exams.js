// ============================================
// مِدار — Exams Page
// ============================================
let me = null;
let mySubjects = [];

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
    document.documentElement.setAttribute("data-theme", localStorage.getItem("madar-theme") || "light");
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const { data } = await sb.from("subjects").select("*").eq("user_id", me.id);
    mySubjects = data || [];
    document.getElementById("examSubject").innerHTML = mySubjects.length
      ? mySubjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("")
      : `<option value="">ضيف مادة الأول من الإعدادات</option>`;

    await loadExams();
  } catch (err) {
    console.error("Exams init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

async function loadExams() {
  const listEl = document.getElementById("examsList");
  const { data, error } = await sb.from("exams")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .order("exam_date");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش امتحانات مضافة — دوس "إضافة امتحان" تحت 👇</div>`;
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);

  listEl.innerHTML = data.map(ex => {
    const examDate = new Date(ex.exam_date);
    const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
    const urgent = daysLeft <= 5;
    return `
      <div class="row">
        <div class="dot" style="background:${ex.subjects?.color || "var(--accent)"}"></div>
        <div class="content">
          <div class="title">${ex.title}</div>
          <div class="meta">${ex.subjects?.name || ""} · ${ex.exam_date}</div>
        </div>
        <div style="text-align:center">
          <div class="exam-days-left ${urgent ? "urgent" : ""}">${daysLeft >= 0 ? daysLeft : 0}</div>
          <div style="font-size:10px; color:var(--text-faint)">يوم</div>
        </div>
      </div>
      <div class="row" style="padding-top:0">
        <button class="btn btn-ghost btn-sm" onclick="autoPlan('${ex.id}', '${ex.subject_id || ""}', '${ex.title}', ${daysLeft})">🧠 خطط لي المراجعة تلقائيًا</button>
      </div>`;
  }).join("");
}

function openExamModal() {
  document.getElementById("examDate").value = new Date(Date.now() + 7*86400000).toISOString().slice(0,10);
  document.getElementById("examModal").classList.add("show");
}
function closeExamModal() { document.getElementById("examModal").classList.remove("show"); }

async function saveExam() {
  const title = document.getElementById("examTitle").value.trim();
  if (!title) { showToast("اكتب اسم الامتحان"); return; }

  const btn = document.getElementById("saveExamBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("examSubject").value || null;
    const exam_date = document.getElementById("examDate").value;
    if (!exam_date) { showToast("اختار تاريخ الامتحان"); btn.disabled = false; btn.textContent = "حفظ الامتحان"; return; }

    const { error } = await withTimeout(sb.from("exams").insert({ user_id: me.id, title, subject_id, exam_date }));
    if (error) throw error;

    document.getElementById("examTitle").value = "";
    closeExamModal();
    showToast("اتضاف الامتحان ✅");
    await loadExams();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ، حاول تاني");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الامتحان";
  }
}

// خطة مراجعة بسيطة: بتوزع مهام مراجعة على الأيام المتبقية لحد الامتحان
async function autoPlan(examId, subjectId, examTitle, daysLeft) {
  if (daysLeft <= 0) { showToast("الامتحان ده فات أو النهاردة"); return; }

  showToast("جاري بناء الخطة...");
  const tasksToCreate = [];
  const planDays = Math.min(daysLeft, 7); // أسبوع أخير قبل الامتحان كحد أقصى للخطة المبسطة

  const titles = ["مراجعة المفاهيم الأساسية", "حل تمارين وأمثلة", "حل أسئلة امتحانات سابقة", "مراجعة الأخطاء الشائعة", "اختبار تجريبي سريع"];

  for (let i = 0; i < planDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i + 1);
    tasksToCreate.push({
      user_id: me.id,
      subject_id: subjectId || null,
      title: `${titles[i % titles.length]} — ${examTitle}`,
      task_type: i === planDays - 1 ? "quiz" : "review",
      due_date: date.toISOString().slice(0, 10),
      estimated_minutes: 40,
      status: "pending"
    });
  }

  const { error } = await sb.from("tasks").insert(tasksToCreate);
  if (error) { console.error(error); showToast("حصل خطأ في بناء الخطة"); return; }
  showToast(`تم إضافة ${tasksToCreate.length} مهمة مراجعة في جدولك 🎯`);
}
