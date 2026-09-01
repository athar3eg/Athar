// ============================================
// أَثَر — Focus Mode Logic (Tailwind & Supabase)
// ============================================
let me = null;
let currentTask = null;
let totalSeconds = 25 * 60;
let remainingSeconds = 25 * 60;
let timerInterval = null;
let isPaused = false;
let pendingFreeMinutes = 25;

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const params = new URLSearchParams(location.search);
    const taskId = params.get("task");

    if (taskId) {
      const { data, error } = await sb.from("tasks").select("*, subjects(name)").eq("id", taskId).single();
      if (!error && data) currentTask = data;
    }

    buildClockTicks();

    if (currentTask) {
      // Task-linked session: duration comes from the task, start right away.
      const minutes = currentTask.estimated_minutes || 25;
      totalSeconds = minutes * 60;
      remainingSeconds = totalSeconds;

      const labelEl = document.getElementById("taskLabel");
      if (labelEl) {
        labelEl.textContent = `${currentTask.title}${currentTask.subjects ? " · " + currentTask.subjects.name : ""}`;
      }

      showTimerStage();
      updateDisplay();
      startTimer();
    } else {
      // Free session: let the person choose their own duration first.
      const picker = document.getElementById("durationPicker");
      if (picker) picker.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Focus init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

function buildClockTicks() {
  const g = document.getElementById("clockTicks");
  if (!g) return;
  let html = "";
  for (let i = 0; i < 12; i++) {
    const angle = i * 30;
    const isMajor = i % 3 === 0;
    html += `<line x1="50" y1="${isMajor ? 5 : 7}" x2="50" y2="10" stroke-width="${isMajor ? 1.6 : 1}" transform="rotate(${angle} 50 50)"/>`;
  }
  g.innerHTML = html;
}

function showTimerStage() {
  const picker = document.getElementById("durationPicker");
  const stage = document.getElementById("timerStage");
  if (picker) picker.classList.add("hidden");
  if (stage) { stage.classList.remove("hidden"); stage.classList.add("fade-in"); }
}

// ── Free-session duration picker ──────────────────────────────
function pickDuration(mins, fromCustomInput = false) {
  if (!mins || mins < 1) return;
  pendingFreeMinutes = Math.min(mins, 240);

  document.querySelectorAll(".duration-chip").forEach(chip => {
    const chipMins = parseInt(chip.textContent);
    const active = chipMins === pendingFreeMinutes;
    chip.classList.toggle("bg-primary", active);
    chip.classList.toggle("text-white", active);
    chip.classList.toggle("border-primary", active);
    chip.classList.toggle("border-outline-variant", !active);
  });

  if (!fromCustomInput) {
    const customInput = document.getElementById("customDuration");
    if (customInput) customInput.value = "";
  }
}

function startFreeSession() {
  totalSeconds = pendingFreeMinutes * 60;
  remainingSeconds = totalSeconds;

  const labelEl = document.getElementById("taskLabel");
  if (labelEl) labelEl.textContent = `جلسة مذاكرة حرة · ${pendingFreeMinutes} دقيقة`;

  showTimerStage();
  updateDisplay();
  startTimer();
}

function updateDisplay() {
  const m = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
  const s = (remainingSeconds % 60).toString().padStart(2, "0");
  const timeEl = document.getElementById("timeDisplay");
  if (timeEl) timeEl.textContent = `${m}:${s}`;

  const fraction = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;

  // Progress ring
  const progressEl = document.getElementById("timerProgress");
  if (progressEl) {
    const dashoffset = (1 - fraction) * 264;
    progressEl.style.strokeDashoffset = `${dashoffset}`;
  }

  // Analog hand — sweeps one full turn (360°) over the session duration
  const handEl = document.getElementById("clockHand");
  if (handEl) {
    const angle = (1 - fraction) * 360;
    handEl.setAttribute("transform", `rotate(${angle} 50 50)`);
  }
}

function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (isPaused) return;
    remainingSeconds--;
    updateDisplay();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      finishSession();
    }
  }, 1000);
}

function togglePause() {
  isPaused = !isPaused;
  const iconEl = document.getElementById("pauseIcon");
  const textEl = document.getElementById("pauseText");
  if (iconEl) iconEl.textContent = isPaused ? "play_arrow" : "pause";
  if (textEl) textEl.textContent = isPaused ? "استكمال" : "إيقاف مؤقت";
}

async function finishSession() {
  clearInterval(timerInterval);
  const btn = document.getElementById("finishBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:16px">progress_activity</span><span>جاري الحفظ...</span>`;
  }

  // Visual celebration: turn progress ring green and trigger confetti
  const progressEl = document.getElementById("timerProgress");
  if (progressEl) {
    progressEl.style.stroke = "#00875F";
    progressEl.style.transform = "scale(1.03)";
  }
  if (typeof triggerConfetti === 'function') {
    triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
  }

  try {
    if (currentTask) {
      await withTimeout(sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", currentTask.id));
    }
    showToast(typeof getMotivationalMessage === "function" ? await getMotivationalMessage() : "أحسنت! تم تسجيل إنجاز الجلسة 🎉");
    setTimeout(() => { window.location.href = "schedule.html"; }, 800);
  } catch (err) {
    console.error(err);
    showToast("تم الانتهاء، جاري التوجيه للجدول...");
    setTimeout(() => { window.location.href = "schedule.html"; }, 1000);
  }
}
