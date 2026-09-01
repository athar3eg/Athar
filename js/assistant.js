// ================================================================
// مِدار — Assistant Controller v2
// Features: Session History, Voice Input, Stop Generation,
//           Edit Messages, Rich Rendering, Full Responsive
// ================================================================

// ─── State ────────────────────────────────────────────────────────
let me = null;
let geminiAgent = null;
let conversationHistory = [];    // In-memory buffer for current session
let currentSessionId = null;     // UUID for grouping messages
let isGenerating = false;
let abortController = null;
let recognition = null;
let isListening = false;
let allSessions = [];            // [{sessionId, preview, date}]

// ─── Toast ────────────────────────────────────────────────────────
const toast = document.getElementById("toast");
function showToast(msg, duration = 2400) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove("translate-y-24", "opacity-0");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add("translate-y-24", "opacity-0"), duration);
}

// ─── Utils ────────────────────────────────────────────────────────
function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function scrollToBottom(smooth = true) {
  const el = document.getElementById("chatScrollArea");
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function autoResizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 144) + "px";
}

// ─── Auth ─────────────────────────────────────────────────────────
async function logout() {
  await sb.auth.signOut();
  location.href = "index.html";
}

// ─── Init ─────────────────────────────────────────────────────────
(async function init() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { location.href = "index.html"; return; }
    me = session.user;

    if (typeof GeminiAgent === "undefined") {
      showToast("⚠️ لم يتحمل محرك الذكاء. حدّث الصفحة.");
      return;
    }
    geminiAgent = new GeminiAgent(sb);

    const hasKey = !!(localStorage.getItem('athar_gemini_api_key') || localStorage.getItem('madar_gemini_api_key'));
    const modelName = localStorage.getItem('athar_gemini_model') || localStorage.getItem('madar_gemini_model') || '';
    const badge = document.getElementById("agentBadge");
    const statusText = document.getElementById("agentStatusText");
    if (badge) badge.textContent = hasKey ? `${modelName} ⚡` : "وضع افتراضي";
    if (statusText && hasKey) statusText.textContent = `تحكم كامل عبر ${modelName}`;

    // Load all sessions from Supabase
    await loadAllSessions();

    // Start with a fresh session
    newSession();

  } catch (err) {
    console.error("init error:", err);
    showToast("حصل خطأ في التحميل: " + err.message);
  }
})();

// ─── Session Management ───────────────────────────────────────────
function newSession() {
  currentSessionId = genId();
  conversationHistory = [];
  document.getElementById("messages").innerHTML = "";
  document.getElementById("suggestions").style.display = "";
}

async function startNewChat() {
  newSession();
  scrollToBottom(false);
  document.getElementById("chatInput").focus();
}

async function loadAllSessions() {
  // Get distinct sessions from Supabase grouped by session_id stored in content JSON
  // We store messages as plain text, so we group by day from created_at
  const { data, error } = await sb
    .from("ai_conversations")
    .select("id, role, content, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) return;

  // Group messages into day-based sessions
  const byDay = {};
  data.forEach(msg => {
    const day = msg.created_at?.slice(0, 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(msg);
  });

  allSessions = Object.entries(byDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, msgs]) => {
      const firstUser = msgs.find(m => m.role === "user");
      return {
        date,
        preview: firstUser ? firstUser.content.slice(0, 50) : "محادثة",
        msgs
      };
    });

  renderSessionsList();
}

function renderSessionsList() {
  const container = document.getElementById("sessionsList");
  if (!container) return;

  if (allSessions.length === 0) {
    container.innerHTML = `<p class="text-xs text-on-surface-variant text-center py-4">لا توجد محادثات سابقة</p>`;
    return;
  }

  container.innerHTML = allSessions.map((session, i) => `
    <button onclick="loadSession(${i})" style="animation-delay:${i * 40}ms" class="session-pop-in w-full text-right px-3 py-2 rounded-xl hover:bg-surface-container-low transition group flex items-center gap-2">
      <span class="material-symbols-outlined text-outline group-hover:text-primary transition" style="font-size:17px">chat_bubble</span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-on-surface truncate">${escapeHtml(session.preview)}</p>
        <p class="text-[10px] text-outline">${formatRelativeDate(session.date)}</p>
      </div>
    </button>
  `).join("");
}

async function loadSession(index) {
  const session = allSessions[index];
  if (!session) return;

  newSession();
  document.getElementById("suggestions").style.display = "none";

  const wrap = document.getElementById("messages");
  conversationHistory = [];

  // Render messages in chronological order
  [...session.msgs].reverse().forEach(msg => {
    wrap.insertAdjacentHTML("beforeend", renderMessageBubble(msg.role, msg.content, {}, true));
    conversationHistory.push({ role: msg.role, content: msg.content });
  });

  scrollToBottom(false);
  if (window.innerWidth < 768) toggleHistorySidebar();
}

async function clearChatHistory() {
  if (!confirm("هل أنت متأكد من مسح جميع المحادثات السابقة؟")) return;
  const { error } = await sb.from("ai_conversations").delete().eq("user_id", me.id);
  if (error) {
    showToast("فشل مسح المحادثات: " + error.message);
    return;
  }
  allSessions = [];
  renderSessionsList();
  startNewChat();
  showToast("تم مسح سجل المحادثات بنجاح 🗑️");
}

function formatRelativeDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today - d) / 86400000);
  if (diff === 0) return "اليوم";
  if (diff === 1) return "أمس";
  if (diff < 7) return `منذ ${diff} أيام`;
  return d.toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
}

// ─── Markdown Renderer ────────────────────────────────────────────
function formatMarkdown(text) {
  if (!text) return "";
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code class="bg-surface-container-high px-1 py-0.5 rounded text-xs font-mono text-primary">$1</code>');
  s = s.replace(/^###\s+(.*)$/gm, '<p class="font-bold text-sm mt-3 mb-1 text-primary">$1</p>');
  s = s.replace(/^##\s+(.*)$/gm, '<p class="font-bold text-base mt-4 mb-2 text-primary">$1</p>');
  s = s.replace(/^\s*[-•]\s+(.+)$/gm, '<li class="mr-4 list-disc leading-relaxed">$1</li>');
  s = s.replace(/(<li[^>]*>[\s\S]+?<\/li>)+/g, m => `<ul class="space-y-1 my-2">${m}</ul>`);
  s = s.replace(/\n/g, '<br/>');
  return s;
}

// ─── Message Bubble Renderer ──────────────────────────────────────
function renderMessageBubble(role, content, extras = {}, fromHistory = false) {
  const isUser = role === "user";
  const msgId = "msg-" + genId();
  const { actions = [], youtubeCards = [], interactiveQuiz = null } = extras;

  let extrasHtml = "";

  // Action badges
  if (actions.length > 0) {
    extrasHtml += `<div class="space-y-1.5 mt-3 pt-3 border-t border-outline-variant/50">
      ${actions.map(a => `
        <div class="flex items-center gap-2 p-2 rounded-xl bg-secondary-container/50 text-on-secondary-container text-xs font-semibold">
          <span class="material-symbols-outlined text-secondary" style="font-size:16px;font-variation-settings:'FILL' 1">check_circle</span>
          <span>${escapeHtml(a.message)}</span>
        </div>`).join("")}
    </div>`;
  }

  // YouTube cards
  if (youtubeCards.length > 0) {
    extrasHtml += `<div class="space-y-2 mt-3 pt-3 border-t border-outline-variant/50">
      <p class="text-[11px] font-bold text-on-surface-variant flex items-center gap-1">
        <span class="material-symbols-outlined text-error" style="font-size:15px;font-variation-settings:'FILL' 1">smart_display</span> شروحات مقترحة:
      </p>
      ${youtubeCards.map(yt => `
        <a href="${yt.searchUrl}" target="_blank" rel="noopener" class="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant hover:border-error/50 hover:bg-error-container/10 transition group">
          <div class="w-10 h-10 rounded-lg bg-error text-white flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined" style="font-size:22px;font-variation-settings:'FILL' 1">play_arrow</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-xs text-on-surface group-hover:text-error transition truncate">${escapeHtml(yt.query)}</p>
            <p class="text-[11px] text-on-surface-variant">${escapeHtml(yt.subject || "ثانوية عامة")} · يوتيوب</p>
          </div>
          <span class="text-error shrink-0"><span class="material-symbols-outlined" style="font-size:18px">open_in_new</span></span>
        </a>`).join("")}
    </div>`;
  }

  // Interactive Quiz
  if (interactiveQuiz?.questions?.length > 0) {
    const qzId = "qz-" + genId();
    extrasHtml += `
      <div class="mt-4 rounded-2xl bg-surface-container-low border border-outline-variant overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-outline-variant bg-primary-container/40">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary" style="font-size:18px;font-variation-settings:'FILL' 1">quiz</span>
            <span class="font-bold text-sm text-on-surface">${escapeHtml(interactiveQuiz.quiz_title || "اختبار تفاعلي")}</span>
          </div>
          <span class="text-[11px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">${interactiveQuiz.questions.length} أسئلة</span>
        </div>
        <div class="p-3 space-y-3">
          ${interactiveQuiz.questions.map((q, qi) => {
            const qid = `${qzId}-q${qi}`;
            return `
              <div class="p-3 bg-white dm-bg-3 rounded-xl border border-outline-variant/60">
                <p class="text-xs font-bold mb-2 leading-relaxed">
                  <span class="text-primary font-bold">${qi + 1}.</span> ${escapeHtml(q.question)}
                </p>
                <div class="space-y-1.5">
                  ${q.options.map((opt, oi) => `
                    <button type="button" onclick="handleQuizAnswer('${qid}',${oi},${q.correct_index},${JSON.stringify(escapeHtml(q.explanation)).replace(/"/g, '&quot;')})"
                      class="quiz-opt-${qid} w-full text-right px-3 py-2 rounded-lg border border-outline-variant text-xs font-medium hover:bg-primary-container/30 hover:border-primary/40 transition flex items-center gap-2">
                      <span class="w-5 h-5 rounded-full border border-outline-variant flex items-center justify-center text-[10px] font-bold shrink-0">${['أ','ب','ج','د'][oi]||oi+1}</span>
                      <span>${escapeHtml(opt)}</span>
                    </button>`).join("")}
                </div>
                <div id="expl-${qid}" class="hidden mt-2 p-2 rounded-lg text-xs font-medium leading-relaxed"></div>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  const bubbleContent = isUser
    ? escapeHtml(content).replace(/\n/g, "<br/>")
    : formatMarkdown(content);

  // Edit controls for user messages
  const editControls = isUser && !fromHistory ? `
    <div class="flex items-center gap-1 mt-1 justify-end opacity-0 group-hover:opacity-100 transition">
      <button onclick="editMessage('${msgId}')" class="text-[11px] text-outline hover:text-primary flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg hover:bg-primary-container transition">
        <span class="material-symbols-outlined" style="font-size:13px">edit</span> تعديل
      </button>
    </div>` : "";

  return `
    <div id="${msgId}" class="flex items-start gap-3 ${isUser ? "flex-row-reverse self-end" : "flex-row self-start"} group ${isUser ? "msg-in-user" : "msg-in-ai"} max-w-[92%] sm:max-w-[85%] 2xl:max-w-[80%]">
      <!-- Avatar -->
      <div class="w-8 h-8 rounded-full ${isUser ? "bg-primary-container text-primary" : "bg-primary text-white"} flex items-center justify-center shrink-0 mt-1 shadow-xs">
        <span class="material-symbols-outlined" style="font-size:18px;font-variation-settings:'FILL' 1">${isUser ? "person" : "psychology"}</span>
      </div>

      <!-- Bubble + edit -->
      <div class="${isUser ? "items-end" : "items-start"} flex flex-col min-w-0">
        <div class="p-4 text-sm leading-relaxed shadow-sm ${isUser
          ? "bg-primary text-white rounded-2xl rounded-tr-xs font-medium"
          : "bg-white dark:bg-[#141d2e] border border-outline-variant text-on-surface rounded-2xl rounded-tl-xs w-full"
        }">
          <div id="${msgId}-content" class="leading-relaxed">${bubbleContent}</div>
          ${extrasHtml}
        </div>
        ${editControls}
      </div>
    </div>`;
}

// ─── Quiz Answer Handler ──────────────────────────────────────────
window.handleQuizAnswer = function(qId, selectedIdx, correctIdx, explanation) {
  document.querySelectorAll(`.quiz-opt-${qId}`).forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIdx) {
      btn.className = "quiz-opt-" + qId + " w-full text-right px-3 py-2 rounded-lg border-2 border-secondary bg-secondary-container text-on-secondary-container text-xs font-bold flex items-center gap-2";
    } else if (i === selectedIdx) {
      btn.className = "quiz-opt-" + qId + " w-full text-right px-3 py-2 rounded-lg border-2 border-error bg-error-container text-on-error-container text-xs font-bold flex items-center gap-2";
    } else {
      btn.className = "quiz-opt-" + qId + " w-full text-right px-3 py-2 rounded-lg border border-outline-variant text-xs opacity-40 flex items-center gap-2";
    }
  });
  const explEl = document.getElementById("expl-" + qId);
  if (explEl) {
    const ok = selectedIdx === correctIdx;
    explEl.className = `mt-2 p-2 rounded-lg text-xs font-medium leading-relaxed ${ok ? "bg-secondary-container text-on-secondary-container" : "bg-error-container text-on-error-container"}`;
    explEl.innerHTML = ok
      ? `✅ <strong>إجابة صحيحة!</strong> ${explanation || ""}`
      : `💡 <strong>الإجابة الصحيحة: (${['أ','ب','ج','د'][correctIdx]})</strong> ${explanation || ""}`;
    explEl.classList.remove("hidden");
  }
};

// ─── Edit Message ─────────────────────────────────────────────────
window.editMessage = function(msgId) {
  const contentEl = document.getElementById(msgId + "-content");
  if (!contentEl) return;
  const originalText = contentEl.innerText.trim();

  contentEl.innerHTML = `
    <textarea class="edit-textarea w-full bg-transparent text-white text-sm outline-none resize-none border-b border-white/40 pb-1 leading-relaxed" id="edit-${msgId}">${escapeHtml(originalText)}</textarea>
    <div class="flex gap-2 mt-2 justify-end">
      <button onclick="cancelEdit('${msgId}','${encodeURIComponent(originalText)}')" class="text-[11px] px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition">إلغاء</button>
      <button onclick="submitEdit('${msgId}')" class="text-[11px] px-2 py-1 rounded-lg bg-white/30 hover:bg-white/40 transition font-bold">إرسال ✓</button>
    </div>`;

  const ta = document.getElementById("edit-" + msgId);
  autoResizeTextarea(ta);
  ta.focus();
  ta.addEventListener("input", () => autoResizeTextarea(ta));
};

window.cancelEdit = function(msgId, encodedText) {
  const contentEl = document.getElementById(msgId + "-content");
  if (contentEl) contentEl.innerHTML = decodeURIComponent(encodedText).replace(/\n/g, "<br/>");
};

window.submitEdit = async function(msgId) {
  const ta = document.getElementById("edit-" + msgId);
  if (!ta) return;
  const newText = ta.value.trim();
  if (!newText) return;

  // Remove the edited message and all subsequent messages
  const msgEl = document.getElementById(msgId);
  if (msgEl) {
    // Remove all siblings after this one
    let next = msgEl.nextElementSibling;
    while (next) { const n = next.nextElementSibling; next.remove(); next = n; }
    msgEl.remove();
  }

  // Trim history up to that message
  const historyIdx = conversationHistory.findIndex(m => m.role === "user");
  if (historyIdx >= 0) conversationHistory = conversationHistory.slice(0, historyIdx);

  // Inject new message
  const input = document.getElementById("chatInput");
  if (input) {
    input.value = newText;
    document.getElementById("chatForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }
};

// ─── Voice Input ──────────────────────────────────────────────────
function toggleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast("⚠️ متصفحك لا يدعم الإدخال الصوتي. استخدم Chrome أو Edge.");
    return;
  }

  if (isListening) {
    recognition?.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ar-EG";
  recognition.continuous = false;
  recognition.interimResults = true;

  const voiceBtn = document.getElementById("voiceBtn");
  const voiceIcon = document.getElementById("voiceIcon");
  const input = document.getElementById("chatInput");

  recognition.onstart = () => {
    isListening = true;
    voiceBtn.classList.add("mic-active", "text-error", "bg-error-container");
    voiceIcon.textContent = "mic_off";
    showToast("🎙️ جارٍ الاستماع... تكلم الآن");
  };

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
    input.value = transcript;
    autoResizeTextarea(input);
  };

  recognition.onend = () => {
    isListening = false;
    voiceBtn.classList.remove("mic-active", "text-error", "bg-error-container");
    voiceIcon.textContent = "mic";
    if (input.value.trim()) {
      document.getElementById("chatForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
  };

  recognition.onerror = (e) => {
    isListening = false;
    voiceBtn.classList.remove("mic-active", "text-error", "bg-error-container");
    voiceIcon.textContent = "mic";
    showToast("خطأ في الميكروفون: " + e.error);
  };

  recognition.start();
}

// ─── Stop Generation ──────────────────────────────────────────────
function stopGeneration() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  setGenerating(false);
  showToast("⏹️ تم إيقاف الرد");
}

function setGenerating(state) {
  isGenerating = state;
  const sendBtn = document.getElementById("sendBtn");
  const stopBtn = document.getElementById("stopBtn");
  const input = document.getElementById("chatInput");
  if (sendBtn) sendBtn.disabled = state;
  if (stopBtn) stopBtn.classList.toggle("hidden", !state);
  if (input) input.disabled = state;
}

// ─── Typing Indicator ─────────────────────────────────────────────
function showTypingIndicator() {
  const id = "typing-" + genId();
  const wrap = document.getElementById("messages");
  wrap.insertAdjacentHTML("beforeend", `
    <div id="${id}" class="flex items-end gap-2 fade-in">
      <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
        <span class="material-symbols-outlined text-white" style="font-size:17px;font-variation-settings:'FILL' 1">psychology</span>
      </div>
      <div class="bg-white dm-bg-3 border border-outline-variant p-4 msg-ai shadow-sm">
        <div class="flex items-center gap-3">
          <div class="flex gap-1.5 items-center">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
          <span class="text-xs text-on-surface-variant">أَثَر يفكر...</span>
        </div>
      </div>
    </div>`);
  scrollToBottom();
  return id;
}

// ─── Suggestions helpers ──────────────────────────────────────────
function sendSuggestion(text) {
  const input = document.getElementById("chatInput");
  if (!input || isGenerating) return;
  input.value = text;
  autoResizeTextarea(input);
  document.getElementById("chatForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

// ─── Chat Submit ──────────────────────────────────────────────────
document.getElementById("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isGenerating) return;

  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  // Hide suggestions
  document.getElementById("suggestions").style.display = "none";

  const wrap = document.getElementById("messages");
  wrap.insertAdjacentHTML("beforeend", renderMessageBubble("user", message));
  input.value = "";
  input.style.height = "auto";
  scrollToBottom();

  setGenerating(true);
  abortController = new AbortController();
  const typingId = showTypingIndicator();

  try {
    if (!geminiAgent) geminiAgent = new GeminiAgent(sb);

    const result = await geminiAgent.sendMessage(me.id, message, conversationHistory, abortController.signal);

    document.getElementById(typingId)?.remove();

    wrap.insertAdjacentHTML("beforeend", renderMessageBubble("assistant", result.reply, {
      actions: result.actions,
      youtubeCards: result.youtubeCards,
      interactiveQuiz: result.interactiveQuiz
    }));

    // Save to memory
    conversationHistory.push({ role: "user", content: message });
    conversationHistory.push({ role: "assistant", content: result.reply });

    // Save to Supabase
    await sb.from("ai_conversations").insert([
      { user_id: me.id, role: "user", content: message },
      { user_id: me.id, role: "assistant", content: result.reply }
    ]);

    // Refresh sessions list
    await loadAllSessions();

    scrollToBottom();
  } catch (err) {
    document.getElementById(typingId)?.remove();
    if (err.name === "AbortError" || err.message?.includes("abort")) {
      wrap.insertAdjacentHTML("beforeend", renderMessageBubble("assistant", "⏹️ تم إيقاف الرد. يمكنك إرسال رسالة جديدة."));
    } else {
      console.error("chat error:", err);
      wrap.insertAdjacentHTML("beforeend", renderMessageBubble("assistant", `⚠️ حصل خطأ: ${err.message || "تحقق من المفتاح أو الإنترنت."}`));
    }
    scrollToBottom();
  } finally {
    setGenerating(false);
    abortController = null;
  }
});
