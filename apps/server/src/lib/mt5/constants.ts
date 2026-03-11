export const MT_TERMINAL_PROVIDERS = ["mt5-terminal", "mt4-terminal"] as const;

export function isMtTerminalProvider(provider: string): boolean {
  return MT_TERMINAL_PROVIDERS.includes(
    provider as (typeof MT_TERMINAL_PROVIDERS)[number]
  );
}
