// ============================================
// أَثَر — Schedule Page Logic
// ============================================
const DAY_NAMES_FULL = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
let me = null;
let selectedDay = new Date().getDay();
let mySubjects = [];
let editingFixedDays = new Set([new Date().getDay()]);
let scheduleViewMode = "table"; // "table" (default) | "timeline"

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    // Check URL query params (e.g. ?day=2 from dashboard week cards)
    const params = new URLSearchParams(location.search);
    if (params.has("day")) {
      const d = parseInt(params.get("day"));
      if (!isNaN(d) && d >= 0 && d <= 6) {
        selectedDay = d;
      }
    }

    buildDayTabs();
    buildFixedDaysPills();
    await withTimeout(Promise.all([
      loadSubjectsForForms(),
      loadFixedForDay(selectedDay),
      loadTasks()
    ]), 12000);
    refreshNotionTableView();
    refreshDailyTimeline();

    // If query string says new task
    if (params.get("action") === "new-task") {
      openTaskModal();
    }
  } catch (err) {
    console.error("Schedule init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

function buildDayTabs() {
  const wrap = document.getElementById("dayTabs");
  if (!wrap) return;
  const today = new Date();
  wrap.innerHTML = DAY_NAMES_FULL.map((name, i) => {
    const isToday  = i === today.getDay();
    const isActive = i === selectedDay;
    // حساب تاريخ هذا اليوم من اليوم ده
    const dayOffset = (i - today.getDay() + 7) % 7;
    const dayDate   = new Date(today); dayDate.setDate(today.getDate() + dayOffset);
    const dateLabel = `${dayDate.getDate()}/${dayDate.getMonth() + 1}`;
    return `
      <button onclick="selectDay(${i})" class="flex flex-col items-center gap-0.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition min-w-[60px] sm:min-w-[70px] ${isActive ? "bg-primary text-white shadow-sm" : "bg-white dark:bg-surface-container border border-outline-variant text-on-surface-variant hover:border-primary/50 hover:bg-surface-container-low"}">
        <span class="text-[11px] ${isActive ? "opacity-80" : "opacity-60"}">${dateLabel}</span>
        <span class="flex items-center gap-1">
          <span>${name}</span>
          ${isToday ? `<span class="w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-primary"} shrink-0"></span>` : ""}
        </span>
        ${isToday ? `<span class="text-[10px] font-bold ${isActive ? "text-white/80" : "text-primary"}">اليوم</span>` : ""}
      </button>`;
  }).join("");
}

async function selectDay(i) {
  selectedDay = i;
  buildDayTabs();
  const titleEl = document.getElementById("selectedDayTitle");
  if (titleEl) titleEl.textContent = `مواعيد وحصص ${DAY_NAMES_FULL[i]}`;
  await loadFixedForDay(i);
  if (typeof refreshDailyTimeline === "function") refreshDailyTimeline();
  // تحديث عنوان وبيانات جدول نوشن لو كان المستخدم في وضع الجدول
  if (scheduleViewMode === "table") refreshNotionTableView();
}

function buildFixedDaysPills() {
  const wrap = document.getElementById("fixedDays");
  if (!wrap) return;
  wrap.innerHTML = DAY_NAMES_FULL.map((name, i) => {
    const isSel = editingFixedDays.has(i);
    return `
      <button type="button" onclick="toggleFixedDay(${i})" class="px-3 py-1 rounded-lg text-xs font-semibold border transition ${isSel ? "bg-primary text-white border-primary" : "bg-surface-container-low border-outline-variant text-on-surface-variant"}">
        ${name}
      </button>`;
  }).join("");
}

function toggleFixedDay(i) {
  if (editingFixedDays.has(i)) editingFixedDays.delete(i);
  else editingFixedDays.add(i);
  buildFixedDaysPills();
}

async function loadSubjectsForForms() {
  const { data } = await sb.from("subjects").select("*").eq("user_id", me.id).order("priority");
  mySubjects = data || [];
  const opts = mySubjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  document.getElementById("taskSubject").innerHTML = opts || `<option value="">أضف مادة أولاً من الإعدادات</option>`;
  document.getElementById("fixedSubject").innerHTML = `<option value="">بدون مادة</option>` + opts;
}

// Fixed classes for selected day
async function loadFixedForDay(day) {
  const listEl = document.getElementById("fixedList");
  listEl.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-4">جاري التحميل...</div>`;

  const { data, error } = await sb.from("fixed_schedule")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .eq("day_of_week", day)
    .order("start_time");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `
      <div class="border border-dashed border-outline-variant rounded-xl p-5 text-center text-on-surface-variant">
        <p class="text-xs font-semibold">لا توجد مواعيد ثابتة مسجلة في هذا اليوم</p>
      </div>`;
    return;
  }

  listEl.innerHTML = data.map(b => {
    const isProtected = b.block_kind === "protected";
    return `
    <div class="flex items-center justify-between gap-2 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl border border-r-4 ${isProtected ? "border-r-secondary bg-secondary-container/10" : "border-r-error bg-error-container/10"} border-outline-variant ${isProtected ? "hover:border-secondary/50" : "hover:border-error/50"} transition">
      <span class="${isProtected ? "bg-secondary" : "bg-error"} text-white text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full shrink-0">${isProtected ? "🛡️ راحة" : "حصة"}</span>
      <div class="flex-1 min-w-0">
        <p class="font-bold text-xs sm:text-sm text-on-surface truncate">${escapeHtml(b.title)}</p>
        <p class="text-[11px] sm:text-xs text-on-surface-variant mt-0.5 truncate">${escapeHtml(b.subjects?.name || "بدون مادة")}</p>
      </div>
      <span class="text-[10px] sm:text-xs font-mono font-bold text-on-surface-variant dir-ltr shrink-0 bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant whitespace-nowrap">${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}</span>
      <button onclick="deleteFixed('${b.id}')" class="p-1 rounded-lg hover:bg-error-container text-error transition shrink-0" title="حذف">
        <span class="material-symbols-outlined" style="font-size:16px">delete</span>
      </button>
    </div>`;
  }).join("");
}

async function deleteFixed(id) {
  showConfirmModal("هل أنت متأكد من حذف هذا الموعد الثابت؟", async () => {
    await sb.from("fixed_schedule").delete().eq("id", id);
    showToast("تم حذف الموعد");
    await loadFixedForDay(selectedDay);
  });
}

// Tasks & Flexible sessions
async function loadTasks() {
  const listEl = document.getElementById("tasksList");
  const lateListEl = document.getElementById("lateTasksList");
  listEl.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-4">جاري التحميل...</div>`;

  const { data, error } = await sb.from("tasks")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false });

  const tasks = data || [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const lateTasks = tasks.filter(t => t.due_date && t.due_date < todayStr);

  // تحديث إحصائيات الساعات والالتزام في العمود الجانبي ديناميكياً
  updateScheduleStats(tasks, todayStr);

  // Render Time Debt (Late tasks)
  if (lateTasks.length === 0) {
    lateListEl.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-2">لا توجد مهام متأخرة 🎉</div>`;
  } else {
    lateListEl.innerHTML = lateTasks.slice(0, 3).map(t => `
      <div class="flex justify-between items-center text-xs bg-white dark:bg-surface-container rounded-lg p-2.5 border border-error/20 gap-2">
        <span class="truncate font-semibold flex-1 min-w-0">${escapeHtml(t.title)}</span>
        <span class="font-mono font-bold text-error shrink-0 mr-1 whitespace-nowrap dir-ltr">-${t.estimated_minutes} د</span>
      </div>`).join("");
  }

  if (error || tasks.length === 0) {
    listEl.innerHTML = `
      <div class="border border-dashed border-outline-variant rounded-xl p-5 text-center text-on-surface-variant">
        <p class="text-xs font-semibold">لا توجد مهام مستحقة حالياً 🎉</p>
      </div>`;
    return;
  }

  listEl.innerHTML = tasks.map(t => {
    const isLate = t.due_date && t.due_date < todayStr;
    const isToday = t.due_date === todayStr;

    return `
      <div class="task-row flex items-center justify-between gap-2 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl border border-r-4 ${isLate ? "border-r-error bg-error-container/10" : "border-r-primary bg-primary-container/10"} border-outline-variant hover:bg-surface-container-low transition group" data-task-id="${t.id}">
        <input type="checkbox" onchange="completeTask('${t.id}')" class="w-4 h-4 accent-primary rounded cursor-pointer shrink-0"/>
        <div class="flex-1 min-w-0 cursor-pointer" onclick="location.href='focus.html?task=${t.id}'">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="text-[10px] sm:text-xs font-bold text-primary px-2 py-0.5 rounded-full shrink-0 ${isLate ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container"}">
              ${isLate ? "متأخرة" : isToday ? "مستحقة اليوم" : taskTypeLabel(t.task_type)}
            </span>
            <p class="font-bold text-xs sm:text-sm text-on-surface truncate group-hover:text-primary transition">${escapeHtml(t.title)}</p>
          </div>
          <p class="text-[11px] sm:text-xs text-on-surface-variant mt-1 truncate">
            ${escapeHtml(t.subjects?.name || "عام")} · ${t.estimated_minutes || 25} دقيقة
            ${t.due_date ? ` · موعد: ${t.due_date}` : ""}
          </p>
        </div>
        <a href="focus.html?task=${t.id}" class="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-primary text-white text-xs font-bold flex items-center gap-1 hover:bg-primary-dark transition shrink-0">
          <span class="material-symbols-outlined" style="font-size:14px">play_arrow</span>
          <span class="hidden sm:inline">ابدأ</span>
        </a>
      </div>`;
  }).join("");
}

function taskTypeLabel(type) {
  const map = { study: "مذاكرة", watch: "مشاهدة شرح", practice: "حل تمارين", review: "مراجعة", quiz: "اختبار", other: "أخرى" };
  return map[type] || "مهمة";
}

async function completeTask(id) {
  const taskRow = document.querySelector(`[data-task-id="${id}"]`);
  
  // Confetti burst
  if (taskRow && typeof triggerConfetti === 'function') {
    const rect = taskRow.getBoundingClientRect();
    triggerConfetti(rect.left + 20, rect.top + rect.height / 2);
  }

  // Animate out immediately — optimistic UI
  if (taskRow) {
    taskRow.classList.add('task-row', 'completing');
    setTimeout(() => taskRow.remove(), 330);
  }

  // DB update in background
  const { error } = await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  if (error) { showToast("حدث خطأ"); return; }
  showToast(await getMotivationalMessage());

  // تحديث الإحصائيات والخط الزمني بعد الإنهاء
  setTimeout(() => {
    loadTasks();
    if (typeof refreshDailyTimeline === 'function') refreshDailyTimeline();
  }, 400);
}

// ── حساب إحصائيات ساعات اليوم ونسبة الالتزام بدقة ────────────
async function updateScheduleStats(tasks, todayStr) {
  const hoursEl = document.getElementById("studyHoursStat");
  const prodEl = document.getElementById("productivityStat");
  if (!hoursEl || !prodEl) return;

  try {
    // جلب الحصص الثابتة لليوم لحساب مدتها
    const dayOfWeek = new Date().getDay();
    const { data: fixedToday } = await sb.from("fixed_schedule")
      .select("start_time, end_time, block_kind")
      .eq("user_id", me.id)
      .eq("day_of_week", dayOfWeek);

    let fixedMinutes = 0;
    (fixedToday || []).forEach(b => {
      if (b.block_kind !== "protected" && b.start_time && b.end_time) {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        fixedMinutes += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
    });

    // مهام اليوم
    const todayTasks = (tasks || []).filter(t => t.due_date === todayStr);
    const taskMinutes = todayTasks.reduce((acc, t) => acc + (t.estimated_minutes || 30), 0);

    const totalMinutes = fixedMinutes + taskMinutes;
    const totalHours = (totalMinutes / 60).toFixed(1);
    hoursEl.textContent = totalMinutes > 0 ? `${totalHours} س` : "0 س";

    // نسبة الالتزام لليوم (المهام المنجزة مقارنة بالمطلوبة)
    const { data: todayCompleted } = await sb.from("tasks")
      .select("id")
      .eq("user_id", me.id)
      .eq("status", "completed")
      .gte("completed_at", `${todayStr}T00:00:00`);

    const doneCount = (todayCompleted || []).length;
    const totalTodayTasks = doneCount + todayTasks.length;
    
    if (totalTodayTasks > 0) {
      const rate = Math.round((doneCount / totalTodayTasks) * 100);
      prodEl.textContent = `${rate}%`;
    } else {
      prodEl.textContent = "100%";
    }
  } catch (err) {
    console.warn("updateScheduleStats warning:", err);
  }
}

async function rescueMode() {
  const btn = document.querySelector('[onclick="rescueMode()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإنقاذ...'; }

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: lateTasks } = await sb.from('tasks')
      .select('id, title, estimated_minutes, due_date, subjects(priority)')
      .eq('user_id', me.id)
      .neq('status', 'completed')
      .lt('due_date', todayStr);

    if (!lateTasks || lateTasks.length === 0) {
      showToast('لا توجد مهام متأخرة — أنت على المسار الصحيح! 🎉');
      return;
    }

    const profile = await getMyProfile(me.id);
    const result  = await runRescueMode(me.id, lateTasks, profile);
    showToast(result.message);
    await loadTasks(); // تحديث العرض فورًا
  } catch (err) {
    console.error('Rescue mode error:', err);
    showToast('حدث خطأ أثناء تفعيل وضع الإنقاذ — حاول ثانية');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🚀 وضع الإنقاذ'; }
  }
}

// "مش قادر أذاكر النهاردة" — إعادة توزيع مهام اليوم على الأيام الجاية من غير ذنب
async function cantStudyToday() {
  showConfirmModal("هنشيل مهام النهاردة ونوزعها على الأيام الجاية براحتك. تمام؟", async () => {
    const btn = document.getElementById("cantStudyBtn");
    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ بنوزّع مهامك..."; }

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: todayTasks } = await sb.from("tasks")
        .select("id, title, estimated_minutes, due_date, subjects(priority)")
        .eq("user_id", me.id)
        .neq("status", "completed")
        .eq("due_date", todayStr);

      if (!todayTasks || todayTasks.length === 0) {
        showToast("مفيش مهام النهاردة أصلاً، خد راحتك 😌");
        return;
      }

      const prof = await getMyProfile(me.id);
      const result = await runRescueMode(me.id, todayTasks, prof);
      showToast("تمام، خد راحتك النهاردة 🌿 " + result.message.replace("✅ وضع الإنقاذ! ", ""));
      await loadTasks();
    } catch (err) {
      console.error("cantStudyToday error:", err);
      showToast("حصل خطأ، حاول تاني");
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">bedtime</span> مش قادر أذاكر النهاردة`; }
    }
  });
}

// ---------- Modals ----------
function openTaskModal() {
  document.getElementById("taskDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("taskModal").classList.remove("hidden");
}
function closeTaskModal() {
  document.getElementById("taskModal").classList.add("hidden");
}

async function saveTask() {
  const title = document.getElementById("taskTitle").value.trim();
  if (!title) { showToast("يرجى كتابة عنوان المهمة"); return; }

  const btn = document.getElementById("saveTaskBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("taskSubject").value || null;
    const task_type = document.getElementById("taskType").value;
    const due_date = document.getElementById("taskDate").value || null;
    const estimated_minutes = parseInt(document.getElementById("taskMinutes").value) || 30;

    const { error } = await withTimeout(sb.from("tasks").insert({
      user_id: me.id,
      title,
      subject_id,
      task_type,
      due_date,
      estimated_minutes,
      status: "pending"
    }));

    if (error) throw error;
    showToast("تمت إضافة المهمة بنجاح ✓");
    closeTaskModal();
    document.getElementById("taskTitle").value = "";
    await loadTasks();
  } catch (err) {
    console.error("Save task error:", err);
    showToast(err.message || "حدث خطأ أثناء حفظ المهمة");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ المهمة";
  }
}

function openFixedModal() {
  editingFixedDays = new Set([selectedDay]);
  buildFixedDaysPills();
  document.getElementById("fixedModal").classList.remove("hidden");
}
function closeFixedModal() {
  document.getElementById("fixedModal").classList.add("hidden");
}

async function saveFixed() {
  const title = document.getElementById("fixedTitle").value.trim();
  if (!title) { showToast("يرجى كتابة اسم الموعد"); return; }
  if (editingFixedDays.size === 0) { showToast("اختر يوماً واحداً على الأقل"); return; }

  const btn = document.getElementById("saveFixedBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("fixedSubject").value || null;
    const block_kind = document.getElementById("fixedKind")?.value || "class";
    const start_time = document.getElementById("fixedStart").value;
    const end_time = document.getElementById("fixedEnd").value;

    const rows = Array.from(editingFixedDays).map(d => ({
      user_id: me.id,
      title,
      subject_id,
      block_kind,
      day_of_week: d,
      start_time,
      end_time
    }));

    const { error } = await withTimeout(sb.from("fixed_schedule").insert(rows));
    if (error) throw error;

    showToast("تم حفظ الموعد الثابت بنجاح ✓");
    closeFixedModal();
    document.getElementById("fixedTitle").value = "";
    await loadFixedForDay(selectedDay);
    if (selectedDay === new Date().getDay()) refreshDailyTimeline();
  } catch (err) {
    console.error("Save fixed error:", err);
    showToast(err.message || "حدث خطأ أثناء حفظ الموعد");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الموعد";
  }
}

// ── محرك الجدولة بالساعة: يبني جدول اليوم كامل من الحصص + الصلوات + المهام ──
const TIMELINE_STYLE = {
  class:     { badge: "حصة دراسية", badgeBg: "bg-error-container text-on-error-container dark:bg-[#3a0d0d] dark:text-[#ffb4ab]", dot: "bg-error", border: "hover:border-error/60 dark:border-r-error", icon: "school" },
  protected: { badge: "🛡️ راحة محمية", badgeBg: "bg-secondary-container text-on-secondary-container dark:bg-[#0a3322] dark:text-[#8fe9c4]", dot: "bg-secondary", border: "hover:border-secondary/60 dark:border-r-secondary", icon: "spa" },
  prayer:    { badge: "🕌 صلاة", badgeBg: "bg-sky-100 dark:bg-[#082f49] text-sky-800 dark:text-sky-300", dot: "bg-sky-500", border: "hover:border-sky-400/60 dark:border-r-sky-500", icon: "mosque" },
  study:     { badge: "📚 مذاكرة", badgeBg: "bg-primary-container text-on-primary-container dark:bg-[#0f2c46] dark:text-[#bfe0ff]", dot: "bg-primary", border: "hover:border-primary/60 dark:border-r-primary", icon: "menu_book" },
  rest:      { badge: "☕ استراحة", badgeBg: "bg-amber-100 dark:bg-[#3a2400] text-amber-800 dark:text-[#ffd28a]", dot: "bg-amber-500", border: "hover:border-amber-400/60 dark:border-r-amber-500", icon: "coffee" },
  free:      { badge: "وقت حر", badgeBg: "bg-surface-container-high text-on-surface-variant dark:bg-[#25324a] dark:text-[#bfe0ff]", dot: "bg-outline", border: "hover:border-outline/60 dark:border-r-outline", icon: "hourglass_empty" },
};

async function refreshDailyTimeline() {
  const container = document.getElementById("dailyTimelineList");
  if (!container) return;
  container.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-6">جاري بناء الجدول...</div>`;

  try {
    const isToday = selectedDay === new Date().getDay();
    const profile = await getMyProfile(me.id);

    const [{ data: fixedBlocks }, { data: dayTasks }] = await withTimeout(Promise.all([
      sb.from("fixed_schedule").select("start_time,end_time,block_kind,title").eq("user_id", me.id).eq("day_of_week", selectedDay),
      isToday
        ? sb.from("tasks").select("id,title,estimated_minutes,subjects(priority)").eq("user_id", me.id).neq("status", "completed").eq("due_date", new Date().toISOString().slice(0, 10))
        : Promise.resolve({ data: [] })
    ]), 12000);

    let prayerTimes = null;
    if (isToday && profile?.latitude != null && profile?.longitude != null && typeof computePrayerTimes === "function") {
      prayerTimes = computePrayerTimes(profile.latitude, profile.longitude);
    }

    const timeline = buildDailyTimeline({
      wakeTime: profile?.wake_time || "07:00:00",
      sleepTime: profile?.sleep_time || "23:30:00",
      fixedBlocks: fixedBlocks || [],
      prayerTimes,
      tasks: dayTasks || [],
      sessionMinutes: profile?.preferred_session_minutes || 45,
      restMinutes: 15,
    });

    if (timeline.length === 0) {
      container.innerHTML = `
        <div class="border border-dashed border-outline-variant dark:border-[#2c3a52] rounded-2xl p-6 text-center text-on-surface-variant">
          <span class="material-symbols-outlined text-outline mb-1" style="font-size:28px">event_available</span>
          <p class="text-xs sm:text-sm font-bold text-on-surface dark:text-[#eef2f9]">مفيش وقت كافي مسجل لهذا اليوم</p>
          <p class="text-[11px] text-outline mt-0.5">اضبط وقت الصحيان والنوم من الإعدادات أو أضف حصص ومواعيد</p>
        </div>`;
      return;
    }

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    container.innerHTML = timeline.map((b, i) => {
      const style = TIMELINE_STYLE[b.type] || TIMELINE_STYLE.free;
      const isNow = isToday && nowMinutes >= b.start && nowMinutes < b.end;
      const isPassed = isToday && nowMinutes >= b.end;
      const durationMin = Math.round(b.end - b.start);

      let cardBg = "bg-white dark:bg-[#141d2e] border-outline-variant/80 dark:border-[#2c3a52]";
      let statusPill = "";

      if (isNow) {
        cardBg = "bg-primary-container/20 dark:bg-[#0f2c46]/80 border-primary shadow-sm";
        statusPill = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white animate-pulse flex items-center gap-1 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>الآن</span>`;
      } else if (isPassed) {
        cardBg = "bg-surface-container-lowest dark:bg-[#111827] border-outline-variant/60 dark:border-[#202b3d] opacity-75";
        statusPill = `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high dark:bg-[#1e2a40] text-on-surface-variant dark:text-gray-400 flex items-center gap-0.5 shrink-0"><span class="material-symbols-outlined" style="font-size:12px">check</span>انتهت</span>`;
      }

      const isStudy = b.type === "study";
      const focusLink = isStudy ? (b.taskId ? `focus.html?task=${b.taskId}` : `focus.html`) : "";

      return `
      <div class="flex items-stretch gap-2.5 sm:gap-3.5 pb-3 group">
        <!-- Time column -->
        <div class="flex flex-col items-center justify-start shrink-0 w-14 sm:w-16 pt-2 text-left">
          <span class="text-[11px] sm:text-xs font-mono font-bold text-on-surface dark:text-sky-300 dir-ltr bg-surface-container-low dark:bg-[#182236] px-1.5 py-0.5 rounded border border-outline-variant/60 dark:border-[#2c3a52] whitespace-nowrap">${b.startLabel}</span>
        </div>

        <!-- Main Content Card -->
        <div class="flex-1 min-w-0 border-r-4 ${style.border} ${cardBg} border rounded-2xl p-3 sm:p-3.5 shadow-xs transition hover:scale-[1.005] flex items-center justify-between gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <span class="text-[10px] font-bold px-2.5 py-0.5 rounded-full ${style.badgeBg} shadow-xs">${style.badge}</span>
              <span class="text-[10px] sm:text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-container-low dark:bg-[#1e2a40] text-on-surface dark:text-gray-300 border border-outline-variant/40 dark:border-transparent">${durationMin} دقيقة</span>
              ${statusPill}
            </div>
            <p class="text-xs sm:text-sm font-extrabold text-on-surface dark:text-[#eef2f9] truncate ${isNow ? 'text-primary dark:text-sky-300' : ''}">${escapeHtml(b.label)}</p>
          </div>

          ${isStudy ? `
            <a href="${focusLink}" class="shrink-0 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white dark:text-sky-300 dark:hover:text-white text-xs font-bold transition flex items-center gap-1 shadow-xs border border-primary/20" title="بدء جلسة تركيز">
              <span class="material-symbols-outlined" style="font-size:15px">play_arrow</span>
              <span class="hidden sm:inline">ابدأ التركيز</span>
            </a>
          ` : ""}
        </div>
      </div>`;
    }).join("");
  } catch (err) {
    console.error("refreshDailyTimeline error:", err);
    container.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-6">حصل خطأ في بناء الجدول</div>`;
  }
}

// ══════════════════════════════════════════════
// Notion Table View — جدول المهام بنمط نوشن
// ══════════════════════════════════════════════

function switchScheduleView(mode) {
  scheduleViewMode = mode;
  const defaultView = document.getElementById("defaultScheduleView");
  const notionView  = document.getElementById("notionTableView");
  const timelineBtn = document.getElementById("viewModeTimelineBtn");
  const tableBtn    = document.getElementById("viewModeTableBtn");
  const hintEl      = document.getElementById("activeViewHint");

  const activeClass   = ["bg-primary", "text-white", "shadow-xs"];
  const inactiveClass = ["text-on-surface-variant", "hover:text-on-surface", "hover:bg-surface-container-high/60"];

  if (mode === "table") {
    defaultView?.classList.add("hidden");
    notionView?.classList.remove("hidden");
    // Button styling
    timelineBtn?.classList.remove(...activeClass);
    timelineBtn?.classList.add(...inactiveClass);
    tableBtn?.classList.add(...activeClass);
    tableBtn?.classList.remove(...inactiveClass);
    if (hintEl) hintEl.textContent = "جدول المهام مرتب بالنوع والمادة والوقت";
    refreshNotionTableView();
  } else {
    defaultView?.classList.remove("hidden");
    notionView?.classList.add("hidden");
    timelineBtn?.classList.add(...activeClass);
    timelineBtn?.classList.remove(...inactiveClass);
    tableBtn?.classList.remove(...activeClass);
    tableBtn?.classList.add(...inactiveClass);
    if (hintEl) hintEl.textContent = "عرض زمني موحد للحصص والمذاكرة والصلوات";
  }
}

// Notion Task-type config (Notion badge style)
const NOTION_TYPE_CFG = {
  prayer:    { label: "🕌 عبادة",   bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
  study:     { label: "📚 مذاكرة", bg: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300",   dot: "bg-blue-500" },
  class:     { label: "🏫 حصة دراسية", bg: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300",   dot: "bg-red-500" },
  protected: { label: "🛡️ راحة",  bg: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300", dot: "bg-purple-500" },
  rest:      { label: "☕ استراحة", bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  watch:     { label: "▶️ مشاهدة شرح", bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300", dot: "bg-sky-500" },
  practice:  { label: "✏️ حل تمارين", bg: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300", dot: "bg-indigo-500" },
  review:    { label: "🔁 مراجعة", bg: "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300", dot: "bg-teal-500" },
  quiz:      { label: "📝 اختبار", bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300", dot: "bg-rose-500" },
  other:     { label: "📌 أخرى",   bg: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300", dot: "bg-gray-400" },
};

function notionTypeBadge(type) {
  const cfg = NOTION_TYPE_CFG[type] || NOTION_TYPE_CFG.other;
  return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.bg} whitespace-nowrap">
    <span class="w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0"></span>
    ${cfg.label}
  </span>`;
}

function fmt12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

async function refreshNotionTableView() {
  const tbody    = document.getElementById("notionTableBody");
  const titleEl  = document.getElementById("notionTableDayTitle");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-outline">
    <span class="inline-block animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full ml-2"></span>جاري تحميل الجدول...
  </td></tr>`;

  if (titleEl) {
    const dayName = DAY_NAMES_FULL[selectedDay] || "";
    const isToday = selectedDay === new Date().getDay();
    titleEl.textContent = `${dayName}${isToday ? " — اليوم 📌" : ""}`;
  }

  try {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const isToday  = selectedDay === today.getDay();

    // حساب تاريخ اليوم المختار بدقة (YYYY-MM-DD)
    const dayOffset = (selectedDay - today.getDay() + 7) % 7;
    const targetDayDate = new Date(today);
    targetDayDate.setDate(today.getDate() + dayOffset);
    const targetDateStr = targetDayDate.toISOString().slice(0, 10);

    // جلب الحصص الثابتة لليوم المختار + المهام المستحقة في ذلك اليوم
    let taskQuery = sb.from("tasks")
      .select("id, title, task_type, estimated_minutes, due_date, status, subjects(name, color)")
      .eq("user_id", me.id)
      .neq("status", "completed");

    if (isToday) {
      // لليوم الحالي: نعرض مهام اليوم (أو المهام المتأخرة)
      taskQuery = taskQuery.or(`due_date.eq.${todayStr},due_date.lt.${todayStr}`);
    } else {
      // لأي يوم آخر مختار من التابات: نعرض المهام المستحقة في ذلك اليوم فقط
      taskQuery = taskQuery.eq("due_date", targetDateStr);
    }

    const [{ data: fixedBlocks }, { data: dayTasks }] = await Promise.all([
      sb.from("fixed_schedule")
        .select("id, title, start_time, end_time, block_kind, subjects(name, color)")
        .eq("user_id", me.id)
        .eq("day_of_week", selectedDay)
        .order("start_time"),
      taskQuery.order("due_date", { ascending: true, nullsFirst: false })
    ]);

    // ترحيل المهام المتأخرة لتاريخ اليوم تلقائياً في الخلفية (Auto-rollover)
    if (isToday) {
      const overdueIds = (dayTasks || []).filter(t => t.due_date && t.due_date < todayStr).map(t => t.id);
      if (overdueIds.length > 0) {
        sb.from("tasks").update({ due_date: todayStr }).in("id", overdueIds).then(({ error }) => {
          if (error) console.error("Auto rollover in schedule error:", error);
        });
      }
    }

    // بناء قائمة الصفوف الموحدة
    const rows = [];

    // ①  الحصص الثابتة
    for (const b of (fixedBlocks || [])) {
      rows.push({
        kind:     "fixed",
        id:       b.id,
        title:    b.title,
        type:     b.block_kind === "protected" ? "protected" : "class",
        subject:  b.subjects?.name || "—",
        timeFrom: b.start_time,
        timeTo:   b.end_time,
        minutes:  null,
        dueDate:  null,
        taskId:   null,
      });
    }

    // ②  مهام اليوم المختار فقط
    for (const t of (dayTasks || [])) {
      rows.push({
        kind:     "task",
        id:       t.id,
        title:    t.title,
        type:     t.task_type || "study",
        subject:  t.subjects?.name || "عام",
        timeFrom: null,
        timeTo:   null,
        minutes:  t.estimated_minutes || 30,
        dueDate:  t.due_date,
        taskId:   t.id,
      });
    }

    if (rows.length === 0) {
      tbody.innerHTML = `<tr>
        <td colspan="7" class="text-center py-10 text-on-surface-variant">
          <span class="material-symbols-outlined text-outline" style="font-size:36px">event_available</span>
          <p class="text-sm font-bold mt-2">لا توجد مهام أو حصص في هذا اليوم 🌿</p>
          <p class="text-xs text-outline mt-1">يمكنك إضافة موعد ثابت أو مهمة جديدة</p>
        </td>
      </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, idx) => {
      const badge       = notionTypeBadge(row.type);
      const timeDisplay = row.timeFrom
        ? `<span class="dir-ltr font-mono text-[11px] text-on-surface-variant">${fmt12h(row.timeFrom)} ← ${fmt12h(row.timeTo)}</span>`
        : row.dueDate
          ? `<span class="text-[11px] text-on-surface-variant">موعد: ${row.dueDate}</span>`
          : `<span class="text-outline text-[11px]">—</span>`;
      const durationDisplay = row.minutes
        ? `<span class="inline-flex items-center gap-1 text-[11px] text-on-surface-variant font-mono bg-surface-container-low dark:bg-[#182236] px-2 py-0.5 rounded border border-outline-variant/60">${row.minutes} د</span>`
        : row.timeFrom
          ? (() => {
              const [sh, sm] = (row.timeFrom || "0:0").split(":").map(Number);
              const [eh, em] = (row.timeTo   || "0:0").split(":").map(Number);
              const dur = (eh * 60 + em) - (sh * 60 + sm);
              return dur > 0
                ? `<span class="inline-flex items-center gap-1 text-[11px] text-on-surface-variant font-mono bg-surface-container-low dark:bg-[#182236] px-2 py-0.5 rounded border border-outline-variant/60">${dur} د</span>`
                : `<span class="text-outline text-[11px]">—</span>`;
            })()
          : `<span class="text-outline text-[11px]">—</span>`;

      const actionBtn = row.taskId
        ? `<a href="focus.html?task=${row.taskId}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-bold hover:bg-primary-dark transition shrink-0">
             <span class="material-symbols-outlined" style="font-size:13px">play_arrow</span> ابدأ
           </a>`
        : `<span class="text-outline text-[11px]">—</span>`;

      const checkbox = row.taskId
        ? `<input type="checkbox" onchange="notionCompleteTask('${row.taskId}', this)" class="w-4 h-4 accent-primary cursor-pointer rounded" title="أنهِ المهمة"/>`
        : `<span class="material-symbols-outlined text-outline" style="font-size:16px">radio_button_unchecked</span>`;

      const subjectColor = row.subject !== "—" && row.subject !== "عام"
        ? `<span class="font-semibold text-[11px] text-primary">${escapeHtml(row.subject)}</span>`
        : `<span class="text-outline text-[11px]">${escapeHtml(row.subject)}</span>`;

      const rowHover = row.taskId
        ? "hover:bg-primary-container/10 dark:hover:bg-[#0f2c46]/30"
        : row.type === "class"
          ? "hover:bg-error-container/10"
          : "hover:bg-surface-container-lowest/60";

      return `<tr class="group transition-colors ${rowHover}" data-notion-row="${row.id}">
        <td class="p-3 text-center">${checkbox}</td>
        <td class="p-3">
          <span class="font-semibold text-[12px] text-on-surface dark:text-[#eef2f9] group-hover:text-primary transition leading-snug">${escapeHtml(row.title)}</span>
        </td>
        <td class="p-3">${badge}</td>
        <td class="p-3">${subjectColor}</td>
        <td class="p-3">${timeDisplay}</td>
        <td class="p-3">${durationDisplay}</td>
        <td class="p-3 text-center">${actionBtn}</td>
      </tr>`;
    }).join("");

  } catch (err) {
    console.error("refreshNotionTableView error:", err);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-error">حصل خطأ في تحميل البيانات</td></tr>`;
  }
}

// إنهاء مهمة من جدول نوشن
async function notionCompleteTask(taskId, checkbox) {
  checkbox.disabled = true;
  try {
    const { error } = await sb.from("tasks")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) throw error;

    // أنيميشن: الصف يختفي بشكل سلس
    const row = checkbox.closest("tr");
    if (row) {
      row.style.transition = "opacity 0.35s, transform 0.35s";
      row.style.opacity = "0";
      row.style.transform = "translateX(12px)";
      setTimeout(() => row.remove(), 380);
    }
    showToast(await getMotivationalMessage());
    // تحديث القائمة العادية كمان لو رجع
    loadTasks();
  } catch (err) {
    showToast("تعذر الإنهاء، حاول تاني");
    checkbox.disabled = false;
    checkbox.checked  = false;
  }
}

// ══════════════════════════════════════════════════════════════
// 1. إعادة التوازن الذكي (Smart Reschedule)
// ══════════════════════════════════════════════════════════════
async function smartRescheduleToday() {
  try {
    showToast("جاري تحليل جدولك وإعادة موازنة المهام بذكاء... ⏳");
    const todayStr = new Date().toISOString().slice(0, 10);
    const dayOfWeek = new Date().getDay();

    const [{ data: fixedBlocks }, { data: pendingTasks }] = await Promise.all([
      sb.from("fixed_schedule")
        .select("start_time, end_time, block_kind")
        .eq("user_id", me.id)
        .eq("day_of_week", dayOfWeek)
        .order("start_time"),
      sb.from("tasks")
        .select("id, title, estimated_minutes, due_date")
        .eq("user_id", me.id)
        .neq("status", "completed")
        .eq("due_date", todayStr)
        .order("due_date")
    ]);

    if (!pendingTasks || pendingTasks.length === 0) {
      showToast("لا توجد مهام معلقة لإعادة موازنتها اليوم 🎉");
      return;
    }

    // حساب إجمالي الدقائق المتبقية
    const totalMinutes = pendingTasks.reduce((sum, t) => sum + (t.estimated_minutes || 30), 0);
    const nowHour = new Date().getHours();
    const remainingHours = Math.max(1, 23 - nowHour);

    // إذا كان الحمل كبيراً على الساعات المتبقية، نقترح ترحيل مهام خفيفة للغد
    if (totalMinutes > remainingHours * 45 && pendingTasks.length > 1) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      // ترحيل آخر مهمة إلى الغد لتخفيف الضغط
      const taskToShift = pendingTasks[pendingTasks.length - 1];
      await sb.from("tasks").update({ due_date: tomorrowStr }).eq("id", taskToShift.id);

      showToast(`تمت إعادة التوازن! تم تركيز مهام اليوم وترحيل "${taskToShift.title}" للغد 🎯`);
    } else {
      showToast(`تمت موازنة المهام! متبقي لديك حوالي ${Math.round(totalMinutes / 60 * 10) / 10} ساعة مذاكرة موزعة على فترات راحة ☕`);
    }

    // إعادة تحميل الجدول
    if (typeof refreshNotionTableView === "function") refreshNotionTableView();
    if (typeof refreshDailyTimeline === "function") refreshDailyTimeline();
    if (typeof loadTasks === "function") loadTasks();
  } catch (err) {
    console.error("smartReschedule error:", err);
    showToast("تعذر إعادة التوازن، يرجى المحاولة ثانية");
  }
}

// ══════════════════════════════════════════════════════════════
// 2. تصدير ومشاركة اليوم (Export Day as Printable/Shareable View)
// ══════════════════════════════════════════════════════════════
function exportTodaySchedule() {
  try {
    const today = new Date();
    const dayName = typeof DAY_NAMES_FULL !== "undefined" ? DAY_NAMES_FULL[today.getDay()] : "اليوم";
    const dateStr = today.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

    // إنشاء نافذة طباعة ومشاركة منسقة بتصميم راقي
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("يرجى السماح بالنوافذ المنبثقة لتصدير الجدول");
      return;
    }

    const tableEl = document.getElementById("notionTableBody") || document.getElementById("dashboardNotionTableBody");
    const rowsHtml = tableEl ? tableEl.innerHTML : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>جدول ${dayName} — منصة أَثَر</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Cairo', sans-serif; padding: 30px; background: #ffffff; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0077cc; padding-bottom: 20px; margin-bottom: 25px; }
          .logo { font-size: 24px; font-weight: 900; color: #0077cc; }
          .subtitle { font-size: 14px; color: #64748b; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px; border: 1px solid #cbd5e1; text-align: right; }
          td { padding: 10px; border: 1px solid #e2e8f0; }
          .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🌿 منصة أَثَر — الجدول الدراسي اليومي</div>
          <div class="subtitle">${dayName} · ${dateStr}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>المهمة / الحصة</th>
              <th>النوع</th>
              <th>المادة</th>
              <th>الوقت / التاريخ</th>
              <th>المدة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          تم التصدير عبر منصة أَثَر الذكية لإدارة المذاكرة والحياة الطلابية 🎓✨
        </div>
        <script>
          setTimeout(() => { window.print(); }, 400);
        <\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    console.error("Export error:", err);
    showToast("تعذر تصدير الجدول حالياً");
  }
}
