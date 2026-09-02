// ============================================
// أَثَر — Dashboard Logic (Tailwind & Supabase)
// ============================================
const DAY_NAMES = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

let me = null;
let profile = null;
let allTodayFixed = [];
let allTodayTasks = [];
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
        if (c.today) {
          allTodayFixed = c.today.fixed || (Array.isArray(c.today) ? c.today : []);
          allTodayTasks = c.today.tasks || [];
          renderTodayList(allTodayFixed, new Date().getHours() * 60 + new Date().getMinutes());
        }
        if (c.tasks) renderTasksList(c.tasks);
        if (c.subjects) renderSubjectsList(c.subjects);
      } catch (e) {}
    }

    // 2. Fetch fresh data concurrently
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const [prof, todayData, tasks, subjects] = await withTimeout(Promise.all([
      getMyProfile(me.id),
      fetchTodayData(),
      fetchTasksData(),
      fetchSubjectsData()
    ]));

    if (prof) { profile = prof; setGreeting(); checkAcademicProfile(prof); }
    if (todayData) {
      allTodayFixed = todayData.fixed || [];
      allTodayTasks = todayData.tasks || [];
      renderTodayList(allTodayFixed, new Date().getHours() * 60 + new Date().getMinutes());
    }
    if (tasks) renderTasksList(tasks);
    if (subjects) renderSubjectsList(subjects);

    loadWeekRestCards();

    if (typeof initPrayerAndWird === "function") initPrayerAndWird();
    if (typeof initPushNotifications === "function") initPushNotifications(me.id);
    renderWeeklyChart();
    updateMomentumStreak();
    initEnergyCheckin();
    refreshDailyQuote();

    // Check for Weekly Review query param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "weekly-review" || urlParams.get("review") === "1" || window.location.hash === "#weekly-review") {
      setTimeout(() => {
        if (typeof openWeeklyReviewModal === "function") openWeeklyReviewModal();
      }, 300);
    }

    // اخفاء بادج "حمّل التطبيق" لو المستخدم أصلاً جوه التطبيق نفسه
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      document.getElementById("downloadAppBadge")?.remove();
    }

    // Save fresh snapshot to cache
    localStorage.setItem('athar_dash_cache', JSON.stringify({
      profile: prof,
      today: { fixed: allTodayFixed, tasks: allTodayTasks },
      tasks: tasks,
      subjects: subjects
    }));

  } catch (err) {
    console.error("Dashboard init error:", err);
  }
})();

async function refreshDailyQuote() {
  const el = document.getElementById("dailyMotivationText");
  if (!el) return;
  if (typeof getMotivationalMessage === "function") {
    el.style.opacity = "0";
    setTimeout(async () => {
      el.textContent = await getMotivationalMessage();
      el.style.transition = "opacity 0.3s ease";
      el.style.opacity = "1";
    }, 150);
  }
}

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

// ---------- Today's Fixed Classes + Tasks + "What To Do Now" ----------
async function loadToday() {
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const d = await fetchTodayData();
  if (d) {
    renderDashboardNotionTable();
    renderTodayList(d.fixed, nowMinutes);
  }
}

function renderTodayList(items, nowMinutes) {
  const listEl = document.getElementById("todayList");
  if (!listEl) return;

  const fixed = Array.isArray(items) ? items : (allTodayFixed || []);
  const tasks = allTodayTasks || [];

  // استخدام محرك الجدول بالساعة (Timeline Engine) لو متاح
  if (typeof buildDailyTimeline === "function") {
    let prayerTimes = null;
    if (profile?.latitude != null && profile?.longitude != null && typeof computePrayerTimes === "function") {
      prayerTimes = computePrayerTimes(profile.latitude, profile.longitude);
    }

    const timeline = buildDailyTimeline({
      wakeTime: profile?.wake_time || "07:00:00",
      sleepTime: profile?.sleep_time || "23:30:00",
      fixedBlocks: fixed || [],
      prayerTimes,
      tasks: tasks || [],
      sessionMinutes: profile?.preferred_session_minutes || 45,
      restMinutes: 15
    });

    // فلترة الأوقات الحرة الكبيرة الفاضية فقط لو حابين تركيز عالي، أو عرض كل شيء
    const displayBlocks = timeline.filter(b => b.type !== "free" || (b.end - b.start >= 30));

    if (displayBlocks.length === 0) {
      listEl.innerHTML = `
        <div class="border border-dashed border-outline-variant rounded-2xl p-6 text-center text-on-surface-variant">
          <span class="material-symbols-outlined text-outline mb-1.5" style="font-size:32px">event_available</span>
          <p class="text-sm font-bold text-on-surface">يومك هادي ومفيش مواعيد مسجلة 🌿</p>
          <p class="text-xs text-outline mt-1">تقدر تسجل حصصك من صفحة الجدول أو تضيف مهام جديدة</p>
          <a href="schedule.html" class="inline-flex items-center gap-1 mt-3 px-4 py-1.5 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary-dark transition shadow-xs">
            <span>تعديل الجدول</span>
            <span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>
          </a>
        </div>`;
      return;
    }

    const typeConfig = {
      class:     { badge: "حصة دراسية", badgeBg: "bg-error-container text-on-error-container", dot: "bg-error", border: "hover:border-error/50", icon: "school" },
      protected: { badge: "🛡️ راحة محمية", badgeBg: "bg-secondary-container text-on-secondary-container", dot: "bg-secondary", border: "hover:border-secondary/50", icon: "spa" },
      prayer:    { badge: "🕌 صلاة", badgeBg: "bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300", dot: "bg-sky-500", border: "hover:border-sky-400/50", icon: "mosque" },
      study:     { badge: "📚 مذاكرة مستحقة", badgeBg: "bg-primary-container text-on-primary-container", dot: "bg-primary", border: "hover:border-primary/50", icon: "menu_book" },
      rest:      { badge: "☕ استراحة", badgeBg: "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300", dot: "bg-amber-500", border: "hover:border-amber-400/50", icon: "coffee" },
      free:      { badge: "وقت حر", badgeBg: "bg-surface-container-high text-on-surface-variant", dot: "bg-outline", border: "hover:border-outline", icon: "hourglass_empty" },
    };

    listEl.innerHTML = displayBlocks.map(b => {
      const cfg = typeConfig[b.type] || typeConfig.free;
      const isNow = nowMinutes >= b.start && nowMinutes < b.end;
      const isPassed = nowMinutes >= b.end;

      let cardBg = "bg-white dark:bg-[#141d2e] border-outline-variant";
      let statusPill = "";

      if (isNow) {
        cardBg = "bg-primary-container/20 dark:bg-[#0f2c46]/80 border-primary shadow-sm";
        statusPill = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white animate-pulse flex items-center gap-1 shrink-0"><span class="w-1.5 h-1.5 rounded-full bg-white"></span>الآن</span>`;
      } else if (isPassed) {
        cardBg = "bg-surface-container-lowest dark:bg-[#111827] border-outline-variant/60 opacity-65";
        statusPill = `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant flex items-center gap-0.5 shrink-0"><span class="material-symbols-outlined" style="font-size:12px">check</span>انتهت</span>`;
      }

      const durationMin = Math.round(b.end - b.start);
      const isStudyTask = b.type === "study";

      return `
        <div class="flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl border ${cardBg} ${cfg.border} transition group shadow-xs">
          <!-- Right Time + Status Badge -->
          <div class="flex items-center gap-2.5 shrink-0">
            <div class="flex flex-col items-center">
              <span class="text-[11px] sm:text-xs font-mono font-bold text-on-surface dir-ltr bg-surface-container-low px-2 py-1 rounded-lg border border-outline-variant/60 whitespace-nowrap">${b.startLabel}</span>
            </div>
            ${statusPill}
          </div>

          <!-- Middle Details -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}"></span>
              <p class="font-bold text-xs sm:text-sm text-on-surface truncate ${isNow ? 'text-primary font-extrabold' : ''}">${escapeHtml(b.label)}</p>
            </div>
            <div class="flex items-center gap-2 text-[11px] text-on-surface-variant mt-0.5">
              <span class="font-bold px-2 py-0.5 rounded-md ${cfg.badgeBg} text-[10px]">${cfg.badge}</span>
              <span class="text-outline">·</span>
              <span class="font-mono text-outline">${durationMin} دقيقة</span>
            </div>
          </div>

          <!-- Left Action / Focus link -->
          <div class="shrink-0 flex items-center gap-1.5">
            ${isStudyTask ? `
              <a href="${b.taskId ? `focus.html?task=${b.taskId}` : `focus.html`}" class="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold transition flex items-center gap-1 shadow-xs" title="بدء جلسة تركيز لهذه المهمة">
                <span class="material-symbols-outlined" style="font-size:15px">play_arrow</span>
                <span class="hidden sm:inline">ذاكر</span>
              </a>
            ` : ""}
          </div>
        </div>`;
    }).join("");
    return;
  }
}

// ── Notion Table View في لوحة التحكم (الوضع الافتراضي) ──────────
let dashboardScheduleViewMode = "table"; // "table" (default) | "timeline"

function switchDashboardScheduleView(mode) {
  dashboardScheduleViewMode = mode;
  const tableView   = document.getElementById("dashboardNotionTableView");
  const timelineView = document.getElementById("dashboardTimelineView");
  const tableBtn    = document.getElementById("dashViewTableBtn");
  const timelineBtn = document.getElementById("dashViewTimelineBtn");

  if (mode === "timeline") {
    tableView?.classList.add("hidden");
    timelineView?.classList.remove("hidden");
    if (tableBtn) tableBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    if (timelineBtn) timelineBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    renderTodayList(allTodayFixed, nowMinutes);
  } else {
    tableView?.classList.remove("hidden");
    timelineView?.classList.add("hidden");
    if (tableBtn) tableBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
    if (timelineBtn) timelineBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    renderDashboardNotionTable();
  }
}

const DASH_NOTION_TYPE_CFG = {
  prayer:    { label: "🕌 عبادة",   bg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300", dot: "bg-emerald-500" },
  study:     { label: "📚 مذاكرة", bg: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300",   dot: "bg-blue-500" },
  class:     { label: "🏫 حصة",     bg: "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300",   dot: "bg-red-500" },
  protected: { label: "🛡️ راحة",  bg: "bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300", dot: "bg-purple-500" },
  rest:      { label: "☕ استراحة", bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
  watch:     { label: "▶️ شرح",     bg: "bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300", dot: "bg-sky-500" },
  practice:  { label: "✏️ تمارين",  bg: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300", dot: "bg-indigo-500" },
  review:    { label: "🔁 مراجعة", bg: "bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300", dot: "bg-teal-500" },
  quiz:      { label: "📝 اختبار", bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300", dot: "bg-rose-500" },
  other:     { label: "📌 أخرى",   bg: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300", dot: "bg-gray-400" },
};

function format12h(timeStr) {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function renderDashboardNotionTable() {
  const tbody = document.getElementById("dashboardNotionTableBody");
  if (!tbody) return;

  const fixed = allTodayFixed || [];
  const tasks = allTodayTasks || [];

  const rows = [];

  // ① الحصص الثابتة لليوم
  for (const b of fixed) {
    rows.push({
      id:       b.id,
      title:    b.title,
      type:     b.block_kind === "protected" ? "protected" : "class",
      subject:  b.subjects?.name || "—",
      time:     b.start_time ? `${format12h(b.start_time)} ← ${format12h(b.end_time)}` : "—",
      taskId:   null,
    });
  }

  // ② مهام اليوم
  for (const t of tasks) {
    rows.push({
      id:       t.id,
      title:    t.title,
      type:     t.task_type || "study",
      subject:  t.subjects?.name || "عام",
      time:     t.estimated_minutes ? `${t.estimated_minutes} دقيقة` : "—",
      taskId:   t.id,
    });
  }

  if (rows.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="6" class="text-center py-8 text-on-surface-variant">
        <span class="material-symbols-outlined text-outline" style="font-size:32px">event_available</span>
        <p class="text-xs font-bold mt-1.5 text-on-surface">يومك هادي ومفيش مهام أو حصص مسجلة 🌿</p>
        <a href="schedule.html" class="inline-flex items-center gap-1 mt-2.5 px-3 py-1 rounded-full bg-primary text-white text-[11px] font-bold hover:bg-primary-dark transition shadow-xs">
          <span>+ إضافة لجدولك</span>
          <span class="material-symbols-outlined" style="font-size:14px">arrow_back</span>
        </a>
      </td>
    </tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const cfg = DASH_NOTION_TYPE_CFG[row.type] || DASH_NOTION_TYPE_CFG.other;
    const badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0"></span>${cfg.label}</span>`;

    const checkbox = row.taskId
      ? `<input type="checkbox" onchange="toggleTask('${row.taskId}')" class="w-3.5 h-3.5 accent-primary cursor-pointer rounded" title="أنهِ المهمة"/>`
      : `<span class="material-symbols-outlined text-outline" style="font-size:15px">radio_button_unchecked</span>`;

    const actionBtn = row.taskId
      ? `<a href="focus.html?task=${row.taskId}" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold hover:bg-primary-dark transition shrink-0">
           <span class="material-symbols-outlined" style="font-size:12px">play_arrow</span> ابدأ
         </a>`
      : `<span class="text-outline text-[10px]">—</span>`;

    const subjectColor = row.subject !== "—" && row.subject !== "عام"
      ? `<span class="font-semibold text-[11px] text-primary truncate max-w-[90px] inline-block">${escapeHtml(row.subject)}</span>`
      : `<span class="text-outline text-[11px]">${escapeHtml(row.subject)}</span>`;

    const rowHover = row.taskId ? "hover:bg-primary-container/10 dark:hover:bg-[#0f2c46]/30" : "hover:bg-surface-container-lowest/60";

    return `<tr class="group transition-colors ${rowHover}" data-task-id="${row.id}">
      <td class="p-2.5 text-center">${checkbox}</td>
      <td class="p-2.5">
        <span class="font-semibold text-[11px] sm:text-[12px] text-on-surface dark:text-[#eef2f9] group-hover:text-primary transition leading-snug">${escapeHtml(row.title)}</span>
      </td>
      <td class="p-2.5">${badge}</td>
      <td class="p-2.5">${subjectColor}</td>
      <td class="p-2.5 text-on-surface-variant text-[11px] font-mono dir-ltr">${row.time}</td>
      <td class="p-2.5 text-center">${actionBtn}</td>
    </tr>`;
  }).join("");
}

// ── كروت باقي الأسبوع (Rest of Week Cards) ───────────────────────────
let currentWeekOrderMode = localStorage.getItem('athar_week_order_mode') || 'upcoming';

function setWeekCardsOrder(mode) {
  currentWeekOrderMode = mode;
  localStorage.setItem('athar_week_order_mode', mode);

  const upBtn = document.getElementById("weekOrderUpcomingBtn");
  const calBtn = document.getElementById("weekOrderCalendarBtn");

  if (upBtn && calBtn) {
    if (mode === 'upcoming') {
      upBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
      calBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    } else {
      calBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
      upBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    }
  }

  loadWeekRestCards();
}

async function loadWeekRestCards() {
  const container = document.getElementById("weekRestCards");
  if (!container) return;

  // Sync toggle button active states on load
  const upBtn = document.getElementById("weekOrderUpcomingBtn");
  const calBtn = document.getElementById("weekOrderCalendarBtn");
  if (upBtn && calBtn) {
    if (currentWeekOrderMode === 'upcoming') {
      upBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
      calBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    } else {
      calBtn.className = "px-2.5 py-1 rounded-full bg-primary text-white shadow-xs transition";
      upBtn.className = "px-2.5 py-1 rounded-full text-on-surface-variant hover:text-on-surface transition";
    }
  }

  try {
    const todayIndex = new Date().getDay();
    const { data: allFixed, error } = await sb
      .from("fixed_schedule")
      .select("id, title, day_of_week, start_time, end_time, block_kind, subjects(name, color)")
      .eq("user_id", me.id);

    if (error) throw error;

    const fixedByDay = {};
    for (let i = 0; i < 7; i++) fixedByDay[i] = [];
    (allFixed || []).forEach(b => {
      if (fixedByDay[b.day_of_week] !== undefined) {
        fixedByDay[b.day_of_week].push(b);
      }
    });

    // بناء قائمة الأيام وفقاً لخيار الترتيب المحدد
    const otherDays = [];

    if (currentWeekOrderMode === 'calendar') {
      // ترتيب الأسبوع الدراسي الكلاسيكي: من السبت (6) حتى الجمعة (5)، مستثنياً اليوم الحالي
      const calendarOrder = [6, 0, 1, 2, 3, 4, 5]; // السبت، الأحد، الاتنين، التلات، الأربع، الخميس، الجمعة
      calendarOrder.forEach(dayIdx => {
        if (dayIdx !== todayIndex) {
          otherDays.push({
            index: dayIdx,
            name: DAY_NAMES[dayIdx],
            blocks: fixedByDay[dayIdx] || []
          });
        }
      });
    } else {
      // الترتيب الزمني للأيام القادمة: غداً ثم الذي يليه حتى اكتمال الأسبوع
      for (let offset = 1; offset <= 6; offset++) {
        const dayIdx = (todayIndex + offset) % 7;
        otherDays.push({
          index: dayIdx,
          name: offset === 1 ? `غداً (${DAY_NAMES[dayIdx]})` : DAY_NAMES[dayIdx],
          offset,
          blocks: fixedByDay[dayIdx] || []
        });
      }
    }

    container.innerHTML = otherDays.map(d => {
      const count = d.blocks.length;
      const hasClasses = count > 0;

      // ألوان مخصصة واضحة وتباين عالي في الدارك موود واللايت موود
      let cardClasses = "";
      let countBadge = "";

      if (hasClasses) {
        cardClasses = "bg-white dark:bg-[#141d2e] border-outline-variant dark:border-[#2c3a52] hover:border-primary/80 shadow-xs";
        countBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container dark:bg-[#0f2c46] dark:text-[#bfe0ff] shrink-0">${count} مواعيد</span>`;
      } else {
        // كارت راحة واضح ونظيف بدون خلفية رمادية شاذة في الدارك موود
        cardClasses = "bg-surface-container-lowest dark:bg-[#141d2e]/60 border-outline-variant/70 dark:border-[#2c3a52]/80 hover:border-secondary/60";
        countBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-container/60 dark:bg-[#0a3322] text-on-secondary-container dark:text-[#8fe9c4] shrink-0">راحة 🌿</span>`;
      }

      const previews = d.blocks.slice(0, 2).map(b => `
        <div class="flex items-center gap-1.5 text-[11px] text-on-surface-variant dark:text-gray-300 truncate">
          <span class="w-2 h-2 rounded-full shrink-0 ${b.block_kind === 'protected' ? 'bg-secondary' : 'bg-primary'}"></span>
          <span class="truncate font-medium">${escapeHtml(b.title)}</span>
        </div>
      `).join("");

      return `
        <a href="schedule.html?day=${d.index}" class="flex flex-col justify-between p-3.5 rounded-2xl border ${cardClasses} transition hover:scale-[1.02] active:scale-[0.98] group cursor-pointer">
          <div>
            <div class="flex items-center justify-between gap-1.5 mb-2.5">
              <span class="font-extrabold text-xs sm:text-sm text-on-surface dark:text-[#eef2f9] group-hover:text-primary transition truncate">${d.name}</span>
              ${countBadge}
            </div>
            <div class="space-y-1.5 my-1 min-h-[36px]">
              ${hasClasses ? previews : `
                <div class="flex items-center gap-1.5 text-xs text-secondary dark:text-emerald-400 font-semibold py-1">
                  <span>مفيش حصص مسجلة</span>
                </div>
              `}
              ${count > 2 ? `<p class="text-[10px] text-primary dark:text-sky-400 font-bold">+${count - 2} إضافي</p>` : ""}
            </div>
          </div>
          <div class="pt-2.5 mt-1 border-t border-outline-variant/40 dark:border-[#2c3a52] flex items-center justify-between text-[11px] text-outline dark:text-gray-400 group-hover:text-primary dark:group-hover:text-sky-400 transition">
            <span class="font-bold">عرض اليوم</span>
            <span class="material-symbols-outlined" style="font-size:15px">arrow_back</span>
          </div>
        </a>`;
    }).join("");

  } catch (err) {
    console.error("loadWeekRestCards error:", err);
    container.innerHTML = `<div class="text-xs text-on-surface-variant col-span-full text-center py-2">تعذر جلب باقي الأسبوع</div>`;
  }
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
  const todayStr = new Date().toISOString().slice(0, 10);
  
  // ترحيل المهام: جلب مهام اليوم + المهام المتأخرة غير المكتملة لترحيلها تلقائياً لليوم
  const [{ data: fixedData }, { data: taskData }] = await Promise.all([
    sb.from("fixed_schedule")
      .select("*, subjects(name, color)")
      .eq("user_id", me.id)
      .eq("day_of_week", dayOfWeek)
      .order("start_time"),
    sb.from("tasks")
      .select("id, title, estimated_minutes, due_date, subjects(name, color)")
      .eq("user_id", me.id)
      .neq("status", "completed")
      .or(`due_date.eq.${todayStr},due_date.lt.${todayStr}`)
      .order("due_date")
  ]);

  // تحديث المهام المتأخرة لتاريخ اليوم في الخلفية (Auto-rollover)
  const overdueIds = (taskData || []).filter(t => t.due_date && t.due_date < todayStr).map(t => t.id);
  if (overdueIds.length > 0) {
    sb.from("tasks").update({ due_date: todayStr }).in("id", overdueIds).then(({ error }) => {
      if (error) console.error("Auto rollover error:", error);
    });
  }

  allTodayFixed = fixedData || [];
  allTodayTasks = taskData || [];
  const countEl = document.getElementById("statTodayCount");
  if (countEl) countEl.textContent = allTodayFixed.length + allTodayTasks.length;
  computeNowAction(allTodayFixed, new Date().getHours() * 60 + new Date().getMinutes());
  return { fixed: fixedData, tasks: taskData };
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
  checkAcademicProfile(profile);

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

// ══════════════════════════════════════════════════════════════
// 1. حساب الستريك والزخم اليومي (Daily Momentum & Streak)
// ══════════════════════════════════════════════════════════════
async function updateMomentumStreak() {
  const streakEl = document.getElementById("streakDaysCount");
  if (!streakEl) return;

  try {
    const { data: completedTasks } = await sb.from("tasks")
      .select("completed_at")
      .eq("user_id", me.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false });

    if (!completedTasks || completedTasks.length === 0) {
      streakEl.innerHTML = `0 <span class="text-xs font-bold text-on-surface-variant">أيام</span>`;
      return;
    }

    // حساب الأيام الفريدة المتتالية
    const completedDates = new Set(completedTasks.map(t => t.completed_at.slice(0, 10)));
    let streak = 0;
    const checkDate = new Date();

    // التحقق من اليوم أو الأمس للبدء
    const todayStr = checkDate.toISOString().slice(0, 10);
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = checkDate.toISOString().slice(0, 10);

    let currDate = new Date();
    if (!completedDates.has(todayStr) && !completedDates.has(yesterdayStr)) {
      streak = 0;
    } else {
      if (!completedDates.has(todayStr)) {
        currDate.setDate(currDate.getDate() - 1);
      }
      while (completedDates.has(currDate.toISOString().slice(0, 10))) {
        streak++;
        currDate.setDate(currDate.getDate() - 1);
      }
    }

    streakEl.innerHTML = `${streak} <span class="text-xs font-bold text-on-surface-variant">أيام</span>`;
  } catch (err) {
    console.error("Streak calc error:", err);
  }
}

// ══════════════════════════════════════════════════════════════
// 2. إعادة التوازن الذكي (Smart Reschedule)
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

    const totalMinutes = pendingTasks.reduce((sum, t) => sum + (t.estimated_minutes || 30), 0);
    const nowHour = new Date().getHours();
    const remainingHours = Math.max(1, 23 - nowHour);

    if (totalMinutes > remainingHours * 45 && pendingTasks.length > 1) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const taskToShift = pendingTasks[pendingTasks.length - 1];
      await sb.from("tasks").update({ due_date: tomorrowStr }).eq("id", taskToShift.id);

      showToast(`تمت إعادة التوازن! تم تركيز مهام اليوم وترحيل "${taskToShift.title}" للغد 🎯`);
    } else {
      showToast(`تمت موازنة المهام! متبقي لديك حوالي ${Math.round(totalMinutes / 60 * 10) / 10} ساعة مذاكرة موزعة على فترات راحة ☕`);
    }

    await loadToday();
  } catch (err) {
    console.error("smartReschedule error:", err);
    showToast("تعذر إعادة التوازن، يرجى المحاولة ثانية");
  }
}

// ══════════════════════════════════════════════════════════════
// 3. تصدير ومشاركة اليوم (Export Day as Printable View)
// ══════════════════════════════════════════════════════════════
function exportTodaySchedule() {
  try {
    const today = new Date();
    const dayName = typeof DAY_NAMES !== "undefined" ? DAY_NAMES[today.getDay()] : "اليوم";
    const dateStr = today.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("يرجى السماح بالنوافذ المنبثقة لتصدير الجدول");
      return;
    }

    const tableEl = document.getElementById("dashboardNotionTableBody");
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
              <th>الوقت</th>
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
