// ============================================
// أَثَر — فحص تحديثات التطبيق الذكي
// ============================================
// يقارن الإصدار المثبت بآخر إصدار منشور على GitHub عبر مقارنة رقمية (SemVer)
// ولا يطلب التحديث إلا إذا كان هناك إصدار أحدث بالفعل، مع دعم زر "لاحقاً" وزر الفحص اليدوي.

const ATHAR_CURRENT_LOCAL_VERSION = "1.0.3";
const ATHAR_REMOTE_VERSION_URL = "https://raw.githubusercontent.com/athar3eg/Athar/main/version.json";
const ATHAR_DISMISS_KEY_PREFIX = "athar_update_dismissed_";

function parseSemVer(verStr) {
  if (!verStr || typeof verStr !== "string") return [0, 0, 0];
  const clean = verStr.trim().replace(/^v/i, "");
  return clean.split(".").map((n) => parseInt(n, 10) || 0);
}

function isNewerVersion(remoteVer, localVer) {
  const r = parseSemVer(remoteVer);
  const l = parseSemVer(localVer);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rNum = r[i] || 0;
    const lNum = l[i] || 0;
    if (rNum > lNum) return true;
    if (rNum < lNum) return false;
  }
  return false;
}

async function checkForAppUpdate(isManual = false) {
  try {
    let localVersion = ATHAR_CURRENT_LOCAL_VERSION;

    const [localRes, remoteRes] = await Promise.all([
      fetch("version.json", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
      fetch(ATHAR_REMOTE_VERSION_URL, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
    ]);

    if (localRes && localRes.version) {
      localVersion = localRes.version;
    }

    if (!remoteRes || !remoteRes.version) {
      if (isManual && typeof showToast === "function") {
        showToast("تعذر التحقق من التحديثات — تأكد من اتصال الإنترنت");
      }
      return;
    }

    // هل الإصدار السحابي أحدث من الإصدار المحلي المثبت؟
    const hasUpdate = isNewerVersion(remoteRes.version, localVersion);

    if (!hasUpdate) {
      if (isManual && typeof showToast === "function") {
        showToast(`أنت تستخدم أحدث إصدار من أَثَر (v${localVersion}) بنجاح 🎉`);
      }
      return;
    }

    // في الفحص التلقائي: التحقق من تأجيل المستخدم خلال آخر 24 ساعة
    if (!isManual) {
      const dismissedTimestamp = localStorage.getItem(ATHAR_DISMISS_KEY_PREFIX + remoteRes.version);
      if (dismissedTimestamp) {
        const timePassed = Date.now() - parseInt(dismissedTimestamp, 10);
        if (timePassed < 24 * 60 * 60 * 1000) {
          return; // تم التأجيل خلال الـ 24 ساعة الماضية
        }
      }
    }

    showAppUpdateModal(remoteRes, localVersion);
  } catch (e) {
    console.error("checkForAppUpdate error:", e);
    if (isManual && typeof showToast === "function") {
      showToast("حدث خطأ أثناء فحص التحديثات");
    }
  }
}

function showAppUpdateModal(remote, currentVer) {
  if (document.getElementById("atharUpdateModal")) return;

  const modal = document.createElement("div");
  modal.id = "atharUpdateModal";
  modal.className = "fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#141d2e] rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-outline-variant modal-pop text-center">
      <div class="w-16 h-16 rounded-2xl bg-primary-container text-primary flex items-center justify-center mx-auto mb-4 shadow-sm">
        <span class="material-symbols-outlined" style="font-size:32px">system_update</span>
      </div>
      <div class="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-extrabold px-3 py-1 rounded-full mb-3">
        <span>إصدار جديد متوفر: v${remote.version}</span>
      </div>
      <h3 class="font-extrabold text-lg text-on-surface mb-2">يتوفر تحديث جديد لتطبيق أَثَر</h3>
      <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed mb-6">
        يتضمن هذا الإصدار تحسينات للأداء والأنيميشن وإصلاحات مهمة لجدولك الدراسي ومساعدك الأكاديمي.
      </p>
      <div class="flex items-center gap-2.5">
        <button id="atharUpdateLater" class="flex-1 border border-outline-variant text-on-surface-variant hover:text-on-surface font-bold text-xs sm:text-sm py-3 rounded-full hover:bg-surface-container-low transition">
          لاحقًا
        </button>
        <button id="atharUpdateNow" class="flex-1 bg-primary text-on-primary font-bold text-xs sm:text-sm py-3 rounded-full hover:bg-primary-dark transition shadow-md shadow-primary/20 flex items-center justify-center gap-1">
          <span class="material-symbols-outlined" style="font-size:18px">download</span>
          <span>تحديث الآن</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById("atharUpdateLater").addEventListener("click", () => {
    localStorage.setItem(ATHAR_DISMISS_KEY_PREFIX + remote.version, Date.now().toString());
    modal.classList.add("opacity-0", "transition-opacity");
    setTimeout(() => modal.remove(), 200);
  });

  document.getElementById("atharUpdateNow").addEventListener("click", () => {
    const downloadUrl = remote.apk_url || "https://github.com/athar3eg/Athar/releases/latest/download/app-debug.apk";
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      window.open(downloadUrl, "_system");
    } else {
      window.open(downloadUrl, "_blank");
    }
    modal.remove();
  });
}

// فحص يدوي متاح عالمياً
window.checkAppUpdatesManually = function () {
  checkForAppUpdate(true);
};

// فحص تلقائي عند فتح التطبيق بعد تحميل الصفحة
if (typeof window !== "undefined") {
  setTimeout(() => checkForAppUpdate(false), 2500);
}
