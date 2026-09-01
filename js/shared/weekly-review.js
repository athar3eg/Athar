// ============================================
// أَثَر — Interactive Weekly Review (مراجعة الأسبوع التفاعلية)
// ملخص أداء الـ 7 أيام الماضية، كشف المواد، وتوزيع المتأخرات بذكاء
// ============================================

(function () {
  let reviewData = null;
  let currentStep = 1;
  const TOTAL_STEPS = 4;

  /**
   * حساب وجلب كافة بيانات الأسبوع المنقضي
   */
  async function fetchWeeklyReviewData(sbClient, userId) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const startStr = startOfWeek.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    // 1. جلب مهام الأسبوع (المكتملة والمتأخرة)
    const { data: tasks } = await sbClient
      .from("tasks")
      .select("*, subjects(id, name, color, priority)")
      .eq("user_id", userId)
      .gte("due_date", startStr)
      .lte("due_date", todayStr);

    const allTasks = tasks || [];
    const completedTasks = allTasks.filter(t => t.status === "completed");
    const lateTasks = allTasks.filter(t => t.status !== "completed");

    // إجمالي دقائق المذاكرة المنجزة
    const totalMinutesStudied = completedTasks.reduce((acc, t) => acc + (t.estimated_minutes || 30), 0);
    const hoursStudied = (totalMinutesStudied / 60).toFixed(1);

    // 2. جلب سجل الورد القرآني لآخر 7 أيام
    const { data: wirdLogs } = await sbClient
      .from("quran_wird_log")
      .select("log_date, done")
      .eq("user_id", userId)
      .gte("log_date", startStr)
      .lte("log_date", todayStr);

    const quranDaysCount = (wirdLogs || []).filter(w => w.done).length;

    // 3. جلب سجل الطاقة
    const { data: energyLogs } = await sbClient
      .from("daily_energy_log")
      .select("log_date, energy_level")
      .eq("user_id", userId)
      .gte("log_date", startStr)
      .lte("log_date", todayStr);

    const energyCounts = { high: 0, medium: 0, low: 0 };
    (energyLogs || []).forEach(e => {
      if (energyCounts[e.energy_level] !== undefined) energyCounts[e.energy_level]++;
    });

    // 4. جلب المواد وتحليل توازنها (كشف المادة المظلومة)
    const { data: subjects } = await sbClient
      .from("subjects")
      .select("*")
      .eq("user_id", userId);

    const subjectStats = (subjects || []).map(sub => {
      const subTasks = allTasks.filter(t => t.subject_id === sub.id);
      const subCompleted = subTasks.filter(t => t.status === "completed");
      const rate = subTasks.length > 0 ? Math.round((subCompleted.length / subTasks.length) * 100) : null;
      return {
        id: sub.id,
        name: sub.name,
        color: sub.color || "#0077CC",
        total: subTasks.length,
        completed: subCompleted.length,
        late: subTasks.length - subCompleted.length,
        rate: rate
      };
    });

    // تحديد أكثر مادة متأخرة أو مظلومة (أقل نسبة أو أكثر متأخرات)
    let neglectedSubject = null;
    const subjectsWithTasks = subjectStats.filter(s => s.total > 0);
    if (subjectsWithTasks.length > 0) {
      subjectsWithTasks.sort((a, b) => {
        if (b.late !== a.late) return b.late - a.late;
        return (a.rate ?? 0) - (b.rate ?? 0);
      });
      if (subjectsWithTasks[0].late > 0 || (subjectsWithTasks[0].rate !== null && subjectsWithTasks[0].rate < 60)) {
        neglectedSubject = subjectsWithTasks[0];
      }
    }

    const completionRate = allTasks.length > 0 ? Math.round((completedTasks.length / allTasks.length) * 100) : 0;

    return {
      dateRangeStr: `${startOfWeek.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })} - ${today.toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}`,
      totalTasksCount: allTasks.length,
      completedCount: completedTasks.length,
      lateCount: lateTasks.length,
      lateTasks: lateTasks,
      totalMinutesStudied,
      hoursStudied,
      completionRate,
      quranDaysCount,
      energyCounts,
      subjectStats,
      neglectedSubject
    };
  }

  /**
   * إنشاء وتضمين الـ Modal في الصفحة
   */
  function ensureModalContainer() {
    let modal = document.getElementById("weeklyReviewModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "weeklyReviewModal";
      modal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm hidden anim-fade-in";
      modal.innerHTML = `
        <div class="bg-white dark:bg-[#141d2e] border border-outline-variant rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] anim-scale-up" dir="rtl">
          <!-- Header -->
          <div class="p-4 sm:p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-low/50">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-primary" style="font-size:26px">insights</span>
              <div>
                <h3 class="font-extrabold text-base sm:text-lg text-on-surface">مراجعة الأسبوع التفاعلية 📊</h3>
                <p class="text-xs text-on-surface-variant font-medium" id="wrDateRange">حصاد آخر 7 أيام</p>
              </div>
            </div>
            <button onclick="closeWeeklyReviewModal()" class="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:bg-surface-container-high transition">
              <span class="material-symbols-outlined" style="font-size:20px">close</span>
            </button>
          </div>

          <!-- Step Indicators -->
          <div class="px-5 pt-3 pb-1 flex items-center justify-between gap-1 border-b border-outline-variant/50">
            <div class="flex items-center gap-1.5 flex-1">
              <div id="stepDot1" class="h-1.5 flex-1 rounded-full bg-primary transition-all"></div>
              <div id="stepDot2" class="h-1.5 flex-1 rounded-full bg-outline-variant transition-all"></div>
              <div id="stepDot3" class="h-1.5 flex-1 rounded-full bg-outline-variant transition-all"></div>
              <div id="stepDot4" class="h-1.5 flex-1 rounded-full bg-outline-variant transition-all"></div>
            </div>
            <span class="text-[11px] font-bold text-outline mr-2" id="wrStepCounter">خطوة 1 من 4</span>
          </div>

          <!-- Body Content (Dynamic by Step) -->
          <div class="p-4 sm:p-6 overflow-y-auto flex-1 min-w-0" id="wrBodyContent">
            <div class="text-center py-12 text-on-surface-variant">
              <span class="material-symbols-outlined animate-spin text-primary" style="font-size:32px">progress_activity</span>
              <p class="text-xs mt-3">جاري جمع بيانات وتحليلات أسبوعك...</p>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-low/30 gap-2">
            <button id="wrPrevBtn" onclick="prevWeeklyReviewStep()" class="px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-on-surface hover:bg-surface-container transition disabled:opacity-30 disabled:pointer-events-none">
              السابق
            </button>
            <div class="flex items-center gap-2">
              <button id="wrNextBtn" onclick="nextWeeklyReviewStep()" class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition flex items-center gap-1 shadow-sm">
                <span>التالي</span>
                <span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    return modal;
  }

  /**
   * عرض محتوى كل خطوة
   */
  function renderStep(step) {
    currentStep = step;
    const body = document.getElementById("wrBodyContent");
    const prevBtn = document.getElementById("wrPrevBtn");
    const nextBtn = document.getElementById("wrNextBtn");
    const stepCounter = document.getElementById("wrStepCounter");

    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const dot = document.getElementById(`stepDot${i}`);
      if (dot) {
        dot.className = i <= step 
          ? "h-1.5 flex-1 rounded-full bg-primary transition-all" 
          : "h-1.5 flex-1 rounded-full bg-outline-variant transition-all";
      }
    }

    if (stepCounter) stepCounter.textContent = `خطوة ${step} من ${TOTAL_STEPS}`;
    if (prevBtn) prevBtn.disabled = step === 1;

    if (!reviewData) return;

    if (step === 1) {
      nextBtn.innerHTML = `<span>تحليل المواد</span><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>`;
      nextBtn.className = "px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition flex items-center gap-1 shadow-sm";

      let praiseText = "أسبوع مثمر وبداية قوية! 💪";
      if (reviewData.completionRate >= 80) praiseText = "إنجاز أسطوري استمر على هذا المستوى! 🌟🔥";
      else if (reviewData.completionRate < 50) praiseText = "الأسبوع كان فيه عقبات، بس لسه الفرصة في إيدك نعوض! 🌿";

      body.innerHTML = `
        <div class="text-center mb-5 anim-fade-up">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-primary mb-2 shadow-inner">
            <span class="text-2xl font-extrabold font-mono">${reviewData.completionRate}%</span>
          </div>
          <h4 class="font-extrabold text-base text-on-surface">نسبة إنجاز مهام الأسبوع</h4>
          <p class="text-xs text-primary font-bold mt-0.5">${praiseText}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-4 anim-fade-up stagger-1">
          <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center text-center">
            <span class="material-symbols-outlined text-tertiary mb-1" style="font-size:22px">timer</span>
            <span class="text-xl font-extrabold font-mono text-on-surface">${reviewData.hoursStudied} س</span>
            <span class="text-[11px] text-on-surface-variant font-medium mt-0.5">وقت المذاكرة المنجز</span>
          </div>
          <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col items-center text-center">
            <span class="material-symbols-outlined text-secondary mb-1" style="font-size:22px">task_alt</span>
            <span class="text-xl font-extrabold font-mono text-on-surface">${reviewData.completedCount} / ${reviewData.totalTasksCount}</span>
            <span class="text-[11px] text-on-surface-variant font-medium mt-0.5">المهام المكتملة</span>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between anim-fade-up stagger-2">
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-primary" style="font-size:24px">menu_book</span>
            <div>
              <p class="text-xs font-bold text-on-surface">الورد القرآني</p>
              <p class="text-[11px] text-on-surface-variant">الالتزام بالورد خلال الأسبوع</p>
            </div>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full ${reviewData.quranDaysCount >= 5 ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface'}">
            ${reviewData.quranDaysCount} من 7 أيام ✨
          </span>
        </div>
      `;
    } else if (step === 2) {
      nextBtn.innerHTML = `<span>ديون الأسبوع</span><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>`;
      nextBtn.className = "px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition flex items-center gap-1 shadow-sm";

      let neglectedHtml = "";
      if (reviewData.neglectedSubject) {
        neglectedHtml = `
          <div class="p-3.5 rounded-xl bg-error-container/20 border border-error/40 mb-4 flex items-start gap-3 anim-fade-up">
            <span class="material-symbols-outlined text-error shrink-0 mt-0.5" style="font-size:22px">warning</span>
            <div>
              <p class="text-xs font-bold text-on-surface">⚠️ المادة المظلومة هذا الأسبوع: <span class="text-error font-extrabold">${escapeHtml(reviewData.neglectedSubject.name)}</span></p>
              <p class="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                عليك فيها ${reviewData.neglectedSubject.late} مهام غير مكتملة. ركز عليها في أولويات الأسبوع القادم عشان متتراكمش!
              </p>
            </div>
          </div>
        `;
      } else {
        neglectedHtml = `
          <div class="p-3.5 rounded-xl bg-secondary-container/20 border border-secondary/40 mb-4 flex items-center gap-2.5 anim-fade-up">
            <span class="material-symbols-outlined text-secondary" style="font-size:22px">verified</span>
            <p class="text-xs font-bold text-on-surface">توازن ممتاز! كل المواد تم إنجاز مهامها بشكل متناسق 👏</p>
          </div>
        `;
      }

      const subjectsRowsHtml = (reviewData.subjectStats || []).map(s => {
        const rate = s.rate ?? 0;
        return `
          <div class="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/60 flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${s.color}"></span>
                <span class="font-bold text-on-surface">${escapeHtml(s.name)}</span>
              </div>
              <span class="font-mono text-[11px] font-bold text-on-surface-variant">${s.completed}/${s.total} (${rate}%)</span>
            </div>
            <div class="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width:${rate}%; background-color:${s.color}"></div>
            </div>
          </div>
        `;
      }).join("");

      body.innerHTML = `
        <div class="mb-3">
          <h4 class="font-bold text-sm text-on-surface mb-1">توزيع الإنجاز بين المواد 📚</h4>
          <p class="text-xs text-on-surface-variant">نظرة على المواد اللي خدت حقها والمواد اللي اتظلمت</p>
        </div>

        ${neglectedHtml}

        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
          ${subjectsRowsHtml || '<p class="text-xs text-center text-outline py-4">لا توجد مواد مسجلة</p>'}
        </div>
      `;
    } else if (step === 3) {
      nextBtn.innerHTML = `<span>الخطة والختام</span><span class="material-symbols-outlined" style="font-size:16px">arrow_back</span>`;
      nextBtn.className = "px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-dark transition flex items-center gap-1 shadow-sm";

      const lateListHtml = (reviewData.lateTasks || []).map(t => `
        <div class="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <span class="material-symbols-outlined text-outline" style="font-size:16px">schedule</span>
            <span class="font-bold text-on-surface truncate">${escapeHtml(t.title)}</span>
          </div>
          <span class="text-[10px] font-mono text-error font-bold shrink-0 bg-error-container/20 px-2 py-0.5 rounded-full">
            ${t.estimated_minutes || 30} د
          </span>
        </div>
      `).join("");

      body.innerHTML = `
        <div class="mb-4 text-center">
          <span class="material-symbols-outlined text-tertiary mb-1" style="font-size:32px">restart_alt</span>
          <h4 class="font-extrabold text-base text-on-surface">ديون الأسبوع والمتأخرات ⏳</h4>
          <p class="text-xs text-on-surface-variant mt-0.5">
            ${reviewData.lateCount > 0 ? `عندك ${reviewData.lateCount} مهام متبقية من الأسبوع الماضي` : 'مبروك! لا توجد أي مهام متأخرة 🎉'}
          </p>
        </div>

        ${reviewData.lateCount > 0 ? `
          <div class="space-y-2 max-h-44 overflow-y-auto mb-4 pr-1">
            ${lateListHtml}
          </div>

          <div class="p-4 rounded-xl bg-primary-container/20 border border-primary/40 text-center anim-fade-up">
            <p class="text-xs text-on-surface font-semibold mb-3">
              متقلقش من التراكم! نقدر نعيد توزيعهم بالتساوي على جدول الأسبوع الجديد بضغطة واحدة.
            </p>
            <button id="wrRescueActionBtn" onclick="triggerWeeklyRescueMode()" class="w-full bg-primary text-white text-xs font-extrabold py-2.5 rounded-xl hover:bg-primary-dark transition flex items-center justify-center gap-1.5 shadow-sm">
              <span class="material-symbols-outlined" style="font-size:18px">auto_mode</span>
              <span>توزيع المتأخرات على الأسبوع الجديد (وضع الإنقاذ)</span>
            </button>
            <div id="wrRescueFeedback" class="hidden text-xs text-secondary font-bold mt-2"></div>
          </div>
        ` : `
          <div class="p-8 border border-dashed border-outline-variant rounded-2xl text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-secondary mb-2" style="font-size:36px">sentiment_very_satisfied</span>
            <p class="text-sm font-bold text-on-surface">صفحتك بيضاء للأسبوع الجديد!</p>
            <p class="text-xs text-outline mt-1">خلصت كل المطلوب بدون أي ديون زمنية رحّلتها.</p>
          </div>
        `}
      `;
    } else if (step === 4) {
      nextBtn.innerHTML = `<span>بدء الأسبوع الجديد ✨</span><span class="material-symbols-outlined" style="font-size:16px">check</span>`;
      nextBtn.className = "px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-extrabold hover:opacity-95 transition flex items-center gap-1.5 shadow-md";

      let finalAdvice = "استعن بالله ونظم أولوياتك، واجعل المذاكرة فترات منتظمة مع أوقات استراحة محمية.";
      if (reviewData.neglectedSubject) {
        finalAdvice = `ابدأ أسبوعك بمراجعة ${reviewData.neglectedSubject.name} في أوقات نشاطك العالية؛ استعادة السيطرة عليها هتديك دفعة ثقة كبيرة!`;
      }

      body.innerHTML = `
        <div class="text-center py-4 anim-fade-up">
          <span class="text-4xl mb-3 block">🚀</span>
          <h4 class="font-extrabold text-lg text-on-surface mb-1">جاهز لأسبوع جديد كله إنجاز؟</h4>
          <p class="text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed mb-6">
            كل أسبوع بداية جديدة وفرصة لتحسين مستواك والاقتراب من حلمك.
          </p>

          <div class="p-4 rounded-2xl bg-surface-container-low border border-outline-variant text-right mb-4">
            <div class="flex items-center gap-2 mb-2 text-primary font-bold text-xs">
              <span class="material-symbols-outlined" style="font-size:18px">lightbulb</span>
              <span>وصية أسبوعك الذكية</span>
            </div>
            <p class="text-xs text-on-surface font-medium leading-relaxed">
              "${finalAdvice}"
            </p>
          </div>
        </div>
      `;
    }
  }

  /**
   * فتح نافذة مراجعة الأسبوع
   */
  async function openWeeklyReviewModal() {
    const modal = ensureModalContainer();
    modal.classList.remove("hidden");
    currentStep = 1;

    try {
      const authUser = typeof me !== "undefined" ? me : (typeof getMyProfile === "function" ? await requireAuth() : null);
      const sbClient = typeof sb !== "undefined" ? sb : null;

      if (!authUser || !sbClient) {
        throw new Error("يجب تسجيل الدخول أولاً لعرض مراجعة الأسبوع");
      }

      const data = await fetchWeeklyReviewData(sbClient, authUser.id);
      reviewData = data;

      const dateRangeEl = document.getElementById("wrDateRange");
      if (dateRangeEl) dateRangeEl.textContent = `حصاد أسبوع: ${data.dateRangeStr}`;

      renderStep(1);
    } catch (err) {
      console.error("Weekly review error:", err);
      const body = document.getElementById("wrBodyContent");
      if (body) {
        body.innerHTML = `
          <div class="text-center py-8 text-error">
            <span class="material-symbols-outlined" style="font-size:32px">error</span>
            <p class="text-xs mt-2 font-bold">${err.message || 'حصل خطأ أثناء تحميل مراجعة الأسبوع'}</p>
          </div>`;
      }
    }
  }

  function closeWeeklyReviewModal() {
    const modal = document.getElementById("weeklyReviewModal");
    if (modal) modal.classList.add("hidden");
  }

  function nextWeeklyReviewStep() {
    if (currentStep < TOTAL_STEPS) {
      renderStep(currentStep + 1);
    } else {
      if (typeof triggerConfetti === "function") {
        triggerConfetti(window.innerWidth / 2, window.innerHeight / 2);
      }
      if (typeof showToast === "function") {
        showToast("بارك الله في أسبوعك القادم! انطلق بعزيمة 🌟");
      }
      closeWeeklyReviewModal();
      localStorage.setItem("athar_last_weekly_review", new Date().toISOString().slice(0, 10));
    }
  }

  function prevWeeklyReviewStep() {
    if (currentStep > 1) {
      renderStep(currentStep - 1);
    }
  }

  /**
   * تشغيل وضع الإنقاذ للمهام المتأخرة في خطوة 3
   */
  async function triggerWeeklyRescueMode() {
    const btn = document.getElementById("wrRescueActionBtn");
    const feedback = document.getElementById("wrRescueFeedback");
    if (!btn || !reviewData || !reviewData.lateTasks || reviewData.lateTasks.length === 0) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin" style="font-size:16px">progress_activity</span><span>جاري توزيع المهام بذكاء...</span>`;

    try {
      const authUser = typeof me !== "undefined" ? me : null;
      const userProfile = typeof profile !== "undefined" ? profile : { preferred_session_minutes: 50 };

      if (typeof runRescueMode === "function") {
        const result = await runRescueMode(authUser.id, reviewData.lateTasks, userProfile);
        btn.classList.add("hidden");
        if (feedback) {
          feedback.classList.remove("hidden");
          feedback.textContent = result.message || "تمت إعادة الجدولة بنجاح!";
        }
        if (typeof showToast === "function") showToast(result.message);
      } else {
        throw new Error("محرك الإنقاذ غير متوفر");
      }
    } catch (err) {
      console.error("Rescue trigger error:", err);
      btn.disabled = false;
      btn.innerHTML = `<span>حاول مرة أخرى</span>`;
      if (typeof showToast === "function") showToast(err.message || "فشل تفعيل الإنقاذ");
    }
  }

  // تصدير للدوال العامة
  window.openWeeklyReviewModal = openWeeklyReviewModal;
  window.closeWeeklyReviewModal = closeWeeklyReviewModal;
  window.nextWeeklyReviewStep = nextWeeklyReviewStep;
  window.prevWeeklyReviewStep = prevWeeklyReviewStep;
  window.triggerWeeklyRescueMode = triggerWeeklyRescueMode;
})();
