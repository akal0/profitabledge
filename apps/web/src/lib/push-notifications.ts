"use client";

import { PROFITABLEDGE_FAVICON_PATH } from "@/lib/brand-assets";

type EnsureWebPushSubscriptionOptions = {
  requestPermission?: boolean;
};

type DesktopNotificationInput = {
  title: string;
  body?: string | null;
  url?: string | null;
  tag?: string;
  requireInteraction?: boolean;
  icon?: string | null;
  badge?: string | null;
};

type PushConfigResponse = {
  supported: boolean;
  publicKey: string | null;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getPushConfig(): Promise<PushConfigResponse> {
  const response = await fetch("/api/notifications/push/config", {
    cache: "no-store",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to load push notification config");
  }

  return response.json();
}

async function getServiceWorkerRegistration() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.register("/push-sw.js");
  return registration;
}

export async function ensureWebPushSubscription(
  options: EnsureWebPushSubscriptionOptions = {}
) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return false;
  }

  let permission = Notification.permission;
  if (permission !== "granted") {
    if (options.requestPermission === false) {
      return false;
    }

    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return false;
  }

  const config = await getPushConfig();
  if (!config.supported || !config.publicKey) {
    throw new Error("Web push is not configured on the server");
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey),
    });
  }

  const response = await fetch("/api/notifications/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });

  if (!response.ok) {
    throw new Error("Failed to save push subscription");
  }

  return true;
}

export async function showDesktopNotification(
  input: DesktopNotificationInput
) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const title = input.title.trim() || "Profitabledge";
  const notificationOptions = {
    body: input.body ?? undefined,
    data: {
      url: input.url || "/dashboard/settings/notifications",
    },
    tag: input.tag,
    icon: input.icon || PROFITABLEDGE_FAVICON_PATH,
    badge: input.badge || input.icon || PROFITABLEDGE_FAVICON_PATH,
    requireInteraction: input.requireInteraction ?? false,
  };

  const registration = await getServiceWorkerRegistration();
  if (registration && typeof registration.showNotification === "function") {
    await registration.showNotification(title, notificationOptions);
    return true;
  }

  const notification = new Notification(title, notificationOptions);
  notification.onclick = () => {
    window.focus();
    const targetUrl = input.url || "/dashboard/settings/notifications";
    window.location.assign(targetUrl);
    notification.close();
  };

  return true;
}

export async function removeWebPushSubscription() {
  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return;
  }

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return;
  }

  await fetch("/api/notifications/push/subscribe", {
    method: "DELETE",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}
