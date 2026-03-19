export type OnboardingStep = 1 | 2;

const LEGACY_ONBOARDING_STEP_STORAGE_KEY = "profitabledge-onboarding-step";

function getOnboardingStepStorageKey(userId: string) {
  return `${LEGACY_ONBOARDING_STEP_STORAGE_KEY}:${userId}`;
}

export function getStoredOnboardingStep(
  userId: string | null | undefined
): OnboardingStep | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }

  const raw = window.sessionStorage.getItem(
    getOnboardingStepStorageKey(userId)
  );

  if (raw === "1") {
    return 1;
  }

  if (raw === "2" || raw === "3") {
    return 2;
  }

  return null;
}

export function storeOnboardingStep(
  userId: string | null | undefined,
  step: OnboardingStep
) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  window.sessionStorage.setItem(
    getOnboardingStepStorageKey(userId),
    String(step)
  );
}

export function clearStoredOnboardingStep(userId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LEGACY_ONBOARDING_STEP_STORAGE_KEY);

  if (!userId) {
    return;
  }

  window.sessionStorage.removeItem(getOnboardingStepStorageKey(userId));
}
