export const MT_TERMINAL_PROVIDERS = ["mt5-terminal", "mt4-terminal"] as const;

export const WORKER_MANAGED_PROVIDERS = [
  ...MT_TERMINAL_PROVIDERS,
  "rithmic",
] as const;

export function isMtTerminalProvider(provider: string): boolean {
  return MT_TERMINAL_PROVIDERS.includes(
    provider as (typeof MT_TERMINAL_PROVIDERS)[number]
  );
}

export function isWorkerManagedProvider(provider: string): boolean {
  return WORKER_MANAGED_PROVIDERS.includes(
    provider as (typeof WORKER_MANAGED_PROVIDERS)[number]
  );
}
