// SMART LTT — service worker KHUSUS push notifikasi (16 Nov 2026).
// Sengaja TANPA handler "fetch" dan tanpa cache: aplikasi tetap tidak punya mode offline,
// semua data selalu diambil langsung dari server.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const judul = data.title || "SMART LTT";
  event.waitUntil(
    self.registration.showNotification(judul, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || undefined, // tag sama → menimpa notifikasi lama, tidak menumpuk
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tujuan = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const jendela = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of jendela) {
        if (new URL(w.url).origin === self.location.origin && "focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(tujuan);
          return;
        }
      }
      await self.clients.openWindow(tujuan);
    })(),
  );
});
