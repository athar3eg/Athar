// ============================================
// أَثَر — Schedule Page Logic
// ============================================
const DAY_NAMES_FULL = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
let me = null;
let selectedDay = new Date().getDay();
let mySubjects = [];
let editingFixedDays = new Set([new Date().getDay()]);

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    buildDayTabs();
    buildFixedDaysPills();
    await withTimeout(Promise.all([
      loadSubjectsForForms(),
      loadFixedForDay(selectedDay),
      loadTasks()
    ]), 12000);
    refreshDailyTimeline();

    // If query string says new task
    const params = new URLSearchParams(location.search);
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
  wrap.innerHTML = DAY_NAMES_FULL.map((name, i) => {
    const isToday = i === new Date().getDay();
    const isActive = i === selectedDay;
    return `
      <button onclick="selectDay(${i})" class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${isActive ? "bg-primary text-white shadow-sm" : "bg-white dark:bg-surface-container border border-outline-variant text-on-surface-variant hover:border-primary/50"}">
        <span>${name}</span>
        ${isToday ? `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isActive ? "bg-white" : "bg-primary"}"></span>` : ""}
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
  class:     { badge: "حصة",     classes: "bg-error text-white",              bar: "border-r-error" },
  protected: { badge: "🛡️ راحة محمية", classes: "bg-secondary text-white",    bar: "border-r-secondary" },
  prayer:    { badge: "🕌 صلاة", classes: "bg-primary-container text-on-primary-container", bar: "border-r-primary" },
  study:     { badge: "📚 مذاكرة", classes: "bg-primary text-white",          bar: "border-r-primary" },
  rest:      { badge: "☕ راحة",  classes: "bg-tertiary-container text-on-tertiary-container", bar: "border-r-tertiary" },
  free:      { badge: "وقت حر",  classes: "bg-surface-container-low text-on-surface-variant",  bar: "border-r-outline-variant" },
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
      container.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-6">مفيش وقت كافي مسجل — اضبط وقت الصحيان والنوم من الإعدادات</div>`;
      return;
    }

    container.innerHTML = timeline.map((b, i) => {
      const style = TIMELINE_STYLE[b.type] || TIMELINE_STYLE.free;
      const isLast = i === timeline.length - 1;
      return `
      <div class="flex gap-2 sm:gap-3 ${isLast ? "" : "pb-3"}">
        <div class="flex flex-col items-center shrink-0 w-12 sm:w-16 pt-0.5">
          <span class="text-[10px] sm:text-[11px] font-mono font-bold text-on-surface-variant">${b.startLabel}</span>
        </div>
        <div class="flex-1 min-w-0 border-r-4 ${style.bar} bg-surface-container-low/60 rounded-lg px-2.5 sm:px-3.5 py-2 sm:py-2.5 ${isLast ? "" : "mb-0"}">
          <div class="flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
            <span class="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${style.classes}">${style.badge}</span>
            <span class="text-[10px] sm:text-[11px] text-on-surface-variant font-mono">${Math.round((b.end - b.start))} د</span>
          </div>
          <p class="text-xs sm:text-sm font-semibold text-on-surface mt-1 truncate">${escapeHtml(b.label)}</p>
        </div>
      </div>`;
    }).join("");
  } catch (err) {
    console.error("refreshDailyTimeline error:", err);
    container.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-6">حصل خطأ في بناء الجدول</div>`;
  }
}



