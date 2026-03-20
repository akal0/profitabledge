import { trpcClient, trpcOptions } from "@/utils/trpc";

export function getBillingV2Options() {
  return trpcOptions.billing as any;
}

export function getBillingV2Client() {
  return trpcClient.billing as any;
}

