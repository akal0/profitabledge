export type AlphaFeatureKey =
  | "aiAssistant"
  | "community"
  | "connections"
  | "feedback"
  | "supportDiagnostics"
  | "scheduledSync"
  | "mt5Ingestion";

export type AlphaFlags = Record<AlphaFeatureKey, boolean>;

export const ALPHA_FLAG_DEFINITIONS = {
  aiAssistant: { defaultValue: true },
  community: { defaultValue: true },
  connections: { defaultValue: true },
  feedback: { defaultValue: true },
  supportDiagnostics: { defaultValue: true },
  scheduledSync: { defaultValue: true },
  mt5Ingestion: { defaultValue: true },
} as const;

export const ALWAYS_ENABLED_ALPHA_FLAGS: AlphaFlags = {
  aiAssistant: true,
  community: true,
  connections: true,
  feedback: true,
  supportDiagnostics: true,
  scheduledSync: true,
  mt5Ingestion: true,
};

export function resolvePublicAlphaFlags(
  _source?: Record<string, string | undefined>
): AlphaFlags {
  return ALWAYS_ENABLED_ALPHA_FLAGS;
}

export function resolveServerAlphaFlags(
  _source?: Record<string, string | undefined>
): AlphaFlags {
  return ALWAYS_ENABLED_ALPHA_FLAGS;
}

export function getAlphaFlagEnvNames() {
  return [] as Array<{
    serverEnv: string;
    publicEnv: string | null;
    description: string;
  }>;
}

export function isAlphaFeatureEnabled(
  flags: AlphaFlags,
  feature: AlphaFeatureKey
) {
  return Boolean(flags[feature]);
}

export function getAlphaFeatureDisabledMessage(_feature: AlphaFeatureKey) {
  return "This feature is enabled.";
}
