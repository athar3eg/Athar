// ============================================
// أَثَر — Supabase Edge Function: send-email-hook
// Custom branded transactional emails (Resend / SMTP)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user, email_data } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "no-reply@athar.app";

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not configured, passing through default behavior.");
      return new Response(JSON.stringify({ message: "Default handler" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { token, token_hash, redirect_to, email_action_type } = email_data || {};
    const recipient = user?.email;

    let subject = "أَثَر — رسالة أمان";
    let bodyHtml = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f9fc; padding: 30px; color: #111827;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #d6dbe6;">
          <h1 style="color: #0077CC; font-size: 22px; margin-bottom: 8px;">أَثَر — نظامك الأكاديمي</h1>
    `;

    if (email_action_type === "signup") {
      subject = "تأكيد بريدك الإلكتروني في منصة أَثَر 🎓";
      bodyHtml += `
          <p style="font-size: 14px; line-height: 1.6;">مرحباً بك في منصة أَثَر، عقلك الثاني للدراسة وتنظيم وقتك.</p>
          <p style="font-size: 14px; line-height: 1.6;">يرجى تأكيد بريدك الإلكتروني للبدء فوراً في إعداد جدولك:</p>
          <a href="${redirect_to}?token_hash=${token_hash}&type=signup" style="display: inline-block; background-color: #0077CC; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 99px; font-weight: bold; font-size: 14px; margin-top: 12px;">تأكيد البريد والبدء 🚀</a>
      `;
    } else if (email_action_type === "recovery") {
      subject = "استعادة كلمة المرور في منصة أَثَر 🔑";
      bodyHtml += `
          <p style="font-size: 14px; line-height: 1.6;">تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في أَثَر.</p>
          <p style="font-size: 14px; line-height: 1.6;">اضغط على الزر التالي لتعيين كلمة مرور جديدة لحسابك:</p>
          <a href="${redirect_to}?token_hash=${token_hash}&type=recovery" style="display: inline-block; background-color: #0077CC; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 99px; font-weight: bold; font-size: 14px; margin-top: 12px;">تعيين كلمة المرور 🔑</a>
          <p style="font-size: 12px; color: #4b5566; margin-top: 16px;">إذا لم تطلب هذا، يمكنك تجاهل هذه الرسالة بأمان.</p>
      `;
    }

    bodyHtml += `
          <hr style="border: none; border-top: 1px solid #d6dbe6; margin: 24px 0 12px;" />
          <p style="font-size: 11px; color: #8791a3; text-align: center;">أَثَر — مشروع صدقة جارية مجاني لطلاب الثانوية العامة.</p>
        </div>
      </div>
    `;

    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: senderEmail,
        to: recipient,
        subject,
        html: bodyHtml
      })
    });

    const sendData = await sendRes.json();
    return new Response(JSON.stringify(sendData), {
      status: sendRes.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
