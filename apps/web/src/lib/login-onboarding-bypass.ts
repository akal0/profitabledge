"use client";

const LOGIN_ONBOARDING_BYPASS_STORAGE_KEY =
  "profitabledge-login-bypass-onboarding";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

export function hasLoginOnboardingBypass() {
  return getStorage()?.getItem(LOGIN_ONBOARDING_BYPASS_STORAGE_KEY) === "1";
}

export function markLoginOnboardingBypass() {
  getStorage()?.setItem(LOGIN_ONBOARDING_BYPASS_STORAGE_KEY, "1");
}

export function clearLoginOnboardingBypass() {
  getStorage()?.removeItem(LOGIN_ONBOARDING_BYPASS_STORAGE_KEY);
}
