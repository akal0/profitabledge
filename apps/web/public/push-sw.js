self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "Profitabledge";
      let body = "You have a new notification.";
      let url = "/dashboard/settings/notifications";
      let tag = "profitabledge-notification";
      let requireInteraction = false;

      try {
        const response = await fetch("/api/notifications/push/latest?limit=5", {
          credentials: "include",
          cache: "no-store",
        });

        if (response.ok) {
          const payload = await response.json();
          const notifications = Array.isArray(payload?.notifications)
            ? payload.notifications
            : [];
          const item = notifications[0] || payload?.notification;
          const unreadCount =
            typeof payload?.unreadCount === "number"
              ? payload.unreadCount
              : notifications.length;

          if (item) {
            title = item.pushTitle || item.title || title;
            body = item.pushBody || item.body || body;
            url = item.url || url;
            tag = item.id ? `profitabledge-notification-${item.id}` : tag;
            requireInteraction = item.requireInteraction === true;

            const additionalCount = Math.max(unreadCount - 1, 0);
            if (additionalCount > 0) {
              body = (item.pushBody || item.body)
                ? `${item.pushBody || item.body} (${additionalCount} more unread)`
                : `${unreadCount} unread notifications`;
            }
          }
        }
      } catch (_error) {
        // Fall back to a generic notification body when the fetch fails.
      }

      await self.registration.showNotification(title, {
        body,
        data: { url },
        tag,
        icon: "/icon.svg",
        badge: "/icon.svg",
        requireInteraction,
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
