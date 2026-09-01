// ============================================
// أَثَر — Dashboard Logic (Tailwind & Supabase)
// ============================================
const DAY_NAMES = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

let me = null;
let profile = null;
let allTodayFixed = [];
let allPendingTasks = [];
let allSubjects = [];

(async function init() {
  try {
    // 1. Instant Cache-First Render (0 ms Delay)
    const cached = localStorage.getItem('athar_dash_cache') || localStorage.getItem('madar_dash_cache');
    if (cached) {
      try {
        const c = JSON.parse(cached);
        if (c.profile) { profile = c.profile; setGreeting(); }
        if (c.today) renderTodayList(c.today, new Date().getHours() * 60 + new Date().getMinutes());
        if (c.tasks) renderTasksList(c.tasks);
        if (c.subjects) renderSubjectsList(c.subjects);
      } catch (e) {}
    }

    // 2. Fetch fresh data concurrently
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const [prof, fixed, tasks, subjects] = await withTimeout(Promise.all([
      getMyProfile(me.id),
      fetchTodayData(),
      fetchTasksData(),
      fetchSubjectsData()
    ]));

    if (prof) { profile = prof; setGreeting(); checkAcademicProfile(prof); }
    if (fixed) renderTodayList(fixed, new Date().getHours() * 60 + new Date().getMinutes());
    if (tasks) renderTasksList(tasks);
    if (subjects) renderSubjectsList(subjects);

    if (typeof initPrayerAndWird === "function") initPrayerAndWird();
    if (typeof initPushNotifications === "function") initPushNotifications(me.id);
    renderWeeklyChart();
    initEnergyCheckin();

    // اخفاء بادج "حمّل التطبيق" لو المستخدم أصلاً جوه التطبيق نفسه
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      document.getElementById("downloadAppBadge")?.remove();
    }

    // Save fresh snapshot to cache
    localStorage.setItem('athar_dash_cache', JSON.stringify({
      profile: prof,
      today: fixed,
      tasks: tasks,
      subjects: subjects
    }));

  } catch (err) {
    console.error("Dashboard init error:", err);
  }
})();

function setGreeting() {
  const hour = new Date().getHours();
  let g = "مساء الخير";
  if (hour < 12) g = "صباح الخير";
  else if (hour < 17) g = "أهلاً بك";

  const greetingEl = document.getElementById("greetingText");
  if (greetingEl) greetingEl.textContent = g;

  const userNameEl = document.getElementById("userName");
  if (userNameEl && profile && profile.full_name) {
    userNameEl.textContent = `يا ${profile.full_name.split(" ")[0]}`;
  }

  const now = new Date();
  const dateEl = document.getElementById("dateText");
  if (dateEl) {
    dateEl.textContent = `${DAY_NAMES[now.getDay()]} · ${now.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}`;
  }
}

// ---------- Today's Fixed Classes + "What To Do Now" ----------
async function loadToday() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { data: fixed, error } = await sb
    .from("fixed_schedule")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .eq("day_of_week", dayOfWeek)
    .order("start_time");

  allTodayFixed = fixed || [];
  const listEl = document.getElementById("todayList");
  const countEl = document.getElementById("statTodayCount");
  if (countEl) countEl.textContent = allTodayFixed.length;

  if (error || allTodayFixed.length === 0) {
    listEl.innerHTML = `
      <div class="border border-dashed border-outline-variant rounded-xl p-6 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-outline mb-1" style="font-size:28px">event_available</span>
        <p class="text-sm font-semibold">مفيش مواعيد أو حصص مسجلة لليوم 🌿</p>
        <p class="text-xs text-outline mt-1">تقدر تضيف حصصك الثابتة من صفحة الجدول</p>
      </div>`;
  } else {
    renderTodayList(allTodayFixed, nowMinutes);
  }

  computeNowAction(allTodayFixed, nowMinutes);
}

function renderTodayList(items, nowMinutes) {
  const listEl = document.getElementById("todayList");
  listEl.innerHTML = items.map(b => {
    const [sh, sm] = (b.start_time || "00:00").split(":").map(Number);
    const [eh, em] = (b.end_time || "00:00").split(":").map(Number);
    const startM = sh * 60 + sm, endM = eh * 60 + em;
    const isNow = nowMinutes >= startM && nowMinutes < endM;
    const isPassed = nowMinutes >= endM;

    let cardBg = "bg-white dark:bg-[#141d2e] border-outline-variant hover:border-primary/50";
    let badgeHtml = `<span class="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary-container text-on-primary-container shrink-0">قادم</span>`;
    
    if (isNow) {
      cardBg = "bg-primary-container/20 dark:bg-[#0f2c46] border-primary/50 shadow-sm";
      badgeHtml = `<span class="text-[10px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-primary text-white animate-pulse shrink-0">الآن 🔴</span>`;
    } else if (isPassed) {
      cardBg = "bg-white dark:bg-[#141d2e] border-outline-variant/80";
      badgeHtml = `<span class="text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-surface-container-high text-on-surface-variant flex items-center gap-1 shrink-0"><span class="material-symbols-outlined" style="font-size:13px">check</span>انتهت</span>`;
    }

    const subjectColor = b.subjects?.color || "#0077CC";
    const subjectName = b.subjects?.name || "بدون مادة";

    return `
      <div class="flex items-center justify-between gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl border ${cardBg} transition group shadow-xs">
        <div class="shrink-0 flex items-center">
          ${badgeHtml}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" style="background-color: ${subjectColor}"></span>
            <p class="font-bold text-xs sm:text-sm text-on-surface truncate">${escapeHtml(b.title)}</p>
          </div>
          <p class="text-[11px] sm:text-xs text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
            <span class="font-medium text-on-surface/80 truncate">${escapeHtml(subjectName)}</span>
            ${b.location ? `<span class="text-outline shrink-0">·</span><span class="material-symbols-outlined text-outline shrink-0" style="font-size:12px">pin_drop</span><span class="truncate">${escapeHtml(b.location)}</span>` : ""}
          </p>
        </div>
        <div class="text-left shrink-0">
          <span class="text-[10px] sm:text-xs font-mono font-bold text-on-surface dir-ltr bg-surface-container-low px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-outline-variant whitespace-nowrap">${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}</span>
        </div>
      </div>`;
  }).join("");
}

function computeNowAction(fixed, nowMinutes) {
  const actionEl = document.getElementById("nowAction");
  const metaEl = document.getElementById("nowMeta");
  if (!actionEl || !metaEl) return;

  const current = fixed.find(b => {
    const [sh, sm] = (b.start_time || "00:00").split(":").map(Number);
    const [eh, em] = (b.end_time || "00:00").split(":").map(Number);
    return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
  });

  if (current) {
    actionEl.textContent = `حصة جارية: ${current.title}`;
    metaEl.textContent = `مستمرة حتى الساعة ${current.end_time?.slice(0,5)} (${current.subjects?.name || ""})`;
    return;
  }

  const upcoming = fixed
    .map(b => {
      const [sh, sm] = (b.start_time || "00:00").split(":").map(Number);
      return { b, startM: sh * 60 + sm };
    })
    .filter(x => x.startM > nowMinutes)
    .sort((a, b) => a.startM - b.startM)[0];

  if (upcoming) {
    const freeMinutes = upcoming.startM - nowMinutes;
    const h = Math.floor(freeMinutes / 60), m = freeMinutes % 60;
    const freeText = h > 0 ? `${h} س و ${m} د` : `${m} دقيقة`;
    actionEl.textContent = `لديك ${freeText} متاحة للمذاكرة`;
    metaEl.textContent = `قبل موعد: ${upcoming.b.title} (${upcoming.b.start_time?.slice(0,5)})`;
  } else {
    actionEl.textContent = "وقتك متاح بالكامل — وقت ممتاز للمذاكرة";
    metaEl.textContent = "لا توجد مواعيد متبقية لليوم. ننصح بإنهاء مهامك العاجلة أو بدء جلسة بومودورو.";
  }
}

// ---------- Tasks Preview ----------
async function loadTasksPreview() {
  const listEl = document.getElementById("tasksPreview");
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await sb.from("tasks")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);

  allPendingTasks = data || [];
  const countEl = document.getElementById("statTasksCount");
  if (countEl) countEl.textContent = allPendingTasks.length;

  if (error || allPendingTasks.length === 0) {
    listEl.innerHTML = `
      <div class="border border-dashed border-outline-variant rounded-xl p-5 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-secondary mb-1" style="font-size:26px">task_alt</span>
        <p class="text-sm font-semibold text-secondary">أحسنت! لا توجد مهام معلقة 🎉</p>
      </div>`;
  } else {
    renderTasksList(allPendingTasks);
  }
}

function renderTasksList(tasks) {
  const listEl = document.getElementById("tasksPreview");
  if (!listEl) return;
  listEl.innerHTML = tasks.map(t => {
    const isDueToday = t.due_date && t.due_date <= new Date().toISOString().slice(0,10);
    return `
      <div class="task-row flex items-start gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl border border-outline-variant hover:bg-surface-container-low transition group" data-task-id="${t.id}">
        <input type="checkbox" onchange="toggleTaskDone('${t.id}', this)" class="mt-1 accent-primary w-4 h-4 rounded cursor-pointer shrink-0"/>
        <div class="flex-1 min-w-0 cursor-pointer" onclick="location.href='focus.html?task=${t.id}'">
          <p class="text-xs sm:text-sm font-bold text-on-surface truncate group-hover:text-primary transition">${escapeHtml(t.title)}</p>
          <div class="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs mt-0.5 truncate">
            <span class="text-on-surface-variant truncate">${escapeHtml(t.subjects?.name || "عام")}</span>
            <span class="text-outline shrink-0">·</span>
            <span class="font-mono text-outline shrink-0">${t.estimated_minutes || 25} د</span>
            ${isDueToday ? `<span class="text-error font-bold flex items-center gap-0.5 shrink-0"><span class="material-symbols-outlined" style="font-size:12px">alarm</span>اليوم</span>` : ""}
          </div>
        </div>
        <a href="focus.html?task=${t.id}" class="p-1 sm:p-1.5 rounded-lg hover:bg-primary-container text-primary opacity-80 sm:opacity-0 group-hover:opacity-100 transition shrink-0" title="بدء في وضع التركيز">
          <span class="material-symbols-outlined" style="font-size:18px">play_arrow</span>
        </a>
      </div>`;
  }).join("");
}


async function toggleTaskDone(taskId, checkbox) {
  // Find the parent task row element to animate it out
  const taskRow = checkbox.closest('[data-task-id]') || checkbox.closest('.flex.items-start.gap-3');
  try {
    checkbox.disabled = true;

    // Show confetti from checkbox position
    if (typeof triggerConfetti === 'function') {
      const rect = checkbox.getBoundingClientRect();
      triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    // Optimistic UI — animate out immediately, THEN update DB
    if (taskRow) {
      taskRow.classList.add('task-row');
      // Force reflow then add completing class for smooth exit
      taskRow.getBoundingClientRect();
      taskRow.classList.add('completing');
    }

    // Update count immediately
    allPendingTasks = allPendingTasks.filter(t => t.id !== taskId);
    const countEl = document.getElementById("statTasksCount");
    if (countEl) countEl.textContent = allPendingTasks.length;

    // DB update (fire and forget, won't block UI)
    sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId).then(({ error }) => {
      if (error) console.error("Task update error:", error);
    });

    showToast(await getMotivationalMessage());

    // Remove element from DOM after animation completes
    setTimeout(() => {
      if (taskRow) taskRow.remove();
      // If no tasks left, show empty state
      const listEl = document.getElementById("tasksPreview");
      if (listEl && listEl.children.length === 0) {
        listEl.innerHTML = `
          <div class="border border-dashed border-outline-variant rounded-xl p-5 text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-secondary mb-1" style="font-size:26px">task_alt</span>
            <p class="text-sm font-semibold text-secondary">أحسنت! لا توجد مهام معلقة 🎉</p>
          </div>`;
      }
    }, 330);

  } catch (err) {
    console.error("toggleTask error:", err);
    checkbox.disabled = false;
    checkbox.checked = false;
    if (taskRow) {
      taskRow.classList.remove('completing');
    }
    showToast("تعذر تحديث المهمة، يرجى المحاولة ثانية");
  }
}

// ---------- Slim Fetch Helpers (No DOM changes — returns raw data) ----------
async function fetchTodayData() {
  const dayOfWeek = new Date().getDay();
  const { data } = await sb
    .from("fixed_schedule")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .eq("day_of_week", dayOfWeek)
    .order("start_time");
  allTodayFixed = data || [];
  const countEl = document.getElementById("statTodayCount");
  if (countEl) countEl.textContent = allTodayFixed.length;
  computeNowAction(allTodayFixed, new Date().getHours() * 60 + new Date().getMinutes());
  return data;
}

async function fetchTasksData() {
  const { data } = await sb.from("tasks")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);
  allPendingTasks = data || [];
  const countEl = document.getElementById("statTasksCount");
  if (countEl) countEl.textContent = allPendingTasks.length;
  return data;
}

async function fetchSubjectsData() {
  const { data } = await sb
    .from("subjects")
    .select("*")
    .eq("user_id", me.id)
    .order("priority");
  allSubjects = data || [];
  return data;
}

// Keep old load wrappers for any legacy calls
async function loadToday() { const d = await fetchTodayData(); if (d) renderTodayList(d, new Date().getHours() * 60 + new Date().getMinutes()); }
async function loadTasksPreview() { const d = await fetchTasksData(); if (d && d.length) renderTasksList(d); }
async function loadSubjects() { const d = await fetchSubjectsData(); renderSubjectsList(d); }

// ---------- Subjects Render ----------

function renderSubjectsList(data) {
  const listEl = document.getElementById("subjectsList");
  if (!listEl) return;
  const subjects = data || [];

  if (subjects.length === 0) {
    listEl.innerHTML = `
      <div class="col-span-full border border-dashed border-outline-variant rounded-xl p-5 text-center text-on-surface-variant">
        <p class="text-sm font-semibold">لم تقم بإضافة مواد بعد</p>
        <a href="settings.html#subjects" class="text-xs text-primary font-bold mt-1 inline-block hover:underline">+ إضافة موادك الدراسية</a>
      </div>`;
    return;
  }

  let totalMastery = 0;
  subjects.forEach(s => totalMastery += (s.mastery_percentage || 50));
  const avg = Math.round(totalMastery / subjects.length);

  const badgeMap = {
    stable: ["مستقرة", "bg-secondary-container text-on-secondary-container"],
    attention: ["تحتاج انتباه", "bg-tertiary-container text-on-tertiary-container"],
    critical: ["حرجة", "bg-error-container text-on-error-container"]
  };

  listEl.innerHTML = subjects.map(s => {
    const [label, badgeCls] = badgeMap[s.risk_level] || badgeMap.stable;
    const mastery = Math.round(s.mastery_percentage || 50);
    return `
      <div class="card-3d bg-surface-container-low border border-outline-variant rounded-xl p-4 flex flex-col justify-between hover:border-primary/40 transition">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full shrink-0" style="background:${s.color || '#0077cc'}"></span>
            <h4 class="font-bold text-sm text-on-surface truncate">${escapeHtml(s.name)}</h4>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeCls} shrink-0">${label}</span>
        </div>
        <div class="mt-2">
          <div class="flex justify-between text-xs mb-1">
            <span class="text-on-surface-variant font-medium">مستوى الإتقان</span>
            <span class="font-mono font-bold text-primary">${mastery}%</span>
          </div>
          <div class="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
            <div class="h-full bg-primary rounded-full transition-all" style="width:${mastery}%"></div>
          </div>
        </div>
      </div>`;
  }).join("");
}

// Quick Search Filtering
function filterQuickItems(q) {
  const query = q.trim().toLowerCase();
  if (!query) {
    renderTodayList(allTodayFixed, new Date().getHours() * 60 + new Date().getMinutes());
    renderTasksList(allPendingTasks);
    return;
  }

  // Check if academic profile is missing
  checkAcademicProfile(prof);

  const filteredFixed = allTodayFixed.filter(b =>
    (b.title && b.title.toLowerCase().includes(query)) ||
    (b.subjects?.name && b.subjects.name.toLowerCase().includes(query))
  );
  renderTodayList(filteredFixed, new Date().getHours() * 60 + new Date().getMinutes());

  const filteredTasks = allPendingTasks.filter(t =>
    (t.title && t.title.toLowerCase().includes(query)) ||
    (t.subjects?.name && t.subjects.name.toLowerCase().includes(query))
  );
  renderTasksList(filteredTasks);
}

function checkAcademicProfile(p) {
  const banner = document.getElementById("profileMissingBanner");
  if (!banner) return;
  if (p && !p.stage) {
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
}

// ── مواعيد الصلاة والورد القرآني ─────────────────────────────────────
async function initPrayerAndWird() {
  const card = document.getElementById("prayerWirdCard");
  if (!card || !profile) return;

  const promptEl = document.getElementById("prayerLocationPrompt");
  const contentEl = document.getElementById("prayerTimesContent");

  if (profile.latitude == null || profile.longitude == null) {
    promptEl.classList.remove("hidden");
    contentEl.classList.add("hidden");
  } else {
    promptEl.classList.add("hidden");
    contentEl.classList.remove("hidden");
    renderPrayerTimes();
  }

  // الورد القرآني (بيظهر بغض النظر عن حالة الموقع الجغرافي)
  try {
    const status = await getQuranWirdStatus(sb, me.id);
    const checkbox = document.getElementById("quranWirdCheckbox");
    const streakEl = document.getElementById("quranWirdStreak");
    if (checkbox) { checkbox.checked = status.doneToday; checkbox.disabled = status.doneToday; }
    if (streakEl && status.streak > 0) streakEl.textContent = `🔥 ${status.streak} يوم متتالي`;
  } catch (e) { /* صامت — مش ميزة أساسية */ }
}

function renderPrayerTimes() {
  const times = computePrayerTimes(profile.latitude, profile.longitude);
  if (!times) return;

  const rowEl = document.getElementById("prayerTimesRow");
  const badgeEl = document.getElementById("nextPrayerBadge");
  const next = getNextPrayer(times);

  const order = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  rowEl.innerHTML = order.map(key => {
    const isNext = next && next.key === key;
    return `
      <div class="flex flex-col items-center py-1.5 sm:py-2 px-0.5 sm:px-1 rounded-xl ${isNext ? "bg-primary text-white" : "bg-surface-container-low text-on-surface"}">
        <span class="text-[9px] sm:text-[10px] font-bold ${isNext ? "text-white/80" : "text-on-surface-variant"} truncate">${PRAYER_LABELS_AR[key]}</span>
        <span class="text-[11px] sm:text-xs font-extrabold font-mono mt-0.5 whitespace-nowrap">${formatArabicTime(times[key])}</span>
      </div>`;
  }).join("");

  badgeEl.textContent = next ? `${next.label} خلال ${next.minutesLeft} د` : "صلوات النهاردة خلصت 🌙";
}

async function enablePrayerLocation() {
  try {
    showToast("بنحدد موقعك...");
    const { latitude, longitude } = await detectAndSaveLocation(sb, me.id);
    profile.latitude = latitude;
    profile.longitude = longitude;
    document.getElementById("prayerLocationPrompt").classList.add("hidden");
    document.getElementById("prayerTimesContent").classList.remove("hidden");
    renderPrayerTimes();
    showToast("تمام! مواعيد الصلاة بقت ظاهرة ✓");
  } catch (err) {
    showToast("مقدرناش نحدد موقعك، جرب تسمح بالوصول للموقع من المتصفح");
  }
}

async function onQuranWirdToggle(checkbox) {
  if (!checkbox.checked) return;
  checkbox.disabled = true;
  const { error } = await markQuranWirdDoneToday(sb, me.id);
  if (error) { showToast("حصل خطأ، حاول تاني"); checkbox.disabled = false; return; }
  showToast(await getMotivationalMessage());
  const status = await getQuranWirdStatus(sb, me.id);
  const streakEl = document.getElementById("quranWirdStreak");
  if (streakEl && status.streak > 0) streakEl.textContent = `🔥 ${status.streak} يوم متتالي`;
}

// ── رسم بياني حقيقي لنسبة إنجاز المهام آخر 7 أيام (بيانات فعلية) ─────
async function renderWeeklyChart() {
  const geomEl = document.getElementById("weeklyChartGeometry");
  const labelsEl = document.getElementById("weeklyChartDayLabels");
  const percentEl = document.getElementById("weeklyCompletionPercent");
  if (!geomEl) return;

  const dayShort = ["أحد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(today); start.setDate(today.getDate() - 6);
  const startStr = start.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const { data } = await sb.from("tasks").select("due_date, status").eq("user_id", me.id).gte("due_date", startStr).lte("due_date", todayStr);
  const rows = data || [];

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTasks = rows.filter(r => r.due_date === key);
    const completed = dayTasks.filter(r => r.status === "completed").length;
    const rate = dayTasks.length ? Math.round((completed / dayTasks.length) * 100) : null;
    days.push({ key, label: i === 0 ? "اليوم" : dayShort[d.getDay()], rate, hasData: dayTasks.length > 0 });
  }

  const validRates = days.filter(d => d.hasData).map(d => d.rate);
  const overallAvg = validRates.length ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length) : 0;
  if (percentEl) percentEl.textContent = validRates.length ? `${overallAvg}%` : "لا بيانات";

  const trendEl = document.getElementById("weeklyTrendBadge");
  if (trendEl) {
    const firstHalf = validRates.slice(0, Math.ceil(validRates.length / 2));
    const secondHalf = validRates.slice(Math.ceil(validRates.length / 2));
    if (firstHalf.length && secondHalf.length) {
      const a = firstHalf.reduce((x, y) => x + y, 0) / firstHalf.length;
      const b = secondHalf.reduce((x, y) => x + y, 0) / secondHalf.length;
      const diff = Math.round(b - a);
      trendEl.innerHTML = diff >= 0
        ? `<span class="material-symbols-outlined" style="font-size:14px">trending_up</span>+${diff}%`
        : `<span class="material-symbols-outlined" style="font-size:14px">trending_down</span>${diff}%`;
      trendEl.className = `text-xs font-bold flex items-center gap-0.5 ${diff >= 0 ? "text-secondary" : "text-error"}`;
    } else {
      trendEl.textContent = "";
    }
  }

  // بناء نقاط الرسم (280×85، مسافة 46.6 بين كل نقطة، الصفر أسفل = 100%، 80 = 0%)
  const W = 280, stepX = W / 6;
  const points = days.map((d, i) => {
    const y = d.hasData ? 80 - (d.rate / 100) * 66 : 60; // لو مفيش بيانات، خط منخفض شفاف
    return { x: Math.round(i * stepX * 10) / 10, y: Math.round(y * 10) / 10, ...d };
  });

  const polylinePts = points.map(p => `${p.x},${p.y}`).join(" ");
  const areaPath = `M${polylinePts.split(" ").join(" L")} L${W},80 L0,80 Z`;

  const dotsHtml = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="${p.label === "اليوم" ? 4.5 : 2.5}" fill="#0077CC" opacity="${p.hasData ? 1 : 0.3}">
      <title>${p.label} · ${p.hasData ? p.rate + "%" : "لا مهام"}</title>
    </circle>`).join("");

  geomEl.innerHTML = `
    <path d="${areaPath}" fill="url(#chartGrad)"/>
    <polyline points="${polylinePts}" fill="none" stroke="#0077CC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dotsHtml}`;

  if (labelsEl) {
    labelsEl.innerHTML = days.map(d => `<span class="${d.label === "اليوم" ? "text-primary font-bold" : ""}">${d.label}</span>`).join("");
  }
}

// ── تقييم الطاقة اليومي ────────────────────────────────────────────
async function initEnergyCheckin() {
  const card = document.getElementById("energyCheckinCard");
  if (!card) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("daily_energy_log").select("energy_level").eq("user_id", me.id).eq("log_date", todayStr).maybeSingle();

  if (data) {
    card.classList.add("hidden");
    if (data.energy_level === "low") await maybeOfferLoadReduction();
  } else {
    card.classList.remove("hidden");
  }
}

async function logEnergyLevel(level) {
  const todayStr = new Date().toISOString().slice(0, 10);
  await sb.from("daily_energy_log").upsert({ user_id: me.id, log_date: todayStr, energy_level: level }, { onConflict: "user_id,log_date" });
  document.getElementById("energyCheckinCard")?.classList.add("hidden");
  showToast(level === "low" ? "خد بالك من نفسك، هنخفف عليك النهاردة 🌿" : "تمام، بالتوفيق في يومك 🔥");
  if (level === "low") await maybeOfferLoadReduction();
}

async function maybeOfferLoadReduction() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: todayTasks } = await sb.from("tasks").select("id").eq("user_id", me.id).neq("status", "completed").eq("due_date", todayStr);
  if (todayTasks && todayTasks.length > 2) {
    showToast("حاسس إنك تعبان؟ تقدر تدوس \"مش قادر أذاكر النهاردة\" في صفحة الجدول عشان نخفف عليك 🌿");
  }
}
