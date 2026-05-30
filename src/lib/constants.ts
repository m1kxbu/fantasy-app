/** NFL primary team colors, used for the "team color spine" on heatmap tiles and dots. */
export const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#552E0E",
  DAL: "#0b2a5b",
  DEN: "#FB4F14",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#0c2c41",
  IND: "#013369",
  JAC: "#107c91",
  KC: "#E31837",
  LV: "#3a3a3a",
  LAC: "#0080C6",
  LAR: "#1f4eb5",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#0a2a55",
  NO: "#9a8557",
  NYG: "#0B2265",
  NYJ: "#1f7a4d",
  PHI: "#006b5b",
  PIT: "#d4a017",
  SF: "#AA0000",
  SEA: "#0a3a6b",
  TB: "#D50A0A",
  TEN: "#2f6fb0",
  WAS: "#5A1414",
};

export const POS_COLORS: Record<string, { c: string; bg: string }> = {
  QB: { c: "#ef4444", bg: "rgba(239,68,68,.16)" },
  RB: { c: "#22c55e", bg: "rgba(34,197,94,.16)" },
  WR: { c: "#3b9bff", bg: "rgba(59,155,255,.16)" },
  TE: { c: "#f59e0b", bg: "rgba(245,158,11,.16)" },
};

export const WINDOWS = ["1D", "7D", "14D", "30D"] as const;
export type Window = (typeof WINDOWS)[number];

/** Color-saturation domain per window — bigger windows accept larger deltas. */
export const DOMAIN: Record<Window, number> = {
  "1D": 5,
  "7D": 11,
  "14D": 18,
  "30D": 28,
};
