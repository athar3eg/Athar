// ============================================
// أَثَر — Push Notifications (Capacitor فقط)
// بيشتغل بس جوه نسخة التطبيق الحقيقية (Android/iOS)، ومفيهوش أي تأثير
// على نسخة المتصفح العادية.
// ============================================

async function initPushNotifications(userId) {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) {
    return; // شغالين في متصفح عادي، مش في التطبيق — تجاهل بأمان
  }

  try {
    const { PushNotifications } = window.Capacitor.Plugins;
    if (!PushNotifications) return;

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== "granted") return;

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      try {
        await sb.from("push_tokens").upsert(
          { user_id: userId, token: token.value, platform: window.Capacitor.getPlatform() },
          { onConflict: "token" }
        );
      } catch (e) {
        console.error("push token save error:", e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err);
    });

    // إشعار وصل والتطبيق مفتوح
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      if (typeof showToast === "function") showToast(notification.title || "إشعار جديد 🔔");
    });
  } catch (e) {
    console.error("initPushNotifications error:", e);
  }
}
