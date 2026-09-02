// ============================================
// أَثَر — نظام الإشعارات والتنبيهات الذكي
// ============================================
// يدعم إشعارات المتصفح (Web Notifications) والتطبيق (Capacitor Native)
// مع تنبيهات تلقائية لمواعيد الحصص والمهام وجلسات المذاكرة وأداة تجربة فورية.

// نغمة تنبيه لطيفة بدون ملفات خارجية (Web Audio API)
function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // Web Audio non-blocking fallback
  }
}

// طلب إذن الإشعارات
async function requestNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }
  }
  return false;
}

// إطلاق إشعار للمستخدم
function sendLocalNotification(title, body, icon = "assets/icon.png") {
  playNotificationChime();

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body: body,
        icon: icon,
        badge: icon,
        vibrate: [200, 100, 200],
        tag: "athar-reminder-" + Date.now(),
      });
      notif.onclick = function () {
        window.focus();
        this.close();
      };
    } catch (e) {
      console.warn("Notification error:", e);
    }
  }

  if (typeof showToast === "function") {
    showToast(`🔔 ${title}: ${body}`);
  }
}

// ── تجربة الإشعار فورياً بنقرة واحدة ──
window.testAtharNotification = async function () {
  const granted = await requestNotificationPermission();
  
  if (granted) {
    sendLocalNotification(
      "أَثَر — تذكير المهمة 🔔",
      "الإشعارات تعمل بنجاح! حان موعد جلسة المذاكرة المقترحة 📚✨"
    );
    if (typeof triggerConfetti === "function") {
      triggerConfetti(window.innerWidth / 2, window.innerHeight / 3);
    }
  } else {
    if (typeof showToast === "function") {
      showToast("يرجى تفعيل إذن الإشعارات من إعدادات المتصفح للتنبيه بمواعيد مهامك 🔔");
    }
  }
};

// ── فحص دوري للمهام والمواعيد القادمة لتنبيه المستخدم ──
const _notifiedTasks = new Set();

async function checkUpcomingSchedulesAndRemind() {
  try {
    if (!window.sb || !("Notification" in window) || Notification.permission !== "granted") return;

    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const userId = session.user.id;

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const todayStr = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay();

    // 1) فحص الحصص الثابتة لليوم
    const { data: fixedList } = await sb
      .from("fixed_schedule")
      .select("id, title, start_time")
      .eq("user_id", userId)
      .eq("day_of_week", dayOfWeek);

    if (fixedList) {
      fixedList.forEach((b) => {
        if (!b.start_time) return;
        const [h, m] = b.start_time.split(":").map(Number);
        const blockMin = h * 60 + m;
        const key = `fixed_${b.id}_${todayStr}`;

        // تنبيه قبل الموعد بـ 10 دقائق أو في الموعد بالضبط
        if (Math.abs(currentMin - (blockMin - 10)) <= 1 && !_notifiedTasks.has(key)) {
          _notifiedTasks.add(key);
          sendLocalNotification("تذكير موعد حصة 🎓", `بعد 10 دقائق: ${b.title}`);
        }
      });
    }

    // 2) فحص المهام المستحقة لليوم
    const { data: tasksList } = await sb
      .from("tasks")
      .select("id, title, due_date")
      .eq("user_id", userId)
      .neq("status", "completed")
      .eq("due_date", todayStr);

    if (tasksList && tasksList.length > 0) {
      const key = `daily_tasks_summary_${todayStr}`;
      // تنبيه صباحي خفيف إذا لم يُنبه اليوم
      if (now.getHours() === 9 && now.getMinutes() <= 5 && !_notifiedTasks.has(key)) {
        _notifiedTasks.add(key);
        sendLocalNotification("مهام اليوم تنتظرك 🎯", `لديك ${tasksList.length} مهام دراسية مجدولة لليوم. بالتوفيق!`);
      }
    }
  } catch (e) {
    // non-blocking
  }
}

// ── تشغيل دوري كل دقيقة في الخلفية ──
if (typeof window !== "undefined") {
  setInterval(checkUpcomingSchedulesAndRemind, 60000);
}

// ── تهيئة إشعارات Capacitor الموبايل الأصلية ──
async function initPushNotifications(userId) {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
    // شغالين في متصفح — نقوم بطلب إذن الإشعارات بهدوء
    return;
  }

  try {
    const { PushNotifications } = window.Capacitor.Plugins;
    if (!PushNotifications) return;

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") return;

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      try {
        await sb.from("push_tokens").upsert(
          { user_id: userId, token: token.value, platform: window.Capacitor.getPlatform() },
          { onConflict: "token" }
        );
      } catch (e) {
        console.error("push token save error:", e);
      }
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      sendLocalNotification(notification.title || "إشعار جديد 🔔", notification.body || "");
    });
  } catch (e) {
    console.error("initPushNotifications error:", e);
  }
}

