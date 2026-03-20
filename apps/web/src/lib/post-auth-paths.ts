"use client";

const DEFAULT_POST_AUTH_PATH = "/dashboard";
const AUTH_ROUTE_PREFIXES = ["/login", "/sign-up", "/beta", "/continue"] as const;

function resolveAppRelativePath(
  value: string | null | undefined,
  fallback = DEFAULT_POST_AUTH_PATH
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function matchesPathPrefix(path: string, prefix: string) {
  return (
    path === prefix ||
    path.startsWith(`${prefix}?`) ||
    path.startsWith(`${prefix}/`)
  );
}

export function resolvePostAuthPath(value: string | null | undefined) {
  const safePath = resolveAppRelativePath(value, DEFAULT_POST_AUTH_PATH);
  return AUTH_ROUTE_PREFIXES.some((prefix) => matchesPathPrefix(safePath, prefix))
    ? DEFAULT_POST_AUTH_PATH
    : safePath;
}

export function resolvePostOnboardingPath(value: string | null | undefined) {
  const safePath = resolvePostAuthPath(value);
  return matchesPathPrefix(safePath, "/onboarding")
    ? DEFAULT_POST_AUTH_PATH
    : safePath;
}

export function buildOnboardingPath(returnTo?: string | null) {
  const safeReturnTo = resolvePostOnboardingPath(returnTo);
  if (safeReturnTo === DEFAULT_POST_AUTH_PATH) {
    return "/onboarding";
  }

  const params = new URLSearchParams({ returnTo: safeReturnTo });
  return `/onboarding?${params.toString()}`;
}

export function buildPostAuthContinuePath(returnTo?: string | null) {
  const safeReturnTo = resolvePostAuthPath(returnTo);
  if (safeReturnTo === DEFAULT_POST_AUTH_PATH) {
    return "/continue";
  }

  const params = new URLSearchParams({ returnTo: safeReturnTo });
  return `/continue?${params.toString()}`;
}

export function buildLoginPath(returnTo?: string | null) {
  const safeReturnTo = resolvePostAuthPath(returnTo);
  if (safeReturnTo === DEFAULT_POST_AUTH_PATH) {
    return "/login";
  }

  const params = new URLSearchParams({ returnTo: safeReturnTo });
  return `/login?${params.toString()}`;
}

export function buildSignUpPath(returnTo?: string | null) {
  const safeReturnTo = resolvePostAuthPath(returnTo);
  if (safeReturnTo === DEFAULT_POST_AUTH_PATH) {
    return "/sign-up";
  }

  const params = new URLSearchParams({ returnTo: safeReturnTo });
  return `/sign-up?${params.toString()}`;
}
