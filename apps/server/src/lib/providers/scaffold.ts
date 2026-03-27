import type {
  NormalizedAccountInfo,
  NormalizedPosition,
  NormalizedTrade,
  ProviderCapabilityMap,
  ProviderCredentials,
  ProviderConfig,
  ProviderMethodName,
  ProviderScaffoldMetadata,
  TradingProvider,
} from "./types";

const DEFAULT_SCAFFOLD_NOTE =
  "This provider is scaffolded but not yet wired to a live API.";

export class ProviderMethodUnsupportedError extends Error {
  readonly providerName: string;
  readonly method: ProviderMethodName;
  readonly note: string;

  constructor(
    providerName: string,
    method: ProviderMethodName,
    note: string
  ) {
    super(`${providerName} does not support ${method} yet. ${note}`);
    this.name = "ProviderMethodUnsupportedError";
    this.providerName = providerName;
    this.method = method;
    this.note = note;
  }
}

export function unsupportedProviderMethod(
  providerName: string,
  method: ProviderMethodName,
  note?: string
): never {
  throw new ProviderMethodUnsupportedError(
    providerName,
    method,
    note ?? DEFAULT_SCAFFOLD_NOTE
  );
}

export function createScaffoldCapabilities(
  providerName: string,
  notes: Partial<Record<ProviderMethodName, string>> = {}
): ProviderCapabilityMap {
  const methods: ProviderMethodName[] = [
    "connect",
    "disconnect",
    "fetchHistory",
    "fetchOpenPositions",
    "fetchAccountInfo",
    "exchangeCode",
    "refreshToken",
  ];

  return Object.freeze(
    Object.fromEntries(
      methods.map((method) => [
        method,
        {
          supported: method === "disconnect",
          readiness: method === "disconnect" ? "implemented" : "scaffolded",
          note:
            notes[method] ??
            (method === "disconnect"
              ? `${providerName} is stateless, so disconnect is a no-op.`
              : DEFAULT_SCAFFOLD_NOTE),
      },
      ])
    ) as ProviderCapabilityMap
  );
}

export function createProviderScaffoldMetadata(input: {
  name: string;
  description: string;
  authType: "oauth" | "credentials";
  fields: string[];
  status: "active" | "coming_soon";
  capabilityNotes?: Partial<Record<ProviderMethodName, string>>;
}): ProviderScaffoldMetadata {
  return {
    name: input.name,
    description: input.description,
    authType: input.authType,
    fields: input.fields,
    status: input.status,
    capabilities: createScaffoldCapabilities(input.name, input.capabilityNotes),
  };
}

export abstract class ScaffoldedTradingProvider implements TradingProvider {
  readonly capabilities: ProviderCapabilityMap;

  protected constructor(
    protected readonly providerName: string,
    capabilities: ProviderCapabilityMap
  ) {
    this.capabilities = capabilities;
  }

  async connect(_config: ProviderConfig): Promise<NormalizedAccountInfo> {
    return unsupportedProviderMethod(
      this.providerName,
      "connect",
      this.capabilities.connect?.note
    );
  }

  async disconnect(): Promise<void> {
    return;
  }

  async fetchHistory(
    _config: ProviderConfig,
    _since: Date | null,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedTrade[]> {
    return unsupportedProviderMethod(
      this.providerName,
      "fetchHistory",
      this.capabilities.fetchHistory?.note
    );
  }

  async fetchOpenPositions(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedPosition[]> {
    return unsupportedProviderMethod(
      this.providerName,
      "fetchOpenPositions",
      this.capabilities.fetchOpenPositions?.note
    );
  }

  async fetchAccountInfo(
    _config: ProviderConfig,
    _accountMeta: Record<string, unknown>
  ): Promise<NormalizedAccountInfo> {
    return unsupportedProviderMethod(
      this.providerName,
      "fetchAccountInfo",
      this.capabilities.fetchAccountInfo?.note
    );
  }

  async exchangeCode(
    _code: string,
    _redirectUri: string
  ): Promise<ProviderCredentials> {
    return unsupportedProviderMethod(
      this.providerName,
      "exchangeCode",
      this.capabilities.exchangeCode?.note
    );
  }

  async refreshToken(
    _credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    return unsupportedProviderMethod(
      this.providerName,
      "refreshToken",
      this.capabilities.refreshToken?.note
    );
  }
}
