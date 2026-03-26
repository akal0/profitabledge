self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "Profitabledge";
      let body = "You have a new notification.";
      let url = "/dashboard/settings/notifications";
      let tag = "profitabledge-notification";

      try {
        const response = await fetch("/api/notifications/push/latest", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) {
          const payload = await response.json();
          const item = payload?.notification;

          if (item) {
            title = item.title || title;
            body = item.body || body;
            url = item.url || url;
            tag = item.id ? `profitabledge-notification-${item.id}` : tag;
          }
        }
      } catch (_error) {
        // Fall back to a generic notification body when the fetch fails.
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        tag,
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification && event.notification.data && event.notification.data.url) ||
    "/dashboard/settings/notifications";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url.includes(self.location.origin)) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
