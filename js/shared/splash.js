// ============================================
// أَثَر — Splash Screen Controller
// ============================================
(function () {
  const SPLASH_MIN_MS = 1100;   // أقل مدة عرض عشان الأنيميشن ما يتقطعش لو الفحص خلص بسرعة
  const SPLASH_MAX_MS = 4500;   // أقصى مدة أمان لو حاجة اتعلقت (بطء إنترنت مثلاً)
  const startedAt = Date.now();
  let hidden = false;

  window.hideAtharSplash = function () {
    if (hidden) return;
    hidden = true;
    const el = document.getElementById("atharSplash");
    if (!el) return;
    const elapsed = Date.now() - startedAt;
    const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
    setTimeout(() => {
      el.classList.add("splash-exit");
      setTimeout(() => el.remove(), 600);
    }, wait);
  };

  // شبكة أمان: لو حاجة اتعلقت ومحدش نادى hideAtharSplash، اختفي بنفسك
  setTimeout(() => { if (typeof window.hideAtharSplash === "function") window.hideAtharSplash(); }, SPLASH_MAX_MS);
})();
