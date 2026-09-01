# ملف تعريف مشروع "أَثَر" — دليل شامل لأي محادثة جديدة

> هذا الملف مرجع كامل للمشروع، يُقرأ أولاً في أي محادثة جديدة قبل تنفيذ أي تعديل، عشان تفهم السياق كامل من غير ما يحتاج المستخدم يشرح من الصفر.

---

## ١) نظرة عامة

**أَثَر** منصة إنتاجية أكاديمية مجانية باللغة العربية لطلاب الثانوية العامة المصرية، مبنية كصدقة جارية (مشروع خيري، مش تجاري). المطوّر الوحيد هو Claude، والمستخدم (سيف) مدير ومراجع — بيدي التوجيه وينفّذ أوامر النشر بنفسه، ومش مطالب يكتب كود.

**أسلوب العمل المتوقع من Claude:**
- ينفّذ التعديلات مباشرة على الملفات، من غير ما يستنى تأكيد لكل خطوة صغيرة.
- **ممنوع** يغيّر التصميم الأساسي (الألوان، الخطوط، الـLayout) إلا لو طُلب صراحةً.
- يفحص الكود الحقيقي قبل ما يفترض حاجة — الحلول يجب تتبني على فحص فعلي، مش تخمين.
- لو أضاف زرار/ميزة جديدة، لازم يوصلها فعليًا بالباك إند (Supabase) والواجهة، مش يسيبها شكل بس.

---

## ٢) المكدّس التقني (Tech Stack)

- **الواجهة:** HTML/CSS/JS عادي (Vanilla) — من غير أي framework (لا React ولا Vue). كل صفحة ملف HTML مستقل.
- **التنسيق:** Tailwind CSS عبر **CDN مباشر** (`cdn.tailwindcss.com`) — قرار **متعمد** بعد تجربة بناء محلي فشلت مرتين. **لا تحاول تحويله لبناء محلي (build step) إلا لو المستخدم طلب صراحةً** — ده قرار اتاخد بعد نقاش طويل وعايز يفضل يفتح الملفات مباشرة من الجهاز من غير أي خطوة بناء.
- **الخط:** Thmanyah Sans (محلي، ملفات WOFF في `fonts/`) — استبدل خط Cairo بالكامل بكل الأوزان.
- **قاعدة البيانات:** Supabase (Postgres + Auth + RLS + Edge Functions + Vault + pg_cron). Project ID: `uujxqzwcqvezsebamnpb`.
- **الذكاء الاصطناعي:** Gemini API عبر `js/gemini-agent.js`، بمفاتيح متعددة تتناوب (جدول `gemini_api_keys`).
- **التطبيق الموبايل:** Capacitor، بيحمّل نسخة الكود **جوّاه محليًا** (مش من لينك خارجي — قرار نهائي بعد نقاش، عشان يفتح حتى من غير إنترنت زي Notion).
- **النشر:**
  - **الموقع:** Vercel (يسحب من الريبو تلقائي) + GitHub Pages احتياطي.
  - **التطبيق:** GitHub Actions (`.github/workflows/android-build.yml`) — يبني APK ويرفعه كـ GitHub Release تلقائي مع كل رفعة على `main`. المستخدم معهوش Android Studio، فالبناء بالكامل سحابي.
  - **الريبو:** `athar3eg/Athar` على GitHub.

---

## ٣) هيكل الملفات

```
/
├── index.html          صفحة الدخول/التسجيل (فيها Splash Screen للتطبيق)
├── onboarding.html      إعداد الحساب أول مرة
├── dashboard.html        لوحة التحكم الرئيسية
├── schedule.html          الجدول الدراسي (فيه الجدول الزمني بالساعة)
├── exams.html            الامتحانات
├── focus.html            بومودورو (تايمر تركيز)
├── assistant.html         المساعد الذكي (شات AI)
├── settings.html          الإعدادات
├── landing.html, privacy.html   صفحات ثانوية
├── js/
│   ├── common.js           دوال مشتركة (toast, escapeHtml, logout, withTimeout, رسائل تحفيزية)
│   ├── supabase-client.js   عميل Supabase + requireAuth + getMyProfile
│   ├── dashboard.js, schedule.js, exams.js, focus.js, settings.js, onboarding.js, assistant.js
│   ├── gemini-agent.js      منطق الذكاء الاصطناعي والأدوات (tools)
│   ├── motion.js            نظام الأنيميشن (scroll reveal, ripple, card tilt)
│   └── shared/
│       ├── rescue-engine.js     توزيع المهام المتأخرة على الأيام الجاية
│       ├── exam-planner.js       خطة مذاكرة تلقائية عند إضافة امتحان
│       ├── prayer-times.js       حساب مواعيد الصلاة محليًا (بدون API خارجي)
│       ├── timeline-engine.js    محرك الجدولة بالساعة (buildDailyTimeline)
│       ├── push-notifications.js  تسجيل توكن الإشعارات (Capacitor فقط)
│       ├── update-checker.js      فحص تحديثات التطبيق تلقائي
│       └── splash.js              تحكم شاشة البداية المتحركة
├── css/
│   ├── motion.css        كل الأنيميشن والـ keyframes
│   └── splash.css        شاشة البداية
├── assets/               شعارات وأيقونات
├── fonts/                خط Thmanyah Sans (WOFF) + Cairo القديم (مش مستخدم حاليًا)
├── firebase/google-services.json   إعدادات Firebase للأندرويد
├── capacitor.config.json  إعدادات تطبيق Capacitor (appId: com.company.athar)
├── package.json           تبعيات Capacitor فقط (Tailwind مش موجود هنا عن قصد)
├── version.json           نسخة التطبيق الحالية (يتحدث تلقائي من الـ Action)
└── .github/workflows/android-build.yml   بناء APK + نشر Release تلقائي
```

---

## ٤) قاعدة البيانات (أهم الجداول)

- `profiles` — بيانات الطالب (الاسم، المرحلة، `latitude`/`longitude` لمواعيد الصلاة، `wake_time`/`sleep_time`/`preferred_session_minutes` للجدولة، `energy_level`).
- `subjects` — المواد (`priority`, `difficulty`, `mastery_percentage`, `risk_level`).
- `tasks` — المهام (`due_date`, `estimated_minutes`, `status`, `completed_at`, `task_type`).
- `exams` — الامتحانات (`exam_date`, `subject_id`).
- `fixed_schedule` — الحصص الثابتة والوقت المحمي (`block_kind`: `class` أو `protected`، `day_of_week`, `start_time`, `end_time`).
- `quran_wird_log`, `daily_energy_log` — سجلات يومية (تتبع الورد القرآني وتقييم الطاقة).
- `motivation_messages` — ١٢٣ رسالة تحفيزية مشتركة بين كل الطلاب (جدول واحد عام، مش مكرر لكل مستخدم).
- `push_tokens`, `notification_log` — بنية الإشعارات (Firebase Cloud Messaging).
- كل الجداول عليها RLS مفعّل، والسياسات بتسمح للمستخدم يشوف/يعدّل بياناته هو بس.

**Edge Function:** `send-push` — بيرسل إشعارات عبر Firebase FCM v1. محتاج Secret اسمه `FCM_SERVICE_ACCOUNT_JSON` في Supabase.
**Cron Job:** `athar-class-reminders` — بيفحص كل ٥ دقايق ويبعت تذكير قبل أي حصة بربع ساعة، عبر دالة `trigger_class_reminders()` اللي بتحتاج `service_role_key` مسجّل في Vault.

---

## ٥) الميزات المُنفّذة بالكامل

- تسجيل دخول بالإيميل أو رقم التليفون
- قائمة جانبية responsive (تفتح/تقفل بـ `display:none`/`flex` مباشر — **ليس** transform/translate، بعد مشاكل كتير مع RTL)
- خطة مذاكرة تلقائية عند إضافة امتحان (spaced repetition بسيط)
- مواعيد الصلاة (حساب فلكي محلي) + الورد القرآني اليومي + streak
- أوقات راحة محمية (`block_kind: protected`) + زرار "مش قادر أذاكر النهاردة"
- تقييم الطاقة اليومي + صعوبة المواد (تُستخدم في توجيه الذكاء الاصطناعي)
- رسم بياني حقيقي لنسبة الإنجاز الأسبوعي (من بيانات `tasks` الفعلية)
- ١٢٣ رسالة تحفيزية عشوائية بعد كل إنجاز
- بومودورو بساعة تناظرية + جلسة حرة بمدة مخصصة
- **محرك الجدولة بالساعة** (`timeline-engine.js`) — بيبني جدول فعلي بالدقيقة (مذاكرة → استراحة → صلاة → حصة...) من وقت الصحيان للنوم
- أنيميشن شامل: انتقالات الشات، دخول الرسايل، شاشة بداية احترافية
- إشعارات Push كاملة البنية (محتاجة خطوتين إعداد يدويين من المستخدم في Supabase، موضحين تحت)
- نظام تحديث تلقائي للتطبيب (يفحص `version.json` ويعرض تنبيه "تحديث الآن/لاحقًا")

## ٦) الميزات الناقصة / خطوات معلّقة

- **مراجعة الأسبوع التفاعلية** — لسه مبنيتش (مطلوبة، مش موجودة).
- المستخدم لازم يسجّل يدويًا (لأسباب أمنية، Claude ميقدرش يعملها):
  1. `select vault.create_secret('SERVICE_ROLE_KEY', 'service_role_key');` في SQL Editor بتاع Supabase.
  2. حط ملف Firebase service account (JSON) في Supabase → Edge Functions → Secrets باسم `FCM_SERVICE_ACCOUNT_JSON` **بالظبط** (لاحظنا مشكلة تكررت: مسافات زيادة في اسم الـ Secret بتكسر القراءة).

---

## ٧) دروس مستفادة (لتجنب تكرار أخطاء سابقة)

- **لا تستخدم CSS transform/translate لإخفاء القائمة الجانبية على الموبايل** — استخدم `display:none` + كلاس `mobile-open` صريح. الحسابات التلقائية لموضع العناصر في RTL غير موثوقة.
- **لا تحوّل Tailwind لبناء محلي** إلا لو طُلب صراحة — قرار واعي بعد تجربتين فاشلتين.
- **الخط الحالي Thmanyah Sans، مش Cairo** — لو لقيت إشارة لـ Cairo في كود قديم، حدّثها.
- أي مفتاح حساس (service_role، Firebase service account) **لا يُطلب من المستخدم إرساله في الشات أبدًا**، حتى لو عرض — يُوجَّه دائمًا لإدخاله مباشرة في لوحة Supabase/Firebase.
- عند إضافة أي جدول جديد في قاعدة البيانات، لازم RLS مفعّل من أول خطوة.
- التطبيق (Capacitor) يحمّل الكود **محليًا جوّاه**، مش من لينك خارجي — عشان يفتح حتى من غير إنترنت.

---

## ٨) لو هتعدّل حاجة، اعمل الآتي أول ما تستلم المشروع

1. افحص هيكل الملفات فعليًا (`view` على المجلد) بدل ما تفترض.
2. لو التعديل في صفحة معينة، افحص كل السكريبتات المرتبطة بيها وترتيب تحميلها.
3. لو التعديل يلمس قاعدة البيانات، استخدم أدوات Supabase MCP مباشرة (`execute_sql`, `apply_migration`) — منسّق مع المستخدم إنه يشتغل بيها مباشرة.
4. بعد أي تعديل، اعمل فحص بناء (div balance, JS syntax) قبل ما تسلّم الملف.
5. لخّص التعديل بالمصري البسيط، من غير تفاصيل تقنية زيادة إلا لو المستخدم طلبها.
