// ============================================
// أَثَر — Rescue Engine (محرك الإنقاذ المشترك)
// يُستخدم من schedule.js وgemini-agent.js معًا
// ============================================

/**
 * runRescueMode
 * إعادة توزيع المهام المتأخرة على الأيام القادمة بمنطق حقيقي
 *
 * @param {string} userId  - معرّف المستخدم
 * @param {Array}  lateTasks - المهام المتأخرة [{id, title, estimated_minutes, due_date, subjects:{priority}}]
 * @param {Object} profile   - بروفايل الطالب {preferred_session_minutes}
 * @returns {Promise<{rescheduled:number, message:string}>}
 */
async function runRescueMode(userId, lateTasks, profile) {
  if (!lateTasks || lateTasks.length === 0) {
    return { rescheduled: 0, message: 'لا توجد مهام متأخرة — أنت على المسار الصحيح! 🎉' };
  }

  // حد أقصى للدقائق في اليوم الواحد = 3 × preferred_session_minutes
  const maxMinPerDay = (profile?.preferred_session_minutes || 50) * 3;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ترتيب المهام: أعلى أولوية أولاً (priority رقم أصغر = أولوية أعلى)، ثم الأقدم تاريخًا
  const sorted = [...lateTasks].sort((a, b) => {
    const pa = a.subjects?.priority ?? 99;
    const pb = b.subjects?.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.due_date || '').localeCompare(b.due_date || '');
  });

  // خريطة تحميل كل يوم { 'YYYY-MM-DD': minutes_used }
  const dayLoad = {};
  const updates = [];

  for (const task of sorted) {
    const taskMin = task.estimated_minutes || 30;
    let placed = false;

    // ابحث عن أقرب يوم متاح في الأسبوعين القادمين
    for (let offset = 1; offset <= 14; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const dateStr = d.toISOString().slice(0, 10);
      const used = dayLoad[dateStr] || 0;

      if (used + taskMin <= maxMinPerDay) {
        dayLoad[dateStr] = used + taskMin;
        updates.push({ id: task.id, due_date: dateStr });
        placed = true;
        break;
      }
    }

    // Fallback: ضعها في أقل يوم تحميلاً
    if (!placed) {
      let minLoad = Infinity;
      let minDate = new Date(today);
      minDate.setDate(today.getDate() + 1);
      let minDateStr = minDate.toISOString().slice(0, 10);

      Object.entries(dayLoad).forEach(([d, m]) => {
        if (m < minLoad) { minLoad = m; minDateStr = d; }
      });

      dayLoad[minDateStr] = (dayLoad[minDateStr] || 0) + taskMin;
      updates.push({ id: task.id, due_date: minDateStr });
    }
  }

  // تطبيق التحديثات على Supabase
  if (typeof sb !== 'undefined' && updates.length > 0) {
    await Promise.all(
      updates.map(u => sb.from('tasks').update({ due_date: u.due_date }).eq('id', u.id))
    );
  }

  const daysSpread = new Set(updates.map(u => u.due_date)).size;
  return {
    rescheduled: updates.length,
    message: `✅ وضع الإنقاذ! تم إعادة توزيع ${updates.length} مهمة على ${daysSpread} أيام قادمة حسب أولويتها وسعتك اليومية.`
  };
}

// تصدير للنافذة
if (typeof window !== 'undefined') window.runRescueMode = runRescueMode;
