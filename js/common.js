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
// بتتجاب من جدول مشترك واحد في قاعدة البيانات (مش مكررة لكل مستخدم)،
// وبتتخزن (cache) في الذاكرة بعد أول تحميل عشان ما تتكررش الرحلة لقاعدة
// البيانات كل مرة تخلص فيها مهمة.
let _motivationCache = null;
let _lastMotivationIdx = -1;

async function getMotivationalMessage() {
  const fallback = ["أحسنت! تم الإنجاز بنجاح 🎉", "تمام كده، كمّل بنفس الروح 🔥"];
  try {
    if (!_motivationCache) {
      const { data, error } = await withTimeout(sb.from("motivation_messages").select("message"), 6000);
      if (error || !data || data.length === 0) _motivationCache = fallback;
      else _motivationCache = data.map(r => r.message);
    }
  } catch {
    _motivationCache = fallback;
  }

  let idx;
  do {
    idx = Math.floor(Math.random() * _motivationCache.length);
  } while (idx === _lastMotivationIdx && _motivationCache.length > 1);
  _lastMotivationIdx = idx;
  return _motivationCache[idx];
}

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
