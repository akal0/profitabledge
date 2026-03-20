import { getServerEnv } from "./env";

type ResendSendResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

type SendResendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveWebBaseUrl() {
  const env = getServerEnv();
  return env.WEB_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function buildJournalSharePath(shareToken: string) {
  return `/share/journal/${shareToken}`;
}

export function buildJournalShareUrl(shareToken: string) {
  return new URL(buildJournalSharePath(shareToken), resolveWebBaseUrl()).toString();
}

async function sendResendEmail({
  to,
  subject,
  html,
  text,
}: SendResendEmailInput): Promise<ResendSendResult> {
  const env = getServerEnv();
  const recipients = (Array.isArray(to) ? to : [to])
    .map((value) => value.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      sent: false,
      skipped: true,
      error: "No recipient email address was provided.",
    };
  }

  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return {
      sent: false,
      skipped: true,
      error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not configured.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: recipients,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        sent: false,
        error: `Resend responded with ${response.status}: ${body}`,
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown Resend error",
    };
  }
}

export async function sendJournalShareInviteEmail(input: {
  recipientEmail: string;
  inviterName: string;
  shareName: string;
  shareToken: string;
}) {
  const shareUrl = buildJournalShareUrl(input.shareToken);
  const inviterName = escapeHtml(input.inviterName);
  const shareName = escapeHtml(input.shareName);

  return sendResendEmail({
    to: input.recipientEmail,
    subject: `${input.inviterName} invited you to a private journal share`,
    text: `${input.inviterName} invited you to view "${input.shareName}" on Profitabledge.\n\nOpen the private share: ${shareUrl}\n\nYou will need to sign in with the invited email to access it.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">Private journal share</h2>
        <p style="margin: 0 0 12px;">
          <strong>${inviterName}</strong> invited you to view
          <strong>${shareName}</strong> on Profitabledge.
        </p>
        <p style="margin: 0 0 16px;">
          Sign in with the invited email address to access the share.
        </p>
        <p style="margin: 0 0 16px;">
          <a href="${shareUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
            Open private share
          </a>
        </p>
        <p style="margin: 0; color: #6b7280;">If the button does not work, open this link: ${escapeHtml(shareUrl)}</p>
      </div>
    `,
  });
}

export async function sendJournalShareAccessRequestEmail(input: {
  ownerEmail: string;
  ownerName?: string | null;
  requesterName: string;
  requesterEmail: string;
  shareName: string;
  shareToken: string;
}) {
  const shareUrl = buildJournalShareUrl(input.shareToken);
  const shareName = escapeHtml(input.shareName);
  const requesterName = escapeHtml(input.requesterName);
  const requesterEmail = escapeHtml(input.requesterEmail);

  return sendResendEmail({
    to: input.ownerEmail,
    subject: `${input.requesterName} requested access to "${input.shareName}"`,
    text: `${input.requesterName} (${input.requesterEmail}) requested access to "${input.shareName}".\n\nReview the request in your journal share settings.\nShare link: ${shareUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">New journal share access request</h2>
        <p style="margin: 0 0 12px;">
          <strong>${requesterName}</strong> (${requesterEmail}) requested access to
          <strong>${shareName}</strong>.
        </p>
        <p style="margin: 0 0 16px;">Review the request in your journal share settings.</p>
        <p style="margin: 0 0 16px;">
          <a href="${shareUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
            Open share
          </a>
        </p>
        <p style="margin: 0; color: #6b7280;">Share link: ${escapeHtml(shareUrl)}</p>
      </div>
    `,
  });
}

export async function sendJournalShareApprovedEmail(input: {
  recipientEmail: string;
  approverName: string;
  shareName: string;
  shareToken: string;
}) {
  const shareUrl = buildJournalShareUrl(input.shareToken);
  const approverName = escapeHtml(input.approverName);
  const shareName = escapeHtml(input.shareName);

  return sendResendEmail({
    to: input.recipientEmail,
    subject: `${input.approverName} approved your journal share access`,
    text: `${input.approverName} approved your access to "${input.shareName}".\n\nOpen the share: ${shareUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2 style="margin: 0 0 12px;">Access approved</h2>
        <p style="margin: 0 0 12px;">
          <strong>${approverName}</strong> approved your access to
          <strong>${shareName}</strong>.
        </p>
        <p style="margin: 0 0 16px;">
          <a href="${shareUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 10px 16px; text-decoration: none; border-radius: 6px;">
            Open share
          </a>
        </p>
        <p style="margin: 0; color: #6b7280;">If the button does not work, open this link: ${escapeHtml(shareUrl)}</p>
      </div>
    `,
  });
}
