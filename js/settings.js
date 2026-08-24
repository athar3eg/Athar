// ============================================
// مِدار — Settings Page
// ============================================
let me = null;

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

function applyTheme() {
  document.documentElement.setAttribute("data-theme", localStorage.getItem("madar-theme") || "light");
}
function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("madar-theme", next);
}
async function logout() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}

(async function init() {
  try {
    applyTheme();
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const profile = await getMyProfile(me.id);
    if (profile) {
      document.getElementById("wakeTime").value = profile.wake_time?.slice(0,5) || "07:00";
      document.getElementById("sleepTime").value = profile.sleep_time?.slice(0,5) || "23:00";
      document.getElementById("energyLevel").value = profile.energy_level || "medium";
      document.getElementById("sessionMinutes").value = profile.preferred_session_minutes || 50;
    }

    await loadSubjects();
    await loadTeachers();
  } catch (err) {
    console.error("Settings init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

async function saveProfile() {
  const btn = document.getElementById("saveProfileBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";
  try {
    const wake_time = document.getElementById("wakeTime").value;
    const sleep_time = document.getElementById("sleepTime").value;
    const energy_level = document.getElementById("energyLevel").value;
    const preferred_session_minutes = parseInt(document.getElementById("sessionMinutes").value) || 50;

    const { error } = await withTimeout(sb.from("profiles").update({
      wake_time, sleep_time, energy_level, preferred_session_minutes, updated_at: new Date().toISOString()
    }).eq("id", me.id));
    if (error) throw error;
    showToast("اتحفظ ✅");
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ التغييرات";
  }
}

// ---------- Subjects ----------
async function loadSubjects() {
  const { data, error } = await sb.from("subjects").select("*").eq("user_id", me.id).order("priority");
  const listEl = document.getElementById("subjectsList");
  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مواد لسه</div>`;
    return;
  }
  listEl.innerHTML = data.map(s => `
    <div class="row">
      <div class="dot" style="background:color-mix(in srgb, ${s.color} 20%, transparent); color:${s.color}">📖</div>
      <div class="content"><div class="title">${s.name}</div></div>
      <button class="modal-close" onclick="deleteSubject('${s.id}')">🗑️</button>
    </div>`).join("");
}
function openSubjectModal() { document.getElementById("subjectModal").classList.add("show"); }
function closeSubjectModal() { document.getElementById("subjectModal").classList.remove("show"); }

async function saveSubject() {
  const name = document.getElementById("newSubjectName").value.trim();
  if (!name) { showToast("اكتب اسم المادة"); return; }
  const btn = document.getElementById("saveSubjectBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";
  try {
    const priority = parseInt(document.getElementById("newSubjectPriority").value) || 2;
    const { error } = await withTimeout(sb.from("subjects").insert({ user_id: me.id, name, priority }));
    if (error) throw error;
    document.getElementById("newSubjectName").value = "";
    closeSubjectModal();
    showToast("اتضافت المادة ✅");
    await loadSubjects();
    await loadTeacherSubjectOptions();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ";
  }
}
async function deleteSubject(id) {
  const { error } = await sb.from("subjects").delete().eq("id", id);
  if (error) { showToast("حصل خطأ"); return; }
  showToast("اتمسحت المادة");
  await loadSubjects();
}

// ---------- Teachers ----------
async function loadTeacherSubjectOptions() {
  const { data } = await sb.from("subjects").select("*").eq("user_id", me.id);
  document.getElementById("newTeacherSubject").innerHTML = (data || []).length
    ? data.map(s => `<option value="${s.id}">${s.name}</option>`).join("")
    : `<option value="">ضيف مادة الأول</option>`;
}
async function loadTeachers() {
  await loadTeacherSubjectOptions();
  const { data, error } = await sb.from("teachers").select("*, subjects(name)").eq("user_id", me.id);
  const listEl = document.getElementById("teachersList");
  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مدرسين لسه</div>`;
    return;
  }
  listEl.innerHTML = data.map(t => `
    <div class="row">
      <div class="content">
        <div class="title">${t.name}</div>
        <div class="meta">${t.subjects?.name || ""}</div>
      </div>
      <button class="modal-close" onclick="deleteTeacher('${t.id}')">🗑️</button>
    </div>`).join("");
}
function openTeacherModal() { document.getElementById("teacherModal").classList.add("show"); }
function closeTeacherModal() { document.getElementById("teacherModal").classList.remove("show"); }

async function saveTeacher() {
  const name = document.getElementById("newTeacherName").value.trim();
  if (!name) { showToast("اكتب اسم المدرس"); return; }
  const btn = document.getElementById("saveTeacherBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";
  try {
    const subject_id = document.getElementById("newTeacherSubject").value || null;
    const channel_url = document.getElementById("newTeacherUrl").value.trim() || null;
    const { error } = await withTimeout(sb.from("teachers").insert({ user_id: me.id, name, subject_id, channel_url }));
    if (error) throw error;
    document.getElementById("newTeacherName").value = "";
    document.getElementById("newTeacherUrl").value = "";
    closeTeacherModal();
    showToast("اتضاف المدرس ✅");
    await loadTeachers();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حصل خطأ");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ";
  }
}
async function deleteTeacher(id) {
  const { error } = await sb.from("teachers").delete().eq("id", id);
  if (error) { showToast("حصل خطأ"); return; }
  showToast("اتمسح المدرس");
  await loadTeachers();
}
