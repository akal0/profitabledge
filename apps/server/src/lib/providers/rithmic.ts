export const RITHMIC_PROVIDER_INFO = {
  name: "Rithmic",
  description:
    "Worker-managed Rithmic integration over the protocol API with account discovery, order-history ingestion, and open-position snapshots.",
  authType: "credentials",
  fields: ["login", "password", "systemName", "fcmId"],
  status: "active",
  capabilities: {
    connect: {
      supported: true,
      readiness: "implemented",
      note: "Rithmic connections are created through the broker worker queue.",
    },
    disconnect: {
      supported: true,
      readiness: "implemented",
      note: "Rithmic worker sessions are released after each sync loop.",
    },
    fetchHistory: {
      supported: true,
      readiness: "implemented",
      note: "Rithmic closed trades are reconstructed from worker-ingested order history.",
    },
    fetchOpenPositions: {
      supported: true,
      readiness: "implemented",
      note: "Rithmic open positions are ingested through the worker bridge.",
    },
    fetchAccountInfo: {
      supported: true,
      readiness: "implemented",
      note: "Rithmic account snapshots are ingested through the worker bridge.",
    },
    exchangeCode: {
      supported: false,
      readiness: "planned",
      note: "Rithmic does not use OAuth.",
    },
    refreshToken: {
      supported: false,
      readiness: "planned",
      note: "Rithmic reconnects with the stored credentials.",
    },
  },
} as const;
