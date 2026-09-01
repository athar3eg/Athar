// ============================================
// أَثَر — Settings Logic (Tailwind & Supabase & Gemini Key)
// ============================================
let me = null;
let currentProfile = null;
let allGeminiKeys = [];

(async function init() {
  try {
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;

    // Load Gemini Settings
    const savedKey = localStorage.getItem('athar_gemini_api_key') || localStorage.getItem('madar_gemini_api_key') || '';
    if (document.getElementById('geminiApiKey')) document.getElementById('geminiApiKey').value = savedKey;

    const profile = await getMyProfile(me.id);
    currentProfile = profile;
    if (profile) {
      if (document.getElementById("wakeTime")) document.getElementById("wakeTime").value = profile.wake_time?.slice(0,5) || "07:00";
      if (document.getElementById("sleepTime")) document.getElementById("sleepTime").value = profile.sleep_time?.slice(0,5) || "23:00";
      if (document.getElementById("energyLevel")) document.getElementById("energyLevel").value = profile.energy_level || "medium";
      if (document.getElementById("sessionMinutes")) document.getElementById("sessionMinutes").value = profile.preferred_session_minutes || 50;

      // Populate Academic Info
      populateAcademicFields(profile);
    }

    await withTimeout(Promise.all([
      loadSubjects(),
      loadTeachers(),
      loadGeminiKeys()
    ]), 12000);
  } catch (err) {
    console.error("Settings init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

// ---------- Gemini API Key Handlers ----------
function toggleApiKeyVisibility() {
  const input = document.getElementById("geminiApiKey");
  const icon = document.getElementById("keyVisIcon");
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    if (icon) icon.textContent = "visibility_off";
  } else {
    input.type = "password";
    if (icon) icon.textContent = "visibility";
  }
}

function saveGeminiSettings() {
  const key = document.getElementById('geminiApiKey').value.trim();
  localStorage.setItem('athar_gemini_api_key', key);
  localStorage.setItem('athar_gemini_model', 'gemini-1.5-flash');
  showToast(key ? 'تم حفظ مفتاح Gemini بنجاح 🧠' : 'تم مسح المفتاح والرجوع للوضع الافتراضي');
}

async function testGeminiKey() {
  const key = document.getElementById("geminiApiKey").value.trim();
  const resultEl = document.getElementById("keyTestResult");
  const btn = document.getElementById("testKeyBtn");

  if (!key) {
    resultEl.className = "text-xs p-2.5 rounded-lg font-medium bg-error-container text-on-error-container block";
    resultEl.textContent = "يرجى كتابة المفتاح أولاً لاختباره.";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin material-symbols-outlined" style="font-size:16px">progress_activity</span> جاري استكشاف أحدث النماذج واختبار المفتاح...`;
  resultEl.className = "hidden";

  try {
    const startTime = Date.now();

    const listRes = await withTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`), 10000);
    const listJson = await listRes.json();

    if (!listRes.ok || !listJson.models || listJson.models.length === 0) {
      throw new Error(listJson.error?.message || "المفتاح غير صالح أو لم يتم تفعيل Google AI Studio عليه.");
    }

    let supported = listJson.models
      .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
      .map(m => m.name.replace("models/", ""));

    supported.sort((a, b) => {
      const isFlashA = a.includes("flash") ? 1 : 0;
      const isFlashB = b.includes("flash") ? 1 : 0;
      if (isFlashA !== isFlashB) return isFlashB - isFlashA;
      return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
    });

    const priorityCandidates = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      ...supported
    ];

    const candidateModels = Array.from(new Set(priorityCandidates.filter(m => supported.includes(m) || m.includes("flash"))));

    let workingModel = null;
    let lastError = null;

    for (const modelToTry of candidateModels) {
      try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${key}`;
        const testRes = await withTimeout(fetch(testUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "جاهز" }] }]
          })
        }), 8000);

        const testJson = await testRes.json();

        if (testRes.ok && testJson.candidates && testJson.candidates.length > 0) {
          workingModel = modelToTry;
          break;
        } else if (testJson.error?.message) {
          lastError = testJson.error.message;
          const match = testJson.error.message.match(/models\/([a-zA-Z0-9\.\-_]+)/);
          if (match && match[1] && !candidateModels.includes(match[1])) {
            candidateModels.push(match[1]);
          }
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!workingModel) {
      throw new Error(lastError || "لم نتمكن من العثور على نموذج نشط متاح لحسابك.");
    }

    const duration = Date.now() - startTime;
    localStorage.setItem('athar_gemini_api_key', key);
    localStorage.setItem('athar_gemini_model', workingModel);

    resultEl.className = "text-xs p-2.5 rounded-lg font-medium bg-secondary-container text-on-secondary-container block";
    resultEl.textContent = `✅ تم فحص المفتاح بنجاح! النموذج المعتمد: (${workingModel}) — زمن الاستجابة: ${duration}ms`;
    showToast("تم تفعيل العقل الثاني بنجاح 🧠");

  } catch (err) {
    console.error("Gemini key test error:", err);
    resultEl.className = "text-xs p-2.5 rounded-lg font-medium bg-error-container text-on-error-container block";
    resultEl.textContent = `❌ فشل الاختبار: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px">verified</span> اختبار المفتاح`;
  }
}

// ---------- Multi-Gemini Keys Management (1.8) ----------
async function loadGeminiKeys() {
  const container = document.getElementById("geminiKeysList");
  if (!container) return;

  try {
    const { data, error } = await sb.from("gemini_api_keys")
      .select("*")
      .eq("user_id", me.id)
      .order("priority", { ascending: true });

    if (error) throw error;
    allGeminiKeys = data || [];

    if (allGeminiKeys.length === 0) {
      container.innerHTML = `
        <div class="border border-dashed border-outline-variant rounded-xl p-4 text-center text-xs text-on-surface-variant">
          لم تقم بإضافة توكنز احتياطية بعد. أضف توكنز لتفادي توقف المحادثات عند نفاد الحد اليومي.
        </div>`;
      return;
    }

    container.innerHTML = allGeminiKeys.map((k, index) => {
      const masked = k.api_key ? (k.api_key.slice(0, 7) + "..." + k.api_key.slice(-4)) : "—";
      const statusBadge = k.is_exhausted
        ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-error-container text-on-error-container">منتهي 🔴</span>`
        : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">نشط 🟢</span>`;

      return `
        <div class="flex items-center justify-between p-3 rounded-xl border border-outline-variant hover:bg-surface-container-low transition">
          <div class="flex items-center gap-3 min-w-0">
            <span class="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center text-xs font-mono font-bold shrink-0">${index + 1}</span>
            <div class="min-w-0">
              <p class="font-bold text-xs text-on-surface truncate">${escapeHtml(k.label || "توكن Gemini")}</p>
              <p class="text-[11px] font-mono text-on-surface-variant mt-0.5">${masked}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="moveKeyPriority('${k.id}', -1)" ${index === 0 ? 'disabled class="opacity-30 p-1"' : 'class="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"'} title="رفع الأولوية">
              <span class="material-symbols-outlined" style="font-size:18px">arrow_upward</span>
            </button>
            <button onclick="moveKeyPriority('${k.id}', 1)" ${index === allGeminiKeys.length - 1 ? 'disabled class="opacity-30 p-1"' : 'class="p-1 hover:bg-surface-container-high rounded text-on-surface-variant"'} title="خفض الأولوية">
              <span class="material-symbols-outlined" style="font-size:18px">arrow_downward</span>
            </button>
            <button onclick="deleteGeminiKey('${k.id}')" class="p-1.5 rounded-lg hover:bg-error-container text-error transition" title="حذف">
              <span class="material-symbols-outlined" style="font-size:18px">delete</span>
            </button>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error("loadGeminiKeys error:", err);
    container.innerHTML = `<div class="text-xs text-error text-center py-2">تعذر جلب التوكنز: ${escapeHtml(err.message)}</div>`;
  }
}

function openAddKeyModal() {
  const modal = document.getElementById("addKeyModal");
  if (modal) modal.classList.remove("hidden");
}

function closeAddKeyModal() {
  const modal = document.getElementById("addKeyModal");
  if (modal) modal.classList.add("hidden");
}

async function addGeminiKey() {
  const keyInput = document.getElementById("newKeyVal");
  const labelInput = document.getElementById("newKeyLabel");
  const key = keyInput?.value.trim();
  const label = labelInput?.value.trim() || "توكن احتياطي";

  if (!key) {
    showToast("يرجى إدخال مفتاح API");
    return;
  }

  const btn = document.getElementById("saveNewKeyBtn");
  if (btn) { btn.disabled = true; btn.textContent = "جاري الإضافة..."; }

  try {
    const nextPriority = (allGeminiKeys.length > 0 ? Math.max(...allGeminiKeys.map(k => k.priority || 0)) : 0) + 1;
    const { error } = await sb.from("gemini_api_keys").insert({
      user_id: me.id,
      api_key: key,
      label,
      priority: nextPriority,
      is_exhausted: false
    });

    if (error) throw error;
    showToast("تمت إضافة التوكن بنجاح ✓");
    closeAddKeyModal();
    if (keyInput) keyInput.value = "";
    if (labelInput) labelInput.value = "";
    await loadGeminiKeys();
  } catch (err) {
    console.error("addGeminiKey error:", err);
    showToast("حدث خطأ أثناء إضافة التوكن: " + (err.message || ""));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "حفظ التوكن"; }
  }
}

async function deleteGeminiKey(id) {
  showConfirmModal("هل أنت متأكد من حذف هذا التوكن؟", async () => {
    const { error } = await sb.from("gemini_api_keys").delete().eq("id", id);
    if (error) { showToast("تعذر حذف التوكن"); return; }
    showToast("تم حذف التوكن");
    await loadGeminiKeys();
  });
}

async function moveKeyPriority(id, direction) {
  const idx = allGeminiKeys.findIndex(k => k.id === id);
  if (idx === -1) return;
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= allGeminiKeys.length) return;

  const currentKey = allGeminiKeys[idx];
  const targetKey = allGeminiKeys[targetIdx];

  const tempP = currentKey.priority;
  currentKey.priority = targetKey.priority;
  targetKey.priority = tempP;

  await Promise.all([
    sb.from("gemini_api_keys").update({ priority: currentKey.priority }).eq("id", currentKey.id),
    sb.from("gemini_api_keys").update({ priority: targetKey.priority }).eq("id", targetKey.id)
  ]);

  await loadGeminiKeys();
}

// ---------- Academic Profile Management (1.7.4) ----------
function populateAcademicFields(profile) {
  const stageSelect = document.getElementById("academicStage");
  const trackContainer = document.getElementById("academicTrackContainer");
  const trackSelect = document.getElementById("academicTrack");
  const phoneInput = document.getElementById("academicPhone");

  if (phoneInput && profile.phone) phoneInput.value = profile.phone;
  if (stageSelect && profile.stage) {
    stageSelect.value = profile.stage;
    onStageSelectChange(profile.stage);
  }
  if (trackSelect && profile.track) {
    trackSelect.value = profile.track;
  }
}

function onStageSelectChange(stageVal) {
  const trackContainer = document.getElementById("academicTrackContainer");
  if (!trackContainer) return;
  if (stageVal === "second_secondary" || stageVal === "third_secondary") {
    trackContainer.classList.remove("hidden");
  } else {
    trackContainer.classList.add("hidden");
  }
}

async function saveAcademicProfile() {
  const stage = document.getElementById("academicStage")?.value || null;
  const trackSelect = document.getElementById("academicTrack");
  const phone = document.getElementById("academicPhone")?.value.trim() || null;

  let track = null;
  if (stage === "second_secondary" || stage === "third_secondary") {
    track = trackSelect?.value || null;
  }

  // Validate phone if provided
  if (phone && !/^01[0-2,5]{1}[0-9]{8}$/.test(phone)) {
    showToast("رقم الهاتف غير صحيح (يجب أن يبدأ بـ 01 ويتكون من 11 رقماً)");
    return;
  }

  const btn = document.getElementById("saveAcademicBtn");
  if (btn) { btn.disabled = true; btn.textContent = "جاري الحفظ..."; }

  try {
    const { error } = await sb.from("profiles").update({
      stage,
      track,
      phone,
      updated_at: new Date().toISOString()
    }).eq("id", me.id);

    if (error) throw error;
    showToast("تم تحديث البيانات الدراسية بنجاح ✓");
  } catch (err) {
    console.error("saveAcademicProfile error:", err);
    showToast("حدث خطأ أثناء حفظ البيانات: " + (err.message || ""));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "حفظ البيانات الدراسية"; }
  }
}

// ---------- Password Change (1.7.3) ----------
async function changePassword() {
  const currentPassword = document.getElementById("currentPassword")?.value || "";
  const newPassword = document.getElementById("newPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";

  if (!currentPassword) {
    showToast("يرجى إدخال كلمة السر الحالية");
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    showToast("كلمة السر الجديدة يجب أن تكون 8 أحرف على الأقل");
    return;
  }
  if (newPassword !== confirmPassword) {
    showToast("تأكيد كلمة السر لا يطابق كلمة السر الجديدة");
    return;
  }

  const btn = document.getElementById("changePasswordBtn");
  if (btn) { btn.disabled = true; btn.textContent = "جاري التحقق والتغيير..."; }

  try {
    // 1. Verify current password
    const { data: { user } } = await sb.auth.getUser();
    if (!user || !user.email) throw new Error("تعذر جلب بيانات المستخدم");

    const { error: verifyError } = await sb.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (verifyError) {
      showToast("كلمة السر الحالية غير صحيحة");
      return;
    }

    // 2. Update to new password
    const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;

    showToast("تم تغيير كلمة السر بنجاح 🎉");
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  } catch (err) {
    console.error("changePassword error:", err);
    showToast("حدث خطأ: " + (err.message || ""));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "تحديث كلمة السر"; }
  }
}

// ---------- Profile Routine ----------
async function saveProfile() {
  const btn = document.getElementById("saveProfileBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const wake_time = document.getElementById("wakeTime").value;
    const sleep_time = document.getElementById("sleepTime").value;
    const energy_level = document.getElementById("energyLevel").value;
    const preferred_session_minutes = parseInt(document.getElementById("sessionMinutes").value) || 50;

    const { error } = await withTimeout(sb.from("profiles").update({
      wake_time,
      sleep_time,
      energy_level,
      preferred_session_minutes,
      updated_at: new Date().toISOString()
    }).eq("id", me.id));

    if (error) throw error;
    showToast("تم حفظ التعديلات بنجاح ✓");
  } catch (err) {
    console.error("Save profile error:", err);
    showToast(err.message || "حصل خطأ أثناء الحفظ");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ تغييرات الروتين";
  }
}

// ---------- Subjects ----------
async function loadSubjects() {
  const listEl = document.getElementById("subjectsList");
  const { data, error } = await sb.from("subjects").select("*").eq("user_id", me.id).order("priority");

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="border border-dashed border-outline-variant rounded-xl p-4 text-center text-xs text-on-surface-variant">لم تقم بإضافة أي مواد بعد</div>`;
    return;
  }

  const priorityMap = { 1: "أولوية عالية 🔴", 2: "أولوية متوسطة 🟡", 3: "أولوية عادية 🟢" };
  const difficultyMap = { hard: "صعبة 😰", medium: "متوسطة 🙂", easy: "سهلة 😌" };

  listEl.innerHTML = data.map(s => `
    <div class="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant hover:bg-surface-container-low transition">
      <div class="flex items-center gap-3">
        <span class="w-3.5 h-3.5 rounded-full" style="background:${s.color || "#0077cc"}"></span>
        <div>
          <p class="font-bold text-sm text-on-surface">${escapeHtml(s.name)}</p>
          <span class="text-xs text-on-surface-variant font-medium">${priorityMap[s.priority] || "عادية"} · ${difficultyMap[s.difficulty] || difficultyMap.medium}</span>
        </div>
      </div>
      <button onclick="deleteSubject('${s.id}')" class="p-1.5 rounded-lg hover:bg-error-container text-error transition" title="حذف">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>
      </button>
    </div>`).join("");
}

function openSubjectModal() { document.getElementById("subjectModal").classList.remove("hidden"); }
function closeSubjectModal() { document.getElementById("subjectModal").classList.add("hidden"); }

async function saveSubject() {
  const name = document.getElementById("newSubjectName").value.trim();
  if (!name) { showToast("اكتب اسم المادة"); return; }

  const priority = parseInt(document.getElementById("newSubjectPriority").value) || 2;
  const difficulty = document.getElementById("newSubjectDifficulty")?.value || "medium";
  const colors = ["#0077CC", "#00875F", "#A15C00", "#7C3AED", "#DB2777", "#D97706", "#2563EB"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const btn = document.getElementById("saveSubjectBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const { error } = await withTimeout(sb.from("subjects").insert({
      user_id: me.id,
      name,
      priority,
      difficulty,
      color,
      mastery_percentage: 50,
      risk_level: "stable"
    }));

    if (error) throw error;
    showToast("تمت إضافة المادة بنجاح ✓");
    closeSubjectModal();
    document.getElementById("newSubjectName").value = "";
    await loadSubjects();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حدث خطأ أثناء إضافة المادة");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ";
  }
}

async function deleteSubject(id) {
  showConfirmModal("هل أنت متأكد من حذف هذه المادة؟ سيتم حذف مهامها المرتبطة.", async () => {
    await sb.from("subjects").delete().eq("id", id);
    showToast("تم حذف المادة");
    await loadSubjects();
  });
}

// ---------- Teachers ----------
async function loadTeachers() {
  const listEl = document.getElementById("teachersList");
  const { data, error } = await sb.from("teachers").select("*, subjects(name)").eq("user_id", me.id);

  if (error || !data || data.length === 0) {
    listEl.innerHTML = `<div class="border border-dashed border-outline-variant rounded-xl p-4 text-center text-xs text-on-surface-variant">لم تقم بإضافة مدرسين بعد</div>`;
    return;
  }

  listEl.innerHTML = data.map(t => `
    <div class="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant hover:bg-surface-container-low transition">
      <div>
        <p class="font-bold text-sm text-on-surface">${escapeHtml(t.name)}</p>
        <p class="text-xs text-on-surface-variant mt-0.5">${escapeHtml(t.subjects?.name || "بدون مادة")} ${t.channel_url ? `· <a href="${t.channel_url}" target="_blank" class="text-primary hover:underline">القناة ↗</a>` : ""}</p>
      </div>
      <button onclick="deleteTeacher('${t.id}')" class="p-1.5 rounded-lg hover:bg-error-container text-error transition" title="حذف">
        <span class="material-symbols-outlined" style="font-size:18px">delete</span>
      </button>
    </div>`).join("");
}

async function openTeacherModal() {
  const { data } = await sb.from("subjects").select("*").eq("user_id", me.id);
  const select = document.getElementById("newTeacherSubject");
  if (data && data.length) {
    select.innerHTML = data.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  } else {
    select.innerHTML = `<option value="">بدون مادة</option>`;
  }
  document.getElementById("teacherModal").classList.remove("hidden");
}
function closeTeacherModal() { document.getElementById("teacherModal").classList.add("hidden"); }

async function saveTeacher() {
  const name = document.getElementById("newTeacherName").value.trim();
  if (!name) { showToast("اكتب اسم المدرس"); return; }

  const subject_id = document.getElementById("newTeacherSubject").value || null;
  const channel_url = document.getElementById("newTeacherUrl").value.trim() || null;

  const btn = document.getElementById("saveTeacherBtn");
  btn.disabled = true; btn.textContent = "جاري الحفظ...";

  try {
    const { error } = await withTimeout(sb.from("teachers").insert({
      user_id: me.id,
      name,
      subject_id,
      channel_url
    }));

    if (error) throw error;
    showToast("تمت إضافة المدرس بنجاح ✓");
    closeTeacherModal();
    document.getElementById("newTeacherName").value = "";
    document.getElementById("newTeacherUrl").value = "";
    await loadTeachers();
  } catch (err) {
    console.error(err);
    showToast(err.message || "حدث خطأ أثناء إضافة المدرس");
  } finally {
    btn.disabled = false; btn.textContent = "حفظ";
  }
}

async function deleteTeacher(id) {
  showConfirmModal("هل أنت متأكد من حذف هذا المدرس؟", async () => {
    await sb.from("teachers").delete().eq("id", id);
    showToast("تم حذف المدرس");
    await loadTeachers();
  });
}
