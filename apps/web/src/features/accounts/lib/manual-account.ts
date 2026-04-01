export type ManualAccountBrokerType =
  | "mt4"
  | "mt5"
  | "ctrader"
  | "dxtrade"
  | "tradovate"
  | "topstepx"
  | "rithmic"
  | "ninjatrader"
  | "other";

export const MANUAL_ACCOUNT_BROKER_TYPE_OPTIONS: Array<{
  value: ManualAccountBrokerType;
  label: string;
}> = [
  { value: "mt4", label: "MetaTrader 4" },
  { value: "mt5", label: "MetaTrader 5" },
  { value: "ctrader", label: "cTrader" },
  { value: "dxtrade", label: "DXTrade" },
  { value: "tradovate", label: "Tradovate" },
  { value: "topstepx", label: "TopstepX" },
  { value: "rithmic", label: "Rithmic" },
  { value: "ninjatrader", label: "NinjaTrader" },
  { value: "other", label: "Other" },
];

export function normalizeBalanceInput(input: string): number | undefined {
  const cleaned = String(input || "").replace(/[^0-9.\-]/g, "");
  if (!cleaned) {
    return undefined;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export async function fileToBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
