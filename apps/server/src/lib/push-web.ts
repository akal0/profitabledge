import { createPrivateKey, createSign } from "node:crypto";
import { nanoid } from "nanoid";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import {
  buildNotificationPresentation,
  resolveNotificationTargetUrl,
} from "@profitabledge/platform";

import { db } from "../db";
import { notification, pushSubscription } from "../db/schema/notifications";
import { getServerEnv } from "./env";

type StoredPushSubscription = typeof pushSubscription.$inferSelect;
type StoredNotification = typeof notification.$inferSelect;

export type WebPushNotificationItem = {
  id: string;
  title: string;
  body: string | null;
  pushTitle: string;
  pushBody: string;
  type: string;
  url: string;
  requireInteraction: boolean;
  createdAt: string;
};

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function getVapidConfig() {
  const env = getServerEnv();
  const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() || "";
  const subject =
    env.WEB_PUSH_SUBJECT?.trim() || "mailto:support@profitabledge.com";

  return {
    supported: Boolean(publicKey && privateKey),
    publicKey,
    privateKey,
    subject,
  };
}

function createVapidJwt(endpoint: string) {
  const config = getVapidConfig();
  if (!config.supported) {
    throw new Error("Web push VAPID keys are not configured");
  }

  const publicBytes = decodeBase64Url(config.publicKey);
  const privateBytes = decodeBase64Url(config.privateKey);

  if (publicBytes.length !== 65 || publicBytes[0] !== 4 || privateBytes.length !== 32) {
    throw new Error("Invalid VAPID key format");
  }

  const x = publicBytes.subarray(1, 33).toString("base64url");
  const y = publicBytes.subarray(33, 65).toString("base64url");
  const d = privateBytes.toString("base64url");
  const audience = new URL(endpoint).origin;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const header = base64UrlJson({ alg: "ES256", typ: "JWT" });
  const payload = base64UrlJson({
    aud: audience,
    exp: expiration,
    sub: config.subject,
  });
  const unsigned = `${header}.${payload}`;

  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();

  const privateKey = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d,
    },
    format: "jwk",
  });

  const signatureDer = signer.sign(privateKey);
  const signature = derToJose(signatureDer, 64).toString("base64url");

  return `${unsigned}.${signature}`;
}

function derToJose(signature: Buffer, outputLength: number) {
  let offset = 3;
  let rLength = signature[3];

  if (signature[offset] !== 2) {
    throw new Error("Invalid DER signature format");
  }

  offset = 4;
  rLength = signature[offset - 1];
  let r = signature.subarray(offset, offset + rLength);
  offset += rLength + 1;

  if (signature[offset - 1] !== 2) {
    throw new Error("Invalid DER signature format");
  }

  const sLength = signature[offset];
  offset += 1;
  let s = signature.subarray(offset, offset + sLength);

  while (r.length > outputLength / 2 && r[0] === 0) {
    r = r.subarray(1);
  }

  while (s.length > outputLength / 2 && s[0] === 0) {
    s = s.subarray(1);
  }

  if (r.length > outputLength / 2 || s.length > outputLength / 2) {
    throw new Error("Invalid DER signature size");
  }

  const jose = Buffer.alloc(outputLength);
  r.copy(jose, outputLength / 2 - r.length);
  s.copy(jose, outputLength - s.length);
  return jose;
}

function buildNotificationUrl(item: {
  type: string;
  metadata?: Record<string, unknown> | null;
}) {
  return (
    resolveNotificationTargetUrl({
      type: item.type,
      metadata: item.metadata ?? null,
    }) || "/dashboard/settings/notifications"
  );
}

export function getWebPushPublicConfig() {
  const config = getVapidConfig();
  return {
    supported: config.supported,
    publicKey: config.supported ? config.publicKey : null,
  };
}

export async function upsertWebPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  userAgent?: string | null;
}) {
  const existing = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(eq(pushSubscription.endpoint, input.endpoint))
    .limit(1);

  if (existing.length) {
    await db
      .update(pushSubscription)
      .set({
        userId: input.userId,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        userAgent: input.userAgent ?? null,
        updatedAt: new Date(),
        failureReason: null,
      })
      .where(eq(pushSubscription.id, existing[0].id));
    return;
  }

  await db.insert(pushSubscription).values({
    id: nanoid(),
    userId: input.userId,
    endpoint: input.endpoint,
    p256dhKey: input.p256dhKey,
    authKey: input.authKey,
    userAgent: input.userAgent ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function removeWebPushSubscription(input: {
  userId: string;
  endpoint: string;
}) {
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, input.userId),
        eq(pushSubscription.endpoint, input.endpoint)
      )
    );
}

export async function getLatestUnreadNotificationForUser(userId: string) {
  const { notifications } = await getRecentUnreadNotificationsForUser(userId, 1);
  return notifications[0] ?? null;
}

function toWebPushNotificationItem(item: StoredNotification): WebPushNotificationItem {
  const presentation = buildNotificationPresentation({
    title: item.title,
    body: item.body,
    type: item.type,
    metadata: (item.metadata as Record<string, unknown> | null) ?? null,
  });

  return {
    id: item.id,
    title: item.title,
    body: item.body,
    pushTitle: presentation.pushTitle,
    pushBody: presentation.pushBody,
    type: item.type,
    url: buildNotificationUrl({
      type: item.type,
      metadata: (item.metadata as Record<string, unknown> | null) ?? null,
    }),
    requireInteraction: presentation.requireInteraction,
    createdAt: item.createdAt.toISOString(),
  };
}

export async function getRecentUnreadNotificationsForUser(
  userId: string,
  limit: number = 1
) {
  const normalizedLimit = Math.max(1, Math.min(limit, 10));
  const unreadFilter = and(
    eq(notification.userId, userId),
    isNull(notification.readAt)
  );
  const [rows, unreadCountRows] = await Promise.all([
    db
      .select()
      .from(notification)
      .where(unreadFilter)
      .orderBy(desc(notification.createdAt))
      .limit(normalizedLimit),
    db
      .select({ value: count() })
      .from(notification)
      .where(unreadFilter),
  ]);

  return {
    notifications: rows.map((item) => toWebPushNotificationItem(item)),
    unreadCount: Number(unreadCountRows[0]?.value ?? 0),
  };
}

async function sendPushSignal(subscription: StoredPushSubscription) {
  const config = getVapidConfig();
  if (!config.supported) {
    return { ok: false, expired: false, status: 0, reason: "not_configured" };
  }

  const jwt = createVapidJwt(subscription.endpoint);
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      Urgency: "high",
      Authorization: `vapid t=${jwt}, k=${config.publicKey}`,
      "Crypto-Key": `p256ecdsa=${config.publicKey}`,
    },
  });

  return {
    ok: response.ok,
    expired: response.status === 404 || response.status === 410,
    status: response.status,
    reason: response.ok ? null : await response.text(),
  };
}

export async function sendWebPushSignalToUser(userId: string) {
  const config = getVapidConfig();
  if (!config.supported) return;

  const subscriptions = await db
    .select()
    .from(pushSubscription)
    .where(eq(pushSubscription.userId, userId));

  await Promise.all(
    subscriptions.map(async (subscription: StoredPushSubscription) => {
      try {
        const result = await sendPushSignal(subscription);

        if (result.expired) {
          await db
            .delete(pushSubscription)
            .where(eq(pushSubscription.id, subscription.id));
          return;
        }

        if (result.ok) {
          await db
            .update(pushSubscription)
            .set({
              lastSuccessAt: new Date(),
              updatedAt: new Date(),
              failureReason: null,
            })
            .where(eq(pushSubscription.id, subscription.id));
          return;
        }

        await db
          .update(pushSubscription)
          .set({
            lastFailureAt: new Date(),
            updatedAt: new Date(),
            failureReason:
              result.reason?.slice(0, 500) || `Push failed with ${result.status}`,
          })
          .where(eq(pushSubscription.id, subscription.id));
      } catch (error) {
        await db
          .update(pushSubscription)
          .set({
            lastFailureAt: new Date(),
            updatedAt: new Date(),
            failureReason:
              error instanceof Error ? error.message.slice(0, 500) : "Push failed",
          })
          .where(eq(pushSubscription.id, subscription.id));
      }
    })
  );
}
