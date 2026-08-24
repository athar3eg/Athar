// ============================================
// مِدار — Focus Mode
// ============================================
let me = null;
let currentTask = null;
let remainingSeconds = 0;
let timerInterval = null;
let isPaused = false;

const toast = document.getElementById("toast");
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
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

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");

    if (taskId) {
      const { data, error } = await sb.from("tasks").select("*, subjects(name)").eq("id", taskId).single();
      if (!error) currentTask = data;
    }

    const minutes = currentTask ? currentTask.estimated_minutes : 25;
    remainingSeconds = minutes * 60;
    document.getElementById("taskLabel").textContent = currentTask
      ? `${currentTask.title}${currentTask.subjects ? " · " + currentTask.subjects.name : ""}`
      : "جلسة مذاكرة حرة";

    updateDisplay();
    startTimer();
  } catch (err) {
    console.error("Focus init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

function updateDisplay() {
  const m = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const s = (remainingSeconds % 60).toString().padStart(2, "0");
  document.getElementById("timeDisplay").textContent = `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (isPaused) return;
    remainingSeconds--;
    updateDisplay();
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      showToast("خلصت الجلسة! 🎉");
      finishSession();
    }
  }, 1000);
}

function togglePause() {
  isPaused = !isPaused;
  document.getElementById("pauseBtn").textContent = isPaused ? "استكمال ▶️" : "إيقاف مؤقت";
}

async function finishSession() {
  clearInterval(timerInterval);
  const btn = document.getElementById("finishBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    if (currentTask) {
      await withTimeout(sb.from("tasks").update({ status: "completed" }).eq("id", currentTask.id));
    }
    showToast("أحسنت! تم تسجيل الجلسة 🎉");
    setTimeout(() => { window.location.href = "schedule.html"; }, 900);
  } catch (err) {
    console.error(err);
    showToast("حصل خطأ في الحفظ، بس هنرجعك على أي حال");
    setTimeout(() => { window.location.href = "schedule.html"; }, 1200);
  }
}
