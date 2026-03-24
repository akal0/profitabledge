export type AlphaFeatureKey =
  | "aiAssistant"
  | "community"
  | "connections"
  | "feedback"
  | "supportDiagnostics"
  | "scheduledSync"
  | "mt5Ingestion";

export type AlphaFlags = Record<AlphaFeatureKey, boolean>;

type AlphaFlagDefinition = {
  defaultValue: boolean;
  serverEnv: string;
  publicEnv?: string;
  description: string;
};

export const ALPHA_FLAG_DEFINITIONS: Record<
  AlphaFeatureKey,
  AlphaFlagDefinition
> = {
  aiAssistant: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_AI_ASSISTANT",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_AI_ASSISTANT",
    description: "Controls the assistant UI and assistant server endpoints.",
  },
  community: {
    defaultValue: false,
    serverEnv: "ALPHA_ENABLE_COMMUNITY",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_COMMUNITY",
    description:
      "Controls community surfaces such as feed, leaderboard, achievements, and news.",
  },
  connections: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_CONNECTIONS",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_CONNECTIONS",
    description:
      "Controls broker/platform connection UI and connection mutation paths.",
  },
  feedback: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_FEEDBACK",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_FEEDBACK",
    description: "Controls the in-app alpha feedback flow.",
  },
  supportDiagnostics: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_SUPPORT_DIAGNOSTICS",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_SUPPORT_DIAGNOSTICS",
    description: "Controls the user-facing support and diagnostics page.",
  },
  scheduledSync: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_SCHEDULED_SYNC",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_SCHEDULED_SYNC",
    description: "Controls the scheduled provider sync worker loop.",
  },
  mt5Ingestion: {
    defaultValue: true,
    serverEnv: "ALPHA_ENABLE_MT5_INGESTION",
    publicEnv: "NEXT_PUBLIC_ALPHA_ENABLE_MT5_INGESTION",
    description: "Controls MT5 worker and EA ingestion paths.",
  },
};

function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean
): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return defaultValue;
  }
}

export function resolveAlphaFlags(
  reader: (definition: AlphaFlagDefinition) => string | undefined
): AlphaFlags {
  return (Object.entries(ALPHA_FLAG_DEFINITIONS) as Array<
    [AlphaFeatureKey, AlphaFlagDefinition]
  >).reduce(
    (acc, [key, definition]) => {
      acc[key] = parseBooleanFlag(reader(definition), definition.defaultValue);
      return acc;
    },
    {} as AlphaFlags
  );
}

export function resolvePublicAlphaFlags(
  source: Record<string, string | undefined>
): AlphaFlags {
  return resolveAlphaFlags((definition) =>
    definition.publicEnv ? source[definition.publicEnv] : undefined
  );
}

export function resolveServerAlphaFlags(
  source: Record<string, string | undefined>
): AlphaFlags {
  return resolveAlphaFlags((definition) => source[definition.serverEnv]);
}

export function getAlphaFlagEnvNames() {
  return Object.values(ALPHA_FLAG_DEFINITIONS).map((definition) => ({
    serverEnv: definition.serverEnv,
    publicEnv: definition.publicEnv ?? null,
    description: definition.description,
  }));
}

export function isAlphaFeatureEnabled(
  flags: AlphaFlags,
  feature: AlphaFeatureKey
) {
  return Boolean(flags[feature]);
}

export function getAlphaFeatureDisabledMessage(feature: AlphaFeatureKey) {
  switch (feature) {
    case "aiAssistant":
      return "AI assistant is temporarily unavailable for this alpha environment.";
    case "community":
      return "Community surfaces are currently held back for this alpha environment.";
    case "connections":
      return "Broker and platform connections are temporarily unavailable in this alpha environment.";
    case "feedback":
      return "Feedback capture is temporarily unavailable right now.";
    case "supportDiagnostics":
      return "Support diagnostics are temporarily unavailable right now.";
    case "scheduledSync":
      return "Scheduled sync is disabled for this alpha environment.";
    case "mt5Ingestion":
      return "MT5 ingestion is disabled for this alpha environment.";
    default:
      return "This feature is temporarily unavailable in the current alpha environment.";
  }
}
