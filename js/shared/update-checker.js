// ============================================
// أَثَر — فحص تحديثات التطبيق (Capacitor فقط)
// ============================================
// بيقارن النسخة المحمّلة جوه التطبيق بآخر نسخة منشورة على GitHub، ولو فيه
// فرق، بيعرض تنبيه أنيق بخيار "تحديث الآن" أو "لاحقًا".

const ATHAR_REMOTE_VERSION_URL = "https://raw.githubusercontent.com/athar3eg/Athar/main/version.json";
const ATHAR_DISMISS_KEY_PREFIX = "athar_update_dismissed_";

async function checkForAppUpdate() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
    return; // الفحص مخصوص للتطبيق فقط، مش لنسخة المتصفح
  }

  try {
    const [localRes, remoteRes] = await Promise.all([
      fetch("version.json").then((r) => r.json()).catch(() => null),
      fetch(ATHAR_REMOTE_VERSION_URL, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);

    if (!localRes || !remoteRes) return;
    if (localRes.version === remoteRes.version) return;

    // لو المستخدم دوس "لاحقًا" على النسخة دي بالذات، ما نزعجهوش بيها تاني
    if (sessionStorage.getItem(ATHAR_DISMISS_KEY_PREFIX + remoteRes.version)) return;

    showAppUpdateModal(remoteRes);
  } catch (e) {
    console.error("checkForAppUpdate error:", e);
  }
}

function showAppUpdateModal(remote) {
  if (document.getElementById("atharUpdateModal")) return;

  const modal = document.createElement("div");
  modal.id = "atharUpdateModal";
  modal.className = "fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4 backdrop-blur-xs";
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#141d2e] rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-outline-variant fade-in text-center">
      <div class="w-14 h-14 rounded-full bg-primary-container flex items-center justify-center mx-auto mb-4">
        <span class="material-symbols-outlined text-primary" style="font-size:28px">system_update</span>
      </div>
      <h3 class="font-extrabold text-lg text-on-surface mb-2">يتوفر تحديث جديد للتطبيق</h3>
      <p class="text-sm text-on-surface-variant leading-relaxed mb-6">
        صدر إصدار أحدث من التطبيق يتضمن تحسينات وإصلاحات. يُنصح بتحديث التطبيق للحصول على أفضل تجربة استخدام.
      </p>
      <div class="flex items-center gap-2">
        <button id="atharUpdateLater" class="flex-1 border border-outline-variant text-on-surface font-bold text-sm py-2.5 rounded-full hover:bg-surface-container-low transition">لاحقًا</button>
        <button id="atharUpdateNow" class="flex-1 bg-primary text-on-primary font-bold text-sm py-2.5 rounded-full hover:bg-primary-dark transition">تحديث الآن</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById("atharUpdateLater").addEventListener("click", () => {
    sessionStorage.setItem(ATHAR_DISMISS_KEY_PREFIX + remote.version, "1");
    modal.remove();
  });

  document.getElementById("atharUpdateNow").addEventListener("click", () => {
    window.open(remote.apk_url, "_system");
    modal.remove();
  });
}

// فحص تلقائي عند فتح التطبيق (بعد شوية عشان الصفحة الأساسية تحمّل الأول)
if (typeof window !== "undefined") {
  setTimeout(checkForAppUpdate, 1500);
}
