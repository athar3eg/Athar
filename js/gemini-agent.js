// ================================================================
// أَثَر — Gemini Autonomous Agent Engine (العقل الثاني الذكي)
// Full Autonomous Agent with Context Awareness, Tool Execution,
// YouTube Learning Recommendations & Interactive Quiz Generation
// ================================================================

(function () {
  class GeminiAgent {
    constructor(supabaseClient) {
      this.sb = supabaseClient;
    }

    get apiKey() {
      // Migration: athar key أولاً، fallback للـ madar القديم
      const v = localStorage.getItem('athar_gemini_api_key');
      if (v) return v;
      const old = localStorage.getItem('madar_gemini_api_key');
      if (old) { localStorage.setItem('athar_gemini_api_key', old); return old; }
      return '';
    }
    get modelName() {
      return localStorage.getItem('athar_gemini_model')
          || localStorage.getItem('madar_gemini_model')
          || 'gemini-2.0-flash';
    }

    // ── 1. جلب بيانات الطالب ─────────────────────────────────────
    async getStudentContext(userId) {
      try {
        const [
          { data: profile },
          { data: subjects },
          { data: teachers },
          { data: fixedSchedule },
          { data: tasks },
          { data: exams }
        ] = await Promise.all([
          this.sb.from("profiles").select("*").eq("id", userId).single(),
          this.sb.from("subjects").select("*").eq("user_id", userId).order("priority"),
          this.sb.from("teachers").select("*, subjects(name)").eq("user_id", userId),
          this.sb.from("fixed_schedule").select("*, subjects(name)").eq("user_id", userId),
          this.sb.from("tasks").select("*, subjects(name)").eq("user_id", userId).neq("status", "completed"),
          this.sb.from("exams").select("*, subjects(name)").eq("user_id", userId).order("exam_date")
        ]);

        const today = new Date().toISOString().slice(0, 10);
        const dayOfWeek = new Date().getDay();
        return {
          profile: profile || {},
          subjects: subjects || [],
          teachers: teachers || [],
          todaySchedule: (fixedSchedule || []).filter(f => f.day_of_week === dayOfWeek),
          pendingTasks: tasks || [],
          lateTasks: (tasks || []).filter(t => t.due_date && t.due_date < today),
          upcomingExams: (exams || []).filter(e => e.exam_date >= today),
          allFixed: fixedSchedule || []
        };
      } catch (err) {
        console.error("getStudentContext error:", err);
        return { profile: {}, subjects: [], teachers: [], todaySchedule: [], pendingTasks: [], lateTasks: [], upcomingExams: [], allFixed: [] };
      }
    }

    // ── 2. System Prompt ─────────────────────────────────────────
    buildSystemInstruction(ctx) {
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      const today = new Date();
      return `
أنت "أَثَر" — العقل الثاني والوكيل الذكي الكامل لطالب الثانوية العامة.
لديك تحكم كامل وصلاحية لإدارة الموقع، إضافة المهام، وضع الامتحانات، جدولة الحصص الثابتة (سناتر وأوفلاين)، مواعيد محاضرات المنصات ويوتيوب (أونلاين)، وضع خطط الإنقاذ، وشرح أي جزء في المنهج بالتبسيط وأمثلة واقعية، وترشيح فيديوهات يوتيوب التعليمية، وعمل اختبارات تفاعلية فورية.

معلومات الطالب الحالي (${ctx.profile?.full_name || "الطالب"}):
- اليوم: ${dayNames[today.getDay()]} (${today.toISOString().slice(0, 10)})
- روتين: يصحى ${ctx.profile?.wake_time || "07:00"} وينام ${ctx.profile?.sleep_time || "23:00"}
- المواد: ${ctx.subjects.map(s => `${s.name} (إتقان: ${Math.round(s.mastery_percentage || 50)}%)`).join("، ") || "لا يوجد"}
- جدول اليوم: ${ctx.todaySchedule.map(f => `${f.title} (${f.start_time?.slice(0,5)} - ${f.end_time?.slice(0,5)})`).join("، ") || "لا توجد حصص"}
- المهام المعلقة: ${ctx.pendingTasks.map(t => `${t.title} (${t.due_date || "بدون موعد"})`).join("، ") || "لا يوجد"}
- المهام المتأخرة: ${ctx.lateTasks.map(t => t.title).join("، ") || "لا يوجد"}
- الامتحانات القادمة: ${ctx.upcomingExams.map(e => `${e.title} يوم ${e.exam_date}`).join("، ") || "لا يوجد"}

🌟 قواعد وتوجيهات خاصة:
1. إذا طلب الطالب ترتيب أو تنظيم يومه وجدول دروسه (أو ضغط على زر "رتّب لي يومي وجدول دروسي"):
   - خذ المبادرة فوراً واسأله بطريقة منظمة ومريحة عن تفاصيل أسبوعه:
     أ) الدروس الأوفلاين (السناتر): المواد، أيامها، ومواعيدها من كام لكام؟
     ب) المحاضرات الأونلاين (يوتيوب أو منصات): المواد، المحاضرة بتنزل يوم إيه والساعة كام؟ وكم محاضرة في الأسبوع؟
     ج) أوقات نومه وصحيانه والراحة.
     د) أوقات راحته الشخصية الثابتة أسبوعيًا (جيم، رياضة، وقت عيلة، لعب) — سجّلها كـ block_kind="protected" ولا تقترح عليه مذاكرة فيها أبداً تحت أي ظرف.
   - بمجرد أن يعطيك البيانات، استدعِ أداة batch_setup_student_routine أو add_fixed_schedule و create_task وسجل كل الحصص والمهام في حسابه فوراً، ثم لخص له خطة يومه وأسبوعه (مواعيد الحصص، أوقات المذاكرة والحل، وفترات الراحة).
2. إذا قال الطالب "مش فاهم كذا": اشرح بتبسيط شديد + استدعِ search_youtube_lessons لجلب فيديو الشرح.
3. إذا طلب امتحان: استدعِ generate_quiz واختبره فوراً.
4. استخدم لهجة مصرية محفزة وذكية ومنظمة في نقاط واضحة.
`;
    }

    // ── 3. تعريف الأدوات ─────────────────────────────────────────
    getToolDeclarations() {
      return [
        {
          name: "create_task",
          description: "إضافة مهمة جديدة إلى جدول مهام الطالب",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "عنوان المهمة" },
              subject_name: { type: "STRING", description: "اسم المادة" },
              task_type: { type: "STRING", enum: ["study", "watch", "practice", "review", "quiz", "other"] },
              due_date: { type: "STRING", description: "تاريخ الاستحقاق YYYY-MM-DD" },
              estimated_minutes: { type: "INTEGER", description: "الوقت المقدر بالدقائق" }
            },
            required: ["title"]
          }
        },
        {
          name: "batch_setup_student_routine",
          description: "تثبيت وضبط الجدول الشامل للطالب (حصص سناتر أوفلاين + محاضرات أونلاين ومنصات + جلسات مذاكرة)",
          parameters: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING", description: "ملخص الجدول الأسبوعي الذي تم إنشاؤه" },
              classes: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING", description: "اسم الحصة أو المحاضرة مثل: سنتر فيزياء أو منصة كيمياء" },
                    subject_name: { type: "STRING", description: "اسم المادة" },
                    day_of_week: { type: "INTEGER", description: "اليوم من 0 (الأحد) إلى 6 (السبت)" },
                    start_time: { type: "STRING", description: "وقت البدء HH:MM" },
                    end_time: { type: "STRING", description: "وقت الانتهاء HH:MM" },
                    block_kind: { type: "STRING", enum: ["class", "study", "other", "protected"] }
                  },
                  required: ["title", "day_of_week", "start_time", "end_time"]
                },
                description: "قائمة الحصص والمحاضرات الثابتة"
              },
              tasks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING", description: "عنوان المهمة مثل: مشاهدة محاضرة العربي" },
                    subject_name: { type: "STRING" },
                    due_date: { type: "STRING", description: "تاريخ الاستحقاق YYYY-MM-DD" },
                    estimated_minutes: { type: "INTEGER" }
                  },
                  required: ["title"]
                },
                description: "قائمة مهام المذاكرة والمشاهدة المرتبطة"
              }
            },
            required: ["summary"]
          }
        },
        {
          name: "complete_task",
          description: "تعليم مهمة كمكتملة",
          parameters: {
            type: "OBJECT",
            properties: {
              task_title: { type: "STRING", description: "عنوان المهمة" }
            },
            required: ["task_title"]
          }
        },
        {
          name: "create_exam",
          description: "إضافة موعد امتحان جديد",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "اسم الامتحان" },
              subject_name: { type: "STRING", description: "اسم المادة" },
              exam_date: { type: "STRING", description: "تاريخ الامتحان YYYY-MM-DD" },
              exam_type: { type: "STRING", enum: ["school", "center", "final", "mock"] },
              total_score: { type: "INTEGER", description: "الدرجة الكلية" }
            },
            required: ["title", "exam_date"]
          }
        },
        {
          name: "add_fixed_schedule",
          description: "إضافة موعد أسبوعي ثابت — حصة دراسية أو وقت راحة محمي (جيم، رياضة، وقت عيلة) لا يجوز جدولة مذاكرة فيه",
          parameters: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "اسم الحصة أو الموعد" },
              subject_name: { type: "STRING", description: "اسم المادة (لو حصة دراسية فقط)" },
              day_of_week: { type: "INTEGER", description: "رقم اليوم 0=الأحد ... 6=السبت" },
              start_time: { type: "STRING", description: "وقت البدء HH:MM" },
              end_time: { type: "STRING", description: "وقت الانتهاء HH:MM" },
              block_kind: { type: "STRING", enum: ["class", "protected"], description: "class لحصة دراسية، protected لوقت راحة محمي زي الجيم أو وقت العيلة" }
            },
            required: ["title", "day_of_week", "start_time", "end_time"]
          }
        },
        {
          name: "search_youtube_lessons",
          description: "البحث عن شروحات يوتيوب للمنهج",
          parameters: {
            type: "OBJECT",
            properties: {
              query: { type: "STRING", description: "كلمات البحث" },
              subject_name: { type: "STRING", description: "اسم المادة" }
            },
            required: ["query"]
          }
        },
        {
          name: "generate_quiz",
          description: "إنشاء اختبار تفاعلي فوري بأسئلة اختيار من متعدد",
          parameters: {
            type: "OBJECT",
            properties: {
              quiz_title: { type: "STRING", description: "عنوان الاختبار" },
              subject_name: { type: "STRING", description: "اسم المادة" },
              questions: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    question: { type: "STRING" },
                    options: { type: "ARRAY", items: { type: "STRING" } },
                    correct_index: { type: "INTEGER" },
                    explanation: { type: "STRING" }
                  },
                  required: ["question", "options", "correct_index", "explanation"]
                }
              }
            },
            required: ["quiz_title", "questions"]
          }
        },
        {
          name: "rescue_and_reschedule",
          description: "تفعيل وضع الإنقاذ وإعادة توزيع المهام المتأخرة",
          parameters: {
            type: "OBJECT",
            properties: {
              plan_summary: { type: "STRING", description: "ملخص الخطة" },
              postpone_days: { type: "INTEGER", description: "عدد الأيام" }
            },
            required: ["plan_summary"]
          }
        }
      ];
    }

    // ── 4. تنفيذ أداة محلياً ─────────────────────────────────────
    async executeTool(name, args, ctx, userId) {
      const sb = this.sb;

      const findSubjectId = (subName) => {
        if (!subName) return null;
        const found = ctx.subjects.find(s => s.name.toLowerCase().includes(subName.toLowerCase()));
        return found ? found.id : null;
      };

      if (name === "create_task") {
        const { data, error } = await sb.from("tasks").insert({
          user_id: userId,
          title: args.title,
          subject_id: findSubjectId(args.subject_name),
          task_type: args.task_type || "study",
          due_date: args.due_date || new Date().toISOString().slice(0, 10),
          estimated_minutes: args.estimated_minutes || 30,
          status: "pending"
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, action: "created_task", task: data, message: `تمت إضافة المهمة "${args.title}" إلى جدولك (${args.estimated_minutes || 30} دقيقة).` };
      }

      if (name === "batch_setup_student_routine") {
        let insertedClasses = 0;
        let insertedTasks = 0;

        if (args.classes && Array.isArray(args.classes)) {
          for (const cls of args.classes) {
            await sb.from("fixed_schedule").insert({
              user_id: userId,
              title: cls.title,
              subject_id: findSubjectId(cls.subject_name),
              day_of_week: cls.day_of_week,
              start_time: cls.start_time,
              end_time: cls.end_time,
              block_kind: cls.block_kind || "class"
            });
            insertedClasses++;
          }
        }

        if (args.tasks && Array.isArray(args.tasks)) {
          for (const t of args.tasks) {
            await sb.from("tasks").insert({
              user_id: userId,
              title: t.title,
              subject_id: findSubjectId(t.subject_name),
              task_type: "study",
              due_date: t.due_date || new Date().toISOString().slice(0, 10),
              estimated_minutes: t.estimated_minutes || 45,
              status: "pending"
            });
            insertedTasks++;
          }
        }

        return {
          success: true,
          action: "routine_configured",
          message: `🎯 تم تثبيت جدولك بنجاح! تم تسجيل (${insertedClasses}) حصة/محاضرة و (${insertedTasks}) مهمة مذاكرة. ${args.summary || ""}`
        };
      }

      if (name === "complete_task") {
        const match = ctx.pendingTasks.find(t => t.title.toLowerCase().includes((args.task_title || "").toLowerCase()));
        if (match) {
          await sb.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", match.id);
          return { success: true, action: "completed_task", message: `تم تسجيل إنجاز المهمة "${match.title}" 🎉` };
        }
        return { success: false, message: `لم يتم العثور على مهمة تطابق "${args.task_title}"` };
      }

      if (name === "create_exam") {
        const { data, error } = await sb.from("exams").insert({
          user_id: userId,
          title: args.title,
          subject_id: findSubjectId(args.subject_name),
          exam_type: args.exam_type || "school",
          exam_date: args.exam_date,
          total_score: args.total_score || 60
        }).select().single();
        if (error) return { error: error.message };

        let planMsg = "";
        if (typeof generateExamStudyPlan === "function") {
          const plan = await generateExamStudyPlan(sb, userId, data, args.subject_name, ctx.profile?.preferred_session_minutes ? Math.min(ctx.profile.preferred_session_minutes, 40) : 35);
          planMsg = plan.message ? " " + plan.message : "";
        }

        return { success: true, action: "created_exam", exam: data, message: `تم تسجيل امتحان "${args.title}" بتاريخ ${args.exam_date} والعد التنازلي بدأ!${planMsg}` };
      }

      if (name === "add_fixed_schedule") {
        const kind = args.block_kind === "protected" ? "protected" : "class";
        const { data, error } = await sb.from("fixed_schedule").insert({
          user_id: userId,
          title: args.title,
          subject_id: kind === "protected" ? null : findSubjectId(args.subject_name),
          day_of_week: args.day_of_week,
          start_time: args.start_time,
          end_time: args.end_time,
          block_kind: kind
        }).select().single();
        if (error) return { error: error.message };
        return { success: true, action: "added_schedule", message: kind === "protected"
          ? `تمام، حجزتلك "${args.title}" كوقت راحة محمي — مش هقترح عليك مذاكرة فيه أبداً.`
          : `تم تثبيت موعد "${args.title}" في جدولك الأسبوعي.` };
      }

      if (name === "search_youtube_lessons") {
        return {
          success: true,
          action: "youtube_recommendation",
          query: args.query,
          subject: args.subject_name,
          searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`,
          message: `تم تجهيز شروحات يوتيوب لـ "${args.query}"`
        };
      }

      if (name === "generate_quiz") {
        return {
          success: true,
          action: "interactive_quiz",
          quiz_title: args.quiz_title,
          subject_name: args.subject_name,
          questions: args.questions,
          message: `تم تجهيز الاختبار "${args.quiz_title}" (${(args.questions || []).length} أسئلة).`
        };
      }

      if (name === "rescue_and_reschedule") {
        // استخدام محرك الإنقاذ المشترك
        const result = typeof runRescueMode === 'function'
          ? await runRescueMode(userId, ctx.lateTasks, ctx.profile)
          : { rescheduled: 0, message: 'محرك الإنقاذ غير متاح — حاول من صفحة الجدول مباشرة' };
        return { success: true, action: "rescue_executed", message: result.message };
      }

      return { error: "Unknown tool: " + name };
    }

    // ── 5. المحادثة مع حلقة Tool Calling ─────────────────────────
    async sendMessage(userId, userMessage, chatHistory = [], abortSignal = null) {
      const ctx = await this.getStudentContext(userId);
      const apiKey = this.apiKey;

      const executedActions = [];
      const youtubeCards = [];
      let interactiveQuiz = null;

      // ─ fallback: بدون مفتاح شخصي → Supabase Edge Function
      if (!apiKey) {
        const { data: sessionData } = await this.sb.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch("https://uujxqzwcqvezsebamnpb.supabase.co/functions/v1/ai-tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify({ message: userMessage, context: ctx }),
          signal: abortSignal
        });
        const json = await res.json();
        return { reply: json.reply || "حصل خطأ في الاتصال", actions: [], youtubeCards: [], interactiveQuiz: null };
      }

      // ─ بناء المحادثة
      const contents = [];
      chatHistory.slice(-10).forEach(msg => {
        contents.push({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] });
      });
      contents.push({ role: "user", parts: [{ text: userMessage }] });

      const systemInstruction = this.buildSystemInstruction(ctx);
      const tools = [{ functionDeclarations: this.getToolDeclarations() }];

      // ─ اختيار النموذج وبناء الـ endpoint
      let currentModel = this.modelName;
      let endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

      const callGemini = async (payload) => {
        let res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: abortSignal
        });

        // ─ لو النموذج انتهى أو غير متاح → استخرج الاقتراح أو جلب قائمة
        if (!res.ok) {
          let errJson = {};
          try { errJson = await res.json(); } catch (_) {}

          const suggestedMatch = (errJson.error?.message || "").match(/models\/([a-zA-Z0-9.\-_]+)/);
          if (suggestedMatch && suggestedMatch[1]) {
            currentModel = suggestedMatch[1];
          } else {
            try {
              const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal: abortSignal });
              const listJson = await listRes.json();
              const supported = (listJson.models || [])
                .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
                .map(m => m.name.replace("models/", ""));
              const flashFirst = supported.find(m => m.includes("flash")) || supported[0];
              if (flashFirst) currentModel = flashFirst;
            } catch (_) {}
          }

          localStorage.setItem('athar_gemini_model', currentModel);
          endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`;

          res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: abortSignal
          });

          if (!res.ok) {
            let e2 = {};
            try { e2 = await res.json(); } catch (_) {}
            throw new Error(e2.error?.message || `Gemini API Error: ${res.status}`);
          }
        }

        return res.json();
      };

      // ─ حلقة Tool Calling (حتى 5 دورات)
      const maxTurns = 5;
      let turn = 0;

      while (turn < maxTurns) {
        turn++;
        const payload = {
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools,
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
        };

        const resJson = await callGemini(payload);
        const candidate = resJson.candidates?.[0];

        if (!candidate || !candidate.content) {
          return { reply: "عفواً، لم أستطع تكوين إجابة مناسبة. حاول ثانية.", actions: executedActions, youtubeCards, interactiveQuiz };
        }

        const modelParts = candidate.content.parts || [];
        const functionCalls = modelParts.filter(p => p.functionCall);

        if (functionCalls.length > 0) {
          contents.push(candidate.content);
          const responseParts = [];

          for (const fc of functionCalls) {
            const toolName = fc.functionCall.name;
            const toolArgs = fc.functionCall.args || {};
            const result = await this.executeTool(toolName, toolArgs, ctx, userId);

            if (["created_task", "completed_task", "created_exam", "added_schedule", "rescue_executed"].includes(result.action)) {
              executedActions.push(result);
            } else if (result.action === "youtube_recommendation") {
              youtubeCards.push(result);
            } else if (result.action === "interactive_quiz") {
              interactiveQuiz = result;
            }

            responseParts.push({ functionResponse: { name: toolName, response: { result } } });
          }

          contents.push({ role: "user", parts: responseParts });
        } else {
          const text = modelParts.map(p => p.text || "").join("\n").trim();
          return { reply: text, actions: executedActions, youtubeCards, interactiveQuiz };
        }
      }

      return { reply: "تم تنفيذ الإجراءات المطلوبة بنجاح.", actions: executedActions, youtubeCards, interactiveQuiz };
    }
  }

  // تصدير للنافذة
  window.GeminiAgent = GeminiAgent;
})();
