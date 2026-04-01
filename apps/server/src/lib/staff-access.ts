export const APP_USER_ROLES = [
  "user",
  "ambassador",
  "partner",
  "moderator",
  "admin",
] as const;

export type AppUserRole = (typeof APP_USER_ROLES)[number];

function hasRole(roleValue: string | null | undefined, expectedRole: string) {
  if (!roleValue) {
    return false;
  }

  const normalizedExpectedRole = expectedRole.trim().toLowerCase();

  return roleValue
    .split(",")
    .some((role) => role.trim().toLowerCase() === normalizedExpectedRole);
}

export function getUserRoles(roleValue: string | null | undefined) {
  if (!roleValue) {
    return [] as AppUserRole[];
  }

  return roleValue
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter((role): role is AppUserRole =>
      (APP_USER_ROLES as readonly string[]).includes(role)
    );
}

export function hasAdminAccess(input: {
  role?: string | null;
  email?: string | null;
}) {
  return hasRole(input.role, "admin");
}

export function hasStaffAccess(input: {
  role?: string | null;
  email?: string | null;
}) {
  return hasRole(input.role, "moderator") || hasRole(input.role, "admin");
}

export function hasAmbassadorAccess(input: {
  role?: string | null;
  email?: string | null;
}) {
  return hasRole(input.role, "ambassador");
}

export function hasPartnerAccess(input: {
  role?: string | null;
  email?: string | null;
}) {
  return hasRole(input.role, "partner");
}
