import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { z } from "zod";

import { getServerEnv } from "../env";

export const widgetShareSurfaceSchema = z.union([
  z.object({
    kind: z.literal("calendar"),
    start: z.string().datetime().nullable().optional(),
    end: z.string().datetime().nullable().optional(),
    viewMode: z.enum(["week", "month"]),
    heatmapEnabled: z.boolean().optional(),
    goalOverlay: z.boolean().optional(),
    summaryWidgets: z.array(z.string().min(1)).optional(),
    summaryWidgetSpans: z.record(z.string(), z.number().int()).optional(),
  }),
  z.object({
    kind: z.literal("dashboard"),
    widgets: z.array(z.string().min(1)),
    widgetSpans: z.record(z.string(), z.number().int()).optional(),
    valueMode: z.enum(["usd", "percent", "rr"]).optional(),
    currencyCode: z.string().nullable().optional(),
  }),
  z.object({
    kind: z.literal("chart"),
    widgets: z.array(z.string().min(1)),
    start: z.string().datetime().nullable().optional(),
    end: z.string().datetime().nullable().optional(),
  }),
]);

export type WidgetShareSurfacePayload = z.infer<typeof widgetShareSurfaceSchema>;

const verificationTokenSchema = z.union([
  z.object({
    v: z.literal(1),
    r: z.literal("proof"),
    id: z.string().min(1),
    i: z.number().int().positive(),
    u: z.string().min(1),
    s: z.string().min(1),
    an: z.string().nullable().optional(),
    br: z.string().nullable().optional(),
  }),
  z.object({
    v: z.literal(1),
    r: z.literal("edge"),
    id: z.string().min(1),
    i: z.number().int().positive(),
    u: z.string().nullable().optional(),
    s: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
    on: z.string().nullable().optional(),
  }),
  z.object({
    v: z.literal(1),
    r: z.literal("card"),
    id: z.string().min(1),
    i: z.number().int().positive(),
    sy: z.string().nullable().optional(),
    tt: z.string().nullable().optional(),
    pf: z.number().nullable().optional(),
    rr: z.number().nullable().optional(),
    oc: z.string().nullable().optional(),
  }),
  z.object({
    v: z.literal(1),
    r: z.literal("widget"),
    i: z.number().int().positive(),
    wt: z.string().min(1),
    ws: z.string().nullable().optional(),
    wi: z.string().nullable().optional(),
    tn: z.string().min(1),
    un: z.string().nullable().optional(),
    ui: z.string().nullable().optional(),
    bu: z.string().nullable().optional(),
    bp: z.string().nullable().optional(),
    pe: z
      .object({
        pfpEffect: z.string().nullable().optional(),
        avatarDecoration: z.string().nullable().optional(),
        bannerEffect: z.string().nullable().optional(),
        nameplate: z.string().nullable().optional(),
        nameEffect: z.string().nullable().optional(),
        nameFont: z.string().nullable().optional(),
        nameColor: z.string().nullable().optional(),
        theme: z.string().nullable().optional(),
        customGradientFrom: z.string().nullable().optional(),
        customGradientTo: z.string().nullable().optional(),
        customRingFrom: z.string().nullable().optional(),
        customRingTo: z.string().nullable().optional(),
        customRingEffect: z.string().nullable().optional(),
        customNameplateFrom: z.string().nullable().optional(),
        customNameplateTo: z.string().nullable().optional(),
        customThemeFrom: z.string().nullable().optional(),
        customThemeTo: z.string().nullable().optional(),
        themeAccent: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    an: z.string().min(1),
    br: z.string().nullable().optional(),
    cc: z.string().nullable().optional(),
    ib: z.number().nullable().optional(),
    ab: z.number().nullable().optional(),
    np: z.number().nullable().optional(),
    fp: z.number().nullable().optional(),
    wr: z.number().nullable().optional(),
    tt: z.number().int().nullable().optional(),
    oc: z.number().int().nullable().optional(),
    pf: z.number().nullable().optional(),
  }),
  z.object({
    v: z.literal(2),
    r: z.literal("widget"),
    i: z.number().int().positive(),
    a: z.string().min(1),
    wk: z.string().min(1),
    wt: z.string().min(1),
    an: z.string().min(1),
    br: z.string().nullable().optional(),
    cc: z.string().nullable().optional(),
    ib: z.number().nullable().optional(),
    ab: z.number().nullable().optional(),
    np: z.number().nullable().optional(),
    fp: z.number().nullable().optional(),
    wr: z.number().nullable().optional(),
    tt: z.number().int().nullable().optional(),
    oc: z.number().int().nullable().optional(),
    pf: z.number().nullable().optional(),
    sv: widgetShareSurfaceSchema.nullable().optional(),
  }),
]);

export type VerificationTokenPayload = z.infer<typeof verificationTokenSchema>;

function getVerificationSecret() {
  const env = getServerEnv();

  if (env.SHARE_VERIFICATION_SECRET?.trim()) {
    return env.SHARE_VERIFICATION_SECRET.trim();
  }

  if (env.BETTER_AUTH_SECRET?.trim()) {
    return env.BETTER_AUTH_SECRET.trim();
  }

  if (process.env.NODE_ENV !== "production") {
    return "profitabledge-local-share-verification-secret";
  }

  throw new Error(
    "SHARE_VERIFICATION_SECRET or BETTER_AUTH_SECRET is required in production"
  );
}

function signPayloadSegment(payloadSegment: string) {
  return createHmac("sha256", getVerificationSecret())
    .update(payloadSegment)
    .digest("base64url");
}

function createVerificationToken(payload: VerificationTokenPayload) {
  const payloadJson = JSON.stringify(payload);
  const payloadSegment = `z${deflateRawSync(
    Buffer.from(payloadJson, "utf8"),
    { level: 9 }
  ).toString("base64url")}`;
  const signatureSegment = signPayloadSegment(payloadSegment);
  return `${payloadSegment}.${signatureSegment}`;
}

export function readVerificationToken(token: string) {
  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return null;
  }

  const expectedSignatureSegment = signPayloadSegment(payloadSegment);
  const providedSignature = Buffer.from(signatureSegment, "utf8");
  const expectedSignature = Buffer.from(expectedSignatureSegment, "utf8");

  if (
    providedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(providedSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const parsedPayload =
      payloadSegment.startsWith("z")
        ? inflateRawSync(
            Buffer.from(payloadSegment.slice(1), "base64url")
          ).toString("utf8")
        : Buffer.from(payloadSegment, "base64url").toString("utf8");
    const parsed = JSON.parse(parsedPayload);
    const result = verificationTokenSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function buildVerificationPath(token: string) {
  return `/verify/${token}`;
}

export function buildVerificationCode(token: string) {
  const digest = createHash("sha256")
    .update(token)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();

  return `PE-${digest.slice(0, 5)}-${digest.slice(5)}`;
}

function toVerificationEnvelope(token: string, issuedAtMs: number) {
  return {
    path: buildVerificationPath(token),
    code: buildVerificationCode(token),
    issuedAt: new Date(issuedAtMs).toISOString(),
  };
}

export function issuePublicProofVerification(input: {
  shareId: string;
  username: string;
  publicAccountSlug: string;
  accountName?: string | null;
  broker?: string | null;
}) {
  const issuedAtMs = Date.now();
  const token = createVerificationToken({
    v: 1,
    r: "proof",
    id: input.shareId,
    i: issuedAtMs,
    u: input.username,
    s: input.publicAccountSlug,
    an: input.accountName ?? null,
    br: input.broker ?? null,
  });

  return toVerificationEnvelope(token, issuedAtMs);
}

export function issuePublicEdgeVerification(input: {
  edgeId: string;
  username?: string | null;
  edgeSlug?: string | null;
  edgeName?: string | null;
  ownerName?: string | null;
}) {
  const issuedAtMs = Date.now();
  const token = createVerificationToken({
    v: 1,
    r: "edge",
    id: input.edgeId,
    i: issuedAtMs,
    u: input.username ?? null,
    s: input.edgeSlug ?? null,
    en: input.edgeName ?? null,
    on: input.ownerName ?? null,
  });

  return toVerificationEnvelope(token, issuedAtMs);
}

export function issueSharedCardVerification(input: {
  shareId: string;
  symbol?: string | null;
  tradeType?: string | null;
  profit?: number | null;
  realisedRR?: number | null;
  outcome?: string | null;
}) {
  const issuedAtMs = Date.now();
  const token = createVerificationToken({
    v: 1,
    r: "card",
    id: input.shareId,
    i: issuedAtMs,
    sy: input.symbol ?? null,
    tt: input.tradeType ?? null,
    pf: input.profit ?? null,
    rr: input.realisedRR ?? null,
    oc: input.outcome ?? null,
  });

  return toVerificationEnvelope(token, issuedAtMs);
}

export function issueWidgetShareVerification(input: {
  accountId: string;
  title: string;
  snapshotKey: string;
  surface?: WidgetShareSurfacePayload | null;
  accountName: string;
  broker?: string | null;
  currencyCode?: string | null;
  initialBalance?: number | null;
  accountBalance?: number | null;
  totalPnl?: number | null;
  floatingPnl?: number | null;
  winRate?: number | null;
  totalTrades?: number | null;
  openTradesCount?: number | null;
  profitFactor?: number | null;
}) {
  const issuedAtMs = Date.now();
  const token = createVerificationToken({
    v: 2,
    r: "widget",
    i: issuedAtMs,
    a: input.accountId,
    wk: input.snapshotKey,
    wt: input.title,
    an: input.accountName,
    br: input.broker ?? null,
    cc: input.currencyCode ?? null,
    ib: input.initialBalance ?? null,
    ab: input.accountBalance ?? null,
    np: input.totalPnl ?? null,
    fp: input.floatingPnl ?? null,
    wr: input.winRate ?? null,
    tt:
      input.totalTrades == null ? null : Math.max(0, Math.round(input.totalTrades)),
    oc:
      input.openTradesCount == null
        ? null
        : Math.max(0, Math.round(input.openTradesCount)),
    pf: input.profitFactor ?? null,
    sv: input.surface ?? null,
  });

  return toVerificationEnvelope(token, issuedAtMs);
}
