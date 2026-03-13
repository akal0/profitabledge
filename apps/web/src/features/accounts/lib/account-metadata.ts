export type BrokerOption = {
  value: string;
  label: string;
  image: string;
};

type DemoWorkspaceAccountLike = {
  name?: string | null;
  broker?: string | null;
  brokerServer?: string | null;
  accountNumber?: string | number | null;
};

export const BROKER_OPTIONS: BrokerOption[] = [
  { value: "ftmo", label: "FTMO", image: "/brokers/FTMO.png" },
  { value: "fundingpips", label: "FundingPips", image: "/brokers/FTMO.png" },
  {
    value: "alphacapitalgroup",
    label: "AlphaCapitalGroup",
    image: "/brokers/FTMO.png",
  },
  {
    value: "seacrestfunded",
    label: "SeacrestFunded",
    image: "/brokers/FTMO.png",
  },
];

const DEMO_ACCOUNT_NAME = "Demo Account";
const DEMO_BROKER = "ProfitEdge Demo";
const DEMO_BROKER_SERVER = "ProfitEdge-Demo01";
const DEMO_ACCOUNT_PREFIX = "DEMO-";

export function getBrokerImage(broker?: string | null): string {
  switch (broker) {
    case "ftmo":
      return "/brokers/FTMO.png";
    case "myforexfunds":
      return "/brokers/FTMO.png";
    case "fundingpips":
      return "/FTMO.png";
    default:
      return "/brokers/FTMO.png";
  }
}

export function isDemoWorkspaceAccount(
  account: DemoWorkspaceAccountLike
): boolean {
  return (
    account.name === DEMO_ACCOUNT_NAME &&
    account.broker === DEMO_BROKER &&
    account.brokerServer === DEMO_BROKER_SERVER &&
    String(account.accountNumber || "").startsWith(DEMO_ACCOUNT_PREFIX)
  );
}
