import { eq, type InferSelectModel } from "drizzle-orm";

import { db } from "../../db";
import { privateBetaCode } from "../../db/schema/billing";

type PrivateBetaCodeRow = InferSelectModel<typeof privateBetaCode>;

export type PrivateBetaCodeValidationResult =
  | {
      valid: false;
      code: string;
      message: string;
      row: null;
    }
  | {
      valid: true;
      code: string;
      label: string;
      remaining: number | null;
      row: PrivateBetaCodeRow;
    };

export function normalizePrivateBetaCode(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export async function validatePrivateBetaCodeInput(
  input: string
): Promise<PrivateBetaCodeValidationResult> {
  const normalized = normalizePrivateBetaCode(input);

  if (!normalized) {
    return {
      valid: false,
      code: normalized,
      message: "Private beta code is required",
      row: null,
    };
  }

  const [row] = await db
    .select()
    .from(privateBetaCode)
    .where(eq(privateBetaCode.code, normalized))
    .limit(1);

  if (!row || !row.isActive) {
    return {
      valid: false,
      code: normalized,
      message: "Invalid private beta code",
      row: null,
    };
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      code: normalized,
      message: "That private beta code has expired",
      row: null,
    };
  }

  if (
    row.maxRedemptions !== null &&
    row.maxRedemptions !== undefined &&
    row.redeemedCount >= row.maxRedemptions
  ) {
    return {
      valid: false,
      code: normalized,
      message: "That private beta code has already been fully redeemed",
      row: null,
    };
  }

  return {
    valid: true,
    code: normalized,
    label: row.label,
    remaining:
      row.maxRedemptions !== null && row.maxRedemptions !== undefined
        ? Math.max(0, row.maxRedemptions - row.redeemedCount)
        : null,
    row,
  };
}
