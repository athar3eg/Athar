// ============================================
// أَثَر — Prayer Times & Quran Wird (حساب محلي، بدون إنترنت)
// ============================================
// حساب فلكي تقريبي لمواعيد الصلاة (معادلات كوبر المبسطة لموقع الشمس).
// الدقة المتوقعة: ± ٢-٤ دقايق تقريبًا — كفاية للتنظيم اليومي، لكنها مش
// بديل عن مصدر ديني موثوق لو محتاج دقة رسمية.
// زاوية الفجر والعشاء الافتراضية هنا: ١٩.٥° / ١٧.٥° (الهيئة المصرية العامة للمساحة).

function computePrayerTimes(lat, lon, date = new Date(), fajrAngle = 19.5, ishaAngle = 17.5) {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) return null;

  const rad = Math.PI / 180, deg = 180 / Math.PI;

  const start = new Date(date.getFullYear(), 0, 0);
  const N = Math.floor((date - start) / 86400000);

  const B = (2 * Math.PI * (N - 81)) / 365;
  const eqT = 229.18 * (0.000075 + 0.001868 * Math.cos(B) - 0.032077 * Math.sin(B) - 0.014615 * Math.cos(2 * B) - 0.040849 * Math.sin(2 * B)); // بالدقايق
  const declDeg = 23.45 * Math.sin((2 * Math.PI * (284 + N)) / 365);

  const phi = lat * rad, delta = declDeg * rad;
  const solarNoonUTC = 12 - lon / 15 - eqT / 60;

  function hourAngleDeg(altitudeDeg) {
    const alt = altitudeDeg * rad;
    const cosH = (Math.sin(alt) - Math.sin(phi) * Math.sin(delta)) / (Math.cos(phi) * Math.cos(delta));
    if (cosH > 1 || cosH < -1) return null; // الشمس ما بتوصلش للزاوية دي (حالات نادرة قرب القطبين)
    return Math.acos(cosH) * deg;
  }

  function timeFromDepression(depressionDeg, isAfternoon) {
    const H = hourAngleDeg(-depressionDeg);
    if (H === null) return null;
    return solarNoonUTC + (isAfternoon ? H / 15 : -H / 15);
  }

  function asrUTC(shadowFactor = 1) {
    const altitude = Math.atan(1 / (shadowFactor + Math.tan(Math.abs(phi - delta)))) * deg;
    const H = hourAngleDeg(altitude);
    if (H === null) return null;
    return solarNoonUTC + H / 15;
  }

  function toLocalDate(utcHours) {
    if (utcHours == null) return null;
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
    d.setUTCMinutes(Math.round(utcHours * 60));
    return d;
  }

  return {
    fajr: toLocalDate(timeFromDepression(fajrAngle, false)),
    sunrise: toLocalDate(timeFromDepression(0.833, false)),
    dhuhr: toLocalDate(solarNoonUTC + 1 / 60),
    asr: toLocalDate(asrUTC(1)),
    maghrib: toLocalDate(timeFromDepression(0.833, true)),
    isha: toLocalDate(timeFromDepression(ishaAngle, true)),
  };
}

const PRAYER_LABELS_AR = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };

function formatArabicTime(d) {
  if (!d) return "--:--";
  let h = d.getHours(), m = d.getMinutes();
  const period = h < 12 ? "ص" : "م";
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

// أقرب صلاة جاية + الوقت المتبقي عليها (نص عربي جاهز للعرض)
function getNextPrayer(times) {
  const now = new Date();
  const order = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  for (const key of order) {
    if (key === "sunrise") continue; // الشروق مش صلاة، بس بنحسبه لعرض وقت انتهاء الفجر
    if (times[key] && times[key] > now) {
      const diffMin = Math.round((times[key] - now) / 60000);
      return { key, label: PRAYER_LABELS_AR[key], time: times[key], minutesLeft: diffMin };
    }
  }
  return null; // كل صلوات اليوم فاتت — الفجر بكرة
}

// ── طلب الموقع الجغرافي من المتصفح وحفظه في البروفايل ──────────────
async function detectAndSaveLocation(sb, userId) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("المتصفح ده مش بيدعم تحديد الموقع")); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const { error } = await sb.from("profiles").update({ latitude, longitude }).eq("id", userId);
        if (error) { reject(error); return; }
        resolve({ latitude, longitude });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
}

// ── الورد القرآني اليومي ────────────────────────────────────────────
async function getQuranWirdStatus(sb, userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data } = await sb.from("quran_wird_log").select("log_date, done").eq("user_id", userId).order("log_date", { ascending: false }).limit(60);
  const doneToday = !!(data || []).find(r => r.log_date === todayStr && r.done);

  // حساب الأيام المتتالية (streak) بداية من النهاردة (أو من أمبارح لو النهاردة لسه ما اتعملش)
  let streak = 0;
  if (data && data.length) {
    const doneDates = new Set(data.filter(r => r.done).map(r => r.log_date));
    let cursor = new Date();
    if (!doneToday) cursor.setDate(cursor.getDate() - 1); // لو النهاردة لسه، ابدأ العد من أمبارح
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (doneDates.has(key)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
  }

  return { doneToday, streak };
}

async function markQuranWirdDoneToday(sb, userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return sb.from("quran_wird_log").upsert({ user_id: userId, log_date: todayStr, done: true }, { onConflict: "user_id,log_date" });
}
