export function getConnectionBadgeClassName(kind?: string | null) {
  switch (kind) {
    case "api_synced":
      return "ring-cyan-500/30 bg-cyan-500/15 text-cyan-300";
    case "mt5_synced":
      return "ring-sky-500/30 bg-sky-500/15 text-sky-300";
    case "mt4_synced":
      return "ring-indigo-500/30 bg-indigo-500/15 text-indigo-300";
    case "ea_synced":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-300";
    case "csv_imported":
      return "ring-amber-500/30 bg-amber-500/15 text-amber-300";
    default:
      return "ring-white/10 bg-white/5 text-white/60";
  }
}

export function getOriginBadgeClassName(originType?: string | null) {
  switch (originType) {
    case "broker_sync":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-300";
    case "csv_import":
      return "ring-amber-500/30 bg-amber-500/15 text-amber-300";
    case "manual_entry":
      return "ring-white/10 bg-white/5 text-white/70";
    default:
      return "ring-white/10 bg-white/5 text-white/55";
  }
}
