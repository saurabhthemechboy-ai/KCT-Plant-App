/* ============================================================
   KCT Plant App — Firebase Cloud Messaging Service Worker
   ------------------------------------------------------------
   - Runs in the background on every subscribed device.
   - Receives FCM messages and shows a system notification.
   - Tapping the notification opens the issue detail in the app.
   - Version pinned to 10.12.5 — do not bump without testing.
   ============================================================ */

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

/* ---------- Firebase config ----------
   These values are PUBLIC. They ship in every Firebase web app.
   Security is enforced by Firebase rules + the backend, not by hiding these. */
firebase.initializeApp({
  apiKey:            "AIzaSyC7m2YQ8QyYd5rLh5nXG7Z4kZq5Zb2Xr9A",
  authDomain:        "kct-plant-app.firebaseapp.com",
  projectId:         "kct-plant-app",
  storageBucket:     "kct-plant-app.appspot.com",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
});

const messaging = firebase.messaging();

/* ---------- Background message handler ----------
   Fired when a push arrives while the app is closed or backgrounded.
   The browser shows a notification ONLY if we call showNotification here
   (or if the backend sends a "notification" payload, which we are NOT doing —
   we send data-only payloads so we control the display exactly). */
messaging.onBackgroundMessage(function (payload) {
  console.log("[SW] Background FCM received:", payload);

  const data = (payload && payload.data) ? payload.data : {};

  const priority    = data.priority    || "Medium";
  const equipment   = data.equipment   || "—";
  const issueType   = data.issueType   || "";
  const location    = data.location    || "";
  const description = data.description || "";
  const issueId     = data.issueId     || "";

  /* Priority → emoji + vibration pattern.
     Critical: three pulses — hard to miss on a plant floor.
     High:     two pulses.
     Medium/Low: single pulse. */
  let emoji = "🟡";
  let vibrate = [200];
  if (priority === "Critical") { emoji = "🔴"; vibrate = [300, 150, 300, 150, 300]; }
  else if (priority === "High") { emoji = "🟠"; vibrate = [200, 100, 200]; }
  else if (priority === "Medium") { emoji = "🟡"; vibrate = [200]; }
  else if (priority === "Low") { emoji = "🟢"; vibrate = [200]; }

  const title = emoji + " " + priority + " — " + equipment;

  /* Body: issue type + location on first line, truncated description on second. */
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
    tag: "kct_issue_" + issueId,   /* new push for same issue replaces old */
    renotify: true,                /* re-vibrate even if tag matches */
    requireInteraction: priority === "Critical",  /* Critical stays on screen */
    vibrate: vibrate,
    data: { url: clickUrl, issueId: issueId },
    silent: false
  };

  return self.registration.showNotification(title, options);
});

/* ---------- Notification click handler ----------
   Opens the app and jumps to the issue detail screen.
   If a tab is already open, focus it and navigate. Otherwise open a new one. */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : "https://kct-plant-app.web.app/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      /* Try to find an existing app window and reuse it. */
      for (let i = 0; i < list.length; i++) {
        const client = list[i];
        if (client.url.indexOf("kct-plant-app.web.app") !== -1 &&
            "focus" in client) {
          /* Ask the open page to navigate — see index.html handler for this message. */
          client.postMessage({ type: "NAVIGATE_ISSUE", url: url });
          return client.focus();
        }
      }
      /* Otherwise open a fresh window. */
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

/* ---------- Force the SW to activate immediately ----------
   Without this, a newly-updated SW sits in "waiting" until all tabs close. */
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});
