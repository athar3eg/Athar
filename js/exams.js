// ============================================
// أَثَر — Exams Logic (Tailwind & Supabase)
// ============================================
let me = null;
let mySubjects = [];
let allExams = [];
let countdownInterval = null;

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    const { data } = await sb.from("subjects").select("*").eq("user_id", me.id);
    mySubjects = data || [];
    const selectEl = document.getElementById("examSubject");
    if (selectEl) {
      selectEl.innerHTML = mySubjects.length
        ? mySubjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")
        : `<option value="">أضف مادة أولاً من الإعدادات</option>`;
    }

    await loadExams();
  } catch (err) {
    console.error("Exams init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

async function loadExams() {
  const listEl = document.getElementById("examsList");
  const pastListEl = document.getElementById("pastExamsList");
  listEl.innerHTML = `<div class="text-xs text-on-surface-variant text-center py-6">جاري جلب الامتحانات...</div>`;

  const { data, error } = await sb.from("exams")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .order("exam_date");

  allExams = data || [];

  if (error || allExams.length === 0) {
    listEl.innerHTML = `
      <div class="border border-dashed border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant">
        <span class="material-symbols-outlined text-outline mb-2" style="font-size:36px">quiz</span>
        <p class="font-bold text-sm">لا توجد اختبارات مسجلة بعد</p>
        <p class="text-xs text-outline mt-1">أضف مواعيد امتحاناتك الشهرية ونصف العام لتجهيز جدول مراجعة ذكي</p>
        <button onclick="openExamModal()" class="mt-4 bg-primary text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-primary-dark transition shadow-sm">
          + إضافة موعد امتحان
        </button>
      </div>`;
    
    document.getElementById("featuredExamSection")?.classList.add("hidden");
    return;
  }

  document.getElementById("featuredExamSection")?.classList.remove("hidden");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = allExams.filter(ex => new Date(ex.exam_date) >= today);
  const past = allExams.filter(ex => new Date(ex.exam_date) < today);

  // Set Top Featured Exam & Countdown
  if (upcoming.length > 0) {
    const nextExam = upcoming[0];
    setupCountdown(nextExam);

    const titleEl = document.getElementById("activeExamTitle");
    const subEl = document.getElementById("activeExamSubject");
    const dateEl = document.getElementById("activeExamDate");
    if (titleEl) titleEl.textContent = nextExam.title;
    if (subEl) subEl.textContent = nextExam.subjects?.name || "عام";
    if (dateEl) {
      const d = new Date(nextExam.exam_date);
      dateEl.textContent = d.toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
    }
  } else {
    document.getElementById("featuredExamSection")?.classList.add("hidden");
  }

  // حساب نسبة الاستعداد الحقيقية لكل امتحان قادم
  await Promise.all(upcoming.map(async (ex) => {
    let q = sb.from('tasks').select('id, status').eq('user_id', me.id);
    if (ex.id && ex.subject_id) {
      q = q.or(`exam_id.eq.${ex.id},subject_id.eq.${ex.subject_id}`);
    } else if (ex.subject_id) {
      q = q.eq('subject_id', ex.subject_id);
    } else {
      ex._prep = null; return;
    }
    q = q.lte('due_date', ex.exam_date);
    const { data: ts } = await q;
    if (!ts || ts.length === 0) { ex._prep = null; return; }
    ex._prep = Math.round((ts.filter(t => t.status === 'completed').length / ts.length) * 100);
  }));

  // Render Upcoming list
  if (upcoming.length === 0) {
    listEl.innerHTML = `<div class="border border-dashed border-outline-variant rounded-xl p-4 text-center text-xs text-on-surface-variant">لا توجد اختبارات قادمة مسجلة</div>`;
  } else {
    listEl.innerHTML = upcoming.map(ex => {
      const examDate = new Date(ex.exam_date);
      const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
      const daysText = daysLeft === 0 ? "اليوم! 🚨" : daysLeft === 1 ? "غداً! ⏰" : `بعد ${daysLeft} يوم`;
      const badgeCls = daysLeft <= 2 ? "bg-error-container text-on-error-container" : "bg-primary-container text-on-primary-container";

      return `
        <div class="bg-white border border-outline-variant rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 hover:border-primary/40 transition">
          <div class="w-11 h-11 rounded-xl bg-secondary-container/60 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-secondary" style="font-size:24px">school</span>
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h4 class="font-bold text-sm text-on-surface truncate">${escapeHtml(ex.title)}</h4>
              <span class="${badgeCls} text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0">${daysText}</span>
            </div>
            <p class="text-xs text-on-surface-variant mt-0.5">
              ${escapeHtml(ex.subjects?.name || "عام")} · تاريخ: ${ex.exam_date}
            </p>
          </div>

          <div class="flex-1 min-w-[140px]">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-on-surface-variant font-medium">الاستعداد</span>
              ${ex._prep !== null && ex._prep !== undefined
                ? `<span class="font-bold font-mono text-primary">${ex._prep}%</span>`
                : `<a href="assistant.html" class="text-xs text-primary font-bold hover:underline">أنشئ خطة مراجعة</a>`}
            </div>
            <div class="h-2 bg-surface-container rounded-full overflow-hidden">
              <div class="h-full bg-primary rounded-full" style="width:${ex._prep ?? 0}%"></div>
            </div>
            ${ex._prep === null || ex._prep === undefined
              ? `<p class="text-[10px] text-on-surface-variant mt-1">لسه مفيش مهام مذاكرة مرتبطة بهذا الامتحان</p>`
              : ''}
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <a href="assistant.html" class="bg-primary-container text-on-primary-container text-xs font-bold px-4 py-2 rounded-full hover:bg-primary hover:text-white transition">
              مراجعة ذكية
            </a>
            <button onclick="deleteExam('${ex.id}')" class="p-2 rounded-full hover:bg-error-container text-error transition" title="حذف">
              <span class="material-symbols-outlined" style="font-size:16px">delete</span>
            </button>
          </div>
        </div>`;
    }).join("");
  }

  // Render Past Exams
  if (past.length > 0 && pastListEl) {
    pastListEl.innerHTML = past.map(ex => `
      <div class="bg-white border border-outline-variant rounded-xl p-4 flex items-center justify-between">
        <div>
          <h4 class="font-bold text-sm text-on-surface">${escapeHtml(ex.title)}</h4>
          <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(ex.subjects?.name || "")} · ${ex.exam_date}</p>
        </div>
        <div class="flex items-center gap-3">
          ${ex.score !== null && ex.score !== undefined
            ? `<span class="font-bold font-mono text-sm text-secondary">${ex.score} / ${ex.total_score || 100}</span>`
            : `<button onclick="recordScore('${ex.id}', ${ex.total_score || 100})" class="text-xs font-bold text-primary border border-primary/30 px-3 py-1 rounded-full hover:bg-primary-container">تسجيل الدرجة</button>`
          }
        </div>
      </div>`).join("");
  }
}

function setupCountdown(nextExam) {
  if (countdownInterval) clearInterval(countdownInterval);

  const titleEl = document.getElementById("countdownExamTitle");
  const subEl = document.getElementById("countdownExamSubject");
  if (titleEl) titleEl.textContent = nextExam.title;
  if (subEl) subEl.textContent = nextExam.subjects?.name || "عام";

  const targetDate = new Date(nextExam.exam_date + "T09:00:00").getTime();

  function update() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      document.getElementById("exam-countdown").textContent = "بدأ الامتحان 🎯";
      return;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const hStr = String(hours).padStart(2, "0");
    const mStr = String(minutes).padStart(2, "0");
    const sStr = String(seconds).padStart(2, "0");

    const clockEl = document.getElementById("exam-countdown");
    if (clockEl) clockEl.textContent = `${hStr}:${mStr}:${sStr}`;
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

async function recordScore(examId, total) {
  showInputModal(`اكتب درجتك التي حصلت عليها (من ${total}):`, `مثلاً: 45`, async (scoreStr) => {
    const score = parseFloat(scoreStr);
    if (isNaN(score)) { showToast('الدرجة غير صحيحة'); return; }
    const { error } = await sb.from('exams').update({ score }).eq('id', examId);
    if (error) { showToast('حدث خطأ أثناء حفظ الدرجة'); return; }
    showToast('تم حفظ الدرجة بنجاح 🎉');
    await loadExams();
  });
}

async function deleteExam(id) {
  showConfirmModal('هل أنت متأكد من حذف هذا الامتحان؟', async () => {
    await sb.from('exams').delete().eq('id', id);
    showToast('تم حذف الامتحان');
    await loadExams();
  });
}

function openExamModal() {
  document.getElementById("examDate").value = new Date().toISOString().slice(0, 10);
  document.getElementById("examModal").classList.remove("hidden");
}

function closeExamModal() {
  document.getElementById("examModal").classList.add("hidden");
}

async function saveExam() {
  const title = document.getElementById("examTitle").value.trim();
  const exam_date = document.getElementById("examDate").value;
  if (!title || !exam_date) { showToast("اكتب اسم الامتحان والتاريخ"); return; }

  const btn = document.getElementById("saveExamBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const subject_id = document.getElementById("examSubject").value || null;
    const exam_type = document.getElementById("examType").value;
    const total_score = parseInt(document.getElementById("examTotalScore").value) || 60;

    const { data: examRow, error } = await withTimeout(sb.from("exams").insert({
      user_id: me.id,
      title,
      subject_id,
      exam_type,
      exam_date,
      total_score
    }).select().single());

    if (error) throw error;

    if (typeof generateExamStudyPlan === "function") {
      const subjName = mySubjects.find(s => s.id === subject_id)?.name || "";
      const plan = await generateExamStudyPlan(sb, me.id, examRow, subjName);
      showToast(plan.created > 0 ? `تمت إضافة الامتحان، و${plan.created} جلسة مذاكرة ليها في جدولك ✓` : "تمت إضافة موعد الامتحان بنجاح ✓");
    } else {
      showToast("تمت إضافة موعد الامتحان بنجاح ✓");
    }
    closeExamModal();
    document.getElementById("examTitle").value = "";
    await loadExams();
  } catch (err) {
    console.error("Save exam error:", err);
    showToast(err.message || "حدث خطأ أثناء حفظ الامتحان");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ الامتحان";
  }
}


