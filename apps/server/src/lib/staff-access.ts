function hasRole(roleValue: string | null | undefined, expectedRole: string) {
  if (!roleValue) {
    return false;
  }

  const normalizedExpectedRole = expectedRole.trim().toLowerCase();

  return roleValue
    .split(",")
    .some((role) => role.trim().toLowerCase() === normalizedExpectedRole);
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
