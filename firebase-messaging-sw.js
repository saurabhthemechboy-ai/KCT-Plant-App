/* ============================================================
   KCT Plant App — Firebase Cloud Messaging Service Worker
   ------------------------------------------------------------
   Uses the raw Push API — no Firebase SDK inside the SW.
   The page (index.html) obtains the FCM token via Firebase
   and subscribes this device to the topic. The SW only
   receives raw push events and shows notifications.
   ============================================================ */

/* ---------- Push event handler ----------
   Fired whenever the backend sends an FCM message to this device. */
self.addEventListener("push", function (event) {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (e) {
    console.log("[SW] Push payload not JSON:", e.message);
    payload = {};
  }

  console.log("[SW] Push received:", payload);

  /* FCM wraps our data fields inside payload.data (data-only messages). */
  const data = payload.data || payload || {};

  const priority    = data.priority    || "Medium";
  const equipment   = data.equipment   || "—";
  const issueType   = data.issueType   || "";
  const location    = data.location    || "";
  const description = data.description || "";
  const issueId     = data.issueId     || "";

  /* Priority → emoji + vibration pattern. */
  let emoji = "🟡";
  let vibrate = [200];
  if (priority === "Critical")      { emoji = "🔴"; vibrate = [300, 150, 300, 150, 300]; }
  else if (priority === "High")     { emoji = "🟠"; vibrate = [200, 100, 200]; }
  else if (priority === "Medium")   { emoji = "🟡"; vibrate = [200]; }
  else if (priority === "Low")      { emoji = "🟢"; vibrate = [200]; }

  const title = emoji + " " + priority + " — " + equipment;

  let body = issueType;
  if (location) body += " · " + location;
  if (description) {
    const trimmed = description.length > 80
      ? description.substring(0, 77) + "…"
      : description;
    body += "\n" + trimmed;
  }

  const clickUrl = "https://kct-plant-app.web.app/#issue=" + encodeURIComponent(issueId);

  const options = {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "kct_issue_" + issueId,
    renotify: true,
    requireInteraction: priority === "Critical",
    vibrate: vibrate,
    data: { url: clickUrl, issueId: issueId },
    silent: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---------- Notification click handler ----------
   Opens the app and jumps to the issue detail screen. */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "https://kct-plant-app.web.app/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (let i = 0; i < list.length; i++) {
        const client = list[i];
        if (client.url.indexOf("kct-plant-app.web.app") !== -1 &&
            "focus" in client) {
          client.postMessage({ type: "NAVIGATE_ISSUE", url: url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

/* ---------- Force immediate activation ---------- */
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
