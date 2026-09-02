// ============================================
// أَثَر — Common Utilities (shared across all pages)
// ============================================

// ── localStorage Migration (madar → athar) ───────────────────────────────
(function migrateLocalStorage() {
  const migrations = [
    ['madar_gemini_api_key', 'athar_gemini_api_key'],
    ['madar_gemini_model',   'athar_gemini_model'],
    ['madar_dash_cache',     'athar_dash_cache'],
    ['madar-theme',          'athar-theme']
  ];
  migrations.forEach(([oldKey, newKey]) => {
    if (!localStorage.getItem(newKey)) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal) localStorage.setItem(newKey, oldVal);
    }
  });
})();

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2400) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('translate-y-24', 'opacity-0');
  clearTimeout(toast._toastTimer);
  toast._toastTimer = setTimeout(() =>
    toast.classList.add('translate-y-24', 'opacity-0'), duration);
}

// ── Timeout wrapper ───────────────────────────────────────────────────────
function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('الاتصال بطيء — حاول ثانية')), ms))
  ]);
}

// ── HTML escape ───────────────────────────────────────────────────────────
function escapeHtml(s) {
  if (!s) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ── Logout ────────────────────────────────────────────────────────────────
async function logout() {
  if (typeof sb !== 'undefined') await sb.auth.signOut();
  window.location.href = 'index.html';
}

// ── Confirm Modal (بديل confirm()) ───────────────────────────────────────
function showConfirmModal(message, onConfirm) {
  document.getElementById('_confirmModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_confirmModal';
  overlay.style.cssText = [
    'position:fixed;inset:0',
    'background:rgba(10,10,14,.55)',
    'display:flex;align-items:center;justify-content:center',
    'z-index:9999;padding:20px'
  ].join(';');

  overlay.innerHTML = `
    <div style="background:var(--bg-card,#fff);border:1px solid var(--border,#d6dbe6);
      border-radius:20px;padding:24px;max-width:360px;width:100%;
      box-shadow:0 12px 40px rgba(0,0,0,.18);direction:rtl;text-align:right;
      font-family:var(--font,'Cairo',sans-serif)">
      <p style="font-size:15px;font-weight:600;color:var(--text,#111827);
        margin:0 0 20px;line-height:1.7">${escapeHtml(message)}</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_confirmCancel" style="padding:9px 20px;border-radius:999px;
          border:1px solid var(--border,#d6dbe6);background:transparent;
          color:var(--text-soft,#4b5566);font-size:13px;font-weight:600;
          cursor:pointer;font-family:inherit">إلغاء</button>
        <button id="_confirmOk" style="padding:9px 20px;border-radius:999px;
          border:none;background:#ba1a1a;color:#fff;font-size:13px;
          font-weight:700;cursor:pointer;font-family:inherit">تأكيد الحذف</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelector('#_confirmCancel').onclick = () => overlay.remove();
  overlay.querySelector('#_confirmOk').onclick    = () => { overlay.remove(); onConfirm(); };
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Input Modal (بديل prompt()) ──────────────────────────────────────────
function showInputModal(message, placeholder, onSubmit) {
  document.getElementById('_inputModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_inputModal';
  overlay.style.cssText = [
    'position:fixed;inset:0',
    'background:rgba(10,10,14,.55)',
    'display:flex;align-items:center;justify-content:center',
    'z-index:9999;padding:20px'
  ].join(';');

  overlay.innerHTML = `
    <div style="background:var(--bg-card,#fff);border:1px solid var(--border,#d6dbe6);
      border-radius:20px;padding:24px;max-width:360px;width:100%;
      box-shadow:0 12px 40px rgba(0,0,0,.18);direction:rtl;text-align:right;
      font-family:var(--font,'Cairo',sans-serif)">
      <p style="font-size:15px;font-weight:600;color:var(--text,#111827);
        margin:0 0 14px;line-height:1.7">${escapeHtml(message)}</p>
      <input id="_inputField" type="text"
        placeholder="${escapeHtml(placeholder || '')}"
        style="width:100%;padding:11px 14px;border-radius:10px;
          border:1.5px solid var(--border,#d6dbe6);
          background:var(--bg-soft,#eef2f8);color:var(--text,#111827);
          font-size:14px;outline:none;font-family:inherit;
          box-sizing:border-box;margin-bottom:16px;transition:border-color .15s" />
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="_inputCancel" style="padding:9px 20px;border-radius:999px;
          border:1px solid var(--border,#d6dbe6);background:transparent;
          color:var(--text-soft,#4b5566);font-size:13px;font-weight:600;
          cursor:pointer;font-family:inherit">إلغاء</button>
        <button id="_inputOk" style="padding:9px 20px;border-radius:999px;
          border:none;background:var(--accent,#0077cc);color:#fff;
          font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">تأكيد</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const field  = overlay.querySelector('#_inputField');
  setTimeout(() => field.focus(), 60);

  const submit = () => {
    const val = field.value.trim();
    if (!val) { field.style.borderColor = '#ba1a1a'; return; }
    overlay.remove();
    onSubmit(val);
  };

  field.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  overlay.querySelector('#_inputCancel').onclick = () => overlay.remove();
  overlay.querySelector('#_inputOk').onclick     = submit;
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ── Simple In-Memory Cache (60 s TTL) ────────────────────────────────────
const _atharCache = new Map();
function cacheGet(key) {
  const item = _atharCache.get(key);
  if (!item) return null;
  if (Date.now() > item.exp) { _atharCache.delete(key); return null; }
  return item.val;
}
function cacheSet(key, value, ttlMs = 60000) {
  _atharCache.set(key, { val: value, exp: Date.now() + ttlMs });
}
function cacheInvalidate(key) { _atharCache.delete(key); }

// ── Offline / Online banner ───────────────────────────────────────────────
(function initOffline() {
  const show = () => {
    if (document.getElementById('_offlineBanner')) return;
    const b = document.createElement('div');
    b.id = '_offlineBanner';
    b.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:9998',
      'background:#ba1a1a;color:#fff;text-align:center',
      'padding:8px 16px;font-size:13px;font-weight:600;direction:rtl',
      'font-family:var(--font,"Cairo",sans-serif)'
    ].join(';');
    b.textContent = '⚠️ لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل';
    document.body.prepend(b);
  };
  const hide = () => document.getElementById('_offlineBanner')?.remove();
  if (!navigator.onLine) window.addEventListener('DOMContentLoaded', show);
  window.addEventListener('offline', show);
  window.addEventListener('online',  hide);
})();

// ── Global unhandled rejection logger ────────────────────────────────────
window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled rejection:', e.reason);
});

// ── Varied motivational messages after finishing a task/session ──────────
const RICH_MOTIVATION_BANK = [
  "عاش يا بطل! خطوة جديدة بتقربك من حلمك وهدفك الكبير 🎯",
  "إنجاز عظيم! كل دقيقة تركيز بتعمل فرق حقيقي في مستقبلك ⚡",
  "استمر بنفس الثبات والهدوء، النجاح بيتبني خطوة بخطوة 🧠",
  "فخورين بيك! مفيش تعب بيضيع عند ربنا أبداً ✨",
  "عاش جداً! الراحة بعد الإنجاز ليها طعم تاني خالص ☕",
  "ركّز على تقدمك مش على المثالية.. أنت بتعمل شغل ممتاز 🚀",
  "كل صفحة بتذاكرها وكل مسألة بتحلها بتديك ثقة أكبر في الامتحان 📝",
  "أنت أقوى من أي ضغط وتشتت، عقلك منظم وطاقتك متجددة 🌟",
  "الله ينور عليك! كمل المشوار بهدوء ويقين في النتيجة 💪",
  "إنجازك اليومي الصغير بيعمل معجزة تراكمية مع الوقت 📈",
  "أحسنت! مخك دلوقتي بيرسخ المعلومات في الذاكرة طويلة المدى 💡",
  "التفوق عادة بتصنعها كل يوم بقراراتك الصغيرة دي 🏆",
  "عاش! استمر وخلي عينك دايماً على لحظة الفرحة الكبيرة بالنتيجة 🎓",
  "ممتاز! اللي بيصبر على المذاكرة بيحصد أعلى الدرجات بإذن الله 🌱",
  "طاقتك وإصرارك هما سر قوتك الحقيقي.. كمل يا بطل 🔥",
  "كل خطوة بتنجزها في جدولك هي انتصار شخصي تستاهل تفرح بيه 🎉",
  "تنظيمك لوقتك مع أَثَر هو أول وأهم خطواتك للقمة 👑",
  "أنت قدها وقدود! يوم ورا يوم بتثبت لنفسك إنك تقدر 💎",
  "المعافرة شرف والنتيجة توفيق من ربنا.. استمر بكل طاقتك 🌿",
  "إنجاز رائع! عقلك التاني فخور بتركيزك وانضباطك النهاردة 🧠✨"
];

let _motivationCache = null;
let _lastMotivationIdx = -1;

async function getMotivationalMessage() {
  try {
    if (!_motivationCache) {
      const { data, error } = await withTimeout(sb.from("motivation_messages").select("message"), 4000);
      if (error || !data || data.length === 0) {
        _motivationCache = RICH_MOTIVATION_BANK;
      } else {
        _motivationCache = [...new Set([...data.map((r) => r.message), ...RICH_MOTIVATION_BANK])];
      }
    }
  } catch {
    _motivationCache = RICH_MOTIVATION_BANK;
  }

  let idx;
  do {
    idx = Math.floor(Math.random() * _motivationCache.length);
  } while (idx === _lastMotivationIdx && _motivationCache.length > 1);
  _lastMotivationIdx = idx;
  return _motivationCache[idx];
}

// ── Developer Social Links Modal (صُنع بواسطة) ──
window.openDeveloperSocialModal = function(devName = "سيف الشيخ (Saif_Elsheikh)") {
  document.getElementById("_developerSocialModal")?.remove();

  const socialLinks = [
    {
      name: "واتساب (WhatsApp)",
      icon: "chat",
      color: "bg-emerald-500 hover:bg-emerald-600 text-white",
      url: "https://wa.me/201125655690",
      desc: "01125655690 · محادثة مباشرة"
    },
    {
      name: "فيسبوك (Facebook)",
      icon: "public",
      color: "bg-blue-600 hover:bg-blue-700 text-white",
      url: "https://www.facebook.com",
      desc: "الحساب الشخصي والتواصل"
    },
    {
      name: "انستجرام (Instagram)",
      icon: "photo_camera",
      color: "bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white",
      url: "https://www.instagram.com",
      desc: "متابعة الحساب والأنشطة"
    },
    {
      name: "تليجرام (Telegram)",
      icon: "send",
      color: "bg-sky-500 hover:bg-sky-600 text-white",
      url: "https://t.me",
      desc: "قناة ورسائل الدعم والتطوير"
    }
  ];

  const modal = document.createElement("div");
  modal.id = "_developerSocialModal";
  modal.className = "fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#141d2e] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-outline-variant modal-pop text-center relative">
      <button onclick="document.getElementById('_developerSocialModal').remove()" class="absolute top-4 left-4 w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition">
        <span class="material-symbols-outlined" style="font-size:18px">close</span>
      </button>

      <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 shadow-xs">
        <span class="material-symbols-outlined" style="font-size:32px">verified</span>
      </div>

      <div class="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-extrabold px-3 py-1 rounded-full mb-2">
        <span>مطور ومصمم المنصة 🚀</span>
      </div>

      <h3 class="font-extrabold text-xl text-on-surface mb-1">سيف الشيخ (Saif_Elsheikh)</h3>
      <p class="text-xs sm:text-sm text-on-surface-variant mb-6 leading-relaxed">
        أهلاً بك! منصة <strong>أَثَر</strong> صُممت لمساعدة ودعم طلاب الثانوية العامة في مصر لتحقيق أعلى درجات التفوق والهدوء النفسي.
      </p>

      <div class="space-y-2.5 text-right mb-5">
        ${socialLinks.map(s => `
          <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between p-3 rounded-2xl border border-outline-variant/70 hover:border-primary bg-surface-container-low/50 dark:bg-surface-container-low hover:scale-[1.02] active:scale-[0.98] transition group">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl ${s.color} flex items-center justify-center shrink-0 shadow-xs">
                <span class="material-symbols-outlined" style="font-size:20px">${s.icon}</span>
              </div>
              <div class="truncate">
                <p class="font-bold text-xs sm:text-sm text-on-surface group-hover:text-primary transition truncate">${s.name}</p>
                <p class="text-[11px] text-on-surface-variant truncate">${s.desc}</p>
              </div>
            </div>
            <span class="material-symbols-outlined text-outline group-hover:text-primary transition shrink-0" style="font-size:18px">arrow_back</span>
          </a>
        `).join('')}
      </div>

      <p class="text-[11px] text-outline text-center">أَثَر — نظام التشغيل الأكاديمي للثانوية العامة © 2026</p>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
};

// ── إغلاق القائمة الجانبية تلقائياً على الشاشات الصغيرة (Navigation فوري بدون أي تأخير) ──
(function setupAutoSidebarBehavior() {
  function closeMobileSidebarInstant() {
    const sb = document.getElementById('sidebar') || document.getElementById('mainNavSidebar');
    const overlay = document.getElementById('sidebar-overlay') || document.getElementById('mainNavOverlay');
    if (sb) {
      sb.style.transition = 'none';
      sb.classList.remove('mobile-open');
    }
    if (overlay) overlay.classList.add('hidden');
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth >= 768) return;

    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript') || href.startsWith('mailto') || href.startsWith('tel')) return;
    if (link.target === '_blank') return;

    const sb = document.getElementById('sidebar') || document.getElementById('mainNavSidebar');
    if (!sb || !sb.classList.contains('mobile-open')) return;

    // أغلق القائمة فوراً بدون أي أنيميشن وانتقل للصفحة في نفس اللحظة
    e.preventDefault();
    e.stopPropagation();
    closeMobileSidebarInstant();
    window.location.href = href;

  }, true);

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) return;
    closeMobileSidebarInstant();
  });
})();

// ── إخفاء كارت وروابط تحميل التطبيق تلقائياً لو شغالين داخل تطبيق الموبايل (Capacitor Native) ──
(function checkNativeAppBadge() {
  function applyBadgeVisibility() {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      document.documentElement.classList.add('capacitor-native');
      const badges = document.querySelectorAll('#downloadAppBadge, #landingAppDownload, .app-download-link, .download-app-badge');
      badges.forEach(b => b.style.setProperty('display', 'none', 'important'));
    }
  }
  applyBadgeVisibility();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBadgeVisibility);
  }
})();
