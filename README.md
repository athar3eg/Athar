# 🧠 مِدار — MADAR

العقل الثاني للطالب. نظام تشغيل دراسي شخصي لطلاب الثانوية العامة.

## الحالة الحالية (المرحلة 1)
- ✅ تسجيل دخول / إنشاء حساب / استعادة كلمة مرور (Supabase Auth)
- ✅ Onboarding: النوم، المواد، المدرسين، الجدول الثابت
- ✅ Dashboard: جدول اليوم، "ماذا أفعل الآن؟"، حالة المواد
- ✅ قاعدة بيانات كاملة على Supabase مع Row Level Security

## التقنية
- Frontend: HTML + CSS + Vanilla JS
- Backend: Supabase (Postgres + Auth + RLS)
- الاستضافة: Vercel (لاحقًا)
- تطبيق أندرويد: Capacitor + GitHub Actions (لاحقًا)

## الملفات
```
index.html          صفحة الدخول / إنشاء الحساب
onboarding.html      معالج الإعداد الأولي
dashboard.html        الشاشة الرئيسية
css/style.css         نظام التصميم (Light/Dark)
js/supabase-client.js اتصال Supabase
js/onboarding.js      منطق الإعداد الأولي
js/dashboard.js       منطق لوحة التحكم
```

## المراحل القادمة
2. Tasks + Study Sessions + Focus Mode + Spaced Repetition
3. Exams + Exam Planner + Academic Risk + Rescue Mode
4. AI Tutor (Gemini) + YouTube Search
5. Smart Library (Cloudflare R2)
6. Student Memory + Weekly/Morning/Night reviews
7. Android app (Capacitor)
