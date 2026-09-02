// ============================================
// أَثَر — Splash Screen Controller
// ============================================
(function () {
  const SPLASH_MIN_MS = 350;    // أنيميشن سريع وسلس للوجو
  const SPLASH_MAX_MS = 1000;   // حد أقصى ثانية واحدة لضمان الدخول الفوري
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
      setTimeout(() => el.remove(), 350);
    }, wait);
  };

  // إخفاء تلقائي فوري
  setTimeout(() => { if (typeof window.hideAtharSplash === "function") window.hideAtharSplash(); }, SPLASH_MAX_MS);
})();
