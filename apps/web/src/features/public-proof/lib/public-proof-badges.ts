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

export function getAffiliateBadgeClassName(effectVariant?: string | null) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "ring-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "teal_signal":
      return "ring-teal-500/30 bg-teal-500/15 text-teal-200";
    default:
      return "ring-amber-500/30 bg-amber-500/15 text-amber-200";
  }
}

export function getAffiliateBannerOverlayClassName(effectVariant?: string | null) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.42),transparent_38%),radial-gradient(circle_at_top_right,rgba(45,212,191,0.22),transparent_32%)]";
    case "teal_signal":
      return "bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.34),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_34%)]";
    default:
      return "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.4),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_30%)]";
  }
}

export function getAffiliateHighlightClassName(effectVariant?: string | null) {
  switch (effectVariant) {
    case "emerald_aurora":
      return "border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.2),rgba(15,23,42,0.6))] text-emerald-100";
    case "teal_signal":
      return "border-cyan-500/20 bg-[linear-gradient(135deg,rgba(45,212,191,0.18),rgba(8,47,73,0.65))] text-cyan-100";
    default:
      return "border-amber-500/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.18),rgba(20,83,45,0.5))] text-amber-50";
  }
}
