// ============================================
// مِدار — Dashboard
// ============================================
const DAY_NAMES = ["الأحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

let me = null;

function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("الاتصال بطيء جدًا — تأكد من الإنترنت وحاول تاني")), ms))
  ]);
}

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled rejection:", e.reason);
});

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    applyTheme();
    setGreeting();
    await withTimeout(loadToday());
    await withTimeout(loadSubjects());
  } catch (err) {
    console.error("Dashboard init error:", err);
    document.getElementById("todayList").innerHTML = `<div class="empty-state">حصل خطأ في التحميل — ${err.message}</div>`;
  }
})();

function setGreeting() {
  const hour = new Date().getHours();
  let g = "مساء الخير";
  if (hour < 12) g = "صباح الخير";
  else if (hour < 17) g = "أهلاً بيك";
  document.getElementById("greetingText").textContent = `${g} 👋`;

  const now = new Date();
  document.getElementById("dateText").textContent =
    `${DAY_NAMES[now.getDay()]} — ${now.toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`;
}

// ---------- Theme ----------
function applyTheme() {
  const saved = localStorage.getItem("madar-theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("madar-theme", next);
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = "index.html";
}

// ---------- Today's blocks + "what to do now" ----------
async function loadToday() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const { data: fixed, error } = await supabase
    .from("fixed_schedule")
    .select("*, subjects(name, color)")
    .eq("user_id", me.id)
    .eq("day_of_week", dayOfWeek)
    .order("start_time");

  const listEl = document.getElementById("todayList");

  if (error || !fixed || fixed.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مواعيد ثابتة النهاردة 🌿</div>`;
  } else {
    listEl.innerHTML = fixed.map(b => {
      const [sh, sm] = b.start_time.split(":").map(Number);
      const [eh, em] = b.end_time.split(":").map(Number);
      const startM = sh * 60 + sm, endM = eh * 60 + em;
      const isNow = nowMinutes >= startM && nowMinutes < endM;
      const color = b.subjects?.color || "var(--accent)";
      return `
        <div class="row">
          <div class="dot" style="background:${color}"></div>
          <div class="content">
            <div class="title">${b.title}${isNow ? " 🔴 دلوقتي" : ""}</div>
            <div class="meta">${b.subjects?.name || ""}</div>
          </div>
          <div class="time">${b.start_time.slice(0,5)} - ${b.end_time.slice(0,5)}</div>
        </div>`;
    }).join("");
  }

  // "ماذا أفعل الآن؟"
  computeNowAction(fixed || [], nowMinutes);
}

function computeNowAction(fixed, nowMinutes) {
  const current = fixed.find(b => {
    const [sh, sm] = b.start_time.split(":").map(Number);
    const [eh, em] = b.end_time.split(":").map(Number);
    return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em;
  });

  if (current) {
    document.getElementById("nowAction").textContent = current.title;
    document.getElementById("nowMeta").textContent = `لحد الساعة ${current.end_time.slice(0,5)}`;
    return;
  }

  const upcoming = fixed
    .map(b => {
      const [sh, sm] = b.start_time.split(":").map(Number);
      return { b, startM: sh * 60 + sm };
    })
    .filter(x => x.startM > nowMinutes)
    .sort((a, b) => a.startM - b.startM)[0];

  if (upcoming) {
    const freeMinutes = upcoming.startM - nowMinutes;
    const h = Math.floor(freeMinutes / 60), m = freeMinutes % 60;
    const freeText = h > 0 ? `${h} ساعة و${m} دقيقة` : `${m} دقيقة`;
    document.getElementById("nowAction").textContent = `عندك ${freeText} لحد "${upcoming.b.title}"`;
    document.getElementById("nowMeta").textContent = "وقت مثالي للمذاكرة أو المراجعة";
  } else {
    document.getElementById("nowAction").textContent = "وقتك فاضي — وقت مثالي للمذاكرة";
    document.getElementById("nowMeta").textContent = "مفيش مواعيد باقية النهاردة";
  }
}

// ---------- Subjects ----------
async function loadSubjects() {
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("user_id", me.id)
    .order("priority");

  const listEl = document.getElementById("subjectsList");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="empty-state">مفيش مواد لسه — ضيفها من الإعدادات</div>`;
    return;
  }

  const badgeMap = { stable: ["مستقرة", "badge-green"], attention: ["محتاجة انتباه", "badge-yellow"], critical: ["حرجة", "badge-red"] };

  listEl.innerHTML = data.map(s => {
    const [label, cls] = badgeMap[s.risk_level] || badgeMap.stable;
    return `
      <div class="row">
        <div class="dot" style="background:${s.color}"></div>
        <div class="content">
          <div class="title">${s.name}</div>
          <div class="meta">مستوى الإتقان: ${Math.round(s.mastery_percentage)}%</div>
        </div>
        <span class="badge ${cls}">${label}</span>
      </div>`;
  }).join("");
}
