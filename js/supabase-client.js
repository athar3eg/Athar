// ============================================
// مِدار — Supabase Client
// ============================================
const SUPABASE_URL = "https://uujxqzwcqvezsebamnpb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_AEnDpI20AodwOpNGH6sBFA_FNJmsnfb";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// يحمي أي صفحة: لو مفيش مستخدم داخل، يرجعه لصفحة الدخول
async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session.user;
}

// يجيب بروفايل المستخدم الحالي
async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("getMyProfile error:", error);
    return null;
  }
  return data;
}
