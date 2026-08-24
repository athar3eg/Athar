// ============================================
// مِدار — AI Tutor (assistant.html)
// ============================================
let me = null;

const toast = document.getElementById("toast");
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
function withTimeout(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("الاتصال بطيء — حاول تاني")), ms))
  ]);
}
window.addEventListener("unhandledrejection", (e) => console.error("Unhandled:", e.reason));

(async function init() {
  try {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("madar-theme") || "light");
    me = await withTimeout(requireAuth(), 10000);
    if (!me) return;
    await loadHistory();
  } catch (err) {
    console.error("Assistant init error:", err);
    showToast(err.message || "حصل خطأ في التحميل");
  }
})();

async function loadHistory() {
  const { data, error } = await sb.from("ai_conversations")
    .select("*").eq("user_id", me.id).order("created_at").limit(50);
  if (error || !data || data.length === 0) return;

  document.getElementById("suggestions").style.display = "none";
  const wrap = document.getElementById("messages");
  wrap.innerHTML = data.map(renderBubble).join("");
  scrollToBottom();
}

function renderBubble(msg) {
  const isUser = msg.role === "user";
  return `
    <div style="align-self:${isUser ? "flex-start" : "flex-end"}; max-width:82%; ${isUser ? "" : "width:100%"}">
      <div style="
        background:${isUser ? "var(--bg-card)" : "var(--accent)"};
        color:${isUser ? "var(--text)" : "#fff"};
        border:${isUser ? "1px solid var(--border)" : "none"};
        padding:12px 16px; border-radius:16px;
        font-size:14px; line-height:1.7; white-space:pre-wrap;
      ">${escapeHtml(msg.content)}</div>
    </div>`;
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function scrollToBottom() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function sendSuggestion(text) {
  document.getElementById("chatInput").value = text;
  document.getElementById("chatForm").requestSubmit();
}

document.getElementById("chatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  document.getElementById("suggestions").style.display = "none";
  const wrap = document.getElementById("messages");
  wrap.insertAdjacentHTML("beforeend", renderBubble({ role: "user", content: message }));
  input.value = "";
  scrollToBottom();

  const btn = document.getElementById("sendBtn");
  btn.disabled = true;

  const typingId = "typing-" + Date.now();
  wrap.insertAdjacentHTML("beforeend", `
    <div id="${typingId}" style="align-self:flex-end; width:100%">
      <div style="background:var(--accent); color:#fff; padding:12px 16px; border-radius:16px; font-size:14px; opacity:.7">
        <span class="spinner" style="border-top-color:#fff"></span> بيفكر...
      </div>
    </div>`);
  scrollToBottom();

  try {
    const { data: sessionData } = await sb.auth.getSession();
    const accessToken = sessionData.session.access_token;

    const res = await withTimeout(fetch("https://uujxqzwcqvezsebamnpb.supabase.co/functions/v1/ai-tutor", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({ message })
    }));

    const json = await res.json();
    document.getElementById(typingId)?.remove();

    if (!res.ok || json.error) {
      wrap.insertAdjacentHTML("beforeend", renderBubble({ role: "assistant", content: "⚠️ " + (json.error || "حصل خطأ، جرب تاني") }));
    } else {
      wrap.insertAdjacentHTML("beforeend", renderBubble({ role: "assistant", content: json.reply }));
    }
    scrollToBottom();
  } catch (err) {
    console.error(err);
    document.getElementById(typingId)?.remove();
    wrap.insertAdjacentHTML("beforeend", renderBubble({ role: "assistant", content: "⚠️ حصل خطأ في الاتصال، جرب تاني" }));
    scrollToBottom();
  } finally {
    btn.disabled = false;
  }
});
