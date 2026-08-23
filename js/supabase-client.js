// ============================================
// مِدار — Supabase Client
// ============================================
const SUPABASE_URL = "https://uujxqzwcqvezsebamnpb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1anhxendjcXZlenNlYmFtbnBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDYxODcsImV4cCI6MjEwMjk4MjE4N30.QuhhY8E_SfLU28tQv9ePcKV-YVHsmiPSm1rCqdFWduI";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// يحمي أي صفحة: لو مفيش مستخدم داخل، يرجعه لصفحة الدخول
async function requireAuth() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!session) {
      window.location.href = "index.html";
      return null;
    }
    return session.user;
  } catch (err) {
    console.error("requireAuth error:", err);
    window.location.href = "index.html";
    return null;
  }
}

// يجيب بروفايل المستخدم الحالي
async function getMyProfile(userId) {
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      console.error("getMyProfile error:", error);
      return null;
    }
    return data;
  } catch (err) {
    console.error("getMyProfile exception:", err);
    return null;
  }
}
