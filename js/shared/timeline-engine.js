// ============================================
// أَثَر — محرك الجدولة بالساعة (Timeline Engine)
// ============================================
// بيبني جدول فعلي بالدقيقة: "من الساعة كذا للكذا ذاكر كذا، وبعدها استريح"
// بدل ما يكون مجرد "مهام لليوم" من غير وقت محدد.

function _tlToMin(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function _tlDateToMin(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function formatTimelineMinutes(totalMin) {
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  const period = h < 12 ? "ص" : "م";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * @param {object} opts
 * @param {string} opts.wakeTime   "HH:MM:SS"
 * @param {string} opts.sleepTime  "HH:MM:SS"
 * @param {number} opts.sessionMinutes  طول جلسة المذاكرة قبل الاستراحة
 * @param {number} opts.restMinutes     طول الاستراحة بين الجلسات
 * @param {Array}  opts.fixedBlocks  [{ title, start_time, end_time, block_kind }]
 * @param {object|null} opts.prayerTimes  ناتج computePrayerTimes() {fajr,dhuhr,asr,maghrib,isha,...} (Date objects) أو null
 * @param {number} opts.prayerBufferMinutes  مدة حجز الصلاة (افتراضي 20)
 * @param {Array}  opts.tasks  [{ id, title, estimated_minutes, subjects?: {priority} }]
 * @returns {Array} timeline: [{ start, end, startLabel, type, label }]
 */
function buildDailyTimeline(opts) {
  const {
    wakeTime, sleepTime,
    sessionMinutes = 45, restMinutes = 15,
    fixedBlocks = [], prayerTimes = null, prayerBufferMinutes = 20,
    tasks = []
  } = opts;

  const dayStart = _tlToMin(wakeTime) ?? 6 * 60;
  let dayEnd = _tlToMin(sleepTime) ?? 23 * 60;
  if (dayEnd <= dayStart) dayEnd += 24 * 60; // نوم بعد نص الليل (مثلاً 01:00) يتحسب صح

  // ── 1) اجمع كل الأوقات المحجوزة (حصص + وقت محمي + صلاة) ──
  const blocked = [];

  fixedBlocks.forEach((b) => {
    const s = _tlToMin(b.start_time), e = _tlToMin(b.end_time);
    if (s == null || e == null) return;
    blocked.push({ start: s, end: e, type: b.block_kind === "protected" ? "protected" : "class", label: b.title });
  });

  if (prayerTimes) {
    const PRAYER_LABELS = { fajr: "الفجر", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
    Object.keys(PRAYER_LABELS).forEach((key) => {
      const d = prayerTimes[key];
      if (!d) return;
      const center = _tlDateToMin(d);
      const s = Math.max(dayStart, center - Math.floor(prayerBufferMinutes / 2));
      const e = Math.min(dayEnd, center + Math.ceil(prayerBufferMinutes / 2));
      if (e > s) blocked.push({ start: s, end: e, type: "prayer", label: PRAYER_LABELS[key] });
    });
  }

  blocked.sort((a, b) => a.start - b.start);

  const merged = [];
  for (const b of blocked) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      last.end = Math.max(last.end, b.end);
      if (last.type === "prayer" && b.type !== "prayer") { last.type = b.type; last.label = b.label; }
    } else {
      merged.push({ ...b });
    }
  }

  const freeSlots = [];
  let cursor = dayStart;
  for (const b of merged) {
    if (b.start > cursor) freeSlots.push({ start: cursor, end: Math.min(b.start, dayEnd) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < dayEnd) freeSlots.push({ start: cursor, end: dayEnd });

  const sortedTasks = [...tasks].sort((a, b) => (a.subjects?.priority ?? 2) - (b.subjects?.priority ?? 2));
  const remainingTasks = sortedTasks.map((t) => ({ ...t, remaining: t.estimated_minutes || 30 }));

  const timeline = merged.map((b) => ({ start: b.start, end: b.end, startLabel: formatTimelineMinutes(b.start), type: b.type, label: b.label }));
  let taskIdx = 0;

  for (const slot of freeSlots) {
    let pos = slot.start;
    let sinceRest = 0;

    while (pos < slot.end && taskIdx < remainingTasks.length) {
      const task = remainingTasks[taskIdx];
      const slotLeft = slot.end - pos;
      const sessionLeft = sessionMinutes - sinceRest;
      const chunk = Math.min(task.remaining, slotLeft, sessionLeft > 0 ? sessionLeft : sessionMinutes);

      if (chunk <= 0) break;

      timeline.push({ start: pos, end: pos + chunk, startLabel: formatTimelineMinutes(pos), type: "study", label: task.title });

      pos += chunk;
      sinceRest += chunk;
      task.remaining -= chunk;
      if (task.remaining <= 0) taskIdx++;

      if (sinceRest >= sessionMinutes && pos < slot.end && taskIdx < remainingTasks.length) {
        const restEnd = Math.min(pos + restMinutes, slot.end);
        if (restEnd > pos) {
          timeline.push({ start: pos, end: restEnd, startLabel: formatTimelineMinutes(pos), type: "rest", label: "استراحة" });
          pos = restEnd;
        }
        sinceRest = 0;
      }
    }

    if (pos < slot.end) {
      timeline.push({ start: pos, end: slot.end, startLabel: formatTimelineMinutes(pos), type: "free", label: "وقت حر" });
    }
  }

  timeline.sort((a, b) => a.start - b.start);
  return timeline;
}

if (typeof window !== "undefined") {
  window.buildDailyTimeline = buildDailyTimeline;
  window.formatTimelineMinutes = formatTimelineMinutes;
}
