// ============================================
// أَثَر — Exam Study Planner (محرك خطة مذاكرة الامتحان)
// يُستخدم من exams.js وgemini-agent.js معًا
//
// بمجرد ما يتسجل امتحان بتاريخ معين، بيبني تلقائيًا مهام "مذاكرة"
// موزعة على الأيام اللي قبله (بمنطق تكرار متباعد Spaced Repetition
// بسيط: جلسات أكتر كل ما نقترب من موعد الامتحان)، وبيضيفها لجدول
// المهام اليومي عادي زي أي مهمة تانية.
// ============================================

/**
 * generateExamStudyPlan
 * @param {object} sb - عميل Supabase
 * @param {string} userId
 * @param {object} exam - { id, title, subject_id, exam_date }
 * @param {string} subjectName - اسم المادة (للعنوان فقط)
 * @param {number} sessionMinutes - مدة الجلسة الواحدة (افتراضي 35 دقيقة)
 * @returns {Promise<{created:number, message:string}>}
 */
async function generateExamStudyPlan(sb, userId, exam, subjectName, sessionMinutes = 35) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const examDate = new Date(exam.exam_date + "T00:00:00");
  const daysUntil = Math.round((examDate - today) / (1000 * 60 * 60 * 24));

  // امتحان النهاردة أو بكرة — مفيش وقت كافي لخطة، سيبها للطالب يذاكر مباشرة
  if (daysUntil <= 1) {
    return { created: 0, message: "" };
  }

  // عدد الجلسات: كل ما الوقت أطول كل ما الجلسات أكتر، بحد أقصى 8 جلسات
  const sessionCount = Math.min(daysUntil - 1, 8);

  // توزيع الجلسات: كثافة أعلى كل ما اقتربنا من الامتحان (Spaced Repetition مبسط)
  // بنولد أوفستات (offsets) من يوم الامتحان للخلف بمسافات متزايدة تدريجيًا
  const offsets = [];
  let gap = 1;
  let cursor = 1; // نبدأ من يوم قبل الامتحان
  while (offsets.length < sessionCount && cursor < daysUntil) {
    offsets.push(cursor);
    cursor += gap;
    gap += 1; // المسافة بين الجلسات بتكبر كل ما نبعد عن الامتحان (يعني تتقارب قرب الامتحان)
  }

  const subjectLabel = subjectName || "المادة";
  const rows = offsets.map((offset, i) => {
    const d = new Date(examDate);
    d.setDate(examDate.getDate() - offset);
    const dueDate = d.toISOString().slice(0, 10);
    const isLast = i === 0; // أقرب جلسة للامتحان (offset الأصغر)
    return {
      user_id: userId,
      title: isLast
        ? `مراجعة أخيرة — ${subjectLabel} (${exam.title})`
        : `مذاكرة ${subjectLabel} — استعداد لامتحان ${exam.title}`,
      subject_id: exam.subject_id || null,
      task_type: isLast ? "review" : "study",
      due_date: dueDate,
      estimated_minutes: sessionMinutes,
      status: "pending"
    };
  });

  if (rows.length === 0) return { created: 0, message: "" };

  const { error } = await sb.from("tasks").insert(rows);
  if (error) return { created: 0, message: "" };

  return {
    created: rows.length,
    message: `📚 وحطيتلك ${rows.length} جلسة مذاكرة موزعة في جدولك لحد يوم الامتحان، عشان توصله وانت جاهز.`
  };
}

if (typeof window !== "undefined") window.generateExamStudyPlan = generateExamStudyPlan;
